/**
 * OneCanvasPanel Component
 *
 * Panel content for the OneCanvas circuit simulation canvas.
 * Integrates SimulationToolbar, Toolbox, Canvas with blocks/wires, and DnD support.
 *
 * Supports both:
 * 1. Document-based editing (multi-document via DocumentContext)
 * 2. Global store editing (single document via useCanvasStore)
 */

import { memo, useCallback, useRef, useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useCanvasStore } from '../../../stores/canvasStore';
import { useDocumentContext } from '../../../contexts/DocumentContext';
import { useCanvasDocument } from '../../../stores/hooks/useCanvasDocument';
import {
  Canvas,
  Toolbox,
  SimulationToolbar,
  useSimulation,
  useCanvasKeyboardShortcuts,
  useBlockDrag,
  useSelectionHandler,
  screenToCanvas,
  type CanvasRef,
  type BlockType,
  type Position,
} from '../../OneCanvas';
import type { Block, Wire as WireData, HandleConstraint, PortPosition } from '../../OneCanvas/types';
import { isPortEndpoint } from '../../OneCanvas/types';
import { WireContextMenu, type WireContextMenuAction } from '../../OneCanvas/overlays/WireContextMenu';
import { useWireHandleDrag } from '../../OneCanvas/hooks/useWireHandleDrag';
import { useWireSegmentDrag } from '../../OneCanvas/hooks/useWireSegmentDrag';
import { PropertiesPanel } from './PropertiesPanel';


// Import simulation styles
import '../../OneCanvas/styles/simulation.css';

// ============================================================================
// Types
// ============================================================================

interface OneCanvasPanelProps {
  /** Tab data (contains documentId, filePath) - reserved for future use */
  data?: unknown;
}

// ============================================================================
// Block Preview Component (for drag overlay)
// ============================================================================

const BlockDragPreview = memo(function BlockDragPreview({ type, presetLabel }: { type: BlockType; presetLabel?: string }) {
  const labels: Record<BlockType, string> = {
    powersource: '+24V',
    plc_out: 'PLC Out',
    plc_in: 'PLC In',
    led: 'LED',
    button: 'Button',
    scope: 'Scope',
  };

  return (
    <div className="px-3 py-2 bg-neutral-700 border border-neutral-500 rounded shadow-lg text-white text-sm font-medium">
      {presetLabel || labels[type] || type}
    </div>
  );
});

// ============================================================================
// Canvas Drop Zone
// ============================================================================

interface CanvasDropZoneProps {
  children: React.ReactNode;
  className?: string;
}

const CanvasDropZone = memo(function CanvasDropZone({ children, className }: CanvasDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-dropzone',
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
    >
      {children}
    </div>
  );
});

// ============================================================================
// Canvas State Hook (Document or Global)
// ============================================================================

/**
 * Hook that returns canvas state from either document registry or global store.
 * This allows OneCanvasPanel to work in both modes seamlessly.
 */
function useCanvasState(documentId: string | null) {
  // Try document-based state first
  const documentState = useCanvasDocument(documentId);

  // Global store state (used when no document)
  const globalComponents = useCanvasStore((state) => state.components);
  const globalJunctions = useCanvasStore((state) => state.junctions);
  const globalWires = useCanvasStore((state) => state.wires);
  const globalZoom = useCanvasStore((state) => state.zoom);
  const globalPan = useCanvasStore((state) => state.pan);
  const globalAddComponent = useCanvasStore((state) => state.addComponent);
  const globalAddWire = useCanvasStore((state) => state.addWire);
  const globalMoveComponent = useCanvasStore((state) => state.moveComponent);
  const globalRemoveWire = useCanvasStore((state) => state.removeWire);
  const globalMoveJunction = useCanvasStore((state) => state.moveJunction);
  const globalUpdateWireHandle = useCanvasStore((state) => state.updateWireHandle);
  const globalRemoveWireHandle = useCanvasStore((state) => state.removeWireHandle);
  const globalMoveWireSegment = useCanvasStore((state) => state.moveWireSegment);
  const globalInsertEndpointHandle = useCanvasStore((state) => state.insertEndpointHandle);
  const globalCleanupOverlappingHandles = useCanvasStore((state) => state.cleanupOverlappingHandles);
  const globalUpdateComponent = useCanvasStore((state) => state.updateComponent);

  // Return document state if available, otherwise global state
  return useMemo(() => {
    if (documentState) {
      return {
        components: documentState.components,
        junctions: documentState.junctions,
        wires: documentState.wires,
        zoom: documentState.zoom,
        pan: documentState.pan,
        addComponent: documentState.addComponent,
        addWire: documentState.addWire,
        moveComponent: documentState.moveComponent,
        moveJunction: documentState.moveJunction,
        removeWire: documentState.removeWire,
        updateComponent: documentState.updateComponent,
        updateWireHandle: documentState.updateWireHandle,
        removeWireHandle: documentState.removeWireHandle,
        moveWireSegment: documentState.moveWireSegment,
        insertEndpointHandle: documentState.insertEndpointHandle,
        cleanupOverlappingHandles: documentState.cleanupOverlappingHandles,
        isDocumentMode: true,
      };
    }

    return {
      components: globalComponents,
      junctions: globalJunctions,
      wires: globalWires,
      zoom: globalZoom,
      pan: globalPan,
      addComponent: globalAddComponent,
      addWire: globalAddWire,
      moveComponent: globalMoveComponent,
      moveJunction: globalMoveJunction,
      removeWire: globalRemoveWire,
      updateComponent: globalUpdateComponent,
      updateWireHandle: globalUpdateWireHandle,
      removeWireHandle: globalRemoveWireHandle,
      moveWireSegment: globalMoveWireSegment,
      insertEndpointHandle: globalInsertEndpointHandle,
      cleanupOverlappingHandles: globalCleanupOverlappingHandles,
      isDocumentMode: false,
    };
  }, [
    documentState,
    globalComponents,
    globalJunctions,
    globalWires,
    globalZoom,
    globalPan,
    globalAddComponent,
    globalAddWire,
    globalMoveComponent,
    globalMoveJunction,
    globalRemoveWire,
    globalUpdateComponent,
    globalUpdateWireHandle,
    globalRemoveWireHandle,
    globalMoveWireSegment,
    globalInsertEndpointHandle,
    globalCleanupOverlappingHandles,
  ]);
}

// ============================================================================
// Component
// ============================================================================

export const OneCanvasPanel = memo(function OneCanvasPanel(_props: OneCanvasPanelProps) {
  const canvasRef = useRef<CanvasRef>(null);
  const containerRectRef = useRef<DOMRect | null>(null);

  // Get document context (may be null if not in document mode)
  const { documentId } = useDocumentContext();

  // Get canvas state (from document or global store)
  const {
    components,
    junctions,
    wires,
    zoom,
    pan,
    addComponent,
    addWire,
    moveComponent,
    moveJunction,
    removeWire,
    updateComponent,
    updateWireHandle,
    removeWireHandle,
    moveWireSegment,
    insertEndpointHandle,
    cleanupOverlappingHandles,
  } = useCanvasState(documentId);

  // Wire drawing state and selection from global store (shared across modes)
  const wireDrawing = useCanvasStore((state) => state.wireDrawing);
  const startWireDrawing = useCanvasStore((state) => state.startWireDrawing);
  const updateWireDrawing = useCanvasStore((state) => state.updateWireDrawing);
  const cancelWireDrawing = useCanvasStore((state) => state.cancelWireDrawing);
  const selectedIds = useCanvasStore((state) => state.selectedIds);

  // DEBUG: Log when selectedIds changes
  console.log('[OneCanvasPanel] selectedIds:', Array.from(selectedIds));

  // Wire context menu state
  const [wireContextMenu, setWireContextMenu] = useState<{
    wireId: string;
    position: Position;
    screenPosition: { x: number; y: number };
  } | null>(null);

  // Cache container bounding rect to avoid getBoundingClientRect on every mouse event
  useEffect(() => {
    const container = canvasRef.current?.getContainer();
    if (!container) return;

    // Initial rect calculation
    containerRectRef.current = container.getBoundingClientRect();

    // ResizeObserver to update rect when container size changes
    const observer = new ResizeObserver(() => {
      containerRectRef.current = container.getBoundingClientRect();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Wire handle drag hook
  const { handleDragStart: handleWireHandleDragStart } = useWireHandleDrag({
    updateWireHandle,
    canvasRef,
    cleanupOverlappingHandles,
  });

  // Wire segment drag hook
  const { handleSegmentDragStart } = useWireSegmentDrag({
    moveWireSegment,
    cleanupOverlappingHandles,
    canvasRef,
  });

  // Endpoint segment drag handler (port ↔ first/last handle)
  const handleEndpointSegmentDragStart = useCallback((
    wireId: string,
    end: 'from' | 'to',
    orientation: 'horizontal' | 'vertical',
    e: React.MouseEvent
  ) => {
    const wire = wires.find((w) => w.id === wireId);
    if (!wire?.handles?.length) return;

    // Only handle port endpoints
    if (!isPortEndpoint(wire.from) || !isPortEndpoint(wire.to)) return;

    // Compute exit position for the endpoint
    const computeExitPos = (endpoint: { componentId: string; portId: string }, exitDir?: PortPosition): Position | null => {
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
        case 'top': return { x: portPos.x, y: portPos.y - dist };
        case 'bottom': return { x: portPos.x, y: portPos.y + dist };
        case 'left': return { x: portPos.x - dist, y: portPos.y };
        case 'right': return { x: portPos.x + dist, y: portPos.y };
      }
    };

    const constraint: HandleConstraint = orientation === 'horizontal' ? 'vertical' : 'horizontal';

    if (end === 'from') {
      const fromEndpoint = wire.from as { componentId: string; portId: string };
      const exitPos = computeExitPos(fromEndpoint, wire.fromExitDirection);
      if (!exitPos) return;

      const firstHandlePos = wire.handles[0].position;

      // Insert TWO handles to maintain orthogonal routing:
      // handleA at exit position, handleB connecting to h0's perpendicular coordinate.
      // This ensures h0 doesn't move, so h0→h1 alignment is preserved.
      const secondPos: Position = orientation === 'vertical'
        ? { x: exitPos.x, y: firstHandlePos.y }  // same X as exit, same Y as h0
        : { x: firstHandlePos.x, y: exitPos.y };  // same Y as exit, same X as h0

      insertEndpointHandle(wireId, 'from', [
        { position: exitPos, constraint },
        { position: secondPos, constraint },
      ]);

      // Drag the two new handles (indices 0, 1). h0 is now at index 2 and doesn't move.
      handleSegmentDragStart(wireId, 0, 1, orientation, e, exitPos, secondPos, true);
    } else {
      const toEndpoint = wire.to as { componentId: string; portId: string };
      const exitPos = computeExitPos(toEndpoint, wire.toExitDirection);
      if (!exitPos) return;

      const lastIdx = wire.handles.length - 1;
      const lastHandlePos = wire.handles[lastIdx].position;

      // Insert TWO handles: handleA connecting from lastH, handleB at exit position.
      const firstPos: Position = orientation === 'vertical'
        ? { x: exitPos.x, y: lastHandlePos.y }  // same X as exit, same Y as lastH
        : { x: lastHandlePos.x, y: exitPos.y };  // same Y as exit, same X as lastH

      insertEndpointHandle(wireId, 'to', [
        { position: firstPos, constraint },
        { position: exitPos, constraint },
      ]);

      // After insert: lastH is at lastIdx, firstPos is at lastIdx+1, exitPos is at lastIdx+2.
      // Drag the two new handles.
      handleSegmentDragStart(wireId, lastIdx + 1, lastIdx + 2, orientation, e, firstPos, exitPos, true);
    }
  }, [wires, components, insertEndpointHandle, handleSegmentDragStart]);

  // Convert Maps to Arrays for simulation
  const componentsArray = useMemo(() => Array.from(components.values()), [components]);
  const junctionsArray = useMemo(() => Array.from(junctions.values()), [junctions]);

  // Simulation hook
  const simulation = useSimulation(componentsArray, wires as WireData[], junctionsArray);

  // Keyboard shortcuts
  useCanvasKeyboardShortcuts();

  // Block drag hook - prevent drag during wire drawing
  // Pass document-aware components and moveComponent to override global store
  const { isDragging: _isDragging, handleBlockDragStart } = useBlockDrag({
    canvasRef,
    shouldPreventDrag: useCallback(() => wireDrawing !== null, [wireDrawing]),
    components: components as Map<string, { position: Position }>,
    moveComponent,
    junctions: junctions as Map<string, { position: Position }>,
    moveJunction,
  });

  // Wire drawing handlers
  const handleStartWire = useCallback(
    (blockId: string, portId: string) => {
      // Validate against document/local components first
      const block = components.get(blockId);
      if (!block || !block.ports.some((p) => p.id === portId)) {
        console.warn('Invalid wire start endpoint:', { blockId, portId });
        return;
      }

      // Calculate port position for exit direction detection
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

      // Skip global store validation since we validated locally
      // Pass start position for exit direction detection
      startWireDrawing({ componentId: blockId, portId }, { skipValidation: true, startPosition });
    },
    [components, startWireDrawing]
  );

  // Wire context menu handlers
  const handleWireContextMenu = useCallback(
    (wireId: string, position: Position, screenPos: { x: number; y: number }) => {
      setWireContextMenu({ wireId, position, screenPosition: screenPos });
    },
    []
  );

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

  // Handle right-click on a wire handle to remove it
  const handleWireHandleContextMenu = useCallback(
    (wireId: string, handleIndex: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      removeWireHandle(wireId, handleIndex);
    },
    [removeWireHandle]
  );

  const handleEndWire = useCallback(
    (blockId: string, portId: string) => {
      if (wireDrawing) {
        // Use document-aware addWire with exit direction info from store wireDrawing
        const to = { componentId: blockId, portId };

        // Get toExitDirection from target port's position
        const toBlock = components.get(blockId);
        let toExitDirection: PortPosition | undefined;
        if (toBlock) {
          const toPort = toBlock.ports.find((p: { id: string; position: string }) => p.id === portId);
          if (toPort) {
            toExitDirection = toPort.position as PortPosition;
          }
        }

        addWire(wireDrawing.from, to, {
          fromExitDirection: wireDrawing.exitDirection,
          toExitDirection,
        });
        cancelWireDrawing();
      }
    },
    [wireDrawing, components, addWire, cancelWireDrawing]
  );

  // Selection handler for drag-to-select (pass current state)
  const selectionHandler = useSelectionHandler({
    components,
    wires,
    junctions,
    zoom,
  });

  // Handle canvas mouse down - for selection box
  const handleCanvasMouseDown = useCallback(
    (event: React.MouseEvent) => {
      console.log('[OneCanvasPanel] MouseDown - wireDrawing:', !!wireDrawing);

      // Don't start selection if wire drawing is active
      if (wireDrawing) {
        console.log('[OneCanvasPanel] Skipping selection - wire drawing active');
        return;
      }

      // TEMPORARY FIX: Use fresh rect instead of cached
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
    [wireDrawing, pan, zoom, selectionHandler, canvasRef]
  );

  // Handle canvas mouse move for wire preview and selection box
  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent) => {
      // TEMPORARY FIX: Use fresh rect instead of cached
      const container = canvasRef.current?.getContainer();
      if (!container) return;
      const rect = container.getBoundingClientRect();

      const screenPos = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const canvasPos = screenToCanvas(screenPos, pan, zoom);

      // Update wire drawing if active
      if (wireDrawing) {
        updateWireDrawing(canvasPos);
      }

      // Update selection box if dragging
      selectionHandler.handleCanvasMouseMove(event, canvasPos);
    },
    [wireDrawing, pan, zoom, updateWireDrawing, selectionHandler, canvasRef]
  );

  // Handle canvas mouse up for wire cancellation and selection completion
  const handleCanvasMouseUp = useCallback(
    (event: React.MouseEvent) => {
      // Handle wire drawing cancellation
      if (wireDrawing) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-port-id]')) {
          cancelWireDrawing();
        }
      }

      // Handle selection completion
      selectionHandler.handleCanvasMouseUp(event);
    },
    [wireDrawing, cancelWireDrawing, selectionHandler]
  );

  // Handle escape key to cancel wire drawing
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && wireDrawing) {
        cancelWireDrawing();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wireDrawing, cancelWireDrawing]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Track dragging state
  const [draggedType, setDraggedType] = useState<BlockType | null>(null);
  const [draggedLabel, setDraggedLabel] = useState<string | undefined>(undefined);

  // Handle drag start from toolbox
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const blockType = active.data.current?.blockType as BlockType | undefined;
    if (blockType) {
      setDraggedType(blockType);
      setDraggedLabel(active.data.current?.presetLabel as string | undefined);
    }
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setDraggedType(null);
      setDraggedLabel(undefined);

      // Check if dropped over canvas
      if (over?.id === 'canvas-dropzone') {
        const blockType = active.data.current?.blockType as BlockType | undefined;
        if (blockType) {
          // Use cached container rect for coordinate calculation
          const rect = containerRectRef.current;
          if (!rect) return;

          // Calculate drop position in canvas coordinates
          // activatorEvent contains the original pointer position when drag started
          const activatorEvent = event.activatorEvent as PointerEvent;
          // Final screen position = start position + delta
          const dropScreenX = activatorEvent.clientX + event.delta.x;
          const dropScreenY = activatorEvent.clientY + event.delta.y;

          // Convert to position relative to canvas container
          const relativeX = dropScreenX - rect.left;
          const relativeY = dropScreenY - rect.top;

          // Apply pan/zoom transformation to get canvas coordinates
          const canvasPos = screenToCanvas({ x: relativeX, y: relativeY }, pan, zoom);
          const position: Position = { x: canvasPos.x, y: canvasPos.y };
          const presetProps = active.data.current?.presetProps as Partial<Block> | undefined;
          addComponent(blockType, position, presetProps);
        }
      }
    },
    [addComponent, zoom, pan]
  );

  // Derive selected components for the Properties sidebar
  const selectedComponentsForPanel = useMemo(() => {
    const result: Block[] = [];
    selectedIds.forEach((id) => {
      const component = components.get(id);
      if (component) result.push(component as Block);
    });
    return result;
  }, [selectedIds, components]);

  // Wrap updateComponent as (id, updates) for PropertiesPanel
  const handleUpdateComponent = useCallback(
    (id: string, updates: Partial<Block>) => {
      updateComponent(id, updates);
    },
    [updateComponent]
  );

  // ============================================================================
  // Simulation Integration
  // ============================================================================

  // Extract port voltages from simulation result
  const portVoltages = useMemo(() => {
    if (!simulation.result) return undefined;
    return simulation.result.nodeVoltages;
  }, [simulation.result]);

  // Calculate connected ports for each block
  const getConnectedPorts = useCallback((blockId: string): Set<string> => {
    const ports = new Set<string>();
    wires.forEach((wire) => {
      if (isPortEndpoint(wire.from) && wire.from.componentId === blockId) {
        ports.add(wire.from.portId);
      }
      if (isPortEndpoint(wire.to) && wire.to.componentId === blockId) {
        ports.add(wire.to.portId);
      }
    });
    return ports;
  }, [wires]);

  // Button press handler - updates simulation runtime state
  const handleButtonPress = useCallback((blockId: string) => {
    simulation.setButtonState(blockId, true);
  }, [simulation]);

  // Button release handler - updates simulation runtime state
  const handleButtonRelease = useCallback((blockId: string) => {
    simulation.setButtonState(blockId, false);
  }, [simulation]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col bg-neutral-950">
        {/* Simulation Toolbar */}
        <SimulationToolbar
          running={simulation.running}
          onStart={simulation.start}
          onStop={simulation.stop}
          onReset={simulation.reset}
          onStep={simulation.step}
          measuredRate={simulation.measuredRate}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Toolbox */}
          <Toolbox />

          {/* Canvas Area */}
          <CanvasDropZone className="flex-1 relative overflow-hidden">
            <div
              className="w-full h-full"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
            >
              <Canvas
                ref={canvasRef}
                className="w-full h-full"
                blocks={components}
                wires={wires}
                junctions={junctions}
                selectionBox={selectionHandler.selectionBox}
                wirePreview={wireDrawing}
                onBlockClick={selectionHandler.handleComponentClick}
                onWireClick={selectionHandler.handleWireClick}
                onJunctionClick={selectionHandler.handleJunctionClick}
                selectedBlockIds={selectedIds}
                selectedWireIds={selectedIds}
                connectedPorts={Array.from(components.keys()).reduce((acc, blockId) => {
                  const ports = getConnectedPorts(blockId);
                  ports.forEach(portId => acc.add(portId));
                  return acc;
                }, new Set<string>())}
                portVoltages={portVoltages}
                plcOutputStates={new Map()}
                onButtonPress={handleButtonPress}
                onButtonRelease={handleButtonRelease}
                onStartWire={handleStartWire}
                onEndWire={handleEndWire}
                onBlockDragStart={handleBlockDragStart}
                onWireContextMenu={handleWireContextMenu}
                onWireHandleDragStart={handleWireHandleDragStart}
                onWireHandleContextMenu={handleWireHandleContextMenu}
                onWireSegmentDragStart={handleSegmentDragStart}
                onWireEndpointSegmentDragStart={handleEndpointSegmentDragStart}
                debugMode={process.env.NODE_ENV === 'development'}
              />
            </div>
          </CanvasDropZone>

          {/* Properties Sidebar */}
          {selectedComponentsForPanel.length === 1 && (
            <div className="w-64 border-l border-neutral-700 overflow-y-auto flex-shrink-0 bg-neutral-900">
              <PropertiesPanel
                selectedComponents={selectedComponentsForPanel}
                onUpdateComponent={handleUpdateComponent}
              />
            </div>
          )}
        </div>
      </div>

      {/* Wire Context Menu */}
      {wireContextMenu && (
        <WireContextMenu
          screenPosition={wireContextMenu.screenPosition}
          wireId={wireContextMenu.wireId}
          wireClickPosition={wireContextMenu.position}
          onClose={handleCloseWireContextMenu}
          onAction={handleWireContextMenuAction}
        />
      )}

      {/* Drag Overlay */}
      <DragOverlay>
        {draggedType && <BlockDragPreview type={draggedType} presetLabel={draggedLabel} />}
      </DragOverlay>
    </DndContext>
  );
});

export default OneCanvasPanel;
