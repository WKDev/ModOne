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
import type { Wire as WireData } from '../../OneCanvas/types';

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
  wireId: string;
  from: { componentId: string; portId: string };
  to: { componentId: string; portId: string };
  components: Map<string, { position: Position; ports: Array<{ id: string; position: string; offset?: number }> }>;
  isSelected: boolean;
}

const WireRenderer = memo(function WireRenderer({
  wireId,
  from,
  to,
  components,
  isSelected,
}: WireRendererProps) {
  // Get component positions and calculate wire endpoints
  const fromComponent = components.get(from.componentId);
  const toComponent = components.get(to.componentId);

  if (!fromComponent || !toComponent) return null;

  // Calculate port positions (simplified - assumes 60x60 blocks)
  const getPortPosition = (
    component: { position: Position; ports: Array<{ id: string; position: string; offset?: number }> },
    portId: string
  ): Position => {
    const port = component.ports.find((p) => p.id === portId);
    const basePos = component.position;
    const blockWidth = 60;
    const blockHeight = 60;

    if (!port) return basePos;

    switch (port.position) {
      case 'top':
        return { x: basePos.x + blockWidth / 2, y: basePos.y };
      case 'bottom':
        return { x: basePos.x + blockWidth / 2, y: basePos.y + blockHeight };
      case 'left':
        return { x: basePos.x, y: basePos.y + blockHeight / 2 };
      case 'right':
        return { x: basePos.x + blockWidth, y: basePos.y + blockHeight / 2 };
      default:
        return { x: basePos.x + blockWidth / 2, y: basePos.y + blockHeight / 2 };
    }
  };

  const fromPos = getPortPosition(fromComponent, from.portId);
  const toPos = getPortPosition(toComponent, to.portId);

  return (
    <Wire
      id={wireId}
      from={fromPos}
      to={toPos}
      isSelected={isSelected}
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

  // Return document state if available, otherwise global state
  return useMemo(() => {
    if (documentState) {
      return {
        components: documentState.components,
        wires: documentState.wires,
        zoom: documentState.zoom,
        pan: documentState.pan,
        addComponent: documentState.addComponent,
        isDocumentMode: true,
      };
    }

    return {
      components: globalComponents,
      wires: globalWires,
      zoom: globalZoom,
      pan: globalPan,
      addComponent: globalAddComponent,
      isDocumentMode: false,
    };
  }, [
    documentState,
    globalComponents,
    globalWires,
    globalZoom,
    globalPan,
    globalAddComponent,
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
  const { components, wires, zoom, pan, addComponent } = useCanvasState(documentId);

  // Wire drawing state and actions from global store
  const wireDrawing = useCanvasStore((state) => state.wireDrawing);
  const startWireDrawing = useCanvasStore((state) => state.startWireDrawing);
  const updateWireDrawing = useCanvasStore((state) => state.updateWireDrawing);
  const completeWireDrawing = useCanvasStore((state) => state.completeWireDrawing);
  const cancelWireDrawing = useCanvasStore((state) => state.cancelWireDrawing);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const setSelection = useCanvasStore((state) => state.setSelection);

  // Convert Map to Array for simulation
  const componentsArray = useMemo(() => Array.from(components.values()), [components]);

  // Simulation hook
  const simulation = useSimulation(componentsArray, wires as WireData[]);

  // Keyboard shortcuts
  useCanvasKeyboardShortcuts();

  // Block drag hook - prevent drag during wire drawing
  const { isDragging: _isDragging, handleBlockDragStart } = useBlockDrag({
    canvasRef: canvasRef as React.RefObject<HTMLElement | null>,
    shouldPreventDrag: useCallback(() => wireDrawing !== null, [wireDrawing]),
  });

  // Wire drawing handlers
  const handleStartWire = useCallback(
    (blockId: string, portId: string) => {
      startWireDrawing({ componentId: blockId, portId });
    },
    [startWireDrawing]
  );

  const handleEndWire = useCallback(
    (blockId: string, portId: string) => {
      if (wireDrawing) {
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
          const rect = container.getBoundingClientRect();
          const dropX = event.delta.x + rect.width / 2;
          const dropY = event.delta.y + rect.height / 2;

          // Convert screen position to canvas coordinates
          const canvasX = (dropX - pan.x) / zoom;
          const canvasY = (dropY - pan.y) / zoom;

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

              {/* Render wires */}
              {wires.map((wire) => (
                <WireRenderer
                  key={wire.id}
                  wireId={wire.id}
                  from={wire.from}
                  to={wire.to}
                  components={components as Map<string, { position: Position; ports: Array<{ id: string; position: string; offset?: number }> }>}
                  isSelected={selectedIds.has(wire.id)}
                />
              ))}

              {/* Wire preview during drawing */}
              {wireDrawing && (() => {
                // Calculate the from position from the endpoint
                const fromComponent = components.get(wireDrawing.from.componentId);
                if (!fromComponent) return null;

                const fromPort = fromComponent.ports.find((p) => p.id === wireDrawing.from.portId);
                const blockSize = 60;
                let fromPos: Position = { x: fromComponent.position.x + blockSize / 2, y: fromComponent.position.y + blockSize / 2 };

                if (fromPort) {
                  switch (fromPort.position) {
                    case 'top':
                      fromPos = { x: fromComponent.position.x + blockSize / 2, y: fromComponent.position.y };
                      break;
                    case 'bottom':
                      fromPos = { x: fromComponent.position.x + blockSize / 2, y: fromComponent.position.y + blockSize };
                      break;
                    case 'left':
                      fromPos = { x: fromComponent.position.x, y: fromComponent.position.y + blockSize / 2 };
                      break;
                    case 'right':
                      fromPos = { x: fromComponent.position.x + blockSize, y: fromComponent.position.y + blockSize / 2 };
                      break;
                  }
                }

                return (
                  <WirePreview
                    from={fromPos}
                    to={wireDrawing.tempPosition}
                  />
                );
              })()}

              {/* Selection box */}
              <SelectionBox box={selectionBox} />
            </Canvas>
            </div>
          </CanvasDropZone>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggedType && <BlockDragPreview type={draggedType} />}
      </DragOverlay>
    </DndContext>
  );
});

export default OneCanvasPanel;
