/**
 * LineTool — Simple Two-Point Line Drawing Tool
 *
 * Draws a single straight line segment (implemented as a 2-point PolylinePrimitive).
 * Interaction:
 *   1. Mouse-down → anchor the start point
 *   2. Mouse-move → live preview of the line from start to cursor
 *   3. Mouse-up   → commit the line as a PolylinePrimitive
 *   Escape        → cancel the current line
 */

import { BaseTool, type CanvasPoint, type ToolCallbacks } from './BaseTool';
import type { PolylinePrimitive } from '../../../types/symbol';
import type { GhostShape } from '../types';

export class LineTool extends BaseTool {
  private startPoint: CanvasPoint | null = null;

  onMouseDown(pt: CanvasPoint, _callbacks: ToolCallbacks): void {
    this.startPoint = pt;
  }

  onMouseMove(pt: CanvasPoint, _callbacks: ToolCallbacks): GhostShape | null {
    if (!this.startPoint) return null;
    return {
      kind: 'polyline',
      points: [this.startPoint, pt],
    };
  }

  onMouseUp(pt: CanvasPoint, callbacks: ToolCallbacks): void {
    if (!this.startPoint) return;

    const dx = pt.x - this.startPoint.x;
    const dy = pt.y - this.startPoint.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len > 0) {
      const line: PolylinePrimitive = {
        kind: 'polyline',
        points: [
          { x: this.startPoint.x, y: this.startPoint.y },
          { x: pt.x, y: pt.y },
        ],
        stroke: '#cccccc',
        fill: 'none',
        strokeWidth: 1,
      };
      callbacks.onAddPrimitive(line);
    }

    this.startPoint = null;
  }

  onKeyDown(e: KeyboardEvent, _callbacks: ToolCallbacks): void {
    if (e.key === 'Escape') this.cancel();
  }

  cancel(): void {
    this.startPoint = null;
  }
}
