// InteractionController FSM: 와이어 세그먼트 드래그 상태 핸들러
import type { HitTestResult, Position } from '../types';
import type { InteractionController } from './InteractionController';
import { snapDelta, subtract, constrainSegmentDelta } from './interactionGeometry';
import { getGridSnap, clearPointerTracking } from './interactionHelpers';

/**
 * Start dragging a wire segment.
 * Stores the polyline segment index; actual endpoint handle insertion
 * happens atomically inside dragWireSegment on first move.
 */
export function startWireSegmentDragging(
  self: InteractionController,
  _worldPos: Position,
  target: HitTestResult
): void {
  self._state = 'wire_segment_dragging';
  self._segmentWireId = target.id || null;
  self._segmentOrientation = null;
  self._segmentPrevDelta = { x: 0, y: 0 };
  self._segmentIsFirstMove = true;
  self._segmentHandleA = -1;
  self._segmentHandleB = -1;
  self._segmentPolyIndex = typeof target.subIndex === 'number' ? target.subIndex : 0;
}

export function handleSegmentDraggingMove(self: InteractionController, worldPos: Position): void {
  if (!self._pointerStartWorld || !self._segmentWireId) return;
  const facade = self._facade;
  if (!facade) return;

  const snapped = snapDelta(subtract(worldPos, self._pointerStartWorld), getGridSnap(self));
  const constrained = constrainSegmentDelta(snapped, self._segmentOrientation);

  const incrementalDelta = {
    x: constrained.x - self._segmentPrevDelta.x,
    y: constrained.y - self._segmentPrevDelta.y,
  };
  self._segmentPrevDelta = constrained;

  if (incrementalDelta.x !== 0 || incrementalDelta.y !== 0) {
    const isFirstMove = self._segmentIsFirstMove;
    self._segmentIsFirstMove = false;

    if (isFirstMove) {
      // First move: use dragWireSegment which atomically inserts endpoint
      // handles + applies delta + returns resolved handle indices & orientation.
      const result = facade.dragWireSegment(
        self._segmentWireId,
        self._segmentPolyIndex,
        incrementalDelta,
        true
      );
      if (result) {
        self._segmentHandleA = result.handleA;
        self._segmentHandleB = result.handleB;
        self._segmentOrientation = result.orientation;
      }
    } else {
      // Subsequent moves: handles already resolved, use direct moveWireSegment.
      facade.moveWireSegment(
        self._segmentWireId,
        self._segmentHandleA,
        self._segmentHandleB,
        incrementalDelta,
        false
      );
    }
  }
}

export function handleSegmentDraggingUp(self: InteractionController): void {
  // Handles are already at the correct final position from incremental move handler.
  // No duplicate delta application needed.
  if (self._segmentWireId) {
    self._facade?.cleanupOverlappingHandles(self._segmentWireId);
  }
  self._segmentWireId = null;
  self._segmentPolyIndex = 0;
  self._segmentHandleA = -1;
  self._segmentHandleB = -1;
  self._segmentOrientation = null;
  self._segmentPrevDelta = { x: 0, y: 0 };
  self._segmentIsFirstMove = true;
  self._state = 'idle';
  clearPointerTracking(self);
}
