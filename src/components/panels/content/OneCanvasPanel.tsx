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
  BlockRenderer,
  Wire,
  WirePreview,
  SelectionBox,
  useSimulation,
  useCanvasKeyboardShortcuts,
  useBlockDrag,
  screenToCanvas,
  type CanvasRef,
  type BlockType,
  type Position,
  type SelectionBoxState,
} from '../../OneCanvas';
import type { Wire as WireData, HandleConstraint, PortPosition } from '../../OneCanvas/types';
import { WireContextMenu, type WireContextMenuAction } from '../../OneCanvas/components/WireContextMenu';
import { useWireHandleDrag } from '../../OneCanvas/hooks/useWireHandleDrag';
import { getBlockSize } from '../../OneCanvas/utils/wirePathCalculator';

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

const BlockDragPreview = memo(function BlockDragPreview({ type }: { type: BlockType }) {
  const labels: Record<BlockType, string> = {
    power_24v: '+24V',
    power_12v: '+12V',
    gnd: 'GND',
    plc_out: 'PLC Out',
    plc_in: 'PLC In',
    led: 'LED',
    button: 'Button',
    scope: 'Scope',
    junction: 'Junction',
  };

  return (
    <div className="px-3 py-2 bg-neutral-700 border border-neutral-500 rounded shadow-lg text-white text-sm font-medium">
      {labels[type] || type}
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
// Wire Renderer (converts store Wire to component props)
// ============================================================================

interface WireRendererProps {
  wire: WireData;
  components: Map<string, { type: string; position: Position; ports: Array<{ id: string; position: string; offset?: number }> }>;
  isSelected: boolean;
  onAddHandle?: (wireId: string, position: Position) => void;
  onContextMenu?: (wireId: string, position: Position, screenPos: { x: number; y: number }) => void;
  onHandleDragStart?: (wireId: string, handleIndex: number, constraint: HandleConstraint, e: React.MouseEvent, handlePosition: Position) => void;
  onHandleContextMenu?: (wireId: string, handleIndex: number, e: React.MouseEvent) => void;
}

const WireRenderer = memo(function WireRenderer({
  wire,
  components,
  isSelected,
  onAddHandle,
  onContextMenu,
  onHandleDragStart,
  onHandleContextMenu,
}: WireRendererProps) {
  const { id: wireId, from, to, points, handleConstraints, fromExitDirection, toExitDirection } = wire;

  // Get component positions and calculate wire endpoints
  const fromComponent = components.get(from.componentId);
  const toComponent = components.get(to.componentId);

  if (!fromComponent || !toComponent) return null;

  // Calculate port positions using actual block sizes
  const getPortPosition = (
    component: { type: string; position: Position; ports: Array<{ id: string; position: string; offset?: number }> },
    portId: string
  ): { position: Position; direction: PortPosition } => {
    const port = component.ports.find((p) => p.id === portId);
    const basePos = component.position;
    const blockSize = getBlockSize(component.type);
    const { width: blockWidth, height: blockHeight } = blockSize;

    if (!port) {
      return {
        position: { x: basePos.x + blockWidth / 2, y: basePos.y + blockHeight / 2 },
        direction: 'right',
      };
    }

    const offset = port.offset ?? 0.5;
    let position: Position;
    const direction = port.position as PortPosition;

    switch (port.position) {
      case 'top':
        position = { x: basePos.x + blockWidth * offset, y: basePos.y };
        break;
      case 'bottom':
        position = { x: basePos.x + blockWidth * offset, y: basePos.y + blockHeight };
        break;
      case 'left':
        position = { x: basePos.x, y: basePos.y + blockHeight * offset };
        break;
      case 'right':
        position = { x: basePos.x + blockWidth, y: basePos.y + blockHeight * offset };
        break;
      default:
        position = { x: basePos.x + blockWidth / 2, y: basePos.y + blockHeight / 2 };
    }

    return { position, direction };
  };

  const fromData = getPortPosition(fromComponent, from.portId);
  const toData = getPortPosition(toComponent, to.portId);

  return (
    <Wire
      id={wireId}
      from={fromData.position}
      to={toData.position}
      isSelected={isSelected}
      pathMode="orthogonal"
      handles={points}
      handleConstraints={handleConstraints}
      fromExitDirection={fromExitDirection}
      toExitDirection={toExitDirection}
      defaultFromDirection={fromData.direction}
      defaultToDirection={toData.direction}
      onAddHandle={onAddHandle}
      onContextMenu={onContextMenu}
      onHandleDragStart={onHandleDragStart}
      onHandleContextMenu={onHandleContextMenu}
    />
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
  const globalWires = useCanvasStore((state) => state.wires);
  const globalZoom = useCanvasStore((state) => state.zoom);
  const globalPan = useCanvasStore((state) => state.pan);
  const globalAddComponent = useCanvasStore((state) => state.addComponent);
  const globalAddWire = useCanvasStore((state) => state.addWire);
  const globalMoveComponent = useCanvasStore((state) => state.moveComponent);
  const globalRemoveWire = useCanvasStore((state) => state.removeWire);
  const globalCreateJunctionOnWire = useCanvasStore((state) => state.createJunctionOnWire);
  const globalAddWireHandle = useCanvasStore((state) => state.addWireHandle);
  const globalUpdateWireHandle = useCanvasStore((state) => state.updateWireHandle);
  const globalRemoveWireHandle = useCanvasStore((state) => state.removeWireHandle);

  // Return document state if available, otherwise global state
  return useMemo(() => {
    if (documentState) {
      return {
        components: documentState.components,
        wires: documentState.wires,
        zoom: documentState.zoom,
        pan: documentState.pan,
        addComponent: documentState.addComponent,
        addWire: documentState.addWire,
        moveComponent: documentState.moveComponent,
        removeWire: documentState.removeWire,
        createJunctionOnWire: documentState.createJunctionOnWire,
        addWireHandle: documentState.addWireHandle,
        updateWireHandle: documentState.updateWireHandle,
        removeWireHandle: documentState.removeWireHandle,
        isDocumentMode: true,
      };
    }

    return {
      components: globalComponents,
      wires: globalWires,
      zoom: globalZoom,
      pan: globalPan,
      addComponent: globalAddComponent,
      addWire: globalAddWire,
      moveComponent: globalMoveComponent,
      removeWire: globalRemoveWire,
      createJunctionOnWire: globalCreateJunctionOnWire,
      addWireHandle: globalAddWireHandle,
      updateWireHandle: globalUpdateWireHandle,
      removeWireHandle: globalRemoveWireHandle,
      isDocumentMode: false,
    };
  }, [
    documentState,
    globalComponents,
    globalWires,
    globalZoom,
    globalPan,
    globalAddComponent,
    globalAddWire,
    globalMoveComponent,
    globalRemoveWire,
    globalCreateJunctionOnWire,
    globalAddWireHandle,
    globalUpdateWireHandle,
    globalRemoveWireHandle,
  ]);
}

// ============================================================================
// Component
// ============================================================================

export const OneCanvasPanel = memo(function OneCanvasPanel(_props: OneCanvasPanelProps) {
  const canvasRef = useRef<CanvasRef>(null);

  // Get document context (may be null if not in document mode)
  const { documentId } = useDocumentContext();

  // Get canvas state (from document or global store)
  const {
    components,
    wires,
    zoom,
    pan,
    addComponent,
    moveComponent,
    removeWire,
    createJunctionOnWire,
    addWireHandle,
    updateWireHandle,
    removeWireHandle,
  } = useCanvasState(documentId);

  // Wire drawing state and selection from global store (shared across modes)
  const wireDrawing = useCanvasStore((state) => state.wireDrawing);
  const startWireDrawing = useCanvasStore((state) => state.startWireDrawing);
  const updateWireDrawing = useCanvasStore((state) => state.updateWireDrawing);
  const completeWireDrawing = useCanvasStore((state) => state.completeWireDrawing);
  const cancelWireDrawing = useCanvasStore((state) => state.cancelWireDrawing);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const setSelection = useCanvasStore((state) => state.setSelection);

  // Wire context menu state
  const [wireContextMenu, setWireContextMenu] = useState<{
    wireId: string;
    position: Position;
    screenPosition: { x: number; y: number };
  } | null>(null);

  // Wire handle drag hook
  const { handleDragStart: handleWireHandleDragStart } = useWireHandleDrag({
    updateWireHandle,
    zoom,
  });

  // Convert Map to Array for simulation
  const componentsArray = useMemo(() => Array.from(components.values()), [components]);

  // Simulation hook
  const simulation = useSimulation(componentsArray, wires as WireData[]);

  // Keyboard shortcuts
  useCanvasKeyboardShortcuts();

  // Block drag hook - prevent drag during wire drawing
  // Pass document-aware components and moveComponent to override global store
  const { isDragging: _isDragging, handleBlockDragStart } = useBlockDrag({
    canvasRef: canvasRef as React.RefObject<HTMLElement | null>,
    shouldPreventDrag: useCallback(() => wireDrawing !== null, [wireDrawing]),
    components: components as Map<string, { position: Position }>,
    moveComponent,
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
        const blockSize = getBlockSize(block.type);
        const offset = port.offset ?? 0.5;
        let portRelativePos: Position;
        switch (port.position) {
          case 'top':
            portRelativePos = { x: blockSize.width * offset, y: 0 };
            break;
          case 'bottom':
            portRelativePos = { x: blockSize.width * offset, y: blockSize.height };
            break;
          case 'left':
            portRelativePos = { x: 0, y: blockSize.height * offset };
            break;
          case 'right':
            portRelativePos = { x: blockSize.width, y: blockSize.height * offset };
            break;
          default:
            portRelativePos = { x: blockSize.width / 2, y: blockSize.height / 2 };
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

      switch (action) {
        case 'add_junction':
          createJunctionOnWire(wireContextMenu.wireId, wireContextMenu.position);
          break;
        case 'add_handle':
          addWireHandle(wireContextMenu.wireId, wireContextMenu.position);
          break;
        case 'delete':
          removeWire(wireContextMenu.wireId);
          break;
      }
      setWireContextMenu(null);
    },
    [wireContextMenu, createJunctionOnWire, addWireHandle, removeWire]
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
        // Use completeWireDrawing to properly record exit directions
        completeWireDrawing({ componentId: blockId, portId });
      }
    },
    [wireDrawing, completeWireDrawing]
  );

  // Handle canvas mouse move for wire preview
  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!wireDrawing) return;

      const container = canvasRef.current?.getContainer();
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const screenPos = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const canvasPos = screenToCanvas(screenPos, pan, zoom);
      updateWireDrawing(canvasPos);
    },
    [wireDrawing, pan, zoom, updateWireDrawing]
  );

  // Handle canvas mouse up for wire cancellation (when not ending on a port)
  const handleCanvasMouseUp = useCallback(
    (event: React.MouseEvent) => {
      if (!wireDrawing) return;

      // If clicking on empty canvas (not a port), cancel wire drawing
      const target = event.target as HTMLElement;
      if (!target.closest('[data-port-id]')) {
        cancelWireDrawing();
      }
    },
    [wireDrawing, cancelWireDrawing]
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

  // Handle block selection
  const handleBlockSelect = useCallback(
    (blockId: string, addToSelection: boolean) => {
      if (addToSelection) {
        // Toggle selection when Ctrl/Cmd is held
        const newSelection = new Set(selectedIds);
        if (newSelection.has(blockId)) {
          newSelection.delete(blockId);
        } else {
          newSelection.add(blockId);
        }
        setSelection(Array.from(newSelection));
      } else {
        // Replace selection
        setSelection([blockId]);
      }
    },
    [selectedIds, setSelection]
  );

  // Selection box state for drag-to-select
  const [selectionBox] = useState<SelectionBoxState | null>(null);

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

  // Handle drag start from toolbox
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const blockType = active.data.current?.blockType as BlockType | undefined;
    if (blockType) {
      setDraggedType(blockType);
    }
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setDraggedType(null);

      // Check if dropped over canvas
      if (over?.id === 'canvas-dropzone') {
        const blockType = active.data.current?.blockType as BlockType | undefined;
        if (blockType) {
          // Get the canvas container for coordinate calculation
          const container = canvasRef.current?.getContainer();
          if (!container) return;

          // Calculate drop position in canvas coordinates
          // activatorEvent contains the original pointer position when drag started
          const activatorEvent = event.activatorEvent as PointerEvent;
          // Final screen position = start position + delta
          const dropScreenX = activatorEvent.clientX + event.delta.x;
          const dropScreenY = activatorEvent.clientY + event.delta.y;

          // Convert to position relative to canvas container
          const rect = container.getBoundingClientRect();
          const relativeX = dropScreenX - rect.left;
          const relativeY = dropScreenY - rect.top;

          // Apply pan/zoom transformation to get canvas coordinates
          const canvasX = (relativeX - pan.x) / zoom;
          const canvasY = (relativeY - pan.y) / zoom;

          const position: Position = { x: canvasX, y: canvasY };
          addComponent(blockType, position);
        }
      }
    },
    [addComponent, zoom, pan]
  );

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
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
            >
              <Canvas ref={canvasRef} className="w-full h-full">
                {/* Render blocks */}
                {Array.from(components.values()).map((block) => (
                  <BlockRenderer
                    key={block.id}
                    block={block}
                    isSelected={selectedIds.has(block.id)}
                    onSelect={handleBlockSelect}
                    onStartWire={handleStartWire}
                    onEndWire={handleEndWire}
                    onDragStart={handleBlockDragStart}
                  />
                ))}

              {/* SVG layer for wires - must wrap SVG elements */}
              <svg
                className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible"
                style={{ minWidth: '10000px', minHeight: '10000px' }}
              >
                {/* Render wires */}
                {wires.map((wire) => (
                  <WireRenderer
                    key={wire.id}
                    wire={wire}
                    components={components as Map<string, { type: string; position: Position; ports: Array<{ id: string; position: string; offset?: number }> }>}
                    isSelected={selectedIds.has(wire.id)}
                    onAddHandle={addWireHandle}
                    onContextMenu={handleWireContextMenu}
                    onHandleDragStart={handleWireHandleDragStart}
                    onHandleContextMenu={handleWireHandleContextMenu}
                  />
                ))}

                {/* Wire preview during drawing */}
                {wireDrawing && (() => {
                  // Calculate the from position from the endpoint
                  const fromComponent = components.get(wireDrawing.from.componentId);
                  if (!fromComponent) return null;

                  const fromPort = fromComponent.ports.find((p) => p.id === wireDrawing.from.portId);
                  const fromBlockSize = getBlockSize(fromComponent.type);
                  const portOffset = fromPort?.offset ?? 0.5;
                  let fromPos: Position = { x: fromComponent.position.x + fromBlockSize.width / 2, y: fromComponent.position.y + fromBlockSize.height / 2 };
                  let defaultFromDir: PortPosition | undefined;

                  if (fromPort) {
                    defaultFromDir = fromPort.position as PortPosition;
                    switch (fromPort.position) {
                      case 'top':
                        fromPos = { x: fromComponent.position.x + fromBlockSize.width * portOffset, y: fromComponent.position.y };
                        break;
                      case 'bottom':
                        fromPos = { x: fromComponent.position.x + fromBlockSize.width * portOffset, y: fromComponent.position.y + fromBlockSize.height };
                        break;
                      case 'left':
                        fromPos = { x: fromComponent.position.x, y: fromComponent.position.y + fromBlockSize.height * portOffset };
                        break;
                      case 'right':
                        fromPos = { x: fromComponent.position.x + fromBlockSize.width, y: fromComponent.position.y + fromBlockSize.height * portOffset };
                        break;
                    }
                  }

                  return (
                    <WirePreview
                      from={fromPos}
                      to={wireDrawing.tempPosition}
                      fromExitDirection={wireDrawing.exitDirection}
                      defaultFromDirection={defaultFromDir}
                    />
                  );
                })()}
              </svg>

              {/* Selection box */}
              <SelectionBox box={selectionBox} />
            </Canvas>
            </div>
          </CanvasDropZone>
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
        {draggedType && <BlockDragPreview type={draggedType} />}
      </DragOverlay>
    </DndContext>
  );
});

export default OneCanvasPanel;
