
import { BaseTool, type CanvasPoint, type ToolCallbacks } from './BaseTool';
import type { PolylinePrimitive } from '../../../types/symbol';
import type { GhostShape } from '../types';

/** Distance threshold for snapping to the first point to close the polygon */
const CLOSE_THRESHOLD = 8;

export class PolylineTool extends BaseTool {
  private points: CanvasPoint[] = [];
  /** True when cursor is near the first point (visual hint for closing) */
  private _nearStart = false;
  /**
   * Flag to suppress the next mouseDown from adding a point.
   * Set true after a double-click finishes the polyline, because the browser
   * fires mouseDown before the dblclick event on the second click.
   * We actually handle this differently: we track whether the tool just finished
   * so we don't start a new polyline from the second click of a double-click.
   */
  private _justFinished = false;

  /** Whether the tool is actively placing points (multi-step drawing) */
  override isDrawing(): boolean {
    return this.points.length > 0;
  }

  onMouseDown(pt: CanvasPoint, callbacks: ToolCallbacks): void {
    // After finish, ignore residual mouseDown from double-click sequence
    if (this._justFinished) {
      this._justFinished = false;
      return;
    }

    // Check if clicking near the first point to close polygon
    if (this.points.length >= 3 && this._isNearFirstPoint(pt)) {
      this.finishClosed(callbacks);
      return;
    }

    // First click: place the anchor point
    if (this.points.length === 0) {
      this.points.push({ x: pt.x, y: pt.y });
      return;
    }

    // Subsequent clicks: commit current segment and start a new one
    // Avoid adding duplicate adjacent points
    const last = this.points[this.points.length - 1];
    if (pt.x !== last.x || pt.y !== last.y) {
      this.points.push({ x: pt.x, y: pt.y });
    }
  }

  onMouseMove(pt: CanvasPoint, _callbacks: ToolCallbacks): GhostShape | null {
    if (this.points.length === 0) return null;

    // Check if near first point for close indicator
    this._nearStart = this.points.length >= 3 && this._isNearFirstPoint(pt);

    const previewPoints = [...this.points, { x: pt.x, y: pt.y }];

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
    // No-op for polyline — we commit points on mouseDown and finish on
    // double-click / Enter / close-snap.  The ghost preview persists
    // because isDrawing() returns true.
  }

  onDoubleClick(_pt: CanvasPoint, callbacks: ToolCallbacks): void {
    this.finish(callbacks);
    // Flag so the residual mouseDown from the second click of the
    // double-click doesn't start a brand-new polyline.
    this._justFinished = true;
  }

  onKeyDown(e: KeyboardEvent, callbacks: ToolCallbacks): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.finish(callbacks);
    } else if (e.key === 'Escape') {
      this.cancel();
      callbacks.dispatch({ type: 'MARK_DIRTY' }); // Force re-render to clear preview
    } else if (e.key === 'Backspace' && this.points.length > 1) {
      // Remove the last placed point (undo last segment)
      e.preventDefault();
      this.points.pop();
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
    this._justFinished = false;
  }
}
