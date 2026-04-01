
import { BaseTool, type CanvasPoint, type ToolCallbacks } from './BaseTool';
import type { PolylinePrimitive } from '../../../types/symbol';
import type { GhostShape } from '../types';

/** Distance threshold for snapping to the first point to close the polygon */
const CLOSE_THRESHOLD = 8;

export class PolylineTool extends BaseTool {
  private points: CanvasPoint[] = [];
  /** True when cursor is near the first point (visual hint for closing) */
  private _nearStart = false;

  onMouseDown(pt: CanvasPoint, callbacks: ToolCallbacks): void {
    // Check if clicking near the first point to close polygon
    if (this.points.length >= 3 && this._isNearFirstPoint(pt)) {
      this.finishClosed(callbacks);
      return;
    }

    // If this is the first point, add it
    if (this.points.length === 0) {
      this.points.push(pt);
    }

    // Add the new point (start of next segment)
    this.points.push(pt);
  }

  onMouseMove(pt: CanvasPoint, _callbacks: ToolCallbacks): GhostShape | null {
    if (this.points.length === 0) return null;

    // Check if near first point for close indicator
    this._nearStart = this.points.length >= 3 && this._isNearFirstPoint(pt);

    const previewPoints = [...this.points, pt];

    // If near start, also add the first point to show the closing segment
    if (this._nearStart) {
      previewPoints.push({ x: this.points[0].x, y: this.points[0].y });
    }

    return {
      kind: 'polyline',
      points: previewPoints,
    };
  }

  onMouseUp(_pt: CanvasPoint, _callbacks: ToolCallbacks): void {
    // No-op for polyline, we wait for next click or finish
  }

  onDoubleClick(_pt: CanvasPoint, callbacks: ToolCallbacks): void {
    this.finish(callbacks);
  }

  onKeyDown(e: KeyboardEvent, callbacks: ToolCallbacks): void {
    if (e.key === 'Enter') {
      this.finish(callbacks);
    } else if (e.key === 'Escape') {
      this.cancel();
      callbacks.dispatch({ type: 'MARK_DIRTY' }); // Force re-render to clear preview
    }
  }

  private _isNearFirstPoint(pt: CanvasPoint): boolean {
    if (this.points.length === 0) return false;
    const first = this.points[0];
    const dx = pt.x - first.x;
    const dy = pt.y - first.y;
    return Math.sqrt(dx * dx + dy * dy) <= CLOSE_THRESHOLD;
  }

  /** Finish as a closed polygon */
  private finishClosed(callbacks: ToolCallbacks): void {
    if (this.points.length < 3) {
      this.cancel();
      return;
    }

    const uniquePoints = this._deduplicatePoints(this.points);

    if (uniquePoints.length >= 3) {
      const polyline: PolylinePrimitive = {
        kind: 'polyline',
        points: uniquePoints,
        stroke: '#cccccc',
        fill: 'none',
        strokeWidth: 1,
        closed: true,
      };
      callbacks.onAddPrimitive(polyline);
    }

    this.points = [];
    this._nearStart = false;
  }

  /** Finish as an open polyline */
  private finish(callbacks: ToolCallbacks): void {
    if (this.points.length < 2) {
      this.cancel();
      return;
    }

    const uniquePoints = this._deduplicatePoints(this.points);

    if (uniquePoints.length >= 2) {
      const polyline: PolylinePrimitive = {
        kind: 'polyline',
        points: uniquePoints,
        stroke: '#cccccc',
        fill: 'none',
        strokeWidth: 1,
      };
      callbacks.onAddPrimitive(polyline);
    }

    this.points = [];
    this._nearStart = false;
  }

  /** Remove adjacent duplicate points */
  private _deduplicatePoints(pts: CanvasPoint[]): CanvasPoint[] {
    return pts.filter((p, i) => {
      if (i === 0) return true;
      const prev = pts[i - 1];
      return p.x !== prev.x || p.y !== prev.y;
    });
  }

  cancel(): void {
    this.points = [];
    this._nearStart = false;
  }
}
