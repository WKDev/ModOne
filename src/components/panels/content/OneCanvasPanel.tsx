/**
 * OneCanvasPanel Component
 *
 * Panel content for the OneCanvas circuit simulation canvas.
 * Integrates SimulationToolbar, Toolbox, and CanvasHost with blocks/wires.
 *
 * Supports both:
 * 1. Document-based editing (multi-document via DocumentContext)
 * 2. Global store editing (single document via useCanvasStore)
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDocumentContext } from '../../../contexts/DocumentContext';

import { PanelErrorBoundary } from '../../error/PanelErrorBoundary';
import {
  Toolbox,
  type BlockType,
  type Position,
} from '../../OneCanvas';
import { useSymbolStore } from '../../../stores/symbolStore';
import { CanvasHost, type CanvasHostHandle } from '../../OneCanvas/CanvasHost';
import type { CanvasInteractionMode } from '../../OneCanvas/interaction';


import type { Block, Junction, Wire } from '../../OneCanvas/types';
import { CanvasMinimap } from '../../OneCanvas/components/CanvasMinimap';
import { CanvasToolbar } from '../../OneCanvas/CanvasToolbar';
import { SchematicPageBar } from '../../OneCanvas/components/SchematicPageBar';
import { WireContextMenu, type WireContextMenuAction } from '../../OneCanvas/overlays/WireContextMenu';
import { generateWireNumbers, applyWireNumbers, type WireNumberingOptions } from '../../OneCanvas/utils/wireNumbering';
import { openPrintDialog, type PrintLayoutConfig } from '../../OneCanvas/utils/printSupport';
import { isPortEndpoint } from '../../OneCanvas/types';
import { useCanvasKeyboardShortcuts, useSimulation } from '../../OneCanvas';
import { useSchematicDocument } from '../../../stores/hooks/useSchematicDocument';
import type { CanvasFacadeReturn } from '../../../types/canvasFacade';
import { useSettingsStore } from '../../../stores/settingsStore';
import { PropertiesPanel } from './PropertiesPanel';
import { CanvasDialogs } from './canvas/CanvasDialogs';
import { useCanvasFacade } from '../../../hooks/useCanvasFacade';
import {
  evaluateBehaviorSwitch,
  resolveBehaviorBinding,
} from '../../OneCanvas/runtime/behaviorTemplates';
import '../../OneCanvas/styles/simulation.css';

interface OneCanvasPanelProps {
  data?: unknown;
}

interface WireContextMenuState {
  wireId: string;
  position: Position;
  screenPosition: { x: number; y: number };
}

interface OneCanvasPanelContentProps {
  facade: CanvasFacadeReturn;
  interactionRootRef: React.RefObject<HTMLDivElement | null>;
}

const OneCanvasPanelContent = memo(function OneCanvasPanelContent({
  facade,
  interactionRootRef,
}: OneCanvasPanelContentProps) {
  const canvasRef = useRef<CanvasHostHandle>(null);
  const containerRectRef = useRef<DOMRect | null>(null);
  const crosshairOverlayRef = useRef<HTMLDivElement | null>(null);
  const crosshairHorizontalRef = useRef<HTMLDivElement | null>(null);
  const crosshairVerticalRef = useRef<HTMLDivElement | null>(null);
  const crosshairPointRef = useRef<{ x: number; y: number } | null>(null);
  const crosshairRafRef = useRef<number | null>(null);

  const { documentId } = useDocumentContext();

  const {
    components,
    junctions,
    wires,
    zoom,
    pan,
    addComponent,
    removeComponent,
    addWire,
    removeWire,
    updateComponent,
    selectedIds,
    clearSelection,
    setPan,
    alignSelected,
    distributeSelected,
    flipSelected,
    undo,
    redo,
  } = facade;

  const schematicDoc = useSchematicDocument(documentId);

  const handleSchematicPageSwitch = useCallback(
    (targetPageId: string) => {
      if (!schematicDoc || !documentId) return;
      const currentPageId = schematicDoc.schematic.activePageId;
      if (targetPageId === currentPageId) return;
      // TODO: V2 migration — re-implement circuit save/load for page switching
      schematicDoc.setActivePage(targetPageId);
    },
    [schematicDoc, documentId]
  );

  const [minimapCollapsed, setMinimapCollapsed] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [wireNumberingOpen, setWireNumberingOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [wireContextMenu, setWireContextMenu] = useState<WireContextMenuState | null>(null);
  const [isWireMode, setIsWireMode] = useState(false);
  const [interactionMode, setInteractionMode] = useState<CanvasInteractionMode>('edit');
  const canvasCrosshairEnabled = useSettingsStore((state) => state.getMergedSettings().canvasCrosshairEnabled);


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
    const container = interactionRootRef.current;
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
  }, [interactionRootRef]);

  useEffect(() => {
    const handle = canvasRef.current;
    if (!handle) return;

    const blockIds: string[] = [];
    const wireIds: string[] = [];
    const junctionIds: string[] = [];
    const selectedBlocks: Block[] = [];

    for (const id of selectedIds) {
      const block = components.get(id);
      if (block) {
        blockIds.push(id);
        selectedBlocks.push(block as Block);
        continue;
      }
      if (junctions.has(id)) {
        junctionIds.push(id);
        continue;
      }
      const isWire = wires.some((w) => w.id === id);
      if (isWire) {
        wireIds.push(id);
      }
    }

    handle.setSelection(blockIds, wireIds, junctionIds, selectedBlocks);
  }, [selectedIds, components, junctions, wires]);

  const componentsArray = useMemo(() => Array.from(components.values()), [components]);
  const junctionsArray = useMemo(() => Array.from(junctions.values()), [junctions]);
  const simulation = useSimulation(componentsArray, wires, junctionsArray);
  const {
    result: simulationResult,
    running: isSimulationRunning,
    runtimeState,
    step: stepSimulation,
    setButtonState,
    setManualOverride,
  } = simulation;

  useCanvasKeyboardShortcuts({
    enabled: interactionMode === 'edit',
    components: components as Map<string, Block>,
    wires,
    selectedIds,
    clearSelection,
    addComponent,
    removeComponent,
    addWire,
    removeWire,
    undo,
    redo,
  });

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

  const handleStartWireMode = useCallback(() => {
    if (interactionMode !== 'edit') return;
    canvasRef.current?.startWireMode();
  }, [interactionMode]);

  const handleInteractionStateChange = useCallback((state: string) => {
    setIsWireMode(state === 'wire_mode' || state === 'wire_drawing');
  }, []);

  const handleSelectSymbol = useCallback(
    (blockType: string) => {
      if (interactionMode !== 'edit') return;
      canvasRef.current?.startPlacing(blockType);
    },
    [interactionMode]
  );

  const handlePlaceBlock = useCallback(
    (blockType: string, position: Position, rotation: number, flipH: boolean, flipV: boolean) => {
      addComponent(blockType as BlockType, position, {
        rotation: rotation as Block['rotation'],
        flip: { horizontal: flipH, vertical: flipV },
      });
    },
    [addComponent]
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

  useEffect(() => {
    if (interactionMode === 'operate') {
      clearSelection();
    }
  }, [clearSelection, interactionMode]);

  const portVoltages = useMemo(() => {
    const result = simulation.result as unknown;
    if (!result || typeof result !== 'object' || !('nodeVoltages' in result)) {
      return undefined;
    }
    return (result as { nodeVoltages?: unknown }).nodeVoltages;
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
      setButtonState(blockId, true);
    },
    [setButtonState]
  );

  const handleButtonRelease = useCallback(
    (blockId: string) => {
      setButtonState(blockId, false);
    },
    [setButtonState]
  );

  const resolveOperateInteractionMode = useCallback((block: Block): 'momentary' | 'maintained' | 'none' => {
    const binding = resolveBehaviorBinding(block);
    if (!binding || binding.archetype !== 'switch') {
      return 'none';
    }

    if (block.type === 'button') {
      return block.mode === 'momentary' ? 'momentary' : 'maintained';
    }

    if (
      block.type === 'selector_switch'
      || block.type === 'emergency_stop'
      || block.type === 'plc_out'
      || block.type === 'disconnect_switch'
    ) {
      return 'maintained';
    }

    return binding.interactionMode === 'momentary'
      ? 'momentary'
      : binding.interactionMode === 'maintained'
        ? 'maintained'
        : 'none';
  }, []);

  const handleOperateBlockInteraction = useCallback(
    (blockId: string, phase: 'press' | 'release' | 'click') => {
      if (interactionMode !== 'operate') return;

      const block = components.get(blockId);
      if (!block) return;

      const blockMode = resolveOperateInteractionMode(block as Block);
      if (blockMode === 'none') return;

      if (phase === 'press' && blockMode === 'momentary') {
        handleButtonPress(blockId);
        return;
      }

      if (phase === 'release' && blockMode === 'momentary') {
        handleButtonRelease(blockId);
        return;
      }

      if (phase !== 'click' || blockMode !== 'maintained') return;

      const currentState = evaluateBehaviorSwitch(block as Block, runtimeState);
      const nextValue = !(currentState?.energized ?? currentState?.conducting ?? false);
      setManualOverride(blockId, nextValue);
    },
    [
      components,
      handleButtonPress,
      handleButtonRelease,
      interactionMode,
      resolveOperateInteractionMode,
      runtimeState,
      setManualOverride,
    ]
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
    const container = interactionRootRef.current;
    const svgElement = container?.querySelector('svg');
    if (svgElement) {
      const svgContent = svgElement.outerHTML;
      openPrintDialog(svgContent, config);
    }
  }, [interactionRootRef]);

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

  void [
    debugMode,
    handleWireContextMenu,
    portVoltages,
    getConnectedPorts,
    handleButtonPress,
    handleButtonRelease,
  ];

  useEffect(() => {
    if (isSimulationRunning) return;
    stepSimulation();
  }, [componentsArray, isSimulationRunning, junctionsArray, stepSimulation, wires]);

  useEffect(() => {
    const renderer = canvasRef.current?.getSimulationRenderer();
    if (!renderer) return;

    if (interactionMode !== 'operate' || !simulationResult) {
      renderer.resetAllVisualState();
      return;
    }

    renderer.applySimulationSnapshot(
      simulationResult.behaviorStates,
      simulationResult.poweredWires,
    );
  }, [interactionMode, simulationResult]);

  const flushCrosshair = useCallback(() => {
    crosshairRafRef.current = null;
    const point = crosshairPointRef.current;
    const overlay = crosshairOverlayRef.current;
    const horizontal = crosshairHorizontalRef.current;
    const vertical = crosshairVerticalRef.current;
    if (!point || !overlay || !horizontal || !vertical) {
      return;
    }

    horizontal.style.transform = `translate3d(0, ${point.y}px, 0)`;
    vertical.style.transform = `translate3d(${point.x}px, 0, 0)`;
    overlay.style.opacity = '1';
  }, []);

  const hideCrosshair = useCallback(() => {
    crosshairPointRef.current = null;
    if (crosshairRafRef.current !== null) {
      cancelAnimationFrame(crosshairRafRef.current);
      crosshairRafRef.current = null;
    }
    const overlay = crosshairOverlayRef.current;
    if (overlay) {
      overlay.style.opacity = '0';
    }
  }, []);

  useEffect(() => {
    const container = interactionRootRef.current;
    if (!container) {
      return;
    }

    if (!canvasCrosshairEnabled) {
      hideCrosshair();
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = containerRectRef.current ?? container.getBoundingClientRect();
      crosshairPointRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      if (crosshairRafRef.current === null) {
        crosshairRafRef.current = requestAnimationFrame(flushCrosshair);
      }
    };

    const onPointerLeave = () => {
      hideCrosshair();
    };

    container.addEventListener('pointermove', onPointerMove, { passive: true });
    container.addEventListener('pointerleave', onPointerLeave, { passive: true });

    return () => {
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [canvasCrosshairEnabled, flushCrosshair, hideCrosshair, interactionRootRef]);

  useEffect(() => {
    return () => {
      if (crosshairRafRef.current !== null) {
        cancelAnimationFrame(crosshairRafRef.current);
        crosshairRafRef.current = null;
      }
    };
  }, []);

  return (
    <PanelErrorBoundary panelName="Canvas">
      <div className="h-full flex flex-col bg-neutral-950">
        <div className="flex items-center justify-center px-2 py-1 bg-neutral-900 border-b border-neutral-800">
          <CanvasToolbar
            interactionMode={interactionMode}
            onInteractionModeChange={setInteractionMode}
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
          <Toolbox
            editingEnabled={interactionMode === 'edit'}
            onOpenLibrary={() => setLibraryOpen(true)}
            onOpenSymbolEditor={() => useSymbolStore.getState().openEditor()}
            onSelectSymbol={handleSelectSymbol}
            onStartWireMode={handleStartWireMode}
            isWireMode={isWireMode}
          />

          <div className="flex-1 relative overflow-hidden">
            <div
              ref={interactionRootRef}
              className="w-full h-full"
            >
              <CanvasHost
                ref={canvasRef}
                className={`w-full h-full ${isWireMode || canvasCrosshairEnabled ? 'cursor-crosshair' : ''}`}
                documentId={documentId}
                facade={facade}
                interactionMode={interactionMode}
                onPlaceBlock={handlePlaceBlock}
                onOperateBlockInteraction={handleOperateBlockInteraction}
                onInteractionStateChange={handleInteractionStateChange}
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

              {canvasCrosshairEnabled && (
                <div
                  ref={crosshairOverlayRef}
                  className="absolute inset-0 pointer-events-none z-20 opacity-0"
                >
                  <div
                    ref={crosshairHorizontalRef}
                    className="absolute left-0 right-0 h-px bg-neutral-400"
                    style={{
                      transform: 'translate3d(0, 0, 0)',
                      willChange: 'transform',
                    }}
                  />
                  <div
                    ref={crosshairVerticalRef}
                    className="absolute top-0 bottom-0 w-px bg-neutral-400"
                    style={{
                      transform: 'translate3d(0, 0, 0)',
                      willChange: 'transform',
                    }}
                  />
                </div>
              )}
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
                className="left-[186px]"
              />
            )}

          </div>

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
    </PanelErrorBoundary>
  );
});

export const OneCanvasPanel = memo(function OneCanvasPanel(_props: OneCanvasPanelProps) {
  const { documentId } = useDocumentContext();
  const facade = useCanvasFacade(documentId);
  const interactionRootRef = useRef<HTMLDivElement>(null);

  return <OneCanvasPanelContent facade={facade} interactionRootRef={interactionRootRef} />;
});

export default OneCanvasPanel;

