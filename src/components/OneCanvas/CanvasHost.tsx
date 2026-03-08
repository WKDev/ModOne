/**
 * CanvasHost — React Component Mounting All Pixi.js Systems
 *
 * This is the bridge between React and Pixi.js. It:
 * 1. Creates and manages the Pixi Application lifecycle
 * 2. Initializes the viewport, layer manager, spatial index, hit tester
 * 3. Creates all renderers (grid, blocks, wires, ports, junctions, selection)
 * 4. Initializes the interaction system (EventBridge + InteractionController + KeyboardShortcuts)
 * 5. Provides imperative handles for parent components to trigger renders
 *
 * Usage:
 *   <CanvasHost ref={canvasRef} config={config} onViewportChange={handler} />
 *
 * The parent (OneCanvasPanel) drives rendering by calling:
 *   canvasRef.current.renderCircuit(blocks, wires, junctions)
 */

import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
  type CSSProperties,
} from 'react';
import type { CanvasFacadeReturn } from '@/types/canvasFacade';

import type {
  Block,
  Wire,
  Junction,
  Position,
  Rect,
  CanvasConfig,
  ViewportState,
  ViewportBounds,
} from './types';
import { DEFAULT_CANVAS_CONFIG, isPortEndpoint } from './types';
import type { SimStatus } from '@/types/onesim';

import { PixiApplication } from './core/PixiApplication';
import { PixiViewport } from './core/PixiViewport';
import { LayerManager } from './core/LayerManager';
import { CoordinateSystem } from './core/CoordinateSystem';
import { SpatialIndex } from './core/SpatialIndex';
import type { SpatialItem } from './core/SpatialIndex';
import { HitTester } from './core/HitTester';

import { GridRenderer } from './renderers/GridRenderer';
import { BlockRenderer } from './renderers/BlockRenderer';
import { WireRenderer } from './renderers/WireRenderer';
import { PortRenderer } from './renderers/PortRenderer';
import { JunctionRenderer } from './renderers/JunctionRenderer';
import { SelectionRenderer } from './renderers/SelectionRenderer';
import { GhostPreviewRenderer } from './renderers/GhostPreviewRenderer';
import { SimulationRenderer } from './renderers/SimulationRenderer';
import { SimulationOverlay } from './renderers/SimulationOverlay';

import { EventBridge } from './interaction/EventBridge';
import { KeyboardShortcuts } from './interaction/KeyboardShortcuts';
import { InteractionController } from './interaction/InteractionController';
import type { InteractionVisuals } from './interaction/InteractionController';
import type { ShortcutCallbacks } from './interaction';
import { SyncEngine, ViewportSync } from './sync';
import { useDocumentRegistry } from '@stores/documentRegistry';
import { isCanvasDocument, isSchematicDocument } from '@/types/document';
// ============================================================================
// Public API (imperative handle)
// ============================================================================

export interface CanvasHostHandle {
  /** Render the full circuit state */
  renderCircuit(
    blocks: Record<string, Block>,
    wires: Record<string, Wire>,
    junctions: Record<string, Junction>
  ): void;

  /** Update selection highlights */
  setSelection(
    selectedBlockIds: string[],
    selectedWireIds: string[],
    selectedJunctionIds: string[],
    selectedBlocks: Block[],
    selectionBounds?: Rect
  ): void;

  /** Set hover state */
  setHover(type: 'block' | 'wire' | 'junction' | null, id: string | null): void;

  /** Get the sync engine instance (advanced use) */
  getSyncEngine(): SyncEngine | null;

  /** Get the simulation renderer instance (advanced use) */
  getSimulationRenderer(): SimulationRenderer | null;

  /** Start simulation rendering event listeners */
  startSimulation(): void;

  /** Stop simulation rendering event listeners */
  stopSimulation(): void;

  /** Update simulation status overlay */
  setSimulationStatus(status: SimStatus): void;

  /** Force an immediate sync pass */
  forceSync(): void;

  /** Show/hide marquee selection */
  renderMarquee(startPos: Position | null, currentPos: Position | null): void;

  /** Show wire drawing preview */
  renderWirePreview(points: Position[]): void;

  /** Clear wire drawing preview */
  clearWirePreview(): void;

  /** Show/hide ports (for wire drawing mode) */
  setPortsVisible(visible: boolean): void;

  /** Show snap highlight on a port */
  showPortSnap(position: Position): void;

  /** Hide snap highlight */
  hidePortSnap(): void;

  /** Get viewport state */
  getViewportState(): ViewportState;

  /** Set viewport state */
  setViewportState(state: Partial<ViewportState>): void;

  /** Get visible bounds in world coordinates */
  getVisibleBounds(): ViewportBounds;

  /** Center viewport on a position */
  centerOn(x: number, y: number, zoom?: number): void;

  /** Fit viewport to show given bounds */
  fitBounds(bounds: ViewportBounds, padding?: number): void;

  /** Convert screen position to world position */
  screenToWorld(screenX: number, screenY: number): Position;

  /** Perform hit test at world position */
  hitTest(worldPos: Position): ReturnType<HitTester['hitTest']>;

  /** Find nearest port (for wire snapping) */
  findNearestPort(worldPos: Position, excludeBlockId?: string): ReturnType<HitTester['findNearestPort']>;

  /** Query spatial index for items within a rectangle */
  queryRect(rect: Rect): SpatialItem[];

  /** Get the interaction controller */
  getInteractionController(): InteractionController | null;

  /** Update keyboard shortcut callbacks */
  setShortcutCallbacks(callbacks: ShortcutCallbacks): void;

  /** Start click-to-place mode for a block type */
  startPlacing(blockType: string): void;

  /** Cancel placement mode */
  cancelPlacing(): void;

  /** Get the underlying Pixi Application (for advanced use) */
  getPixiApp(): PixiApplication;
}

// ============================================================================
// Props
// ============================================================================

export interface CanvasHostProps {
  documentId?: string | null;
  config?: CanvasConfig;
  facade: CanvasFacadeReturn;
  onViewportChange?: (state: ViewportState) => void;
  shortcutCallbacks?: ShortcutCallbacks;
  style?: CSSProperties;
  className?: string;
  onPlaceBlock?: (blockType: string, position: Position, rotation: number, flipH: boolean, flipV: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

const CONTAINER_STYLE: CSSProperties = {
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  position: 'relative',
};

/**
 * CanvasHost mounts the Pixi.js application and all rendering subsystems.
 * It exposes an imperative handle for the parent to drive rendering.
 */
export const CanvasHost = forwardRef<CanvasHostHandle, CanvasHostProps>(
  function CanvasHost({ documentId, config, facade, onViewportChange, shortcutCallbacks, onPlaceBlock, style, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasConfig = config ?? DEFAULT_CANVAS_CONFIG;

    // Refs for all systems (persist across renders)
    const pixiAppRef = useRef<PixiApplication | null>(null);
    const viewportRef = useRef<PixiViewport | null>(null);
    const layerMgrRef = useRef<LayerManager | null>(null);
    const coordSysRef = useRef<CoordinateSystem | null>(null);
    const spatialRef = useRef<SpatialIndex | null>(null);
    const hitTesterRef = useRef<HitTester | null>(null);

    // Renderer refs
    const gridRendererRef = useRef<GridRenderer | null>(null);
    const blockRendererRef = useRef<BlockRenderer | null>(null);
    const wireRendererRef = useRef<WireRenderer | null>(null);
    const portRendererRef = useRef<PortRenderer | null>(null);
    const junctionRendererRef = useRef<JunctionRenderer | null>(null);
    const selectionRendererRef = useRef<SelectionRenderer | null>(null);
    const simulationRendererRef = useRef<SimulationRenderer | null>(null);
    const simulationOverlayRef = useRef<SimulationOverlay | null>(null);
    const ghostPreviewRef = useRef<GhostPreviewRenderer | null>(null);

    // Sync layer refs
    const syncEngineRef = useRef<SyncEngine | null>(null);
    const viewportSyncRef = useRef<ViewportSync | null>(null);

    // Interaction system refs
    const controllerRef = useRef<InteractionController | null>(null);
    const eventBridgeRef = useRef<EventBridge | null>(null);
    const keyboardShortcutsRef = useRef<KeyboardShortcuts | null>(null);

    const facadeRef = useRef(facade);
    facadeRef.current = facade;

    // Track viewport change callback
    const onViewportChangeRef = useRef(onViewportChange);
    onViewportChangeRef.current = onViewportChange;
    const onPlaceBlockRef = useRef(onPlaceBlock);
    onPlaceBlockRef.current = onPlaceBlock;
    const documentIdRef = useRef<string | null>(documentId ?? null);

    const getActiveCanvasData = () => {
      const activeDocumentId = documentIdRef.current;
      if (!activeDocumentId) return null;

      const document = useDocumentRegistry.getState().documents.get(activeDocumentId);
      if (!document) return null;
      if (isCanvasDocument(document)) return document.data;
      if (isSchematicDocument(document)) {
        const page = document.data.schematic.pages.find(
          (candidate) => candidate.id === document.data.schematic.activePageId
        );
        if (!page) return null;
        return {
          components: new Map(Object.entries(page.circuit.components)) as Map<string, Block>,
          junctions: page.circuit.junctions
            ? (new Map(Object.entries(page.circuit.junctions)) as Map<string, Junction>)
            : new Map<string, Junction>(),
          wires: page.circuit.wires,
          metadata: page.circuit.metadata,
          zoom: page.circuit.viewport?.zoom ?? 1,
          pan: {
            x: page.circuit.viewport?.panX ?? 0,
            y: page.circuit.viewport?.panY ?? 0,
          },
          gridSize: 20,
          snapToGrid: true,
          showGrid: true,
        };
      }
      return null;
    };

    // ========================================================================
    // Initialization & Cleanup
    // ========================================================================

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let destroyed = false;

      const init = async () => {
        // 1. Create Pixi Application
        const pixiApp = new PixiApplication();
        await pixiApp.init({
          container,
          config: canvasConfig,
        });

        if (destroyed) {
          pixiApp.destroy();
          return;
        }

        pixiAppRef.current = pixiApp;

        // 2. Create Viewport (pan/zoom camera)
        const viewport = new PixiViewport();
        const vpContainer = viewport.init({
          app: pixiApp.app,
          config: canvasConfig,
          onViewportChange: (state) => {
            onViewportChangeRef.current?.(state);
            // Re-render grid on viewport change
            if (gridRendererRef.current && viewportRef.current) {
              gridRendererRef.current.render(
                viewportRef.current.visibleBounds,
                state.zoom,
              );
            }
          },
        });
        viewportRef.current = viewport;

        // Add viewport to stage
        pixiApp.app.stage.addChild(vpContainer);

        // 3. Create Layer Manager
        const layerMgr = new LayerManager();
        layerMgr.init(vpContainer);
        layerMgrRef.current = layerMgr;

        // 4. Create Coordinate System
        const coordSys = new CoordinateSystem();
        coordSysRef.current = coordSys;

        // 5. Create Spatial Index + Hit Tester
        const spatial = new SpatialIndex();
        spatialRef.current = spatial;

        const hitTester = new HitTester(spatial);
        hitTesterRef.current = hitTester;

        // 6. Create Renderers
        gridRendererRef.current = new GridRenderer({
          layer: layerMgr.getLayer('grid'),
          config: canvasConfig.grid,
        });

        blockRendererRef.current = new BlockRenderer({
          layer: layerMgr.getLayer('blocks'),
        });

        wireRendererRef.current = new WireRenderer({
          layer: layerMgr.getLayer('wires'),
        });

        portRendererRef.current = new PortRenderer({
          layer: layerMgr.getLayer('ports'),
        });

        junctionRendererRef.current = new JunctionRenderer({
          layer: layerMgr.getLayer('junctions'),
        });

        selectionRendererRef.current = new SelectionRenderer({
          layer: layerMgr.getLayer('selection'),
        });

        // 6b. Ghost preview renderer (for click-to-place)
        const ghostPreview = new GhostPreviewRenderer();
        ghostPreview.init({ layer: layerMgr.getLayer('overlay') });
        ghostPreviewRef.current = ghostPreview;

        const visuals: InteractionVisuals = {
          renderMarquee(start, end) {
            if (start && end) {
              selectionRendererRef.current?.renderMarquee(start, end);
            } else {
              selectionRendererRef.current?.clearMarquee();
            }
          },
          clearMarquee() {
            selectionRendererRef.current?.clearMarquee();
          },
          renderWirePreview(points) {
            wireRendererRef.current?.renderPreview(points);
          },
          clearWirePreview() {
            wireRendererRef.current?.clearPreview();
          },
          setPortsVisible(visible) {
            portRendererRef.current?.setShowAll(visible);
          },
          showPortSnap(position) {
            portRendererRef.current?.showSnapHighlight(position);
          },
          hidePortSnap() {
            portRendererRef.current?.hideSnapHighlight();
          },
          showGhost(blockType) {
            ghostPreviewRef.current?.show(blockType);
          },
          updateGhost(options) {
            ghostPreviewRef.current?.update(options);
          },
          hideGhost() {
            ghostPreviewRef.current?.hide();
          },
        };

        const controller = new InteractionController({
          hitTester,
          spatialIndex: spatial,
          visuals,
          onPlaceBlock: (...args) => onPlaceBlockRef.current?.(...args),
        });
        controller.setFacade(facadeRef.current);
        controllerRef.current = controller;

        const eventBridge = new EventBridge();
        eventBridge.init({
          viewport: viewport.viewport,
          domElement: container,
          controller,
        });
        eventBridgeRef.current = eventBridge;

        const shortcuts = new KeyboardShortcuts();
        shortcuts.init({
          domElement: container,
          callbacks: shortcutCallbacks ?? {},
          gridSize: canvasConfig.grid.size,
        });
        keyboardShortcutsRef.current = shortcuts;

        // 8. Initialize sync layer
        const viewportSync = new ViewportSync();
        viewportSync.init({
          viewport,
          documentId: null,
        });
        viewportSyncRef.current = viewportSync;

        const syncEngine = new SyncEngine();
        syncEngine.init({
          blockRenderer: blockRendererRef.current,
          wireRenderer: wireRendererRef.current,
          portRenderer: portRendererRef.current,
          junctionRenderer: junctionRendererRef.current,
          selectionRenderer: selectionRendererRef.current,
          gridRenderer: gridRendererRef.current,
          spatialIndex: spatial,
          hitTester,
          viewport,
          onApplyingViewportStoreState: (applying) => {
            viewportSyncRef.current?.setApplyingStoreState(applying);
          },
        });
        syncEngineRef.current = syncEngine;

        // 10. Initialize simulation renderer + overlay
        const simRenderer = new SimulationRenderer();
        simRenderer.init({
          blockRenderer: blockRendererRef.current,
          wireRenderer: wireRendererRef.current,
          overlayLayer: layerMgr.getLayer('overlay'),
          ticker: pixiApp.app.ticker,
          getBlockType: (blockId) => {
            const canvasData = getActiveCanvasData();
            if (!canvasData) return undefined;
            return canvasData.components.get(blockId)?.type;
          },
          getLedColor: (blockId) => {
            const canvasData = getActiveCanvasData();
            const block = canvasData?.components.get(blockId);
            if (!block) return undefined;

            const typedColor = 'color' in block && typeof block.color === 'string'
              ? block.color
              : undefined;

            return typedColor;
          },
          getWireIdsForBlock: (blockId) => {
            const canvasData = getActiveCanvasData();
            if (!canvasData) return [];

            const wireIds: string[] = [];
            for (const wire of canvasData.wires) {
              const fromMatches = isPortEndpoint(wire.from)
                && wire.from.componentId === blockId;
              const toMatches = isPortEndpoint(wire.to)
                && wire.to.componentId === blockId;

              if (fromMatches || toMatches) {
                wireIds.push(wire.id);
              }
            }

            return wireIds;
          },
        });
        simulationRendererRef.current = simRenderer;

        const simOverlay = new SimulationOverlay();
        simOverlay.init({
          stage: pixiApp.app.stage,
          ticker: pixiApp.app.ticker,
          getScreenSize: () => ({
            width: pixiApp.app.screen.width,
            height: pixiApp.app.screen.height,
          }),
        });
        simulationOverlayRef.current = simOverlay;

        // Use ref instead of closure-captured documentId to avoid stale closure
        // during async init. The [documentId] useEffect may have updated the ref
        // while init() was awaiting PixiApp creation.
        const nextDocumentId = documentIdRef.current;
        viewportSync.setDocumentId(nextDocumentId);
        syncEngine.setDocumentId(nextDocumentId);

        // 9. Initial grid render
        gridRendererRef.current.render(
          viewport.visibleBounds,
          viewport.state.zoom,
        );

        // DEV: Startup diagnostic — fires 500ms after init to let rAF complete
        if (import.meta.env.DEV) {
          setTimeout(() => {
            if (destroyed) return;
            const docId = documentIdRef.current;
            const doc = docId
              ? useDocumentRegistry.getState().documents.get(docId)
              : undefined;
            const docType = doc?.type ?? 'N/A';
            const isCanvas = doc ? isCanvasDocument(doc) : false;
            const compCount = isCanvas ? (doc as { data: { components: Map<string, unknown> } }).data.components.size : 0;
            const spatialSize = spatialRef.current?.size ?? 'null';
            const hasFacade = !!controllerRef.current && !!(controllerRef.current as unknown as { _facade: unknown })._facade;
            const viewportEventMode = viewportRef.current?.viewport?.eventMode ?? 'null';
            const viewportHitArea = viewportRef.current?.viewport?.hitArea ? 'set' : 'null';
            console.group('%c[CanvasHost] STARTUP DIAGNOSTIC', 'color: #ff6600; font-weight: bold');
            console.log('documentId:', docId);
            console.log('document exists:', !!doc);
            console.log('document type:', docType);
            console.log('isCanvasDocument:', isCanvas);
            console.log('components count:', compCount);
            console.log('spatialIndex.size:', spatialSize);
            console.log('controller has facade:', hasFacade);
            console.log('viewport eventMode:', viewportEventMode);
            console.log('viewport hitArea:', viewportHitArea);
            console.log('eventBridge initialized:', !!eventBridgeRef.current);
            console.log('syncEngine initialized:', !!syncEngineRef.current);
            console.groupEnd();
          }, 500);
        }
      };

      init();

      return () => {
        destroyed = true;

        // Destroy in reverse order
        simulationOverlayRef.current?.destroy();
        ghostPreviewRef.current?.destroy();
        simulationRendererRef.current?.destroy();
        viewportSyncRef.current?.destroy();
        syncEngineRef.current?.destroy();
        keyboardShortcutsRef.current?.destroy();
        eventBridgeRef.current?.destroy();
        controllerRef.current?.destroy();

        selectionRendererRef.current?.destroy();
        junctionRendererRef.current?.destroy();
        portRendererRef.current?.destroy();
        wireRendererRef.current?.destroy();
        blockRendererRef.current?.destroy();
        gridRendererRef.current?.destroy();

        hitTesterRef.current?.destroy();
        spatialRef.current?.destroy();
        layerMgrRef.current?.destroy();
        viewportRef.current?.destroy();
        pixiAppRef.current?.destroy();

        keyboardShortcutsRef.current = null;
        eventBridgeRef.current = null;
        controllerRef.current = null;
        selectionRendererRef.current = null;
        junctionRendererRef.current = null;
        portRendererRef.current = null;
        wireRendererRef.current = null;
        blockRendererRef.current = null;
        gridRendererRef.current = null;
        simulationOverlayRef.current = null;
        ghostPreviewRef.current = null;
        simulationRendererRef.current = null;
        syncEngineRef.current = null;
        viewportSyncRef.current = null;
        hitTesterRef.current = null;
        spatialRef.current = null;
        layerMgrRef.current = null;
        coordSysRef.current = null;
        viewportRef.current = null;
        pixiAppRef.current = null;
      };
    }, []); // Mount once — config changes handled via imperative methods

    useEffect(() => {
      const nextDocumentId = documentId ?? null;
      documentIdRef.current = nextDocumentId;

      if (import.meta.env.DEV) {
        console.debug('[CanvasHost] documentId effect:', {
          documentId: nextDocumentId,
          syncEngineReady: !!syncEngineRef.current,
          viewportSyncReady: !!viewportSyncRef.current,
        });
      }

      syncEngineRef.current?.setDocumentId(nextDocumentId);
      viewportSyncRef.current?.setDocumentId(nextDocumentId);
    }, [documentId]);

    useEffect(() => {
      if (import.meta.env.DEV) {
        console.debug('[CanvasHost] facade effect:', {
          controllerReady: !!controllerRef.current,
          facadeIsDocMode: facade?.isDocumentMode,
          facadeDocId: facade?.documentId,
          facadeComponentsSize: facade?.components?.size ?? 'N/A',
        });
        const currentDocumentId = documentIdRef.current;
        if (
          currentDocumentId &&
          (!facade?.isDocumentMode || facade?.documentId !== currentDocumentId)
        ) {
          console.warn('[CanvasHost] document/facade mismatch detected', {
            documentId: currentDocumentId,
            facadeIsDocMode: facade?.isDocumentMode,
            facadeDocId: facade?.documentId,
          });
        }
      }
      controllerRef.current?.setFacade(facade);
    }, [facade]);

    // ========================================================================
    // Imperative Handle
    // ========================================================================

    const screenToWorld = useCallback((screenX: number, screenY: number): Position => {
      const vp = viewportRef.current?.viewport;
      if (!vp) return { x: screenX, y: screenY };
      const worldPoint = vp.toWorld(screenX, screenY);
      return { x: worldPoint.x, y: worldPoint.y };
    }, []);

    useImperativeHandle(ref, () => ({
      renderCircuit(blocks, wires, junctions) {
        if (syncEngineRef.current) {
          syncEngineRef.current.forceSync();
          return;
        }

        // Update spatial index
        spatialRef.current?.rebuild(blocks, wires, junctions);
        hitTesterRef.current?.updateData(blocks, wires, junctions);

        // Render all elements
        blockRendererRef.current?.renderAll(blocks);
        wireRendererRef.current?.renderAll(wires, blocks, junctions);
        portRendererRef.current?.renderAll(blocks);
        junctionRendererRef.current?.renderAll(junctions);
      },

      setSelection(blockIds, wireIds, junctionIds, selectedBlocks, bounds) {
        if (syncEngineRef.current) {
          syncEngineRef.current.syncSelection(
            blockIds,
            wireIds,
            junctionIds,
            selectedBlocks,
            bounds,
          );
          return;
        }

        blockRendererRef.current?.setSelectedBlocks(new Set(blockIds));
        wireRendererRef.current?.setSelectedWires(new Set(wireIds));
        junctionRendererRef.current?.setSelectedJunctions(new Set(junctionIds));
        selectionRendererRef.current?.renderHighlights(selectedBlocks, bounds);
      },

      setHover(type, id) {
        if (syncEngineRef.current) {
          syncEngineRef.current.syncHover(type, id);
          return;
        }

        blockRendererRef.current?.setHoveredBlock(type === 'block' ? id : null);
        wireRendererRef.current?.setHoveredWire(type === 'wire' ? id : null);
        junctionRendererRef.current?.setHoveredJunction(type === 'junction' ? id : null);
      },

      getSyncEngine() {
        return syncEngineRef.current;
      },

      getSimulationRenderer() {
        return simulationRendererRef.current;
      },

      startSimulation() {
        simulationRendererRef.current?.startListening();
        simulationOverlayRef.current?.setStatus('running');
      },

      stopSimulation() {
        simulationRendererRef.current?.stopListening();
        simulationOverlayRef.current?.setStatus('stopped');
      },

      setSimulationStatus(status) {
        simulationOverlayRef.current?.setStatus(status);
      },

      forceSync() {
        syncEngineRef.current?.forceSync();
      },

      renderMarquee(startPos, currentPos) {
        if (startPos && currentPos) {
          selectionRendererRef.current?.renderMarquee(startPos, currentPos);
        } else {
          selectionRendererRef.current?.clearMarquee();
        }
      },

      renderWirePreview(points) {
        wireRendererRef.current?.renderPreview(points);
      },

      clearWirePreview() {
        wireRendererRef.current?.clearPreview();
      },

      setPortsVisible(visible) {
        portRendererRef.current?.setShowAll(visible);
      },

      showPortSnap(position) {
        portRendererRef.current?.showSnapHighlight(position);
      },

      hidePortSnap() {
        portRendererRef.current?.hideSnapHighlight();
      },

      getViewportState() {
        return viewportRef.current?.state ?? { panX: 0, panY: 0, zoom: 1 };
      },

      setViewportState(state) {
        viewportRef.current?.setViewport(state);
      },

      getVisibleBounds() {
        return viewportRef.current?.visibleBounds ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      },

      centerOn(x, y, zoom) {
        viewportRef.current?.centerOn(x, y, zoom);
      },

      fitBounds(bounds, padding) {
        viewportRef.current?.fitBounds(bounds, padding);
      },

      screenToWorld,

      hitTest(worldPos) {
        return hitTesterRef.current?.hitTest(worldPos) ?? {
          type: 'none', id: '', position: worldPos, distance: Infinity,
        };
      },

      findNearestPort(worldPos, excludeBlockId) {
        return hitTesterRef.current?.findNearestPort(worldPos, excludeBlockId) ?? null;
      },

      queryRect(rect) {
        return spatialRef.current?.queryRect(rect) ?? [];
      },

      getPixiApp() {
        if (!pixiAppRef.current) throw new Error('CanvasHost not initialized');
        return pixiAppRef.current;
      },

      getInteractionController() {
        return controllerRef.current;
      },

      setShortcutCallbacks(callbacks: ShortcutCallbacks) {
        keyboardShortcutsRef.current?.setCallbacks(callbacks);
      },

      startPlacing(blockType: string) {
        controllerRef.current?.startPlacing(blockType);
      },

      cancelPlacing() {
        controllerRef.current?.cancel();
      },
    }), [screenToWorld]);

    // ========================================================================
    // Render
    // ========================================================================

    return (
      <div
        ref={containerRef}
        className={className}
        style={{ ...CONTAINER_STYLE, ...style }}
        data-testid="canvas-host"
      />
    );
  },
);
