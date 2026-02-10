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
import type { HandleConstraint, PortEndpoint, PortPosition } from '../../OneCanvas/types';
import { CanvasMinimap } from '../../OneCanvas/components/CanvasMinimap';
import { CanvasToolbar } from '../../OneCanvas/CanvasToolbar';
import { SchematicPageBar } from '../../OneCanvas/components/SchematicPageBar';
import { WireContextMenu, type WireContextMenuAction } from '../../OneCanvas/overlays/WireContextMenu';
import { generateWireNumbers, applyWireNumbers, type WireNumberingOptions } from '../../OneCanvas/utils/wireNumbering';
import { openPrintDialog, type PrintLayoutConfig } from '../../OneCanvas/utils/printSupport';
import { updatePageCircuitInDocument } from '../../OneCanvas/utils/schematicHelpers';
import { isPortEndpoint } from '../../OneCanvas/types';
import { useCanvasKeyboardShortcuts, useSimulation } from '../../OneCanvas';
import { useDocumentRegistry } from '../../../stores/documentRegistry';
import { useSchematicDocument } from '../../../stores/hooks/useSchematicDocument';
import { PropertiesPanel } from './PropertiesPanel';
import { BlockDragPreview } from './canvas/BlockDragPreview';
import { CanvasDropZone } from './canvas/CanvasDropZone';
import { CanvasDialogs } from './canvas/CanvasDialogs';
import { useCanvasFacade } from '../../../hooks/useCanvasFacade';
import {
  InteractionProvider,
  extractModifiers,
  resolvePointerTarget,
  useInteraction,
} from '../../OneCanvas/contexts/InteractionContext';

import '../../OneCanvas/styles/simulation.css';

interface OneCanvasPanelProps {
  data?: unknown;
}

interface WireContextMenuState {
  wireId: string;
  position: Position;
  screenPosition: { x: number; y: number };
}

function getPortPosition(components: Map<string, Block>, blockId: string, portId: string): Position | null {
  const block = components.get(blockId);
  if (!block) {
    return null;
  }

  const port = block.ports.find((p) => p.id === portId);
  if (!port) {
    return null;
  }

  const offset = port.offset ?? 0.5;
  switch (port.position) {
    case 'top':
      return { x: block.position.x + block.size.width * offset, y: block.position.y };
    case 'bottom':
      return {
        x: block.position.x + block.size.width * offset,
        y: block.position.y + block.size.height,
      };
    case 'left':
      return { x: block.position.x, y: block.position.y + block.size.height * offset };
    case 'right':
      return {
        x: block.position.x + block.size.width,
        y: block.position.y + block.size.height * offset,
      };
    default:
      return {
        x: block.position.x + block.size.width / 2,
        y: block.position.y + block.size.height / 2,
      };
  }
}

const OneCanvasPanelContent = memo(function OneCanvasPanelContent() {
  const canvasRef = useRef<CanvasRef>(null);
  const interactionRootRef = useRef<HTMLDivElement>(null);
  const containerRectRef = useRef<DOMRect | null>(null);
  const interaction = useInteraction();

  const { documentId } = useDocumentContext();

  const {
    components,
    junctions,
    wires,
    zoom,
    pan,
    addComponent,
    addWire,
    removeWire,
    updateComponent,
    removeWireHandle,
    insertEndpointHandle,
    selectedIds,
    setSelection,
    addToSelection,
    toggleSelection,
    clearSelection,
    setPan,
    alignSelected,
    distributeSelected,
    flipSelected,
    getCircuitData,
    loadCircuit,
    undo,
    redo,
  } = useCanvasFacade(documentId);

  const schematicDoc = useSchematicDocument(documentId);

  const handleSchematicPageSwitch = useCallback(
    (targetPageId: string) => {
      if (!schematicDoc || !documentId) return;
      const currentPageId = schematicDoc.schematic.activePageId;
      if (targetPageId === currentPageId) return;

      const currentCircuit = getCircuitData();
      updatePageCircuitInDocument(documentId, currentPageId, currentCircuit);
      useDocumentRegistry.getState().pushHistory(documentId);
      schematicDoc.setActivePage(targetPageId);

      const targetPage = schematicDoc.schematic.pages.find((p) => p.id === targetPageId);
      if (!targetPage) return;
      loadCircuit(targetPage.circuit);
    },
    [schematicDoc, documentId, getCircuitData, loadCircuit]
  );

  const [minimapCollapsed, setMinimapCollapsed] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [wireNumberingOpen, setWireNumberingOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [wireContextMenu, setWireContextMenu] = useState<WireContextMenuState | null>(null);

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

  const componentsArray = useMemo(() => Array.from(components.values()), [components]);
  const junctionsArray = useMemo(() => Array.from(junctions.values()), [junctions]);
  const simulation = useSimulation(componentsArray, wires, junctionsArray);

  useCanvasKeyboardShortcuts({
    components: components as Map<string, Block>,
    wires,
    selectedIds,
    clearSelection,
    addComponent,
    addWire,
    undo,
    redo,
  });

  const toCanvasPosition = useCallback(
    (screenPos: Position): Position => {
      const canvasPos = screenToCanvas(screenPos, pan, zoom);
      return { x: canvasPos.x, y: canvasPos.y };
    },
    [pan, zoom]
  );

  const getScreenPosition = useCallback((clientX: number, clientY: number): Position | null => {
    const container = canvasRef.current?.getContainer();
    if (!container) {
      return null;
    }
    const rect = container.getBoundingClientRect();
    containerRectRef.current = rect;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const sendPointerDown = useCallback(
    (event: React.MouseEvent, targetOverride?: ReturnType<typeof resolvePointerTarget>) => {
      const screenPos = getScreenPosition(event.clientX, event.clientY);
      if (!screenPos) {
        return;
      }
      interaction.send({
        type: 'POINTER_DOWN',
        position: screenPos,
        canvasPosition: toCanvasPosition(screenPos),
        button: event.button,
        target: targetOverride ?? resolvePointerTarget(event, components as Map<string, Block>),
        modifiers: extractModifiers(event),
      });
    },
    [components, getScreenPosition, interaction, toCanvasPosition]
  );

  const sendPointerMove = useCallback(
    (event: React.MouseEvent) => {
      const screenPos = getScreenPosition(event.clientX, event.clientY);
      if (!screenPos) {
        return;
      }
      interaction.send({
        type: 'POINTER_MOVE',
        position: screenPos,
        canvasPosition: toCanvasPosition(screenPos),
        modifiers: extractModifiers(event),
      });
    },
    [getScreenPosition, interaction, toCanvasPosition]
  );

  const sendPointerUp = useCallback(
    (event: React.MouseEvent) => {
      const screenPos = getScreenPosition(event.clientX, event.clientY);
      if (!screenPos) {
        return;
      }
      interaction.send({
        type: 'POINTER_UP',
        position: screenPos,
        canvasPosition: toCanvasPosition(screenPos),
        button: event.button,
        modifiers: extractModifiers(event),
      });
    },
    [getScreenPosition, interaction, toCanvasPosition]
  );

  useEffect(() => {
    const handleWindowMouseUp = (event: MouseEvent) => {
      const screenPos = getScreenPosition(event.clientX, event.clientY);
      if (!screenPos) {
        return;
      }
      interaction.send({
        type: 'POINTER_UP',
        position: screenPos,
        canvasPosition: toCanvasPosition(screenPos),
        button: event.button,
        modifiers: {
          ctrl: event.ctrlKey,
          shift: event.shiftKey,
          alt: event.altKey,
          meta: event.metaKey,
        },
      });
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => window.removeEventListener('mouseup', handleWindowMouseUp);
  }, [getScreenPosition, interaction, toCanvasPosition]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      sendPointerDown(event);
    },
    [sendPointerDown]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      sendPointerMove(event);
    },
    [sendPointerMove]
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent) => {
      sendPointerUp(event);
    },
    [sendPointerUp]
  );

  const handleStartWire = useCallback(
    (blockId: string, portId: string) => {
      const portPosition = getPortPosition(components as Map<string, Block>, blockId, portId);
      const block = components.get(blockId);
      const port = block?.ports.find((p) => p.id === portId);
      if (!portPosition || !port) {
        return;
      }

      const screenPos = {
        x: portPosition.x * zoom + pan.x,
        y: portPosition.y * zoom + pan.y,
      };

      interaction.send({
        type: 'POINTER_DOWN',
        position: screenPos,
        canvasPosition: portPosition,
        button: 0,
        target: {
          kind: 'port',
          blockId,
          portId,
          portPosition: port.position,
        },
        modifiers: { ctrl: false, shift: false, alt: false, meta: false },
      });
    },
    [components, interaction, pan, zoom]
  );

  const handleEndWire = useCallback(() => {
    // Pointer up is handled by container/window handlers.
  }, []);

  const handleBlockDragStart = useCallback(
    (blockId: string, event: React.MouseEvent) => {
      sendPointerDown(event, { kind: 'block', blockId });
    },
    [sendPointerDown]
  );

  const handleWireHandleDragStart = useCallback(
    (
      wireId: string,
      handleIndex: number,
      constraint: HandleConstraint,
      event: React.MouseEvent,
      handlePosition: Position
    ) => {
      sendPointerDown(event, {
        kind: 'wire_handle',
        wireId,
        handleIndex,
        constraint,
        handlePosition,
      });
    },
    [sendPointerDown]
  );

  const handleSegmentDragStart = useCallback(
    (
      wireId: string,
      handleIndexA: number,
      handleIndexB: number,
      orientation: 'horizontal' | 'vertical',
      event: React.MouseEvent,
      handlePosA: Position,
      handlePosB: Position
    ) => {
      sendPointerDown(event, {
        kind: 'wire_segment',
        wireId,
        handleA: handleIndexA,
        handleB: handleIndexB,
        orientation,
        positionA: handlePosA,
        positionB: handlePosB,
      });
    },
    [sendPointerDown]
  );

  const handleEndpointSegmentDragStart = useCallback(
    (wireId: string, end: 'from' | 'to', orientation: 'horizontal' | 'vertical', event: React.MouseEvent) => {
      const wire = wires.find((w) => w.id === wireId);
      if (!wire?.handles?.length) return;

      if (!isPortEndpoint(wire.from) || !isPortEndpoint(wire.to)) return;

      const computeExitPos = (endpoint: PortEndpoint, exitDir?: PortPosition): Position | null => {
        const comp = components.get(endpoint.componentId);
        if (!comp) return null;

        const port = comp.ports.find((p) => p.id === endpoint.portId);
        if (!port) return null;

        const offset = port.offset ?? 0.5;
        const dir = exitDir || port.position;
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
        const secondPos: Position =
          orientation === 'vertical'
            ? { x: exitPos.x, y: firstHandlePos.y }
            : { x: firstHandlePos.x, y: exitPos.y };

        insertEndpointHandle(wireId, 'from', [
          { position: exitPos, constraint },
          { position: secondPos, constraint },
        ]);

        sendPointerDown(event, {
          kind: 'wire_segment',
          wireId,
          handleA: 0,
          handleB: 1,
          orientation,
          positionA: exitPos,
          positionB: secondPos,
        });
      } else {
        const toEndpoint = wire.to as PortEndpoint;
        const exitPos = computeExitPos(toEndpoint, wire.toExitDirection);
        if (!exitPos) return;

        const lastIdx = wire.handles.length - 1;
        const lastHandlePos = wire.handles[lastIdx].position;
        const firstPos: Position =
          orientation === 'vertical'
            ? { x: exitPos.x, y: lastHandlePos.y }
            : { x: lastHandlePos.x, y: exitPos.y };

        insertEndpointHandle(wireId, 'to', [
          { position: firstPos, constraint },
          { position: exitPos, constraint },
        ]);

        sendPointerDown(event, {
          kind: 'wire_segment',
          wireId,
          handleA: lastIdx + 1,
          handleB: lastIdx + 2,
          orientation,
          positionA: firstPos,
          positionB: exitPos,
        });
      }
    },
    [components, insertEndpointHandle, sendPointerDown, wires]
  );

  const handleBlockClick = useCallback(
    (blockId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      if (event.shiftKey) {
        addToSelection(blockId);
      }
    },
    [addToSelection]
  );

  const handleWireClick = useCallback(
    (wireId: string, event: React.MouseEvent) => {
      event.stopPropagation();

      if (event.ctrlKey || event.metaKey) {
        toggleSelection(wireId);
      } else if (event.shiftKey) {
        addToSelection(wireId);
      } else {
        setSelection([wireId]);
      }
    },
    [addToSelection, setSelection, toggleSelection]
  );

  const handleJunctionClick = useCallback(
    (junctionId: string, event: React.MouseEvent) => {
      event.stopPropagation();

      if (event.ctrlKey || event.metaKey) {
        toggleSelection(junctionId);
      } else if (event.shiftKey) {
        addToSelection(junctionId);
      } else {
        setSelection([junctionId]);
      }
    },
    [addToSelection, setSelection, toggleSelection]
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
    [removeWire, wireContextMenu]
  );

  const handleWireHandleContextMenu = useCallback(
    (wireId: string, handleIndex: number, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      removeWireHandle(wireId, handleIndex);
    },
    [removeWireHandle]
  );

  const [draggedType, setDraggedType] = useState<BlockType | null>(null);
  const [draggedLabel, setDraggedLabel] = useState<string | undefined>(undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  const machineWirePreview = useMemo(() => {
    if (!interaction.wirePreview || !interaction.snapshot.context.wireFrom) {
      return null;
    }

    return {
      from: interaction.snapshot.context.wireFrom,
      tempPosition: interaction.wirePreview.to,
      startPosition: interaction.wirePreview.from,
      exitDirection: interaction.snapshot.context.wireFromExitDirection ?? undefined,
    };
  }, [interaction.snapshot.context.wireFrom, interaction.snapshot.context.wireFromExitDirection, interaction.wirePreview]);

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
              <div
                ref={interactionRootRef}
                className="w-full h-full"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                <Canvas
                  ref={canvasRef}
                  className="w-full h-full"
                  blocks={components}
                  wires={wires}
                  junctions={junctions}
                  selectionBox={interaction.selectionBox}
                  wirePreview={machineWirePreview}
                  onBlockClick={handleBlockClick}
                  onWireClick={handleWireClick}
                  onJunctionClick={handleJunctionClick}
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

export const OneCanvasPanel = memo(function OneCanvasPanel(_props: OneCanvasPanelProps) {
  return (
    <InteractionProvider>
      <OneCanvasPanelContent />
    </InteractionProvider>
  );
});

export default OneCanvasPanel;
