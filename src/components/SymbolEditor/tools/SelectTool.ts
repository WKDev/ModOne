
import { BaseTool, type CanvasPoint, type ToolCallbacks } from './BaseTool';
import type { GraphicPrimitive } from '../../../types/symbol';
import type { GhostShape } from '../types';

export class SelectTool extends BaseTool {
  private startPoint: CanvasPoint | null = null;
  private currentPoint: CanvasPoint | null = null;
  private isDragging = false;

  onMouseDown(pt: CanvasPoint, callbacks: ToolCallbacks): void {
    this.startPoint = pt;
    this.currentPoint = pt;
    this.isDragging = false;

    // Check for hit on existing primitives
    // We iterate in reverse order (top-most first)
    const graphics = callbacks.symbol?.graphics || [];
    let hitId: string | null = null;

    for (let i = graphics.length - 1; i >= 0; i--) {
      if (this.hitTest(pt, graphics[i])) {
        hitId = `g-${i}`;
        break;
      }
    }

    if (hitId) {
      // If we hit something, select it
      // TODO: Handle multi-select with Shift/Ctrl
      callbacks.dispatch({ type: 'SELECT', ids: [hitId] });
    } else {
      // If we didn't hit anything, start drag selection
      // But we don't deselect immediately on mouse down, usually on mouse up if no drag occurred
      // However, for now, let's assume drag starts immediately
      this.isDragging = true;
      callbacks.dispatch({ type: 'DESELECT_ALL' });
    }
  }

  onMouseMove(pt: CanvasPoint, _callbacks: ToolCallbacks): GhostShape | null {
    if (!this.startPoint || !this.isDragging) return null;
    this.currentPoint = pt;

    const x = Math.min(this.startPoint.x, this.currentPoint.x);
    const y = Math.min(this.startPoint.y, this.currentPoint.y);
    const width = Math.abs(this.currentPoint.x - this.startPoint.x);
    const height = Math.abs(this.currentPoint.y - this.startPoint.y);

    return {
      kind: 'marquee',
      x,
      y,
      width,
      height,
    };
  }

  onMouseUp(pt: CanvasPoint, callbacks: ToolCallbacks): void {
    if (this.isDragging && this.startPoint) {
      // Box selection
      const x1 = Math.min(this.startPoint.x, pt.x);
      const y1 = Math.min(this.startPoint.y, pt.y);
      const x2 = Math.max(this.startPoint.x, pt.x);
      const y2 = Math.max(this.startPoint.y, pt.y);

      const graphics = callbacks.symbol?.graphics || [];
      const selectedIds: string[] = [];

      graphics.forEach((prim, i) => {
        if (this.boxHitTest(prim, x1, y1, x2, y2)) {
          selectedIds.push(`g-${i}`);
        }
      });

      if (selectedIds.length > 0) {
        callbacks.dispatch({ type: 'SELECT', ids: selectedIds });
      }
    }

    this.startPoint = null;
    this.currentPoint = null;
    this.isDragging = false;
  }

  private hitTest(pt: CanvasPoint, prim: GraphicPrimitive): boolean {
    const TOLERANCE = 5;
    switch (prim.kind) {
      case 'rect':
        return (
          pt.x >= prim.x &&
          pt.x <= prim.x + prim.width &&
          pt.y >= prim.y &&
          pt.y <= prim.y + prim.height
        );
      case 'circle': {
        const dist = Math.sqrt(Math.pow(pt.x - prim.cx, 2) + Math.pow(pt.y - prim.cy, 2));
        return dist <= prim.r + TOLERANCE && dist >= prim.r - TOLERANCE; // Stroke hit
        // Or fill hit? Default fill is 'none'. So stroke hit.
      }
      case 'polyline':
        // Check distance to each segment
        for (let i = 0; i < prim.points.length - 1; i++) {
          if (this.distToSegment(pt, prim.points[i], prim.points[i + 1]) <= TOLERANCE) {
            return true;
          }
        }
        return false;
      case 'arc':
        // Check distance to center is approx radius AND angle is within range
        const dist = Math.sqrt(Math.pow(pt.x - prim.cx, 2) + Math.pow(pt.y - prim.cy, 2));
        if (dist > prim.r + TOLERANCE || dist < prim.r - TOLERANCE) return false;
        
        const angle = Math.atan2(pt.y - prim.cy, pt.x - prim.cx) * 180 / Math.PI;
        const normAngle = (angle % 360 + 360) % 360;
        const startNorm = (prim.startAngle % 360 + 360) % 360;
        const endNorm = (prim.endAngle % 360 + 360) % 360;
        
        if (startNorm <= endNorm) {
          return normAngle >= startNorm && normAngle <= endNorm;
        } else {
          return normAngle >= startNorm || normAngle <= endNorm;
        }
      case 'text':
        // Approx bounding box
        // Assuming monospace font with approx 0.6 aspect ratio per char
        const charWidth = prim.fontSize * 0.6;
        const width = prim.text.length * charWidth;
        const height = prim.fontSize;
        // Anchor handling
        let x = prim.x;
        if (prim.anchor === 'middle') x -= width / 2;
        if (prim.anchor === 'end') x -= width;
        
        return (
          pt.x >= x &&
          pt.x <= x + width &&
          pt.y >= prim.y - height && // SVG text y is baseline
          pt.y <= prim.y + height * 0.2 // Descent
        );
      default:
        return false;
    }
  }

  private boxHitTest(prim: GraphicPrimitive, x1: number, y1: number, x2: number, y2: number): boolean {
    // Simple bounding box check for selection
    switch (prim.kind) {
      case 'rect':
        return (
          prim.x >= x1 && prim.x + prim.width <= x2 &&
          prim.y >= y1 && prim.y + prim.height <= y2
        );
      case 'circle':
        return (
          prim.cx - prim.r >= x1 && prim.cx + prim.r <= x2 &&
          prim.cy - prim.r >= y1 && prim.cy + prim.r <= y2
        );
      case 'polyline':
        return prim.points.every(p => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2);
      case 'arc':
        // Simplified: check center +/- radius
        return (
          prim.cx - prim.r >= x1 && prim.cx + prim.r <= x2 &&
          prim.cy - prim.r >= y1 && prim.cy + prim.r <= y2
        );
      case 'text':
        return (
          prim.x >= x1 && prim.x <= x2 &&
          prim.y >= y1 && prim.y <= y2
        );
      default:
        return false;
    }
  }

  private distToSegment(p: CanvasPoint, v: CanvasPoint, w: CanvasPoint): number {
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
    if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt(
      Math.pow(p.x - (v.x + t * (w.x - v.x)), 2) +
      Math.pow(p.y - (v.y + t * (w.y - v.y)), 2)
    );
  }
}
