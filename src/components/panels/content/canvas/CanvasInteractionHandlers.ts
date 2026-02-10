import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';
import { screenToCanvas, type CanvasRef, type Position } from '../../../OneCanvas';
import type { Block, HandleConstraint, PortPosition, PortEndpoint, Wire, WireEndpoint } from '../../../OneCanvas/types';
import { isPortEndpoint } from '../../../OneCanvas/types';
import type { WireContextMenuAction } from '../../../OneCanvas/overlays/WireContextMenu';
import type { WireDrawingState as StoreWireDrawingState } from '../../../../types/canvasFacade';
import { useInteractionStore } from '../../../../stores/interactionStore';

interface SelectionHandler {
  handleCanvasMouseDown: (event: ReactMouseEvent, canvasPos: Position) => void;
  handleCanvasMouseMove: (event: ReactMouseEvent, canvasPos: Position) => void;
  handleCanvasMouseUp: (event: ReactMouseEvent) => void;
}

interface WireContextMenuState {
  wireId: string;
  position: Position;
  screenPosition: { x: number; y: number };
}

interface UseCanvasInteractionsParams {
  canvasRef: RefObject<CanvasRef | null>;
  components: Map<string, Block>;
  junctions: Map<string, { id: string; position: Position }>;
  wires: Wire[];
  pan: Position;
  zoom: number;
  selectionHandler: SelectionHandler;
  wireDrawing: StoreWireDrawingState | null;
  startWireDrawing: (
    from: WireEndpoint,
    options?: { skipValidation?: boolean; startPosition?: Position }
  ) => void;
  updateWireDrawing: (position: Position) => void;
  cancelWireDrawing: () => void;
  addWire: (
    from: WireEndpoint,
    to: WireEndpoint,
    options?: { fromExitDirection?: PortPosition; toExitDirection?: PortPosition }
  ) => void;
  createJunctionOnWire: (wireId: string, position: Position) => string | null;
  removeWire: (wireId: string) => void;
  removeWireHandle: (wireId: string, handleIndex: number) => void;
  insertEndpointHandle: (
    wireId: string,
    end: 'from' | 'to',
    handles: Array<{ position: Position; constraint: HandleConstraint }>
  ) => void;
  handleSegmentDragStart: (
    wireId: string,
    handleA: number,
    handleB: number,
    orientation: 'horizontal' | 'vertical',
    event: ReactMouseEvent,
    handleAPosition: Position,
    handleBPosition: Position,
    isEndpointSegment?: boolean
  ) => void;
}

const WIRE_INTERACTION_CONFIG = {
  snapRadiusPx: {
    port: 16,
    junction: 14,
    wire: 12,
  },
  snapPriority: ['port', 'junction', 'wire'] as const,
};

type WireInteractionMode = 'idle' | 'drawing';

type WireSnapTarget =
  | { kind: 'port'; endpoint: PortEndpoint; position: Position }
  | { kind: 'junction'; endpoint: { junctionId: string }; position: Position }
  | { kind: 'wire'; wireId: string; position: Position };

interface WireSnapPolicy {
  enablePort: boolean;
  enableJunction: boolean;
  enableWire: boolean;
}

function isSameEndpoint(a: WireEndpoint, b: WireEndpoint): boolean {
  if (isPortEndpoint(a) && isPortEndpoint(b)) {
    return a.componentId === b.componentId && a.portId === b.portId;
  }
  if (!isPortEndpoint(a) && !isPortEndpoint(b)) {
    return a.junctionId === b.junctionId;
  }
  return false;
}

function distanceSquared(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function closestPointOnSegment(point: Position, start: Position, end: Position): Position {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) return start;

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
  const clamped = Math.max(0, Math.min(1, t));
  return {
    x: start.x + clamped * dx,
    y: start.y + clamped * dy,
  };
}

function getWireSnapPolicy(event: ReactMouseEvent): WireSnapPolicy {
  if (event.shiftKey) {
    return {
      enablePort: false,
      enableJunction: false,
      enableWire: false,
    };
  }

  if (event.altKey) {
    return {
      enablePort: true,
      enableJunction: true,
      enableWire: false,
    };
  }

  return {
    enablePort: true,
    enableJunction: true,
    enableWire: true,
  };
}

export function useCanvasInteractions({
  canvasRef,
  components,
  junctions,
  wires,
  pan,
  zoom,
  selectionHandler,
  wireDrawing,
  startWireDrawing,
  updateWireDrawing,
  cancelWireDrawing,
  addWire,
  createJunctionOnWire,
  removeWire,
  removeWireHandle,
  insertEndpointHandle,
  handleSegmentDragStart,
}: UseCanvasInteractionsParams) {
  const [wireContextMenu, setWireContextMenu] = useState<WireContextMenuState | null>(null);
  const wireInteractionRef = useRef<{ mode: WireInteractionMode; snapTarget: WireSnapTarget | null }>({
    mode: 'idle',
    snapTarget: null,
  });

  const getPortPosition = useCallback(
    (blockId: string, portId: string): Position | null => {
      const block = components.get(blockId);
      if (!block) return null;

      const port = block.ports.find((p) => p.id === portId);
      if (!port) return null;

      const offset = port.offset ?? 0.5;
      switch (port.position) {
        case 'top':
          return { x: block.position.x + block.size.width * offset, y: block.position.y };
        case 'bottom':
          return { x: block.position.x + block.size.width * offset, y: block.position.y + block.size.height };
        case 'left':
          return { x: block.position.x, y: block.position.y + block.size.height * offset };
        case 'right':
          return { x: block.position.x + block.size.width, y: block.position.y + block.size.height * offset };
        default:
          return { x: block.position.x + block.size.width / 2, y: block.position.y + block.size.height / 2 };
      }
    },
    [components]
  );

  const resolveEndpointPosition = useCallback(
    (endpoint: WireEndpoint): Position | null => {
      if (isPortEndpoint(endpoint)) {
        return getPortPosition(endpoint.componentId, endpoint.portId);
      }
      return junctions.get(endpoint.junctionId)?.position ?? null;
    },
    [getPortPosition, junctions]
  );

  const findMagnetTarget = useCallback(
    (position: Position, drawingFrom: WireEndpoint, policy: WireSnapPolicy): WireSnapTarget | null => {
      const portThresholdSq = Math.pow(WIRE_INTERACTION_CONFIG.snapRadiusPx.port / zoom, 2);
      const junctionThresholdSq = Math.pow(WIRE_INTERACTION_CONFIG.snapRadiusPx.junction / zoom, 2);
      const wireThresholdSq = Math.pow(WIRE_INTERACTION_CONFIG.snapRadiusPx.wire / zoom, 2);

      let nearestPort: WireSnapTarget | null = null;
      let nearestPortDist = Infinity;

      if (policy.enablePort) {
        for (const [blockId, block] of components.entries()) {
          for (const port of block.ports) {
            const endpoint: PortEndpoint = { componentId: blockId, portId: port.id };
            if (isSameEndpoint(drawingFrom, endpoint)) continue;

            const portPos = getPortPosition(blockId, port.id);
            if (!portPos) continue;

            const dist = distanceSquared(position, portPos);
            if (dist < nearestPortDist && dist <= portThresholdSq) {
              nearestPortDist = dist;
              nearestPort = { kind: 'port', endpoint, position: portPos };
            }
          }
        }
      }

      let nearestJunction: WireSnapTarget | null = null;
      let nearestJunctionDist = Infinity;
      if (policy.enableJunction) {
        for (const junction of junctions.values()) {
          const endpoint = { junctionId: junction.id };
          if (isSameEndpoint(drawingFrom, endpoint)) continue;

          const dist = distanceSquared(position, junction.position);
          if (dist < nearestJunctionDist && dist <= junctionThresholdSq) {
            nearestJunctionDist = dist;
            nearestJunction = { kind: 'junction', endpoint, position: junction.position };
          }
        }
      }

      let nearestWire: WireSnapTarget | null = null;
      let nearestWireDist = Infinity;
      if (policy.enableWire) {
        for (const wire of wires) {
          const fromPos = resolveEndpointPosition(wire.from);
          const toPos = resolveEndpointPosition(wire.to);
          if (!fromPos || !toPos) continue;

          const polyline = [fromPos, ...(wire.handles?.map((h) => h.position) ?? []), toPos];
          for (let i = 0; i < polyline.length - 1; i++) {
            const closest = closestPointOnSegment(position, polyline[i], polyline[i + 1]);
            const dist = distanceSquared(position, closest);
            if (dist < nearestWireDist && dist <= wireThresholdSq) {
              nearestWireDist = dist;
              nearestWire = { kind: 'wire', wireId: wire.id, position: closest };
            }
          }
        }
      }

      const candidates: Record<(typeof WIRE_INTERACTION_CONFIG.snapPriority)[number], WireSnapTarget | null> = {
        port: nearestPort,
        junction: nearestJunction,
        wire: nearestWire,
      };

      for (const kind of WIRE_INTERACTION_CONFIG.snapPriority) {
        const candidate = candidates[kind];
        if (candidate) {
          return candidate;
        }
      }

      return null;
    },
    [components, getPortPosition, junctions, resolveEndpointPosition, wires, zoom]
  );

  const handleStartWire = useCallback(
    (blockId: string, portId: string) => {
      const block = components.get(blockId);
      if (!block || !block.ports.some((p) => p.id === portId)) {
        console.warn('Invalid wire start endpoint:', { blockId, portId });
        return;
      }

      const port = block.ports.find((p) => p.id === portId);
      let startPosition: Position | undefined;

      if (port) {
        const offset = port.offset ?? 0.5;
        let portRelativePos: Position;
        switch (port.position) {
          case 'top':
            portRelativePos = { x: block.size.width * offset, y: 0 };
            break;
          case 'bottom':
            portRelativePos = { x: block.size.width * offset, y: block.size.height };
            break;
          case 'left':
            portRelativePos = { x: 0, y: block.size.height * offset };
            break;
          case 'right':
            portRelativePos = { x: block.size.width, y: block.size.height * offset };
            break;
          default:
            portRelativePos = { x: block.size.width / 2, y: block.size.height / 2 };
        }
        startPosition = {
          x: block.position.x + portRelativePos.x,
          y: block.position.y + portRelativePos.y,
        };
      }

      startWireDrawing({ componentId: blockId, portId }, { skipValidation: true, startPosition });
      wireInteractionRef.current = { mode: 'drawing', snapTarget: null };
    },
    [components, startWireDrawing]
  );

  const handleEndWire = useCallback(
    (blockId: string, portId: string) => {
      if (!wireDrawing) return;

      const to: PortEndpoint = { componentId: blockId, portId };
      const toBlock = components.get(blockId);
      let toExitDirection: PortPosition | undefined;
      if (toBlock) {
        const toPort = toBlock.ports.find((p: { id: string; position: string }) => p.id === portId);
        if (toPort) {
          toExitDirection = toPort.position as PortPosition;
        }
      }

      if (!isPortEndpoint(wireDrawing.from)) return;

      addWire(wireDrawing.from, to, {
        fromExitDirection: wireDrawing.exitDirection,
        toExitDirection,
      });
      cancelWireDrawing();
      wireInteractionRef.current = { mode: 'idle', snapTarget: null };
    },
    [wireDrawing, components, addWire, cancelWireDrawing]
  );

  const handleWireContextMenu = useCallback((wireId: string, position: Position, screenPos: { x: number; y: number }) => {
    setWireContextMenu({ wireId, position, screenPosition: screenPos });
  }, []);

  const handleCloseWireContextMenu = useCallback(() => {
    setWireContextMenu(null);
  }, []);

  const handleWireContextMenuAction = useCallback(
    (action: WireContextMenuAction) => {
      if (!wireContextMenu) return;

      if (action === 'delete') {
        removeWire(wireContextMenu.wireId);
      }
      setWireContextMenu(null);
    },
    [wireContextMenu, removeWire]
  );

  const handleWireHandleContextMenu = useCallback(
    (wireId: string, handleIndex: number, event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      removeWireHandle(wireId, handleIndex);
    },
    [removeWireHandle]
  );

  const handleEndpointSegmentDragStart = useCallback(
    (wireId: string, end: 'from' | 'to', orientation: 'horizontal' | 'vertical', event: ReactMouseEvent) => {
      const wire = wires.find((w) => w.id === wireId);
      if (!wire?.handles?.length) return;

      if (!isPortEndpoint(wire.from) || !isPortEndpoint(wire.to)) return;

      const computeExitPos = (endpoint: PortEndpoint, exitDir?: PortPosition): Position | null => {
        const comp = components.get(endpoint.componentId);
        if (!comp) return null;

        const port = comp.ports.find((p: { id: string; position: string; offset?: number }) => p.id === endpoint.portId);
        if (!port) return null;

        const offset = port.offset ?? 0.5;
        const dir = exitDir || (port.position as PortPosition);
        let portPos: Position;

        switch (port.position) {
          case 'top':
            portPos = { x: comp.position.x + comp.size.width * offset, y: comp.position.y };
            break;
          case 'bottom':
            portPos = { x: comp.position.x + comp.size.width * offset, y: comp.position.y + comp.size.height };
            break;
          case 'left':
            portPos = { x: comp.position.x, y: comp.position.y + comp.size.height * offset };
            break;
          case 'right':
            portPos = { x: comp.position.x + comp.size.width, y: comp.position.y + comp.size.height * offset };
            break;
          default:
            portPos = { x: comp.position.x + comp.size.width / 2, y: comp.position.y + comp.size.height / 2 };
        }

        const dist = 20;
        switch (dir) {
          case 'top':
            return { x: portPos.x, y: portPos.y - dist };
          case 'bottom':
            return { x: portPos.x, y: portPos.y + dist };
          case 'left':
            return { x: portPos.x - dist, y: portPos.y };
          case 'right':
            return { x: portPos.x + dist, y: portPos.y };
          default:
            return null;
        }
      };

      const constraint: HandleConstraint = orientation === 'horizontal' ? 'vertical' : 'horizontal';

      if (end === 'from') {
        const fromEndpoint = wire.from as PortEndpoint;
        const exitPos = computeExitPos(fromEndpoint, wire.fromExitDirection);
        if (!exitPos) return;

        const firstHandlePos = wire.handles[0].position;
        const secondPos: Position = orientation === 'vertical'
          ? { x: exitPos.x, y: firstHandlePos.y }
          : { x: firstHandlePos.x, y: exitPos.y };

        insertEndpointHandle(wireId, 'from', [
          { position: exitPos, constraint },
          { position: secondPos, constraint },
        ]);

        handleSegmentDragStart(wireId, 0, 1, orientation, event, exitPos, secondPos, true);
      } else {
        const toEndpoint = wire.to as PortEndpoint;
        const exitPos = computeExitPos(toEndpoint, wire.toExitDirection);
        if (!exitPos) return;

        const lastIdx = wire.handles.length - 1;
        const lastHandlePos = wire.handles[lastIdx].position;
        const firstPos: Position = orientation === 'vertical'
          ? { x: exitPos.x, y: lastHandlePos.y }
          : { x: lastHandlePos.x, y: exitPos.y };

        insertEndpointHandle(wireId, 'to', [
          { position: firstPos, constraint },
          { position: exitPos, constraint },
        ]);

        handleSegmentDragStart(wireId, lastIdx + 1, lastIdx + 2, orientation, event, firstPos, exitPos, true);
      }
    },
    [wires, components, insertEndpointHandle, handleSegmentDragStart]
  );

  const handleCanvasMouseDown = useCallback(
    (event: ReactMouseEvent) => {
      const modeType = useInteractionStore.getState().mode.type;
      if (modeType !== 'IDLE') {
        return;
      }

      const container = canvasRef.current?.getContainer();
      if (!container) return;
      const rect = container.getBoundingClientRect();

      const screenPos = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const canvasPos = screenToCanvas(screenPos, pan, zoom);

      selectionHandler.handleCanvasMouseDown(event, canvasPos);
    },
    [canvasRef, pan, zoom, selectionHandler]
  );

  const handleCanvasMouseMove = useCallback(
    (event: ReactMouseEvent) => {
      const container = canvasRef.current?.getContainer();
      if (!container) return;
      const rect = container.getBoundingClientRect();

      const screenPos = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const canvasPos = screenToCanvas(screenPos, pan, zoom);

      const modeType = useInteractionStore.getState().mode.type;

      if (modeType === 'WIRE_DRAWING' && wireDrawing) {
        const snapPolicy = getWireSnapPolicy(event);
        const snapTarget = findMagnetTarget(canvasPos, wireDrawing.from, snapPolicy);
        wireInteractionRef.current = { mode: 'drawing', snapTarget };
        updateWireDrawing(snapTarget?.position ?? canvasPos);
        return;
      }

      if (modeType !== 'IDLE' && modeType !== 'BOX_SELECTING') {
        return;
      }

      selectionHandler.handleCanvasMouseMove(event, canvasPos);
    },
    [wireDrawing, canvasRef, pan, zoom, updateWireDrawing, selectionHandler, findMagnetTarget]
  );

  const handleCanvasMouseUp = useCallback(
    (event: ReactMouseEvent) => {
      const modeType = useInteractionStore.getState().mode.type;
      if (modeType === 'WIRE_DRAWING' && wireDrawing) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-port-id]')) {
          const snapTarget = wireInteractionRef.current.snapTarget;

          if (snapTarget?.kind === 'port') {
            const toBlock = components.get(snapTarget.endpoint.componentId);
            const toPort = toBlock?.ports.find((p) => p.id === snapTarget.endpoint.portId);
            addWire(wireDrawing.from, snapTarget.endpoint, {
              fromExitDirection: wireDrawing.exitDirection,
              toExitDirection: toPort?.position,
            });
          } else if (snapTarget?.kind === 'junction') {
            addWire(wireDrawing.from, snapTarget.endpoint, {
              fromExitDirection: wireDrawing.exitDirection,
            });
          } else if (snapTarget?.kind === 'wire') {
            const junctionId = createJunctionOnWire(snapTarget.wireId, snapTarget.position);
            if (junctionId) {
              addWire(wireDrawing.from, { junctionId }, {
                fromExitDirection: wireDrawing.exitDirection,
              });
            }
          }

          cancelWireDrawing();
        }
        wireInteractionRef.current = { mode: 'idle', snapTarget: null };
        return;
      }

      selectionHandler.handleCanvasMouseUp(event);
    },
    [wireDrawing, components, addWire, createJunctionOnWire, cancelWireDrawing, selectionHandler]
  );

  return {
    wireContextMenu,
    handleStartWire,
    handleEndWire,
    handleWireContextMenu,
    handleCloseWireContextMenu,
    handleWireContextMenuAction,
    handleWireHandleContextMenu,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleEndpointSegmentDragStart,
  };
}
