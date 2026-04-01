/**
 * SelectTool — Selection and Move Tool for Symbol Editor
 *
 * Handles three distinct interaction modes:
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
 */

import { BaseTool, type CanvasPoint, type ToolCallbacks } from './BaseTool';
import type { GraphicPrimitive, SymbolPin } from '../../../types/symbol';
import type { GhostShape } from '../types';

// ============================================================================
// Internal state machine
// ============================================================================

type SelectState =
  | 'idle'
  | 'pending'   // mousedown on selected item — waiting to see if it becomes a move
  | 'marquee'   // dragging a rubber-band selection box
  | 'moving';   // dragging selected items

/** Minimum canvas-unit movement required to start a move */
const MOVE_THRESHOLD = 3;

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
// SelectTool
// ============================================================================

export class SelectTool extends BaseTool {
  private state: SelectState = 'idle';
  private startPt: CanvasPoint | null = null;
  /** True when the initial mousedown target was a locked pin */
  private _hitLockedPin = false;

  onMouseDown(pt: CanvasPoint, callbacks: ToolCallbacks): void {
    this.startPt = pt;
    const graphics = callbacks.symbol?.graphics ?? [];
    const pins = callbacks.symbol?.pins ?? [];
    const selectedIds = callbacks.selectedIds ?? new Set<string>();

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

    this.state = 'idle';
    this.startPt = null;
    this._hitLockedPin = false;
  }

  // Arrow-key nudge
  onKeyDown(e: KeyboardEvent, callbacks: ToolCallbacks): void {
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

  cancel(): void {
    this.state = 'idle';
    this.startPt = null;
  }
}
