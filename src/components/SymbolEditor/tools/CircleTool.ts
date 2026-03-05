import React from 'react';
import { BaseTool, type CanvasPoint, type ToolCallbacks } from './BaseTool';
import type { CirclePrimitive } from '../../../types/symbol';

export class CircleTool extends BaseTool {
  private centerPoint: CanvasPoint | null = null;
  private currentPoint: CanvasPoint | null = null;

  onMouseDown(pt: CanvasPoint, _callbacks: ToolCallbacks): void {
    this.centerPoint = pt;
    this.currentPoint = pt;
  }

  onMouseMove(pt: CanvasPoint, _callbacks: ToolCallbacks): React.ReactNode | null {
    if (!this.centerPoint) return null;
    this.currentPoint = pt;

    const r = Math.sqrt(
      Math.pow(this.currentPoint.x - this.centerPoint.x, 2) +
      Math.pow(this.currentPoint.y - this.centerPoint.y, 2)
    );

    return React.createElement('circle', {
      cx: this.centerPoint.x,
      cy: this.centerPoint.y,
      r,
      stroke: '#cccccc',
      fill: 'none',
      strokeWidth: 1,
      strokeDasharray: '4 4',
    });
  }

  onMouseUp(pt: CanvasPoint, callbacks: ToolCallbacks): void {
    if (!this.centerPoint) return;

    const r = Math.sqrt(
      Math.pow(pt.x - this.centerPoint.x, 2) +
      Math.pow(pt.y - this.centerPoint.y, 2)
    );

    if (r > 0) {
      const circle: CirclePrimitive = {
        kind: 'circle',
        cx: this.centerPoint.x,
        cy: this.centerPoint.y,
        r,
        stroke: '#cccccc',
        fill: 'none',
        strokeWidth: 1,
      };
      callbacks.onAddPrimitive(circle);
    }

    this.centerPoint = null;
    this.currentPoint = null;
  }
}
