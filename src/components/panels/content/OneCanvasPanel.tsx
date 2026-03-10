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
  SimulationToolbar,
  Toolbox,
  type BlockType,
  type Position,
} from '../../OneCanvas';
import { useSymbolStore } from '../../../stores/symbolStore';
import { CanvasHost, type CanvasHostHandle } from '../../OneCanvas/CanvasHost';

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
import { PropertiesPanel } from './PropertiesPanel';
import { CanvasDialogs } from './canvas/CanvasDialogs';
import { useCanvasFacade } from '../../../hooks/useCanvasFacade';
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

  useCanvasKeyboardShortcuts({
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
    canvasRef.current?.startWireMode();
  }, []);

  const handleInteractionStateChange = useCallback((state: string) => {
    setIsWireMode(state === 'wire_mode' || state === 'wire_drawing');
  }, []);

  const handleSelectSymbol = useCallback(
    (blockType: string) => {
      canvasRef.current?.startPlacing(blockType);
    },
    []
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

  return (
    <PanelErrorBoundary panelName="Canvas">
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
          <Toolbox
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
                className={`w-full h-full ${isWireMode ? 'cursor-crosshair' : ''}`}
                documentId={documentId}
                facade={facade}
                onPlaceBlock={handlePlaceBlock}
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
