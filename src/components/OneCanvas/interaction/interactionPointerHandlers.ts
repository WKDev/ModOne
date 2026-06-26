// InteractionController FSM: operate/idle 클릭·아이템 드래그·박스 선택 핸들러
import type { HitTestResult, Position } from '../types';
import type { Modifiers, DragGroupItem } from './interactionTypes';
import type { InteractionController } from './InteractionController';
import {
  getDistance,
  snapDelta,
  subtract,
  add,
  rectFromTwoPoints,
  DRAG_THRESHOLD_PX,
} from './interactionGeometry';
import { getGridSnap, clearPointerTracking } from './interactionHelpers';
import { startWireDrawing } from './interactionWireHandlers';
import { startWireSegmentDragging } from './interactionSegmentHandlers';

// ============================================================================
// Operate mode
// ============================================================================

export function handleOperatePointerDown(
  self: InteractionController,
  worldPos: Position,
  screenPos: Position,
  button: number
): void {
  if (button === 1 || (button === 0 && self._isSpaceHeld)) {
    self._state = 'panning';
    self._pointerStartWorld = worldPos;
    self._pointerStartScreen = screenPos;
    return;
  }

  if (button !== 0) return;

  const target = self._hitTester.hitTest(worldPos);
  if (target.type !== 'block' || !target.id) return;

  self._pointerStartWorld = worldPos;
  self._pointerStartScreen = screenPos;
  self._operateBlockId = target.id;
  self._operatePointerMoved = false;
  self._state = 'operating_pressing';
  self._onOperateBlockInteraction?.(target.id, 'press');
}

export function handleOperatePointerUp(self: InteractionController, worldPos: Position, button: number): void {
  if (button !== 0) return;

  const blockId = self._operateBlockId;
  if (blockId) {
    self._onOperateBlockInteraction?.(blockId, 'release');

    const target = self._hitTester.hitTest(worldPos);
    if (!self._operatePointerMoved && target.type === 'block' && target.id === blockId) {
      self._onOperateBlockInteraction?.(blockId, 'click');
    }
  }

  handleOperateCancel(self);
}

export function handleOperateCancel(self: InteractionController): void {
  self._operateBlockId = null;
  self._operatePointerMoved = false;
  self._state = 'idle';
  clearPointerTracking(self);
}

// ============================================================================
// Idle pointer down (routes to wire / segment / item / box)
// ============================================================================

export function handleIdlePointerDown(
  self: InteractionController,
  worldPos: Position,
  screenPos: Position,
  button: number,
  modifiers: Modifiers
): void {
  if (button === 1 || (button === 0 && self._isSpaceHeld)) {
    self._state = 'panning';
    self._pointerStartWorld = worldPos;
    self._pointerStartScreen = screenPos;
    return;
  }

  if (button !== 0) return;

  const target = self._hitTester.hitTest(worldPos);

  if (import.meta.env.DEV) {
    console.debug(
      '[InteractionController] idle hitTest →', target.type, target.id || '',
      '| spatialIndex.size:', self._spatialIndex.size,
      '| worldPos:', worldPos,
      '| facade?:', !!self._facade,
      '| facade.components.size:', self._facade?.components?.size ?? 'N/A'
    );
  }

  self._pointerStartWorld = worldPos;
  self._pointerStartScreen = screenPos;

  switch (target.type) {
    case 'port':
      startWireDrawing(self, worldPos, target);
      break;

    case 'segment':
      startWireSegmentDragging(self, worldPos, target);
      break;

    case 'block':
    case 'junction':
    case 'wire':
      startItemPending(self, target, modifiers);
      break;

    case 'none':
    default:
      // In wire_mode-like behavior: if wire_mode is active, start wire from empty canvas
      // Otherwise, start box selection
      self._state = 'box_pending';
      self._boxSelectStart = worldPos;
      self._boxSelectCurrent = worldPos;
      break;
  }
}

// ============================================================================
// Item click / drag
// ============================================================================

export function startItemPending(
  self: InteractionController,
  target: HitTestResult,
  _modifiers: Modifiers
): void {
  self._state = 'item_pending';
  self._dragPrimaryId = target.id;
  self._dragThresholdPassed = false;

  const facade = self._facade;
  if (!facade) return;

  if (target.id && facade.selectedIds.has(target.id)) {
    const group = new Map<string, DragGroupItem>();
    for (const id of facade.selectedIds) {
      const block = facade.components.get(id);
      if (block) {
        group.set(id, {
          originalPos: { x: block.position.x, y: block.position.y },
          isJunction: false,
        });
        continue;
      }
      const junction = facade.junctions.get(id);
      if (junction) {
        group.set(id, {
          originalPos: {
            x: junction.position.x,
            y: junction.position.y,
          },
          isJunction: true,
        });
      }
    }
    self._dragGroup = group.size > 0 ? group : null;
  } else {
    self._dragGroup = null;
  }
}

export function handleItemPendingMove(
  self: InteractionController,
  worldPos: Position,
  screenPos: Position
): void {
  if (!self._pointerStartScreen) return;

  if (
    getDistance(self._pointerStartScreen, screenPos) > DRAG_THRESHOLD_PX
  ) {
    self._dragThresholdPassed = true;

    if (!self._dragGroup && self._dragPrimaryId) {
      const facade = self._facade;
      if (facade) {
        const block = facade.components.get(self._dragPrimaryId);
        if (block) {
          self._dragGroup = new Map([
            [
              self._dragPrimaryId,
              {
                originalPos: {
                  x: block.position.x,
                  y: block.position.y,
                },
                isJunction: false,
              },
            ],
          ]);
        } else {
          const junction = facade.junctions.get(self._dragPrimaryId);
          if (junction) {
            self._dragGroup = new Map([
              [
                self._dragPrimaryId,
                {
                  originalPos: {
                    x: junction.position.x,
                    y: junction.position.y,
                  },
                  isJunction: true,
                },
              ],
            ]);
          }
        }
      }
    }

    self._state = 'dragging_items';
    handleDraggingItemsMove(self, worldPos);
  }
}

export function handleDraggingItemsMove(self: InteractionController, worldPos: Position): void {
  if (!self._pointerStartWorld || !self._dragGroup) return;
  self._lastMoveWorld = worldPos;

  const facade = self._facade;
  if (!facade) return;

  const delta = snapDelta(subtract(worldPos, self._pointerStartWorld), getGridSnap(self));

  for (const [id, { originalPos, isJunction }] of self._dragGroup) {
    const newPos = add(originalPos, delta);
    // skipHistory=true (no per-frame undo), skipWireRecalc=false so connected
    // wires re-route orthogonally *live* during the drag instead of snapping to
    // right angles only on release. recalculateAutoHandles is stable per frame
    // (auto wires recompute from scratch; user-handle bridges are discarded and
    // regenerated each pass), so this does not drift or accumulate handles.
    if (isJunction) {
      facade.moveJunction(id, newPos, true, false);
    } else {
      facade.moveComponent(id, newPos, true, false);
    }
  }
}

export function handleItemPendingUp(self: InteractionController, _modifiers: Modifiers): void {
  if (!self._dragThresholdPassed && self._dragPrimaryId) {
    const facade = self._facade;
    const mods = self._downModifiers;
    if (facade && mods) {
      if (mods.shift) {
        facade.addToSelection(self._dragPrimaryId);
      } else if (mods.ctrl || mods.meta) {
        facade.toggleSelection(self._dragPrimaryId);
      } else {
        facade.setSelection([self._dragPrimaryId]);
      }
    }
  }

  self._dragPrimaryId = null;
  self._dragGroup = null;
  self._dragThresholdPassed = false;
  self._state = 'idle';
  clearPointerTracking(self);
}

export function handleDraggingItemsUp(self: InteractionController): void {
  if (self._dragGroup && self._pointerStartWorld) {
    const facade = self._facade;
    if (facade) {
      const lastWorld = self._pointerStartWorld;
      const delta = snapDelta(
        subtract(
          self._lastMoveWorld ?? lastWorld,
          self._pointerStartWorld
        ),
        getGridSnap(self)
      );

      for (const [id, { originalPos, isJunction }] of self._dragGroup) {
        const newPos = add(originalPos, delta);
        if (isJunction) {
          facade.moveJunction(id, newPos, false, false);
        } else {
          facade.moveComponent(id, newPos, false, false);
        }
      }
    }
  }

  self._dragPrimaryId = null;
  self._dragGroup = null;
  self._dragThresholdPassed = false;
  self._state = 'idle';
  clearPointerTracking(self);
}

// ============================================================================
// Box selection
// ============================================================================

export function handleBoxPendingMove(
  self: InteractionController,
  worldPos: Position,
  screenPos: Position
): void {
  if (!self._pointerStartScreen) return;

  if (
    getDistance(self._pointerStartScreen, screenPos) > DRAG_THRESHOLD_PX
  ) {
    self._state = 'box_selecting';
    self._boxSelectCurrent = worldPos;
    self._visuals.renderMarquee(self._boxSelectStart!, worldPos);
  }
}

export function handleBoxSelectingUp(self: InteractionController, modifiers: Modifiers): void {
  const facade = self._facade;
  if (facade && self._boxSelectStart && self._boxSelectCurrent) {
    const bounds = rectFromTwoPoints(
      self._boxSelectStart,
      self._boxSelectCurrent
    );
    const items = self._spatialIndex.queryRect(bounds);
    const ids = items
      .filter(
        (item) =>
          item.type === 'block' ||
          item.type === 'junction' ||
          item.type === 'wire'
      )
      .map((item) => item.id);

    if (modifiers.shift) {
      const currentIds = Array.from(facade.selectedIds);
      const merged = new Set([...currentIds, ...ids]);
      facade.setSelection(Array.from(merged));
    } else {
      facade.setSelection(ids);
    }
  }

  self._visuals.clearMarquee();
  self._boxSelectStart = null;
  self._boxSelectCurrent = null;
  self._state = 'idle';
  clearPointerTracking(self);
}
