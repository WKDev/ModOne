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
import type { GraphicPrimitive, SymbolPin } from '../../../types/symbol';
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
  | 'rotating';  // dragging the rotation handle

/** Minimum canvas-unit movement required to start a move */
const MOVE_THRESHOLD = 3;

/** Minimum primitive size in canvas units (AC7) */
const MIN_SIZE = 10;

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
 */
function computeResizedBounds(
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
  if (shiftKey) {
    const initialRatio = initialBounds.width / initialBounds.height;
    if (initialRatio > 0) {
      // Determine which dimension to constrain based on handle
      const isHorizontal = handleType === 'e' || handleType === 'w';
      const isVertical = handleType === 'n' || handleType === 's';

      if (isHorizontal) {
        height = width / initialRatio;
      } else if (isVertical) {
        width = height * initialRatio;
      } else {
        // Corner handles: use the larger delta to drive
        const newRatio = width / height;
        if (newRatio > initialRatio) {
          width = height * initialRatio;
        } else {
          height = width / initialRatio;
        }
      }

      // Adjust position for handles that anchor on top/left
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

  /** Overlay renderer's handle hit-test function — injected by Host */
  getHandleAt: ((x: number, y: number) => HandleType | null) | null = null;

  /** Overlay renderer's selected bounds getter — injected by Host */
  getSelectedResizableBounds: ((selectedIds: Set<string>, graphics: GraphicPrimitive[]) => { x: number; y: number; width: number; height: number } | null) | null = null;

  onMouseDown(pt: CanvasPoint, callbacks: ToolCallbacks): void {
    this.startPt = pt;
    const graphics = callbacks.symbol?.graphics ?? [];
    const pins = callbacks.symbol?.pins ?? [];
    const selectedIds = callbacks.selectedIds ?? new Set<string>();

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
        // Use the latest Shift key state from the mouseup event (pt.shiftKey),
        // but fall back to the last tracked state (_constrainAspect) in case
        // the host fires mouseup without modifier info.
        const constrainOnCommit = pt.shiftKey !== undefined ? pt.shiftKey : this._constrainAspect;
        const newBounds = computeResizedBounds(
          this._resizeInitialBounds,
          this._resizeHandle,
          dx, dy,
          constrainOnCommit,
          this._altKey,
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

  // Arrow-key nudge + modifier tracking
  onKeyDown(e: KeyboardEvent, callbacks: ToolCallbacks): void {
    // Track modifier keys for resize/rotate
    this._shiftKey = e.shiftKey;
    this._altKey = e.altKey;

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
  }
}
