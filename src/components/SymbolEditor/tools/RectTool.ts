
import { BaseTool, type CanvasPoint, type ToolCallbacks } from './BaseTool';
import type { RectPrimitive } from '../../../types/symbol';
import type { GhostShape } from '../types';

export class RectTool extends BaseTool {
  private startPoint: CanvasPoint | null = null;
  private currentPoint: CanvasPoint | null = null;

  onMouseDown(pt: CanvasPoint, _callbacks: ToolCallbacks): void {
    this.startPoint = pt;
    this.currentPoint = pt;
  }

  onMouseMove(pt: CanvasPoint, _callbacks: ToolCallbacks): GhostShape | null {
    if (!this.startPoint) return null;
    this.currentPoint = pt;

    const x = Math.min(this.startPoint.x, this.currentPoint.x);
    const y = Math.min(this.startPoint.y, this.currentPoint.y);
    const width = Math.abs(this.currentPoint.x - this.startPoint.x);
    const height = Math.abs(this.currentPoint.y - this.startPoint.y);

    return {
      kind: 'rect',
      x,
      y,
      width,
      height,
    };
  }

  onMouseUp(pt: CanvasPoint, callbacks: ToolCallbacks): void {
    if (!this.startPoint) return;

    const x = Math.min(this.startPoint.x, pt.x);
    const y = Math.min(this.startPoint.y, pt.y);
    const width = Math.abs(pt.x - this.startPoint.x);
    const height = Math.abs(pt.y - this.startPoint.y);

    if (width > 0 && height > 0) {
      const rect: RectPrimitive = {
        kind: 'rect',
        x,
        y,
        width,
        height,
        stroke: '#cccccc',
        fill: 'none',
        strokeWidth: 1,
      };
      callbacks.onAddPrimitive(rect);
    }

    this.startPoint = null;
    this.currentPoint = null;
  }
}
