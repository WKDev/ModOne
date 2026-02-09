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

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useCanvasStore } from '../../../stores/canvasStore';
import { useDocumentContext } from '../../../contexts/DocumentContext';
import { PanelErrorBoundary } from '../../error/PanelErrorBoundary';
import {
  Canvas,
  SimulationToolbar,
  Toolbox,
  screenToCanvas,
  type BlockType,
  type CanvasRef,
  type Position,
} from '../../OneCanvas';
import type { Block, Junction, Wire } from '../../OneCanvas/types';
import { CanvasMinimap } from '../../OneCanvas/components/CanvasMinimap';
import { CanvasToolbar } from '../../OneCanvas/CanvasToolbar';
import { SchematicPageBar } from '../../OneCanvas/components/SchematicPageBar';
import { WireContextMenu } from '../../OneCanvas/overlays/WireContextMenu';
import { useWireHandleDrag } from '../../OneCanvas/hooks/useWireHandleDrag';
import { useWireSegmentDrag } from '../../OneCanvas/hooks/useWireSegmentDrag';
import { generateWireNumbers, applyWireNumbers, type WireNumberingOptions } from '../../OneCanvas/utils/wireNumbering';
import { openPrintDialog, type PrintLayoutConfig } from '../../OneCanvas/utils/printSupport';
import { updatePageCircuitInDocument } from '../../OneCanvas/utils/schematicHelpers';
import { isPortEndpoint } from '../../OneCanvas/types';
import { useBlockDrag, useCanvasKeyboardShortcuts, useSelectionHandler, useSimulation } from '../../OneCanvas';
import { useDocumentRegistry } from '../../../stores/documentRegistry';
import { useSchematicDocument } from '../../../stores/hooks/useSchematicDocument';
import { PropertiesPanel } from './PropertiesPanel';
import { BlockDragPreview } from './canvas/BlockDragPreview';
import { CanvasDropZone } from './canvas/CanvasDropZone';
import { CanvasDialogs } from './canvas/CanvasDialogs';
import { useCanvasState } from './canvas/useCanvasState';
import { useCanvasInteractions } from './canvas/CanvasInteractionHandlers';

import '../../OneCanvas/styles/simulation.css';

interface OneCanvasPanelProps {
  data?: unknown;
}

export const OneCanvasPanel = memo(function OneCanvasPanel(_props: OneCanvasPanelProps) {
  const canvasRef = useRef<CanvasRef>(null);
  const containerRectRef = useRef<DOMRect | null>(null);

  const { documentId } = useDocumentContext();

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
    wireDrawing,
    startWireDrawing,
    updateWireDrawing,
    cancelWireDrawing,
    selectedIds,
    setPan,
    alignSelected,
    distributeSelected,
    flipSelected,
  } = useCanvasState(documentId);

  const schematicDoc = useSchematicDocument(documentId);

  const handleSchematicPageSwitch = useCallback(
    (targetPageId: string) => {
      if (!schematicDoc || !documentId) return;
      const currentPageId = schematicDoc.schematic.activePageId;
      if (targetPageId === currentPageId) return;

      const currentCircuit = useCanvasStore.getState().getCircuitData();
      updatePageCircuitInDocument(documentId, currentPageId, currentCircuit);
      useDocumentRegistry.getState().pushHistory(documentId);
      schematicDoc.setActivePage(targetPageId);

      const targetPage = schematicDoc.schematic.pages.find((p) => p.id === targetPageId);
      if (!targetPage) return;
      useCanvasStore.getState().loadCircuit(targetPage.circuit);
    },
    [schematicDoc, documentId]
  );

  const [minimapCollapsed, setMinimapCollapsed] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [wireNumberingOpen, setWireNumberingOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    const toggle = () => {
      setDebugMode((prev) => {
        const next = !prev;
        console.log(`[OneCanvas] Debug mode ${next ? 'ON' : 'OFF'}`);
        return next;
      });
    };
    (window as unknown as Record<string, unknown>).canvasDebug = toggle;
    return () => {
      delete (window as unknown as Record<string, unknown>).canvasDebug;
    };
  }, []);

  useEffect(() => {
    const container = canvasRef.current?.getContainer();
    if (!container) return;

    containerRectRef.current = container.getBoundingClientRect();
    setViewportSize({ width: containerRectRef.current.width, height: containerRectRef.current.height });

    const observer = new ResizeObserver(() => {
      containerRectRef.current = container.getBoundingClientRect();
      if (containerRectRef.current) {
        setViewportSize({ width: containerRectRef.current.width, height: containerRectRef.current.height });
      }
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const { handleDragStart: handleWireHandleDragStart } = useWireHandleDrag({
    updateWireHandle,
    canvasRef,
    cleanupOverlappingHandles,
  });

  const { handleSegmentDragStart } = useWireSegmentDrag({
    moveWireSegment,
    cleanupOverlappingHandles,
    canvasRef,
  });

  const selectionHandler = useSelectionHandler({
    components,
    wires,
    junctions,
    zoom,
  });

  const {
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
  } = useCanvasInteractions({
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
  });

  const componentsArray = useMemo(() => Array.from(components.values()), [components]);
  const junctionsArray = useMemo(() => Array.from(junctions.values()), [junctions]);
  const simulation = useSimulation(componentsArray, wires, junctionsArray);

  useCanvasKeyboardShortcuts();

  const { handleBlockDragStart } = useBlockDrag({
    canvasRef,
    shouldPreventDrag: useCallback(() => wireDrawing !== null, [wireDrawing]),
    components: components as Map<string, { position: Position }>,
    moveComponent,
    junctions: junctions as Map<string, { position: Position }>,
    moveJunction,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && wireDrawing) {
        cancelWireDrawing();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wireDrawing, cancelWireDrawing]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const [draggedType, setDraggedType] = useState<BlockType | null>(null);
  const [draggedLabel, setDraggedLabel] = useState<string | undefined>(undefined);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const blockType = active.data.current?.blockType as BlockType | undefined;
    if (blockType) {
      setDraggedType(blockType);
      setDraggedLabel(active.data.current?.presetLabel as string | undefined);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setDraggedType(null);
      setDraggedLabel(undefined);

      if (over?.id === 'canvas-dropzone') {
        const blockType = active.data.current?.blockType as BlockType | undefined;
        if (blockType) {
          const rect = containerRectRef.current;
          if (!rect) return;

          const activatorEvent = event.activatorEvent as PointerEvent;
          const dropScreenX = activatorEvent.clientX + event.delta.x;
          const dropScreenY = activatorEvent.clientY + event.delta.y;
          const relativeX = dropScreenX - rect.left;
          const relativeY = dropScreenY - rect.top;
          const canvasPos = screenToCanvas({ x: relativeX, y: relativeY }, pan, zoom);
          const position: Position = { x: canvasPos.x, y: canvasPos.y };
          const presetProps = active.data.current?.presetProps as Partial<Block> | undefined;
          addComponent(blockType, position, presetProps);
        }
      }
    },
    [addComponent, zoom, pan]
  );

  const selectedComponentsForPanel = useMemo(() => {
    const result: Block[] = [];
    selectedIds.forEach((id) => {
      const component = components.get(id);
      if (component) result.push(component as Block);
    });
    return result;
  }, [selectedIds, components]);

  const handleUpdateComponent = useCallback(
    (id: string, updates: Partial<Block>) => {
      updateComponent(id, updates);
    },
    [updateComponent]
  );

  const portVoltages = useMemo(() => {
    if (!simulation.result) return undefined;
    return simulation.result.nodeVoltages;
  }, [simulation.result]);

  const getConnectedPorts = useCallback(
    (blockId: string): Set<string> => {
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
    },
    [wires]
  );

  const handleButtonPress = useCallback(
    (blockId: string) => {
      simulation.setButtonState(blockId, true);
    },
    [simulation]
  );

  const handleButtonRelease = useCallback(
    (blockId: string) => {
      simulation.setButtonState(blockId, false);
    },
    [simulation]
  );

  const handleApplyWireNumbering = useCallback(
    (options: WireNumberingOptions) => {
      const result = generateWireNumbers(wires, components, options);
      const updatedWires = applyWireNumbers(wires, result.wireNumbers);
      console.log('Wire numbering applied:', result.stats);
      console.log('Updated wires:', updatedWires.length);
    },
    [wires, components]
  );

  const handlePrint = useCallback((config: PrintLayoutConfig) => {
    const container = canvasRef.current?.getContainer();
    const svgElement = container?.querySelector('svg');
    if (svgElement) {
      const svgContent = svgElement.outerHTML;
      openPrintDialog(svgContent, config);
    }
  }, []);

  const handleLoadTemplate = useCallback(
    (
      templateComponents: Map<string, Block>,
      templateWires: Wire[],
      _templateJunctions: Map<string, Junction>,
      _offset: Position
    ) => {
      templateComponents.forEach((block) => {
        addComponent(block.type, block.position, block);
      });

      templateWires.forEach((wire) => {
        if (isPortEndpoint(wire.from) && isPortEndpoint(wire.to)) {
          addWire(wire.from, wire.to, {
            fromExitDirection: wire.fromExitDirection,
            toExitDirection: wire.toExitDirection,
          });
        }
      });
    },
    [addComponent, addWire]
  );

  return (
    <PanelErrorBoundary panelName="Canvas">
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="h-full flex flex-col bg-neutral-950">
          <SimulationToolbar
            running={simulation.running}
            onStart={simulation.start}
            onStop={simulation.stop}
            onReset={simulation.reset}
            onStep={simulation.step}
            measuredRate={simulation.measuredRate}
          />

          <div className="flex items-center justify-center px-2 py-1 bg-neutral-900 border-b border-neutral-800">
            <CanvasToolbar
              onAlignSelected={alignSelected}
              onDistributeSelected={distributeSelected}
              onFlipSelected={flipSelected}
              onOpenWireNumbering={() => setWireNumberingOpen(true)}
              onOpenPrint={() => setPrintDialogOpen(true)}
              hasSelection={selectedIds.size > 0}
              selectionCount={selectedIds.size}
            />
          </div>

          <div className="flex-1 flex overflow-hidden">
            <Toolbox onOpenLibrary={() => setLibraryOpen(true)} />

            <CanvasDropZone className="flex-1 relative overflow-hidden">
              <div className="w-full h-full" onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp}>
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
                    ports.forEach((portId) => acc.add(portId));
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
                  onUpdateComponent={handleUpdateComponent}
                  debugMode={debugMode}
                />

                <CanvasMinimap
                  components={components}
                  wires={wires}
                  zoom={zoom}
                  pan={pan}
                  viewportWidth={viewportSize.width}
                  viewportHeight={viewportSize.height}
                  onNavigate={setPan}
                  collapsed={minimapCollapsed}
                  onToggleCollapse={() => setMinimapCollapsed(!minimapCollapsed)}
                />
              </div>

              {schematicDoc && (
                <SchematicPageBar
                  pages={schematicDoc.schematic.pages}
                  activePageId={schematicDoc.schematic.activePageId}
                  onActivatePage={handleSchematicPageSwitch}
                  onAddPage={() => schematicDoc.addPage()}
                  onRemovePage={schematicDoc.removePage}
                  onRenamePage={(pageId, newName) => schematicDoc.updatePage(pageId, { name: newName })}
                  onDuplicatePage={schematicDoc.duplicatePage}
                  hasNextPage={schematicDoc.navigationInfo.hasNext}
                  hasPreviousPage={schematicDoc.navigationInfo.hasPrevious}
                  onNextPage={schematicDoc.goToNextPage}
                  onPreviousPage={schematicDoc.goToPreviousPage}
                />
              )}
            </CanvasDropZone>

            {selectedComponentsForPanel.length === 1 && (
              <div className="w-64 min-h-0 border-l border-neutral-700 overflow-y-auto flex-shrink-0 bg-neutral-900">
                <PropertiesPanel selectedComponents={selectedComponentsForPanel} onUpdateComponent={handleUpdateComponent} />
              </div>
            )}
          </div>
        </div>

        {wireContextMenu && (
          <WireContextMenu
            screenPosition={wireContextMenu.screenPosition}
            wireId={wireContextMenu.wireId}
            wireClickPosition={wireContextMenu.position}
            onClose={handleCloseWireContextMenu}
            onAction={handleWireContextMenuAction}
          />
        )}

        <DragOverlay>{draggedType && <BlockDragPreview type={draggedType} presetLabel={draggedLabel} />}</DragOverlay>

        <CanvasDialogs
          libraryOpen={libraryOpen}
          onCloseLibrary={() => setLibraryOpen(false)}
          selectedIds={selectedIds}
          components={components}
          wires={wires}
          junctions={junctions}
          onLoadTemplate={handleLoadTemplate}
          wireNumberingOpen={wireNumberingOpen}
          onCloseWireNumbering={() => setWireNumberingOpen(false)}
          onApplyWireNumbering={handleApplyWireNumbering}
          printDialogOpen={printDialogOpen}
          onClosePrintDialog={() => setPrintDialogOpen(false)}
          onPrint={handlePrint}
        />
      </DndContext>
    </PanelErrorBoundary>
  );
});

export default OneCanvasPanel;
