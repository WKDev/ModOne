import { useCallback, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';
import { screenToCanvas, type CanvasRef, type Position } from '../../../OneCanvas';
import type { Block, HandleConstraint, PortPosition, PortEndpoint, Wire, WireEndpoint } from '../../../OneCanvas/types';
import { isPortEndpoint } from '../../../OneCanvas/types';
import type { WireContextMenuAction } from '../../../OneCanvas/overlays/WireContextMenu';
import type { WireDrawingState as StoreWireDrawingState } from '../../../../stores/canvasStore';

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

export function useCanvasInteractions({
  canvasRef,
  components,
  wires,
  pan,
  zoom,
  selectionHandler,
  wireDrawing,
  startWireDrawing,
  updateWireDrawing,
  cancelWireDrawing,
  addWire,
  removeWire,
  removeWireHandle,
  insertEndpointHandle,
  handleSegmentDragStart,
}: UseCanvasInteractionsParams) {
  const [wireContextMenu, setWireContextMenu] = useState<WireContextMenuState | null>(null);

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
      console.log('[OneCanvasPanel] MouseDown - wireDrawing:', !!wireDrawing);

      if (wireDrawing) {
        console.log('[OneCanvasPanel] Skipping selection - wire drawing active');
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

      console.log('[OneCanvasPanel] Calling selectionHandler.handleCanvasMouseDown');
      selectionHandler.handleCanvasMouseDown(event, canvasPos);
    },
    [wireDrawing, canvasRef, pan, zoom, selectionHandler]
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

      if (wireDrawing) {
        updateWireDrawing(canvasPos);
      }

      selectionHandler.handleCanvasMouseMove(event, canvasPos);
    },
    [wireDrawing, canvasRef, pan, zoom, updateWireDrawing, selectionHandler]
  );

  const handleCanvasMouseUp = useCallback(
    (event: ReactMouseEvent) => {
      if (wireDrawing) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-port-id]')) {
          cancelWireDrawing();
        }
      }

      selectionHandler.handleCanvasMouseUp(event);
    },
    [wireDrawing, cancelWireDrawing, selectionHandler]
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
