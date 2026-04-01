/**
 * SelectTool — Selection, Move, Resize & Rotate Tool for Symbol Editor
 *
 * Handles five distinct interaction modes:
 *
 * 1. Marquee (rubber-band) selection
 *    - Click on empty canvas → deselect all
 *    - Drag on empty canvas → draw blue dashed marquee; on mouseup select
 *      all primitives/pins whose bounding box is fully inside the marquee.
 *
 * 2. Click selection
 *    - Click on an unselected primitive/pin → select it (deselect others)
 *    - Click on an already-selected item → enters pending state
 *
 * 3. Drag-to-move
 *    - Mouse-down on an already-selected item → enter "pending" state
 *    - If the pointer moves more than MOVE_THRESHOLD → transition to "moving"
 *    - On mouseup in "moving" state → commit via callbacks.onMovePrimitives / onMovePins
 *    - Arrow keys → nudge selected items by 1 (or 10 with Shift)
 *
 * 4. Resize via handles (AC2-AC5, AC7)
 *    - When a single resizable primitive is selected, 8 handles appear
 *    - Dragging a handle enters "resizing" state
 *    - Shift+drag = aspect ratio lock (AC4)
 *    - Alt+drag = center-based resize (AC5)
 *    - Minimum size 10x10px enforced (AC7)
 *
 * 5. Rotate via handle (AC6)
 *    - Rotation handle above top-center of selection
 *    - Shift+rotate = 45° snap
 */

import { BaseTool, type CanvasPoint, type ToolCallbacks } from './BaseTool';
import type { GraphicPrimitive, SymbolPin, PolylinePrimitive } from '../../../types/symbol';
import type { GhostShape } from '../types';
import type { HandleType } from '../renderers/OverlayRenderer';

// ============================================================================
// Internal state machine
// ============================================================================

type SelectState =
  | 'idle'
  | 'pending'    // mousedown on selected item — waiting to see if it becomes a move
  | 'marquee'    // dragging a rubber-band selection box
  | 'moving'     // dragging selected items
  | 'resizing'   // dragging a resize handle
  | 'rotating'   // dragging the rotation handle
  | 'point-move'; // dragging a polyline vertex in point-edit mode

/** Minimum canvas-unit movement required to start a move */
const MOVE_THRESHOLD = 3;

/** Minimum primitive size in canvas units (AC7) */
const MIN_SIZE = 10;

/** Hit radius for polyline point handles in point-edit mode */
const POINT_HIT_RADIUS = 6;

/** Distance threshold for hitting a polyline segment (to insert a point) */
const SEGMENT_HIT_TOL = 5;

// ============================================================================
// Bounding-box helpers
// ============================================================================

interface BBox { x: number; y: number; w: number; h: number }

function primitiveBBox(prim: GraphicPrimitive): BBox | null {
  switch (prim.kind) {
    case 'rect':
      return { x: prim.x, y: prim.y, w: prim.width, h: prim.height };
    case 'circle':
      return { x: prim.cx - prim.r, y: prim.cy - prim.r, w: prim.r * 2, h: prim.r * 2 };
    case 'polyline': {
      if (prim.points.length === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of prim.points) {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    case 'arc':
      return { x: prim.cx - prim.r, y: prim.cy - prim.r, w: prim.r * 2, h: prim.r * 2 };
    case 'text': {
      const approxW = prim.text.length * prim.fontSize * 0.6;
      return { x: prim.x, y: prim.y - prim.fontSize, w: approxW, h: prim.fontSize * 1.2 };
    }
    default:
      return null;
  }
}

function pinBBox(pin: SymbolPin): BBox {
  const dirs: Record<SymbolPin['orientation'], { dx: number; dy: number }> = {
    right: { dx: 1, dy: 0 }, left: { dx: -1, dy: 0 },
    up: { dx: 0, dy: -1 },   down: { dx: 0, dy: 1 },
  };
  const d = dirs[pin.orientation];
  const endX = pin.position.x + d.dx * pin.length;
  const endY = pin.position.y + d.dy * pin.length;
  return {
    x: Math.min(pin.position.x, endX),
    y: Math.min(pin.position.y, endY),
    w: Math.max(Math.abs(endX - pin.position.x), 4),
    h: Math.max(Math.abs(endY - pin.position.y), 4),
  };
}

function selectedBBox(
  graphics: GraphicPrimitive[],
  pins: SymbolPin[],
  selectedIds: Set<string>,
): BBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  graphics.forEach((prim, i) => {
    if (!selectedIds.has(`g-${i}`)) return;
    const bb = primitiveBBox(prim);
    if (!bb) return;
    minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y);
    maxX = Math.max(maxX, bb.x + bb.w); maxY = Math.max(maxY, bb.y + bb.h);
  });
  pins.forEach((pin) => {
    if (!selectedIds.has(pin.id)) return;
    const bb = pinBBox(pin);
    minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y);
    maxX = Math.max(maxX, bb.x + bb.w); maxY = Math.max(maxY, bb.y + bb.h);
  });
  if (!isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ============================================================================
// Hit-testing helpers
// ============================================================================

const HIT_TOL = 5;

function distToSegment(p: CanvasPoint, v: CanvasPoint, w: CanvasPoint): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2);
}

function hitTestPrimitive(pt: CanvasPoint, prim: GraphicPrimitive): boolean {
  switch (prim.kind) {
    case 'rect': {
      const hasFill = prim.fill && prim.fill !== 'none';
      if (hasFill) {
        return pt.x >= prim.x && pt.x <= prim.x + prim.width &&
               pt.y >= prim.y && pt.y <= prim.y + prim.height;
      }
      // Stroke-only: check each edge
      const tl: CanvasPoint = { x: prim.x, y: prim.y };
      const tr: CanvasPoint = { x: prim.x + prim.width, y: prim.y };
      const br: CanvasPoint = { x: prim.x + prim.width, y: prim.y + prim.height };
      const bl: CanvasPoint = { x: prim.x, y: prim.y + prim.height };
      return (
        distToSegment(pt, tl, tr) <= HIT_TOL ||
        distToSegment(pt, tr, br) <= HIT_TOL ||
        distToSegment(pt, br, bl) <= HIT_TOL ||
        distToSegment(pt, bl, tl) <= HIT_TOL
      );
    }
    case 'circle': {
      const dist = Math.sqrt((pt.x - prim.cx) ** 2 + (pt.y - prim.cy) ** 2);
      if (prim.fill && prim.fill !== 'none') return dist <= prim.r + HIT_TOL;
      return Math.abs(dist - prim.r) <= HIT_TOL;
    }
    case 'polyline':
      for (let i = 0; i < prim.points.length - 1; i++) {
        if (distToSegment(pt, prim.points[i], prim.points[i + 1]) <= HIT_TOL) return true;
      }
      // Also test closing segment for closed polygons
      if (prim.closed && prim.points.length >= 3) {
        const last = prim.points[prim.points.length - 1];
        const first = prim.points[0];
        if (distToSegment(pt, last, first) <= HIT_TOL) return true;
      }
      return false;
    case 'arc': {
      const dist = Math.sqrt((pt.x - prim.cx) ** 2 + (pt.y - prim.cy) ** 2);
      if (Math.abs(dist - prim.r) > HIT_TOL) return false;
      const angle = (Math.atan2(pt.y - prim.cy, pt.x - prim.cx) * 180 / Math.PI + 360) % 360;
      const start = (prim.startAngle % 360 + 360) % 360;
      const end = (prim.endAngle % 360 + 360) % 360;
      return start <= end ? (angle >= start && angle <= end) : (angle >= start || angle <= end);
    }
    case 'text': {
      const approxW = prim.text.length * prim.fontSize * 0.6;
      let x = prim.x;
      if (prim.anchor === 'middle') x -= approxW / 2;
      if (prim.anchor === 'end') x -= approxW;
      return (
        pt.x >= x && pt.x <= x + approxW &&
        pt.y >= prim.y - prim.fontSize && pt.y <= prim.y + prim.fontSize * 0.3
      );
    }
    default:
      return false;
  }
}

function hitTestPin(pt: CanvasPoint, pin: SymbolPin): boolean {
  if (pin.hidden) return false;
  const dirs: Record<SymbolPin['orientation'], { dx: number; dy: number }> = {
    right: { dx: 1, dy: 0 }, left: { dx: -1, dy: 0 },
    up: { dx: 0, dy: -1 },   down: { dx: 0, dy: 1 },
  };
  const d = dirs[pin.orientation];
  const end: CanvasPoint = {
    x: pin.position.x + d.dx * pin.length,
    y: pin.position.y + d.dy * pin.length,
  };
  return distToSegment(pt, pin.position, end) <= HIT_TOL;
}

// ============================================================================
// Resize computation helpers
// ============================================================================

/**
 * Compute new bounds from dragging a resize handle.
 * Returns { x, y, width, height } after applying constraints.
 *
 * @param initialBounds - Bounding box of the primitive at drag start
 * @param handleType    - Which handle is being dragged
 * @param dx            - Horizontal delta from drag start (canvas units)
 * @param dy            - Vertical delta from drag start (canvas units)
 * @param shiftKey      - true = maintain original aspect ratio (width/height locked)
 * @param altKey        - true = resize from center outward
 *
 * @remarks Aspect-ratio lock (shiftKey=true) mathematics:
 *   Let R = initialBounds.width / initialBounds.height.
 *   - Edge handles (e, w): width is driven by drag. height = width / R.
 *     The shape is re-centered vertically on the original center-y.
 *   - Edge handles (n, s): height is driven by drag. width = height * R.
 *     The shape is re-centered horizontally on the original center-x.
 *   - Corner handles (nw, ne, sw, se): "fit-within" strategy —
 *     compare widthScale = width / initialWidth vs heightScale = height / initialHeight.
 *     If widthScale > heightScale (width grew proportionally more), snap width = height * R.
 *     Otherwise snap height = width / R.
 *     Then apply fixed-edge correction so that the edges NOT moved by the handle
 *     remain at their original screen positions:
 *       right edge fixed (nw, sw, w handles): x = initialRight  - newWidth
 *       bottom edge fixed (nw, ne, n handles): y = initialBottom - newHeight
 *
 * @exported for unit testing
 */
export function computeResizedBounds(
  initialBounds: { x: number; y: number; width: number; height: number },
  handleType: HandleType,
  dx: number,
  dy: number,
  shiftKey: boolean,
  altKey: boolean,
): { x: number; y: number; width: number; height: number } {
  let { x, y, width, height } = initialBounds;

  // Apply deltas based on handle type
  switch (handleType) {
    case 'nw':
      x += dx; y += dy; width -= dx; height -= dy;
      break;
    case 'n':
      y += dy; height -= dy;
      break;
    case 'ne':
      y += dy; width += dx; height -= dy;
      break;
    case 'e':
      width += dx;
      break;
    case 'se':
      width += dx; height += dy;
      break;
    case 's':
      height += dy;
      break;
    case 'sw':
      x += dx; width -= dx; height += dy;
      break;
    case 'w':
      x += dx; width -= dx;
      break;
    default:
      break;
  }

  // Shift = aspect ratio lock (AC4)
  //
  // Mathematical basis:
  //   Let R = initialBounds.width / initialBounds.height  (the locked ratio).
  //   After the drag we must satisfy:  new_width / new_height = R
  //   i.e.  new_width = new_height * R   OR   new_height = new_width / R
  //
  // Handle semantics determine which axis is "driven" by the drag and which
  // axis is "constrained" to maintain the ratio:
  //
  //   • Edge handles (e, w) — the drag moves only one vertical edge, so
  //     `width` is driven.  `height` is recalculated as width / R.
  //     Because neither the top nor bottom edge is anchored by an e/w drag,
  //     the shape is re-centered vertically on the original center-y.
  //
  //   • Edge handles (n, s) — the drag moves only one horizontal edge, so
  //     `height` is driven.  `width` is recalculated as height * R.
  //     The shape is re-centered horizontally on the original center-x.
  //
  //   • Corner handles (nw, ne, sw, se) — both axes are affected.  We use a
  //     "fit-within" strategy: pick whichever raw dimension has the *smaller*
  //     scale factor relative to the initial size, and constrain the other
  //     dimension to satisfy R.  This keeps the resized shape within the
  //     rectangle swept by the drag.
  //
  // After the ratio constraint is applied, a second pass adjusts the origin
  // (x, y) so that the *fixed* edges (those not moved by the handle) remain
  // anchored at their original screen positions:
  //   • nw, n (top edge moved)  → bottom edge is fixed → y = bottom - height
  //   • nw, w, sw (left edge)   → right edge is fixed  → x = right  - width
  //   • n/s (neither left/right moved) → center-x was set above (no override)
  //   • e/w (neither top/bottom moved) → center-y was set above (no override)
  if (shiftKey) {
    const initialRatio = initialBounds.width / initialBounds.height;
    if (initialRatio > 0) {
      const isHorizontal = handleType === 'e' || handleType === 'w';
      const isVertical   = handleType === 'n' || handleType === 's';

      if (isHorizontal) {
        // Width is driven by the drag → constrain height to maintain ratio.
        // Neither the top nor bottom edge is anchored by an e/w drag, so
        // re-center the shape vertically on the original center-y.
        height = width / initialRatio;
        const cy = initialBounds.y + initialBounds.height / 2;
        y = cy - height / 2;
      } else if (isVertical) {
        // Height is driven by the drag → constrain width to maintain ratio.
        // Neither the left nor right edge is anchored by an n/s drag, so
        // re-center the shape horizontally on the original center-x.
        width = height * initialRatio;
        const cx = initialBounds.x + initialBounds.width / 2;
        x = cx - width / 2;
      } else {
        // Corner handles: fit-within strategy.
        //   widthScale  = width  / initialBounds.width
        //   heightScale = height / initialBounds.height
        // If widthScale > heightScale (equivalent to newRatio > R) the width
        // grew proportionally more, so we snap it down to match the height's
        // scale.  Otherwise the height grew more, so we snap it down instead.
        const newRatio = width / height;
        if (newRatio > initialRatio) {
          // Width is proportionally too large → constrain width to match height
          width = height * initialRatio;
        } else {
          // Height is proportionally too large → constrain height to match width
          height = width / initialRatio;
        }
      }

      // ── Fixed-edge position correction ───────────────────────────────────
      // Ensure that the edges NOT moved by the drag stay at their original
      // screen position after the ratio constraint modified width/height.
      //
      //   Right edge fixed  (nw, sw, w handles): x = initial_right  - new_width
      //   Bottom edge fixed (nw, ne, n handles): y = initial_bottom - new_height
      //
      // For n/s the x was already set to the centered value above; since n/s
      // are not in the x-adjustment set that assignment is preserved.
      // For w   the y was already set to the centered value above; since w is
      // not in the y-adjustment set that assignment is preserved.
      // For n   both the centered-x (from isVertical branch) and the
      //         bottom-anchored y (from this block) apply correctly.
      if (handleType === 'nw' || handleType === 'sw' || handleType === 'w') {
        x = initialBounds.x + initialBounds.width - width;
      }
      if (handleType === 'nw' || handleType === 'ne' || handleType === 'n') {
        y = initialBounds.y + initialBounds.height - height;
      }
    }
  }

  // Alt = center-based resize (AC5)
  // Mirror the resize around the center of the original bounds so both
  // opposing sides move symmetrically.  We compute the signed growth on
  // each axis (new size – original size) and distribute half to each side.
  if (altKey) {
    const cx = initialBounds.x + initialBounds.width / 2;
    const cy = initialBounds.y + initialBounds.height / 2;

    // Double the growth: when the user drags east by δ the west side also
    // shrinks by δ, yielding 2δ total width change.  We achieve this by
    // computing how much the dragged edge changed relative to the original
    // bounds and applying that same delta to the opposite edge.
    const dw = width - initialBounds.width;   // signed growth on width axis
    const dh = height - initialBounds.height;  // signed growth on height axis
    width  = initialBounds.width  + dw * 2;
    height = initialBounds.height + dh * 2;

    // Re-center on the original center
    x = cx - width / 2;
    y = cy - height / 2;
  }

  // Enforce minimum size (AC7)
  if (width < MIN_SIZE) {
    if (handleType === 'nw' || handleType === 'sw' || handleType === 'w') {
      x = x + width - MIN_SIZE;
    }
    width = MIN_SIZE;
  }
  if (height < MIN_SIZE) {
    if (handleType === 'nw' || handleType === 'ne' || handleType === 'n') {
      y = y + height - MIN_SIZE;
    }
    height = MIN_SIZE;
  }

  return { x, y, width, height };
}

// ============================================================================
// SelectTool
// ============================================================================

export class SelectTool extends BaseTool {
  private state: SelectState = 'idle';
  private startPt: CanvasPoint | null = null;
  /** True when the initial mousedown target was a locked pin */
  private _hitLockedPin = false;

  // Resize state
  private _resizeHandle: HandleType | null = null;
  private _resizeInitialBounds: { x: number; y: number; width: number; height: number } | null = null;
  private _resizePrimIndex: number = -1;
  private _shiftKey = false;
  private _altKey = false;
  /**
   * Aspect-ratio lock flag — true when Shift is held during an active resize drag.
   *
   * This flag is managed by the resize drag handler and reflects the real-time
   * Shift key state read from `CanvasPoint.shiftKey` (populated by SymbolEditorHost
   * from the React mouse event's `shiftKey` property).
   *
   * When true, `computeResizedBounds` constrains the resize so the primitive's
   * width/height ratio stays constant throughout the drag operation.
   * Releasing Shift mid-drag immediately disables the constraint for subsequent
   * mousemove events until Shift is pressed again.
   */
  private _constrainAspect = false;

  // Rotation state
  private _rotateCenter: CanvasPoint | null = null;
  private _rotatePrimIndex: number = -1;

  // Point-edit state (polyline vertex editing)
  /** Index of the vertex being dragged in point-edit mode (-1 = none) */
  private _pointEditVertexIndex = -1;
  /** Index of the last-clicked/selected vertex (for Delete key removal) */
  private _selectedVertexIndex = -1;
  /** Snapshot of polyline points at the start of a point-move drag */
  private _pointEditOriginalPoints: Array<{ x: number; y: number }> = [];

  /** Overlay renderer's handle hit-test function — injected by Host */
  getHandleAt: ((x: number, y: number) => HandleType | null) | null = null;

  /** Overlay renderer's selected bounds getter — injected by Host */
  getSelectedResizableBounds: ((selectedIds: Set<string>, graphics: GraphicPrimitive[]) => { x: number; y: number; width: number; height: number } | null) | null = null;

  onMouseDown(pt: CanvasPoint, callbacks: ToolCallbacks): void {
    this.startPt = pt;
    const graphics = callbacks.symbol?.graphics ?? [];
    const pins = callbacks.symbol?.pins ?? [];
    const selectedIds = callbacks.selectedIds ?? new Set<string>();
    const editIdx = callbacks.editingPolylineIndex ?? null;

    // --- Point-edit mode: handle vertex interactions first ---
    if (editIdx !== null && editIdx >= 0) {
      const prim = graphics[editIdx];
      if (prim && prim.kind === 'polyline') {
        const polyline = prim as PolylinePrimitive;

        // Check if clicking on an existing vertex
        for (let i = 0; i < polyline.points.length; i++) {
          const vp = polyline.points[i];
          const dx = pt.x - vp.x;
          const dy = pt.y - vp.y;
          if (dx * dx + dy * dy <= POINT_HIT_RADIUS * POINT_HIT_RADIUS) {
            // Start dragging this vertex and mark it as selected
            this.state = 'point-move';
            this._pointEditVertexIndex = i;
            this._selectedVertexIndex = i;
            this._pointEditOriginalPoints = polyline.points.map(p => ({ ...p }));
            return;
          }
        }

        // Check if clicking on a segment (insert a new point)
        for (let i = 0; i < polyline.points.length - 1; i++) {
          if (distToSegment(pt, polyline.points[i], polyline.points[i + 1]) <= SEGMENT_HIT_TOL) {
            // Insert point on this segment
            const newPoints = [...polyline.points];
            newPoints.splice(i + 1, 0, { x: pt.x, y: pt.y });
            const updated: PolylinePrimitive = { ...polyline, points: newPoints };
            callbacks.onUpdatePrimitive?.(editIdx, updated);
            return;
          }
        }
        // Also check the closing segment for closed polygons
        if (polyline.closed && polyline.points.length >= 3) {
          const last = polyline.points[polyline.points.length - 1];
          const first = polyline.points[0];
          if (distToSegment(pt, last, first) <= SEGMENT_HIT_TOL) {
            const newPoints = [...polyline.points];
            newPoints.push({ x: pt.x, y: pt.y });
            const updated: PolylinePrimitive = { ...polyline, points: newPoints };
            callbacks.onUpdatePrimitive?.(editIdx, updated);
            return;
          }
        }

        // Click on empty space while in point-edit → exit point-edit mode
        callbacks.dispatch({ type: 'EXIT_POINT_EDIT' });
        // Fall through to normal selection
      }
    }

    // --- Check resize/rotate handles first (before primitive hit-test) ---
    if (this.getHandleAt && this.getSelectedResizableBounds && selectedIds.size > 0) {
      const handleType = this.getHandleAt(pt.x, pt.y);
      if (handleType) {
        if (handleType === 'rotate') {
          // Enter rotating state
          const bounds = this.getSelectedResizableBounds(selectedIds, graphics);
          if (bounds) {
            this.state = 'rotating';
            this._rotateCenter = {
              x: bounds.x + bounds.width / 2,
              y: bounds.y + bounds.height / 2,
            };
            // Find the primitive index
            const graphicIds = Array.from(selectedIds).filter(id => id.startsWith('g-'));
            if (graphicIds.length === 1) {
              this._rotatePrimIndex = parseInt(graphicIds[0].slice(2), 10);
            }
            return;
          }
        } else {
          // Enter resizing state
          const bounds = this.getSelectedResizableBounds(selectedIds, graphics);
          if (bounds) {
            this.state = 'resizing';
            this._resizeHandle = handleType;
            this._resizeInitialBounds = { ...bounds };
            // Find the primitive index
            const graphicIds = Array.from(selectedIds).filter(id => id.startsWith('g-'));
            if (graphicIds.length === 1) {
              this._resizePrimIndex = parseInt(graphicIds[0].slice(2), 10);
            }
            return;
          }
        }
      }
    }

    // --- Normal hit-test ---
    // Hit-test primitives (last in array = top-most)
    let hitId: string | null = null;
    for (let i = graphics.length - 1; i >= 0; i--) {
      if (hitTestPrimitive(pt, graphics[i])) { hitId = `g-${i}`; break; }
    }
    // Hit-test pins if no graphic hit
    if (!hitId) {
      for (let i = pins.length - 1; i >= 0; i--) {
        if (hitTestPin(pt, pins[i])) { hitId = pins[i].id; break; }
      }
    }

    if (hitId) {
      // Check if the hit target is a locked pin — allow selection but prevent move
      const hitPin = pins.find(p => p.id === hitId);
      this._hitLockedPin = hitPin?.locked === true;

      if (!selectedIds.has(hitId)) {
        callbacks.dispatch({ type: 'SELECT', ids: [hitId] });
      }
      this.state = 'pending';
    } else {
      this.state = 'marquee';
      callbacks.dispatch({ type: 'DESELECT_ALL' });
    }
  }

  onMouseMove(pt: CanvasPoint, callbacks: ToolCallbacks): GhostShape | null {
    if (!this.startPt) return null;
    const selectedIds = callbacks.selectedIds ?? new Set<string>();

    // --- Point-move: live-update vertex position ---
    if (this.state === 'point-move' && this._pointEditVertexIndex >= 0) {
      const editIdx = callbacks.editingPolylineIndex ?? -1;
      if (editIdx >= 0) {
        const prim = callbacks.symbol?.graphics[editIdx];
        if (prim && prim.kind === 'polyline') {
          const newPoints = this._pointEditOriginalPoints.map(p => ({ ...p }));
          newPoints[this._pointEditVertexIndex] = { x: pt.x, y: pt.y };
          const updated: PolylinePrimitive = { ...(prim as PolylinePrimitive), points: newPoints };
          callbacks.onUpdatePrimitive?.(editIdx, updated);
        }
      }
      return null;
    }

    if (this.state === 'marquee') {
      return {
        kind: 'marquee',
        x: Math.min(this.startPt.x, pt.x),
        y: Math.min(this.startPt.y, pt.y),
        width: Math.abs(pt.x - this.startPt.x),
        height: Math.abs(pt.y - this.startPt.y),
      };
    }

    if (this.state === 'pending') {
      // Block move if the initial hit was a locked pin
      if (this._hitLockedPin) return null;
      const dx = pt.x - this.startPt.x, dy = pt.y - this.startPt.y;
      if (Math.abs(dx) >= MOVE_THRESHOLD || Math.abs(dy) >= MOVE_THRESHOLD) {
        // Also block if any selected pin is locked
        const pins = callbacks.symbol?.pins ?? [];
        const hasLockedSelected = pins.some(p => selectedIds.has(p.id) && p.locked);
        if (hasLockedSelected) return null;
        this.state = 'moving';
      }
    }

    if (this.state === 'moving') {
      const dx = pt.x - this.startPt.x, dy = pt.y - this.startPt.y;
      const bb = selectedBBox(
        callbacks.symbol?.graphics ?? [],
        callbacks.symbol?.pins ?? [],
        selectedIds,
      );
      if (bb) {
        return { kind: 'marquee', x: bb.x + dx, y: bb.y + dy, width: bb.w, height: bb.h };
      }
    }

    // --- Resizing: show ghost rect of new bounds ---
    if (this.state === 'resizing' && this._resizeInitialBounds && this._resizeHandle) {
      const dx = pt.x - this.startPt.x;
      const dy = pt.y - this.startPt.y;

      // ── Sub-AC 1: Detect Shift key state from the pointer event ──────────────
      // `pt.shiftKey` is set by SymbolEditorHost from the React mouse event.
      // This allows the aspect-ratio lock to engage/disengage in real-time
      // while the user holds or releases Shift during an active resize drag.
      // The `_constrainAspect` flag reflects the current Shift state and is
      // consumed by computeResizedBounds to enforce aspect-ratio locking.
      this._constrainAspect = pt.shiftKey === true;
      // Keep _shiftKey in sync (used by onMouseUp commit path)
      this._shiftKey = this._constrainAspect;

      // ── Sub-AC 5: Detect Alt key state from the pointer event ───────────────
      // `pt.altKey` is set by SymbolEditorHost from the React mouse event.
      // This allows center-based resize to engage/disengage in real-time
      // while the user holds or releases Alt during an active resize drag.
      if (pt.altKey !== undefined) {
        this._altKey = pt.altKey;
      }

      const newBounds = computeResizedBounds(
        this._resizeInitialBounds,
        this._resizeHandle,
        dx, dy,
        this._constrainAspect,
        this._altKey,
      );
      return {
        kind: 'marquee',
        x: newBounds.x,
        y: newBounds.y,
        width: newBounds.width,
        height: newBounds.height,
      };
    }

    // --- Rotating: show ghost rect at rotated position ---
    if (this.state === 'rotating' && this._rotateCenter) {
      // For rotation preview, show the original bounds (rotation is applied on commit)
      // This is a simplification — full rotation preview would require a rotated rect ghost
      const bounds = this._resizeInitialBounds;
      if (bounds) {
        return {
          kind: 'marquee',
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        };
      }
    }

    return null;
  }

  onMouseUp(pt: CanvasPoint, callbacks: ToolCallbacks): void {
    const selectedIds = callbacks.selectedIds ?? new Set<string>();

    // --- Point-move commit ---
    if (this.state === 'point-move') {
      // The vertex was already live-updated via onMouseMove; just reset state
      this.state = 'idle';
      this.startPt = null;
      this._pointEditVertexIndex = -1;
      this._pointEditOriginalPoints = [];
      return;
    }

    if (this.state === 'marquee' && this.startPt) {
      const x1 = Math.min(this.startPt.x, pt.x), y1 = Math.min(this.startPt.y, pt.y);
      const x2 = Math.max(this.startPt.x, pt.x), y2 = Math.max(this.startPt.y, pt.y);
      const graphics = callbacks.symbol?.graphics ?? [];
      const pins = callbacks.symbol?.pins ?? [];
      const ids: string[] = [];
      graphics.forEach((prim, i) => {
        const bb = primitiveBBox(prim);
        if (bb && bb.x >= x1 && bb.y >= y1 && bb.x + bb.w <= x2 && bb.y + bb.h <= y2) {
          ids.push(`g-${i}`);
        }
      });
      pins.forEach((pin) => {
        if (pin.hidden) return;
        const bb = pinBBox(pin);
        if (bb.x >= x1 && bb.y >= y1 && bb.x + bb.w <= x2 && bb.y + bb.h <= y2) {
          ids.push(pin.id);
        }
      });
      if (ids.length > 0) callbacks.dispatch({ type: 'SELECT', ids });
    }

    if (this.state === 'moving' && this.startPt) {
      const dx = pt.x - this.startPt.x, dy = pt.y - this.startPt.y;
      if (dx !== 0 || dy !== 0) {
        const primIndices = Array.from(selectedIds)
          .filter((id) => id.startsWith('g-'))
          .map((id) => parseInt(id.slice(2), 10))
          .filter((i) => !isNaN(i));
        if (primIndices.length > 0) callbacks.onMovePrimitives?.(primIndices, dx, dy);

        // Exclude locked pins from the move
        const pins = callbacks.symbol?.pins ?? [];
        const lockedIds = new Set(pins.filter(p => p.locked).map(p => p.id));
        const pinIds = Array.from(selectedIds).filter((id) => !id.startsWith('g-') && !lockedIds.has(id));
        if (pinIds.length > 0) callbacks.onMovePins?.(pinIds, dx, dy);
      }
    }

    // --- Commit resize ---
    if (this.state === 'resizing' && this.startPt && this._resizeInitialBounds && this._resizeHandle) {
      const dx = pt.x - this.startPt.x;
      const dy = pt.y - this.startPt.y;
      if (dx !== 0 || dy !== 0) {
        // Use the latest modifier key states from the mouseup event,
        // but fall back to the last tracked state in case
        // the host fires mouseup without modifier info.
        const constrainOnCommit = pt.shiftKey !== undefined ? pt.shiftKey : this._constrainAspect;
        const altOnCommit = pt.altKey !== undefined ? pt.altKey : this._altKey;
        const newBounds = computeResizedBounds(
          this._resizeInitialBounds,
          this._resizeHandle,
          dx, dy,
          constrainOnCommit,
          altOnCommit,
        );
        if (this._resizePrimIndex >= 0) {
          callbacks.onResizePrimitive?.(this._resizePrimIndex, newBounds);
        }
      }
    }

    // --- Commit rotation ---
    if (this.state === 'rotating' && this.startPt && this._rotateCenter) {
      const startAngle = Math.atan2(
        this.startPt.y - this._rotateCenter.y,
        this.startPt.x - this._rotateCenter.x,
      );
      const endAngle = Math.atan2(
        pt.y - this._rotateCenter.y,
        pt.x - this._rotateCenter.x,
      );
      let angleDeg = (endAngle - startAngle) * 180 / Math.PI;

      // Shift = 45° snap (AC6)
      if (this._shiftKey) {
        angleDeg = Math.round(angleDeg / 45) * 45;
      }

      if (angleDeg !== 0 && this._rotatePrimIndex >= 0) {
        callbacks.onRotatePrimitive?.(this._rotatePrimIndex, angleDeg);
      }
    }

    this.state = 'idle';
    this.startPt = null;
    this._hitLockedPin = false;
    this._resizeHandle = null;
    this._resizeInitialBounds = null;
    this._resizePrimIndex = -1;
    this._rotateCenter = null;
    this._rotatePrimIndex = -1;
  }

  // Double-click: enter polyline point-edit mode
  onDoubleClick(pt: CanvasPoint, callbacks: ToolCallbacks): void {
    const graphics = callbacks.symbol?.graphics ?? [];
    const selectedIds = callbacks.selectedIds ?? new Set<string>();

    // Check if a selected polyline was double-clicked
    const graphicIds = Array.from(selectedIds).filter(id => id.startsWith('g-'));
    if (graphicIds.length === 1) {
      const idx = parseInt(graphicIds[0].slice(2), 10);
      const prim = graphics[idx];
      if (prim && prim.kind === 'polyline' && hitTestPrimitive(pt, prim)) {
        // Enter point-edit mode
        callbacks.dispatch({ type: 'ENTER_POINT_EDIT', index: idx });
        return;
      }
    }

    // Also allow double-click on any polyline to select + enter point-edit
    for (let i = graphics.length - 1; i >= 0; i--) {
      const prim = graphics[i];
      if (prim.kind === 'polyline' && hitTestPrimitive(pt, prim)) {
        callbacks.dispatch({ type: 'SELECT', ids: [`g-${i}`] });
        callbacks.dispatch({ type: 'ENTER_POINT_EDIT', index: i });
        return;
      }
    }
  }

  // Arrow-key nudge + modifier tracking
  onKeyDown(e: KeyboardEvent, callbacks: ToolCallbacks): void {
    // Track modifier keys for resize/rotate
    this._shiftKey = e.shiftKey;
    this._altKey = e.altKey;

    // Point-edit mode key handling
    const editIdx = callbacks.editingPolylineIndex ?? null;
    if (editIdx !== null && editIdx >= 0) {
      // Escape → exit point-edit mode
      if (e.key === 'Escape') {
        this._selectedVertexIndex = -1;
        callbacks.dispatch({ type: 'EXIT_POINT_EDIT' });
        return;
      }
      // Delete/Backspace → remove selected vertex (min 2 points)
      if ((e.key === 'Delete' || e.key === 'Backspace') && this._selectedVertexIndex >= 0) {
        const prim = callbacks.symbol?.graphics[editIdx];
        if (prim && prim.kind === 'polyline') {
          const polyline = prim as PolylinePrimitive;
          const minPoints = polyline.closed ? 3 : 2;
          if (polyline.points.length > minPoints) {
            const newPoints = polyline.points.filter((_, i) => i !== this._selectedVertexIndex);
            const updated: PolylinePrimitive = { ...polyline, points: newPoints };
            callbacks.onUpdatePrimitive?.(editIdx, updated);
            this._selectedVertexIndex = -1;
            e.preventDefault();
          }
        }
        return;
      }
    }

    if (e.key === 'Escape') { this.cancel(); return; }

    const NUDGE = e.shiftKey ? 10 : 1;
    let dx = 0, dy = 0;
    if (e.key === 'ArrowLeft')  { dx = -NUDGE; e.preventDefault(); }
    if (e.key === 'ArrowRight') { dx =  NUDGE; e.preventDefault(); }
    if (e.key === 'ArrowUp')    { dy = -NUDGE; e.preventDefault(); }
    if (e.key === 'ArrowDown')  { dy =  NUDGE; e.preventDefault(); }

    if (dx !== 0 || dy !== 0) {
      const selectedIds = callbacks.selectedIds ?? new Set<string>();
      const primIndices = Array.from(selectedIds)
        .filter((id) => id.startsWith('g-'))
        .map((id) => parseInt(id.slice(2), 10))
        .filter((i) => !isNaN(i));
      if (primIndices.length > 0) callbacks.onMovePrimitives?.(primIndices, dx, dy);

      // Exclude locked pins from nudge
      const pins = callbacks.symbol?.pins ?? [];
      const lockedIds = new Set(pins.filter(p => p.locked).map(p => p.id));
      const pinIds = Array.from(selectedIds).filter((id) => !id.startsWith('g-') && !lockedIds.has(id));
      if (pinIds.length > 0) callbacks.onMovePins?.(pinIds, dx, dy);
    }
  }

  /**
   * Update modifier key state from mouse events.
   * Called by SymbolEditorHost to keep shift/alt state in sync during drag.
   */
  updateModifiers(shiftKey: boolean, altKey: boolean): void {
    this._shiftKey = shiftKey;
    this._altKey = altKey;
  }

  cancel(): void {
    this.state = 'idle';
    this.startPt = null;
    this._resizeHandle = null;
    this._resizeInitialBounds = null;
    this._resizePrimIndex = -1;
    this._rotateCenter = null;
    this._rotatePrimIndex = -1;
    this._pointEditVertexIndex = -1;
    this._selectedVertexIndex = -1;
    this._pointEditOriginalPoints = [];
  }
}
