// InteractionController FSM: 와이어 그리기 상태 핸들러 (시작/이동/완료/리셋)
import type { HitTestResult, Position, WireEndpoint } from '../types';
import { isPortEndpoint, isFloatingEndpoint } from '../types';
import type { InteractionController } from './InteractionController';
import {
  getDistance,
  getPortDirection,
  WIRE_SNAP_STICKY_RADIUS_PX,
} from './interactionGeometry';
import { snapToGridCtx, snapToOrthogonalCtx } from './interactionHelpers';

export function startWireDrawing(
  self: InteractionController,
  _worldPos: Position,
  target: HitTestResult
): void {
  self._wireDrawingReturnState = self._state === 'wire_mode' ? 'wire_mode' : 'idle';
  self._state = 'wire_drawing';
  self._wireFrom = {
    componentId: target.parentId ?? '',
    portId: target.id,
  };
  self._wireFromExitDirection = getPortDirection(target);
  // Use the exact port center position (from hit test), not the raw mouse position.
  // This ensures preview matches the final rendered wire, which resolves
  // endpoints from block.position + port.absolutePosition.
  self._wireDrawingFromPos = target.position;
  self._lastMoveWorld = target.position;
  self._wireSnapTarget = null;
  self._wireBendPoints = [];
}

export function handleWireDrawingMove(self: InteractionController, worldPos: Position): void {
  self._lastMoveWorld = worldPos;

  // Check snap target sticky
  if (self._wireSnapTarget) {
    const dist = getDistance(worldPos, self._wireSnapTarget.position);
    if (dist > WIRE_SNAP_STICKY_RADIUS_PX) {
      self._wireSnapTarget = null;
    }
  }

  // Find new snap target
  if (!self._wireSnapTarget) {
    const fromBlockId =
      self._wireFrom && isPortEndpoint(self._wireFrom)
        ? self._wireFrom.componentId
        : undefined;
    const portHit = self._hitTester.findNearestPort(worldPos, fromBlockId);
    if (portHit) {
      self._wireSnapTarget = {
        type: 'port',
        id: portHit.id,
        parentId: portHit.parentId,
        position: portHit.position,
      };
    } else {
      // Fall back to wire-level snapping: an existing junction, or a point on
      // an existing wire (which becomes a junction on completion). Exclude the
      // source wire when the drawing itself started from a wire tap.
      const wireSnap = self._hitTester.findNearestWireSnap(
        worldPos,
        self._wireFromTap?.wireId
      );
      if (wireSnap) {
        self._wireSnapTarget = {
          type: wireSnap.type === 'junction' ? 'junction' : 'wire',
          id: wireSnap.id,
          position: wireSnap.position,
        };
      }
    }
  }

  // Visual feedback — orthogonal lines through bend points
  const fromPos = self._wireDrawingFromPos;
  const rawTarget = self._wireSnapTarget?.position ?? snapToGridCtx(self, worldPos);
  const currentTarget = self._wireSnapTarget
    ? rawTarget
    : snapToOrthogonalCtx(self, rawTarget);
  const previewPoints: Position[] = [fromPos, ...self._wireBendPoints, currentTarget];

  self._visuals.renderWirePreview(previewPoints);

  if (self._wireSnapTarget) {
    self._visuals.showPortSnap(self._wireSnapTarget.position);
  } else {
    self._visuals.hidePortSnap();
  }
}

export function handleWireDrawingUp(
  _self: InteractionController,
  _worldPos: Position,
  button: number
): void {
  if (button !== 0) return;
  // Wire completion is now handled by handleWireDrawingPointerDown
  // (port click / snap target) and ESC key. Mouse up is a no-op
  // during multi-click wire drawing.
}

export function handleWireModePointerDown(
  self: InteractionController,
  worldPos: Position,
  button: number
): void {
  if (button !== 0) return;

  const target = self._hitTester.hitTest(worldPos);
  if (target.type === 'port') {
    // Start from port (existing behavior)
    self._pointerStartWorld = worldPos;
    self._pointerStartScreen = worldPos;
    startWireDrawing(self, worldPos, target);
  } else if (target.type === 'junction') {
    // Start from an existing junction
    self._wireDrawingReturnState = 'wire_mode';
    self._state = 'wire_drawing';
    self._wireFrom = { junctionId: target.id };
    self._wireFromTap = null;
    self._wireFromExitDirection = null;
    self._wireDrawingFromPos = target.position;
    self._lastMoveWorld = target.position;
    self._wireSnapTarget = null;
    self._wireBendPoints = [];
  } else if (target.type === 'segment') {
    // Start from a point on an existing wire — a tap. The junction is created
    // lazily in completeWire (deferred), so cancelling leaves no orphan.
    self._wireDrawingReturnState = 'wire_mode';
    self._state = 'wire_drawing';
    self._wireFrom = null;
    self._wireFromTap = { wireId: target.id, position: target.position };
    self._wireFromExitDirection = null;
    self._wireDrawingFromPos = target.position;
    self._lastMoveWorld = target.position;
    self._wireSnapTarget = null;
    self._wireBendPoints = [];
  } else {
    // Start from empty canvas — FloatingEndpoint
    const snappedPos = snapToGridCtx(self, worldPos);
    self._wireDrawingReturnState = 'wire_mode';
    self._state = 'wire_drawing';
    self._wireFrom = { position: snappedPos };
    self._wireFromTap = null;
    self._wireFromExitDirection = null;
    self._wireDrawingFromPos = snappedPos;
    self._lastMoveWorld = snappedPos;
    self._wireSnapTarget = null;
    self._wireBendPoints = [];
  }
}

export function handleWireDrawingPointerDown(
  self: InteractionController,
  worldPos: Position,
  button: number
): void {
  if (button !== 0) return;

  // If there's a snap target, complete the wire
  if (self._wireSnapTarget) {
    completeWire(self);
    return;
  }

  // If clicking directly on a port / junction / wire, complete wire there.
  const target = self._hitTester.hitTest(worldPos);
  if (target.type === 'port') {
    self._wireSnapTarget = {
      type: 'port',
      id: target.id,
      parentId: target.parentId,
      position: target.position,
    };
    completeWire(self);
    return;
  }
  if (target.type === 'junction') {
    self._wireSnapTarget = { type: 'junction', id: target.id, position: target.position };
    completeWire(self);
    return;
  }
  if (target.type === 'segment') {
    self._wireSnapTarget = { type: 'wire', id: target.id, position: target.position };
    completeWire(self);
    return;
  }

  // Click on empty canvas — record bend point orthogonally constrained
  const snappedPos = snapToOrthogonalCtx(self, snapToGridCtx(self, worldPos));
  self._wireBendPoints.push(snappedPos);
}

export function completeWire(self: InteractionController, _endPosition?: Position): void {
  // A valid start is either a connected endpoint (port/junction) or a deferred
  // wire tap. A floating start (empty canvas) cannot be completed.
  const hasValidStart =
    self._wireFromTap !== null ||
    (self._wireFrom !== null && !isFloatingEndpoint(self._wireFrom));
  if (!hasValidStart || !self._facade) {
    resetWireDrawing(self);
    return;
  }

  // Resolve the destination endpoint from the snap target.
  let to: WireEndpoint | null = null;
  if (self._wireSnapTarget) {
    const snapTarget = self._wireSnapTarget;
    if (snapTarget.type === 'port' && snapTarget.parentId) {
      to = { componentId: snapTarget.parentId, portId: snapTarget.id };
    } else if (snapTarget.type === 'junction') {
      to = { junctionId: snapTarget.id };
    } else if (snapTarget.type === 'wire') {
      // Tapping a wire: split it at the snap point, connect to the new junction.
      const jid = self._facade.createJunctionOnWire(snapTarget.id, snapTarget.position);
      if (jid) to = { junctionId: jid };
    }
  }
  // No floating endpoint creation — wire must end at a port, junction, or wire.

  // Resolve the source endpoint, materializing a deferred wire tap if needed.
  let from: WireEndpoint | null = self._wireFrom;
  if (self._wireFromTap) {
    const jid = self._facade.createJunctionOnWire(
      self._wireFromTap.wireId,
      self._wireFromTap.position
    );
    from = jid ? { junctionId: jid } : null;
  }

  if (from && to) {
    // Convert user bend points to WireHandle format
    const handles = self._wireBendPoints.length > 0
      ? self._wireBendPoints.map(pos => ({
        position: pos,
        constraint: 'free' as const,
        source: 'user' as const,
      }))
      : undefined;

    self._facade.addWire(from, to, {
      fromExitDirection: self._wireFromExitDirection ?? undefined,
      handles,
    });
  }

  resetWireDrawing(self);
}

export function resetWireDrawing(self: InteractionController): void {
  self._visuals.clearWirePreview();
  self._visuals.hidePortSnap();
  self._wireFrom = null;
  self._wireFromTap = null;
  self._wireFromExitDirection = null;
  self._lastMoveWorld = null;
  self._wireSnapTarget = null;
  self._wireDrawingFromPos = { x: 0, y: 0 };
  self._wireBendPoints = [];
  self._state = self._wireDrawingReturnState;
  self._onStateChange?.(self._state);
}
