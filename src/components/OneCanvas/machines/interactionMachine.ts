import { assign, setup, type SnapshotFrom } from 'xstate';
import type { RefObject } from 'react';
import { DRAG_THRESHOLD_PX } from '../constants/interaction';
import { WireGeometryCache } from '../geometry/geometryCache';
import { getDragDirection } from '../components/SelectionBox';
import { isBlockInBox, isJunctionInBox, selectWiresInBox } from '../geometry/collision';
import { getPortAbsolutePosition } from '../utils/wirePathCalculator';
import type { CanvasInteractionAdapter } from '../interaction/types';
import type {
  HandleConstraint,
  Junction,
  JunctionEndpoint,
  PortEndpoint,
  PortPosition,
  Position,
  WireEndpoint,
  Block,
} from '../types';

export type Modifiers = { ctrl: boolean; shift: boolean; alt: boolean; meta: boolean };

export type PointerTarget =
  | { kind: 'canvas' }
  | { kind: 'block'; blockId: string }
  | { kind: 'port'; blockId: string; portId: string; portPosition: PortPosition }
  | { kind: 'junction'; junctionId: string }
  | { kind: 'wire'; wireId: string }
  | {
      kind: 'wire_segment';
      wireId: string;
      handleA: number;
      handleB: number;
      orientation: 'horizontal' | 'vertical';
      positionA: Position;
      positionB: Position;
    }
  | {
      kind: 'wire_handle';
      wireId: string;
      handleIndex: number;
      constraint: HandleConstraint;
      handlePosition: Position;
    };

export type CanvasEvent =
  | {
      type: 'POINTER_DOWN';
      position: Position;
      canvasPosition: Position;
      button: number;
      target: PointerTarget;
      modifiers: Modifiers;
    }
  | {
      type: 'POINTER_MOVE';
      position: Position;
      canvasPosition: Position;
      modifiers: Modifiers;
    }
  | {
      type: 'POINTER_UP';
      position: Position;
      canvasPosition: Position;
      button: number;
      modifiers: Modifiers;
    }
  | { type: 'WHEEL'; deltaX: number; deltaY: number; ctrlKey: boolean; position: Position }
  | { type: 'KEY_DOWN'; key: string; code: string; modifiers: Modifiers }
  | { type: 'KEY_UP'; key: string; code: string }
  | { type: 'ESCAPE' };

export type WireSnapTarget =
  | { kind: 'port'; endpoint: PortEndpoint; position: Position }
  | { kind: 'junction'; endpoint: JunctionEndpoint; position: Position }
  | { kind: 'wire'; wireId: string; position: Position };

export interface InteractionContext {
  adapterRef: RefObject<CanvasInteractionAdapter> | null;
  panStartScreenPos: Position | null;
  panStartValue: Position | null;

  dragPrimaryId: string | null;
  dragStartCanvasPos: Position | null;
  dragOriginalPositions: Map<string, Position>;
  dragJunctionIds: Set<string>;
  dragHasPassedThreshold: boolean;
  dragMouseDownScreenPos: Position | null;
  dragIsFirstMove: boolean;
  dragContainerRect: DOMRect | null;

  boxSelectStartPos: Position | null;
  boxSelectCurrentPos: Position | null;
  boxSelectHasPassedThreshold: boolean;

  wireFrom: WireEndpoint | null;
  wireFromExitDirection: PortPosition | null;
  wireTempPosition: Position | null;
  wireSnapTarget: WireSnapTarget | null;

  segmentWireId: string | null;
  segmentHandleA: number;
  segmentHandleB: number;
  segmentOrientation: 'horizontal' | 'vertical';
  segmentStartCanvasPos: Position | null;
  segmentStartPositionA: Position | null;
  segmentStartPositionB: Position | null;
  segmentAppliedDelta: Position;
  segmentIsFirstMove: boolean;
  segmentContainerRect: DOMRect | null;

  handleWireId: string | null;
  handleIndex: number;
  handleConstraint: HandleConstraint;
  handleStartCanvasPos: Position | null;
  handleStartPosition: Position | null;
  handleIsFirstMove: boolean;
  handleContainerRect: DOMRect | null;

  isSpaceHeld: boolean;
  containerRect: DOMRect | null;
}

const wireGeometryCache = new WireGeometryCache();

const initialContext: InteractionContext = {
  adapterRef: null,
  panStartScreenPos: null,
  panStartValue: null,

  dragPrimaryId: null,
  dragStartCanvasPos: null,
  dragOriginalPositions: new Map(),
  dragJunctionIds: new Set(),
  dragHasPassedThreshold: false,
  dragMouseDownScreenPos: null,
  dragIsFirstMove: true,
  dragContainerRect: null,

  boxSelectStartPos: null,
  boxSelectCurrentPos: null,
  boxSelectHasPassedThreshold: false,

  wireFrom: null,
  wireFromExitDirection: null,
  wireTempPosition: null,
  wireSnapTarget: null,

  segmentWireId: null,
  segmentHandleA: -1,
  segmentHandleB: -1,
  segmentOrientation: 'horizontal',
  segmentStartCanvasPos: null,
  segmentStartPositionA: null,
  segmentStartPositionB: null,
  segmentAppliedDelta: { x: 0, y: 0 },
  segmentIsFirstMove: true,
  segmentContainerRect: null,

  handleWireId: null,
  handleIndex: -1,
  handleConstraint: 'free',
  handleStartCanvasPos: null,
  handleStartPosition: null,
  handleIsFirstMove: true,
  handleContainerRect: null,

  isSpaceHeld: false,
  containerRect: null,
};

function isPointerDown(event: CanvasEvent): event is Extract<CanvasEvent, { type: 'POINTER_DOWN' }> {
  return event.type === 'POINTER_DOWN';
}

function isPointerMove(event: CanvasEvent): event is Extract<CanvasEvent, { type: 'POINTER_MOVE' }> {
  return event.type === 'POINTER_MOVE';
}

function isPointerUp(event: CanvasEvent): event is Extract<CanvasEvent, { type: 'POINTER_UP' }> {
  return event.type === 'POINTER_UP';
}

function getAdapter(context: InteractionContext): CanvasInteractionAdapter {
  const adapter = context.adapterRef?.current;
  if (!adapter) {
    throw new Error('InteractionMachine: adapter not available');
  }
  return adapter;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function snapToGrid(position: Position, gridSize: number): Position {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  };
}

function resolveEndpointPosition(
  endpoint: WireEndpoint,
  components: Map<string, Block>,
  junctions: Map<string, Junction>
): Position | null {
  if ('junctionId' in endpoint) {
    const junction = junctions.get(endpoint.junctionId);
    return junction ? { ...junction.position } : null;
  }

  const block = components.get(endpoint.componentId);
  if (!block) {
    return null;
  }

  return getPortAbsolutePosition(block, endpoint.portId);
}

function closestPointOnSegment(point: Position, a: Position, b: Position): { point: Position; distance: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const denom = abx * abx + aby * aby;

  if (denom === 0) {
    return { point: { ...a }, distance: distance(point, a) };
  }

  const t = clamp((apx * abx + apy * aby) / denom, 0, 1);
  const projected: Position = {
    x: a.x + abx * t,
    y: a.y + aby * t,
  };

  return {
    point: projected,
    distance: distance(point, projected),
  };
}

function findWireSnapTarget(
  cursor: Position,
  source: WireEndpoint | null,
  adapter: CanvasInteractionAdapter
): WireSnapTarget | null {
  if (!source) {
    return null;
  }

  const zoom = Math.max(adapter.getZoom(), 0.01);

  const portThreshold = 16 / zoom;
  const junctionThreshold = 14 / zoom;
  const wireThreshold = 12 / zoom;

  let bestPort: WireSnapTarget | null = null;
  let bestPortDistance = Infinity;

  for (const block of adapter.getComponents().values()) {
    for (const port of block.ports) {
      const endpoint: PortEndpoint = { componentId: block.id, portId: port.id };
      if ('componentId' in source && source.componentId === endpoint.componentId && source.portId === endpoint.portId) {
        continue;
      }
      const position = getPortAbsolutePosition(block, port.id);
      if (!position) {
        continue;
      }
      const d = distance(cursor, position);
      if (d <= portThreshold && d < bestPortDistance) {
        bestPortDistance = d;
        bestPort = {
          kind: 'port',
          endpoint,
          position,
        };
      }
    }
  }

  if (bestPort) {
    return bestPort;
  }

  let bestJunction: WireSnapTarget | null = null;
  let bestJunctionDistance = Infinity;
  for (const junction of adapter.getJunctions().values()) {
    if ('junctionId' in source && source.junctionId === junction.id) {
      continue;
    }
    const d = distance(cursor, junction.position);
    if (d <= junctionThreshold && d < bestJunctionDistance) {
      bestJunctionDistance = d;
      bestJunction = {
        kind: 'junction',
        endpoint: { junctionId: junction.id },
        position: { ...junction.position },
      };
    }
  }

  if (bestJunction) {
    return bestJunction;
  }

  let bestWire: WireSnapTarget | null = null;
  let bestWireDistance = Infinity;

  for (const wire of adapter.getWires()) {
    const fromPos = resolveEndpointPosition(wire.from, adapter.getComponents(), adapter.getJunctions());
    const toPos = resolveEndpointPosition(wire.to, adapter.getComponents(), adapter.getJunctions());
    if (!fromPos || !toPos) {
      continue;
    }

    const points: Position[] = [fromPos, ...(wire.handles?.map((h) => h.position) ?? []), toPos];
    for (let i = 0; i < points.length - 1; i += 1) {
      const closest = closestPointOnSegment(cursor, points[i], points[i + 1]);
      if (closest.distance <= wireThreshold && closest.distance < bestWireDistance) {
        bestWireDistance = closest.distance;
        bestWire = {
          kind: 'wire',
          wireId: wire.id,
          position: closest.point,
        };
      }
    }
  }

  return bestWire;
}

export const interactionMachine = setup({
  types: {
    context: {} as InteractionContext,
    events: {} as CanvasEvent,
    input: {} as { adapterRef: RefObject<CanvasInteractionAdapter> },
  },
  guards: {
    canStartPanning: ({ context, event }) => {
      if (!isPointerDown(event)) {
        return false;
      }
      const isCanvas = event.target.kind === 'canvas';
      const isMiddleClick = event.button === 1;
      const isSpacePan = event.button === 0 && context.isSpaceHeld;
      return isCanvas && (isMiddleClick || isSpacePan);
    },
    canStartItemDragging: ({ event }) => {
      if (!isPointerDown(event) || event.button !== 0) {
        return false;
      }
      return event.target.kind === 'block' || event.target.kind === 'junction';
    },
    canStartBoxSelecting: ({ context, event }) => {
      return (
        isPointerDown(event) &&
        event.button === 0 &&
        event.target.kind === 'canvas' &&
        !context.isSpaceHeld
      );
    },
    canStartWireDrawing: ({ event }) => {
      return isPointerDown(event) && event.button === 0 && event.target.kind === 'port';
    },
    canStartWireSegmentDragging: ({ event }) => {
      return isPointerDown(event) && event.button === 0 && event.target.kind === 'wire_segment';
    },
    canStartWireHandleDragging: ({ event }) => {
      return isPointerDown(event) && event.button === 0 && event.target.kind === 'wire_handle';
    },
    draggingThresholdPassed: ({ context, event }) => {
      if (!isPointerMove(event) || !context.dragMouseDownScreenPos) {
        return false;
      }
      return distance(event.position, context.dragMouseDownScreenPos) > DRAG_THRESHOLD_PX;
    },
    boxSelectingThresholdPassed: ({ context, event }) => {
      if (!isPointerMove(event) || !context.boxSelectStartPos) {
        return false;
      }
      const zoom = Math.max(getAdapter(context).getZoom(), 0.01);
      const threshold = DRAG_THRESHOLD_PX / zoom;
      return distance(event.canvasPosition, context.boxSelectStartPos) > threshold;
    },
    hasWireSnapTarget: ({ context }) => {
      return context.wireSnapTarget !== null;
    },
  },
  actions: {
    rebuildInteractionSpatialIndex: () => {
      /* spatial index auto-rebuilds via useEffect in adapter */
    },

    clearTransientInteraction: assign(({ context }) => ({
      ...context,
      panStartScreenPos: null,
      panStartValue: null,

      dragPrimaryId: null,
      dragStartCanvasPos: null,
      dragOriginalPositions: new Map(),
      dragJunctionIds: new Set(),
      dragHasPassedThreshold: false,
      dragMouseDownScreenPos: null,
      dragIsFirstMove: true,
      dragContainerRect: null,

      boxSelectStartPos: null,
      boxSelectCurrentPos: null,
      boxSelectHasPassedThreshold: false,

      wireFrom: null,
      wireFromExitDirection: null,
      wireTempPosition: null,
      wireSnapTarget: null,

      segmentWireId: null,
      segmentHandleA: -1,
      segmentHandleB: -1,
      segmentOrientation: 'horizontal' as const,
      segmentStartCanvasPos: null,
      segmentStartPositionA: null,
      segmentStartPositionB: null,
      segmentAppliedDelta: { x: 0, y: 0 },
      segmentIsFirstMove: true,
      segmentContainerRect: null,

      handleWireId: null,
      handleIndex: -1,
      handleConstraint: 'free' as const,
      handleStartCanvasPos: null,
      handleStartPosition: null,
      handleIsFirstMove: true,
      handleContainerRect: null,
    })),

    cancelCurrentStoreInteraction: () => {
      /* XState manages wire drawing state */
    },

    setSpaceHeldOnKeyDown: assign(({ context, event }) => {
      if (event.type === 'KEY_DOWN' && event.code === 'Space') {
        return { ...context, isSpaceHeld: true };
      }
      return context;
    }),

    setSpaceHeldOnKeyUp: assign(({ context, event }) => {
      if (event.type === 'KEY_UP' && event.code === 'Space') {
        return { ...context, isSpaceHeld: false };
      }
      return context;
    }),

    handleWheel: ({ context, event }) => {
      if (event.type !== 'WHEEL') {
        return;
      }

      const adapter = getAdapter(context);
      if (event.ctrlKey) {
        const zoomFactor = 1 + (-event.deltaY * 0.1) * 0.1;
        const zoom = adapter.getZoom();
        const newZoom = clamp(zoom * zoomFactor, 0.1, 4);
        if (newZoom !== zoom) {
          const pan = adapter.getPan();
          const mousePos = context.containerRect
            ? {
                x: event.position.x - context.containerRect.left,
                y: event.position.y - context.containerRect.top,
              }
            : event.position;

          const scaleRatio = newZoom / zoom;
          adapter.setPan({
            x: mousePos.x - (mousePos.x - pan.x) * scaleRatio,
            y: mousePos.y - (mousePos.y - pan.y) * scaleRatio,
          });
          adapter.setZoom(newZoom);
        }
        return;
      }

      const pan = adapter.getPan();
      adapter.setPan({
        x: pan.x - event.deltaX,
        y: pan.y - event.deltaY,
      });
    },

    preparePanning: assign(({ context, event }) => {
      if (!isPointerDown(event)) {
        return context;
      }
      const pan = getAdapter(context).getPan();
      return {
        ...context,
        panStartScreenPos: { ...event.position },
        panStartValue: { ...pan },
      };
    }),

    updatePan: ({ context, event }) => {
      if (!isPointerMove(event) || !context.panStartScreenPos || !context.panStartValue) {
        return;
      }
      const dx = event.position.x - context.panStartScreenPos.x;
      const dy = event.position.y - context.panStartScreenPos.y;
      getAdapter(context).setPan({
        x: context.panStartValue.x + dx,
        y: context.panStartValue.y + dy,
      });
    },

    prepareItemDragging: assign(({ context, event }) => {
      if (!isPointerDown(event)) {
        return context;
      }

      const adapter = getAdapter(context);
      const selectedIds = adapter.getSelectedIds();

      let primaryId: string | null = null;
      if (event.target.kind === 'block') {
        primaryId = event.target.blockId;
      } else if (event.target.kind === 'junction') {
        primaryId = event.target.junctionId;
      }

      if (!primaryId) {
        return context;
      }

      const shouldAdd = event.modifiers.ctrl || event.modifiers.meta;
      let dragIds = new Set(selectedIds);

      if (!selectedIds.has(primaryId)) {
        if (shouldAdd) {
          dragIds.add(primaryId);
        } else {
          dragIds = new Set([primaryId]);
        }
      }

      adapter.setSelection(Array.from(dragIds));

      const originalPositions = new Map<string, Position>();
      const junctionIds = new Set<string>();
      for (const id of dragIds) {
        const block = adapter.getComponents().get(id);
        if (block) {
          originalPositions.set(id, { ...block.position });
          continue;
        }

        const junction = adapter.getJunctions().get(id);
        if (junction) {
          originalPositions.set(id, { ...junction.position });
          junctionIds.add(id);
        }
      }

      return {
        ...context,
        dragPrimaryId: primaryId,
        dragStartCanvasPos: { ...event.canvasPosition },
        dragOriginalPositions: originalPositions,
        dragJunctionIds: junctionIds,
        dragHasPassedThreshold: false,
        dragMouseDownScreenPos: { ...event.position },
        dragIsFirstMove: true,
      };
    }),

    markDraggingThresholdPassed: assign(({ context }) => ({
      ...context,
      dragHasPassedThreshold: true,
    })),

    applyItemDragging: ({ context, event }) => {
      if (!isPointerMove(event) || !context.dragStartCanvasPos) {
        return;
      }

      const adapter = getAdapter(context);
      const delta = {
        x: event.canvasPosition.x - context.dragStartCanvasPos.x,
        y: event.canvasPosition.y - context.dragStartCanvasPos.y,
      };

      for (const [id, original] of context.dragOriginalPositions) {
        let next = {
          x: original.x + delta.x,
          y: original.y + delta.y,
        };

        if (adapter.getSnapToGrid()) {
          next = snapToGrid(next, adapter.getGridSize());
        }

        // Transient drag: update DOM directly for 60fps, skip React state
        if (!context.dragJunctionIds.has(id)) {
          adapter.setTransientPosition(id, next.x, next.y);
        } else {
          // Junctions are SVG — fall back to store update (small set, low cost)
          adapter.moveJunction(id, next, true);
        }
      }
    },

    commitItemDragging: ({ context, event }) => {
      if (!isPointerUp(event) || !context.dragStartCanvasPos || !context.dragHasPassedThreshold) {
        return;
      }

      const adapter = getAdapter(context);
      const delta = {
        x: event.canvasPosition.x - context.dragStartCanvasPos.x,
        y: event.canvasPosition.y - context.dragStartCanvasPos.y,
      };

      // Commit final positions to store (triggers React re-render + history push)
      for (const [id, original] of context.dragOriginalPositions) {
        let next = {
          x: original.x + delta.x,
          y: original.y + delta.y,
        };

        if (adapter.getSnapToGrid()) {
          next = snapToGrid(next, adapter.getGridSize());
        }

        if (context.dragJunctionIds.has(id)) {
          // Junctions were already updated during drag — final commit with history
          adapter.moveJunction(id, next, false);
        } else {
          adapter.moveComponent(id, next, false);
        }
      }

      adapter.clearTransientPositions();
    },

    consumeDragFirstMove: assign(({ context }) => ({
      ...context,
      dragIsFirstMove: false,
    })),

    prepareBoxSelecting: assign(({ context, event }) => {
      if (!isPointerDown(event)) {
        return context;
      }

      return {
        ...context,
        boxSelectStartPos: { ...event.canvasPosition },
        boxSelectCurrentPos: { ...event.canvasPosition },
        boxSelectHasPassedThreshold: false,
      };
    }),

    updateBoxSelectingCurrent: assign(({ context, event }) => {
      if (!isPointerMove(event)) {
        return context;
      }

      return {
        ...context,
        boxSelectCurrentPos: { ...event.canvasPosition },
      };
    }),

    markBoxSelectingThresholdPassed: assign(({ context }) => ({
      ...context,
      boxSelectHasPassedThreshold: true,
    })),

    finalizeBoxSelection: ({ context, event }) => {
      if (!isPointerUp(event) || !context.boxSelectStartPos || !context.boxSelectCurrentPos) {
        return;
      }

      const adapter = getAdapter(context);
      if (!context.boxSelectHasPassedThreshold) {
        const hasModifier =
          event.modifiers.alt || event.modifiers.ctrl || event.modifiers.meta || event.modifiers.shift;
        if (!hasModifier) {
          adapter.clearSelection();
        }
        return;
      }

      const boxState = {
        start: context.boxSelectStartPos,
        end: context.boxSelectCurrentPos,
      };
      const dragDirection = getDragDirection(boxState);
      const mode = dragDirection === 'ltr' ? 'contain' : 'intersect';
      const selectionBox = {
        startX: boxState.start.x,
        startY: boxState.start.y,
        endX: boxState.end.x,
        endY: boxState.end.y,
      };

      const nextSelection: string[] = [];
      for (const block of adapter.getComponents().values()) {
        if (isBlockInBox(block, selectionBox, mode)) {
          nextSelection.push(block.id);
        }
      }
      for (const junction of adapter.getJunctions().values()) {
        if (isJunctionInBox(junction, selectionBox)) {
          nextSelection.push(junction.id);
        }
      }

      // Version must change when wire geometry changes (handle moves, not just item count).
      // Combine item counts with a lightweight wire-handle hash.
      let wireHandleHash = 0;
      for (const w of adapter.getWires()) {
        if (w.handles) {
          for (const h of w.handles) {
            // Simple bit-mixing hash: fast, not cryptographic, just needs to detect changes
            wireHandleHash = (wireHandleHash * 31 + ((h.position.x * 1000) | 0)) | 0;
            wireHandleHash = (wireHandleHash * 31 + ((h.position.y * 1000) | 0)) | 0;
          }
        }
      }
      const geometryVersion =
        adapter.getComponents().size + adapter.getJunctions().size + adapter.getWires().length + wireHandleHash;
      const wireIds = selectWiresInBox(
        adapter.getWires(),
        selectionBox,
        wireGeometryCache,
        adapter.getComponents(),
        adapter.getJunctions(),
        geometryVersion,
        mode
      );
      nextSelection.push(...wireIds);

      if (event.modifiers.ctrl || event.modifiers.meta || event.modifiers.shift || event.modifiers.alt) {
        for (const id of nextSelection) {
          adapter.addToSelection(id);
        }
        return;
      }

      adapter.setSelection(nextSelection);
    },

    prepareWireDrawing: assign(({ context, event }) => {
      if (!isPointerDown(event) || event.target.kind !== 'port') {
        return context;
      }

      const from: PortEndpoint = {
        componentId: event.target.blockId,
        portId: event.target.portId,
      };

      return {
        ...context,
        wireFrom: from,
        wireFromExitDirection: event.target.portPosition,
        wireTempPosition: { ...event.canvasPosition },
        wireSnapTarget: null,
      };
    }),

    updateWireDrawingPreview: assign(({ context, event }) => {
      if (!isPointerMove(event)) {
        return context;
      }

      const snapTarget = findWireSnapTarget(event.canvasPosition, context.wireFrom, getAdapter(context));
      const previewPosition = snapTarget ? snapTarget.position : event.canvasPosition;

      return {
        ...context,
        wireTempPosition: { ...previewPosition },
        wireSnapTarget: snapTarget,
      };
    }),

    completeWireDrawing: ({ context }) => {
      if (!context.wireFrom || !context.wireSnapTarget) {
        return;
      }

      const adapter = getAdapter(context);

      if (context.wireSnapTarget.kind === 'wire') {
        const junctionId = adapter.createJunctionOnWire(context.wireSnapTarget.wireId, context.wireSnapTarget.position);
        if (junctionId) {
          adapter.addWire(
            context.wireFrom,
            { junctionId },
            { fromExitDirection: context.wireFromExitDirection ?? undefined }
          );
        }
      } else {
        adapter.addWire(context.wireFrom, context.wireSnapTarget.endpoint, {
          fromExitDirection: context.wireFromExitDirection ?? undefined,
        });
      }
    },

    cancelWireDrawing: () => {
      /* XState handles wire drawing state */
    },

    prepareWireSegmentDragging: assign(({ context, event }) => {
      if (!isPointerDown(event) || event.target.kind !== 'wire_segment') {
        return context;
      }

      return {
        ...context,
        segmentWireId: event.target.wireId,
        segmentHandleA: event.target.handleA,
        segmentHandleB: event.target.handleB,
        segmentOrientation: event.target.orientation,
        segmentStartCanvasPos: { ...event.canvasPosition },
        segmentStartPositionA: { ...event.target.positionA },
        segmentStartPositionB: { ...event.target.positionB },
        segmentAppliedDelta: { x: 0, y: 0 },
        segmentIsFirstMove: true,
      };
    }),

    applyWireSegmentDragging: assign(({ context, event }) => {
      if (
        !isPointerMove(event) ||
        !context.segmentWireId ||
        !context.segmentStartCanvasPos ||
        !context.segmentStartPositionA
      ) {
        return context;
      }

      const adapter = getAdapter(context);
      const absDx = event.canvasPosition.x - context.segmentStartCanvasPos.x;
      const absDy = event.canvasPosition.y - context.segmentStartCanvasPos.y;

      let targetDelta: Position;
      if (context.segmentOrientation === 'horizontal') {
        let targetY = context.segmentStartPositionA.y + absDy;
        if (adapter.getSnapToGrid()) {
          targetY = Math.round(targetY / adapter.getGridSize()) * adapter.getGridSize();
        }
        targetDelta = { x: 0, y: targetY - context.segmentStartPositionA.y };
      } else {
        let targetX = context.segmentStartPositionA.x + absDx;
        if (adapter.getSnapToGrid()) {
          targetX = Math.round(targetX / adapter.getGridSize()) * adapter.getGridSize();
        }
        targetDelta = { x: targetX - context.segmentStartPositionA.x, y: 0 };
      }

      const delta = {
        x: targetDelta.x - context.segmentAppliedDelta.x,
        y: targetDelta.y - context.segmentAppliedDelta.y,
      };

      adapter.moveWireSegment(
        context.segmentWireId,
        context.segmentHandleA,
        context.segmentHandleB,
        delta,
        context.segmentIsFirstMove
      );

      return {
        ...context,
        segmentAppliedDelta: targetDelta,
        segmentIsFirstMove: false,
      };
    }),

    finalizeWireSegmentDragging: ({ context }) => {
      if (!context.segmentWireId) {
        return;
      }
      getAdapter(context).cleanupOverlappingHandles(context.segmentWireId);
    },

    prepareWireHandleDragging: assign(({ context, event }) => {
      if (!isPointerDown(event) || event.target.kind !== 'wire_handle') {
        return context;
      }

      return {
        ...context,
        handleWireId: event.target.wireId,
        handleIndex: event.target.handleIndex,
        handleConstraint: event.target.constraint,
        handleStartCanvasPos: { ...event.canvasPosition },
        handleStartPosition: { ...event.target.handlePosition },
        handleIsFirstMove: true,
      };
    }),

    applyWireHandleDragging: assign(({ context, event }) => {
      if (
        !isPointerMove(event) ||
        !context.handleWireId ||
        !context.handleStartCanvasPos ||
        !context.handleStartPosition
      ) {
        return context;
      }

      const adapter = getAdapter(context);
      const delta = {
        x: event.canvasPosition.x - context.handleStartCanvasPos.x,
        y: event.canvasPosition.y - context.handleStartCanvasPos.y,
      };

      let nextPosition: Position;
      if (context.handleConstraint === 'free') {
        nextPosition = {
          x: context.handleStartPosition.x + delta.x,
          y: context.handleStartPosition.y + delta.y,
        };
      } else if (context.handleConstraint === 'horizontal') {
        nextPosition = {
          x: context.handleStartPosition.x + delta.x,
          y: context.handleStartPosition.y,
        };
      } else {
        nextPosition = {
          x: context.handleStartPosition.x,
          y: context.handleStartPosition.y + delta.y,
        };
      }

      if (adapter.getSnapToGrid()) {
        nextPosition = snapToGrid(nextPosition, adapter.getGridSize());
      }

      adapter.updateWireHandle(context.handleWireId, context.handleIndex, nextPosition, context.handleIsFirstMove);

      return {
        ...context,
        handleIsFirstMove: false,
      };
    }),

    finalizeWireHandleDragging: ({ context }) => {
      if (!context.handleWireId) {
        return;
      }
      getAdapter(context).cleanupOverlappingHandles(context.handleWireId);
    },
  },
}).createMachine({
  id: 'oneCanvasInteraction',
  context: ({ input }) => ({
    ...initialContext,
    adapterRef: input.adapterRef,
  }),
  initial: 'idle',
  on: {
    ESCAPE: {
      target: '.idle',
      actions: ['cancelCurrentStoreInteraction', 'clearTransientInteraction'],
    },
    WHEEL: {
      actions: ['handleWheel'],
    },
    KEY_DOWN: {
      actions: ['setSpaceHeldOnKeyDown'],
    },
    KEY_UP: {
      actions: ['setSpaceHeldOnKeyUp'],
    },
  },
  states: {
    idle: {
      entry: ['rebuildInteractionSpatialIndex', 'clearTransientInteraction'],
      on: {
        POINTER_DOWN: [
          {
            guard: 'canStartPanning',
            target: 'panning',
            actions: ['preparePanning'],
          },
          {
            guard: 'canStartItemDragging',
            target: 'dragging_items',
            actions: ['prepareItemDragging'],
          },
          {
            guard: 'canStartBoxSelecting',
            target: 'box_selecting',
            actions: ['prepareBoxSelecting'],
          },
          {
            guard: 'canStartWireDrawing',
            target: 'wire_drawing',
            actions: ['prepareWireDrawing'],
          },
          {
            guard: 'canStartWireSegmentDragging',
            target: 'wire_segment_dragging',
            actions: ['prepareWireSegmentDragging'],
          },
          {
            guard: 'canStartWireHandleDragging',
            target: 'wire_handle_dragging',
            actions: ['prepareWireHandleDragging'],
          },
        ],
      },
    },

    panning: {
      on: {
        POINTER_MOVE: {
          actions: ['updatePan'],
        },
        POINTER_UP: {
          target: 'idle',
        },
      },
    },

    dragging_items: {
      initial: 'pending',
      states: {
        pending: {
          on: {
            POINTER_MOVE: {
              guard: 'draggingThresholdPassed',
              target: 'active',
              actions: ['markDraggingThresholdPassed', 'applyItemDragging', 'consumeDragFirstMove'],
            },
            POINTER_UP: {
              target: '#oneCanvasInteraction.idle',
            },
          },
        },
        active: {
          on: {
            POINTER_MOVE: {
              actions: ['applyItemDragging', 'consumeDragFirstMove'],
            },
            POINTER_UP: {
              target: '#oneCanvasInteraction.idle',
              actions: ['commitItemDragging'],
            },
          },
        },
      },
    },

    box_selecting: {
      initial: 'pending',
      states: {
        pending: {
          on: {
            POINTER_MOVE: {
              guard: 'boxSelectingThresholdPassed',
              target: 'active',
              actions: ['markBoxSelectingThresholdPassed', 'updateBoxSelectingCurrent'],
            },
            POINTER_UP: {
              target: '#oneCanvasInteraction.idle',
              actions: ['finalizeBoxSelection'],
            },
          },
        },
        active: {
          on: {
            POINTER_MOVE: {
              actions: ['updateBoxSelectingCurrent'],
            },
            POINTER_UP: {
              target: '#oneCanvasInteraction.idle',
              actions: ['finalizeBoxSelection'],
            },
          },
        },
      },
    },

    wire_drawing: {
      on: {
        POINTER_MOVE: {
          actions: ['updateWireDrawingPreview'],
        },
        POINTER_UP: [
          {
            guard: 'hasWireSnapTarget',
            target: 'idle',
            actions: ['completeWireDrawing'],
          },
          {
            target: 'idle',
            actions: ['cancelWireDrawing'],
          },
        ],
      },
    },

    wire_segment_dragging: {
      on: {
        POINTER_MOVE: {
          actions: ['applyWireSegmentDragging'],
        },
        POINTER_UP: {
          target: 'idle',
          actions: ['finalizeWireSegmentDragging'],
        },
      },
    },

    wire_handle_dragging: {
      on: {
        POINTER_MOVE: {
          actions: ['applyWireHandleDragging'],
        },
        POINTER_UP: {
          target: 'idle',
          actions: ['finalizeWireHandleDragging'],
        },
      },
    },
  },
});

export type InteractionSnapshot = SnapshotFrom<typeof interactionMachine>;
