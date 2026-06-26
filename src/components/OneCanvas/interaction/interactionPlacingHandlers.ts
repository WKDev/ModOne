// InteractionController FSM: 블록 배치(placing) 모드 핸들러
import type { Position } from '../types';
import type { InteractionController } from './InteractionController';
import { snapToGrid } from './interactionGeometry';
import { getGridSnap } from './interactionHelpers';

export function handlePlacingPointerDown(
  self: InteractionController,
  worldPos: Position,
  button: number
): void {
  if (button !== 0 || !self._placingBlockType) return;

  const snappedPos = snapToGrid(worldPos, getGridSnap(self));
  self._onPlaceBlock?.(
    self._placingBlockType,
    snappedPos,
    self._placingRotation,
    self._placingFlipH,
    self._placingFlipV
  );
}

export function handlePlacingMove(self: InteractionController, worldPos: Position): void {
  self._placingPosition = snapToGrid(worldPos, getGridSnap(self));
  updateGhostPreview(self);
}

export function updateGhostPreview(self: InteractionController): void {
  if (self._placingBlockType && self._placingPosition) {
    self._visuals.updateGhost({
      blockType: self._placingBlockType,
      position: self._placingPosition,
      rotation: self._placingRotation,
      flipH: self._placingFlipH,
      flipV: self._placingFlipV,
    });
  }
}
