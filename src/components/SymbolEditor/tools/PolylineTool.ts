import React from 'react';
import { BaseTool, type CanvasPoint, type ToolCallbacks } from './BaseTool';
import type { PolylinePrimitive } from '../../../types/symbol';

export class PolylineTool extends BaseTool {
  private points: CanvasPoint[] = [];


  onMouseDown(pt: CanvasPoint, _callbacks: ToolCallbacks): void {
    // If this is the first point, add it
    if (this.points.length === 0) {
      this.points.push(pt);
    }
    
    // Add the new point (start of next segment)
    this.points.push(pt);

  }

  onMouseMove(pt: CanvasPoint, _callbacks: ToolCallbacks): React.ReactNode | null {
    if (this.points.length === 0) return null;
    

    
    // Construct points for preview: all committed points + current mouse position
    const previewPoints = [...this.points, pt];
    const pointsStr = previewPoints.map(p => `${p.x},${p.y}`).join(' ');

    return React.createElement('polyline', {
      points: pointsStr,
      stroke: '#cccccc',
      fill: 'none',
      strokeWidth: 1,
      strokeDasharray: '4 4',
    });
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

  private finish(callbacks: ToolCallbacks): void {
    if (this.points.length < 2) {
      this.cancel();
      return;
    }

    // Remove the last point if it's a duplicate (from double click)
    // or if it's just the current cursor position placeholder
    // Actually, onMouseDown adds a point.
    // If we double click, we might have added the same point twice.
    // Let's deduplicate adjacent points.
    const uniquePoints = this.points.filter((p, i) => {
      if (i === 0) return true;
      const prev = this.points[i - 1];
      return p.x !== prev.x || p.y !== prev.y;
    });

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

  }

  cancel(): void {
    this.points = [];

  }
}
