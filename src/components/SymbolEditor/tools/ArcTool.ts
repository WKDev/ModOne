
import { BaseTool, type CanvasPoint, type ToolCallbacks } from './BaseTool';
import type { ArcPrimitive } from '../../../types/symbol';
import type { GhostShape } from '../types';

export class ArcTool extends BaseTool {
  private step: 0 | 1 | 2 = 0;
  private center: CanvasPoint | null = null;
  private radius: number = 0;
  private startAngle: number = 0;

  onMouseDown(pt: CanvasPoint, callbacks: ToolCallbacks): void {
    if (this.step === 0) {
      this.center = pt;
      this.step = 1;
    } else if (this.step === 1) {
      if (!this.center) return;
      this.radius = Math.sqrt(
        Math.pow(pt.x - this.center.x, 2) + Math.pow(pt.y - this.center.y, 2)
      );
      this.startAngle = Math.atan2(pt.y - this.center.y, pt.x - this.center.x) * 180 / Math.PI;
      this.step = 2;
    } else if (this.step === 2) {
      if (!this.center) return;
      const endAngle = Math.atan2(pt.y - this.center.y, pt.x - this.center.x) * 180 / Math.PI;
      
      const arc: ArcPrimitive = {
        kind: 'arc',
        cx: this.center.x,
        cy: this.center.y,
        r: this.radius,
        startAngle: this.startAngle,
        endAngle: endAngle,
        stroke: '#cccccc',
        fill: 'none',
        strokeWidth: 1,
      };
      callbacks.onAddPrimitive(arc);
      this.reset();
    }
  }

  onMouseMove(pt: CanvasPoint, _callbacks: ToolCallbacks): GhostShape | null {
    if (this.step === 0) return null;
    if (!this.center) return null;

    if (this.step === 1) {
      return {
        kind: 'line',
        x1: this.center.x,
        y1: this.center.y,
        x2: pt.x,
        y2: pt.y,
      };
    } else if (this.step === 2) {
      const currentAngle = Math.atan2(pt.y - this.center.y, pt.x - this.center.x) * 180 / Math.PI;
      return {
        kind: 'arc',
        cx: this.center.x,
        cy: this.center.y,
        r: this.radius,
        startAngle: this.startAngle,
        endAngle: currentAngle,
      };
    }
    return null;
  }

  onMouseUp(_pt: CanvasPoint, _callbacks: ToolCallbacks): void {
    // No-op
  }

  cancel(): void {
    this.reset();
  }

  private reset(): void {
    this.step = 0;
    this.center = null;
    this.radius = 0;
    this.startAngle = 0;
  }


}
