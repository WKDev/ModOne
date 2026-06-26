// InteractionController FSM의 컨텍스트(self) 의존 공용 헬퍼 — 그리드 스냅·상태 리셋
import type { Position } from '../types';
import type { InteractionController } from './InteractionController';
import { DEFAULT_GRID_SNAP } from './interactionGeometry';

export function getGridSnap(self: InteractionController): number {
  return self._facade?.gridSize ?? DEFAULT_GRID_SNAP;
}

export function snapToGridCtx(self: InteractionController, pos: Position): Position {
  const step = getGridSnap(self);
  return {
    x: Math.round(pos.x / step) * step,
    y: Math.round(pos.y / step) * step,
  };
}

/** Constrain position to 90-degree (horizontal/vertical) from last anchor point */
export function snapToOrthogonalCtx(self: InteractionController, pos: Position): Position {
  const anchor =
    self._wireBendPoints.length > 0
      ? self._wireBendPoints[self._wireBendPoints.length - 1]
      : self._wireDrawingFromPos;
  if (!anchor) return pos;
  const dx = Math.abs(pos.x - anchor.x);
  const dy = Math.abs(pos.y - anchor.y);
  // Snap to whichever axis has more displacement
  if (dx >= dy) {
    return { x: pos.x, y: anchor.y }; // horizontal
  } else {
    return { x: anchor.x, y: pos.y }; // vertical
  }
}

export function clearPointerTracking(self: InteractionController): void {
  self._pointerStartWorld = null;
  self._pointerStartScreen = null;
  self._lastMoveWorld = null;
}

export function resetTransient(self: InteractionController): void {
  self._dragPrimaryId = null;
  self._dragGroup = null;
  self._dragThresholdPassed = false;
  self._operateBlockId = null;
  self._operatePointerMoved = false;
  self._boxSelectStart = null;
  self._boxSelectCurrent = null;
  self._wireFrom = null;
  self._wireFromExitDirection = null;
  self._lastMoveWorld = null;
  self._wireSnapTarget = null;
  self._wireDrawingReturnState = 'idle';
  self._wireDrawingFromPos = { x: 0, y: 0 };
  self._segmentWireId = null;
  self._segmentPolyIndex = 0;
  self._segmentHandleA = -1;
  self._segmentHandleB = -1;
  self._segmentOrientation = null;
  self._segmentPrevDelta = { x: 0, y: 0 };
  self._segmentIsFirstMove = true;
  self._placingBlockType = null;
  self._placingPosition = null;
  self._placingRotation = 0;
  self._placingFlipH = false;
  self._placingFlipV = false;
  clearPointerTracking(self);
}
