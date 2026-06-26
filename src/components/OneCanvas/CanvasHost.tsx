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
  useMemo,
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
import { getGridStepMm } from './canvasUnits';
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
import { PageGuideRenderer } from './renderers/PageGuideRenderer';
import { SimulationRenderer } from './renderers/SimulationRenderer';
import { SimulationOverlay } from './renderers/SimulationOverlay';
import { SheetOverlayRenderer } from './renderers/SheetOverlayRenderer';
import { useProjectSheet } from '../../hooks/useProjectSheet';

import { EventBridge } from './interaction/EventBridge';
import { KeyboardShortcuts } from './interaction/KeyboardShortcuts';
import { InteractionController } from './interaction/InteractionController';
import type { InteractionVisuals } from './interaction/InteractionController';
import type { CanvasInteractionMode, ShortcutCallbacks } from './interaction';
import { SyncEngine, ViewportSync } from './sync';
import { useDocumentRegistry } from '@stores/documentRegistry';
import { isCanvasDocument, isSchematicDocument } from '@/types/document';
import {
  getDefaultCanvasSheetBounds,
  getDefaultPdfOutputGuideBounds,
} from './utils/canvasSheetGuides';
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

  /** Start wire drawing mode */
  startWireMode(): void;

  /** Cancel placement/wire mode */
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
  interactionMode?: CanvasInteractionMode;
  onViewportChange?: (state: ViewportState) => void;
  shortcutCallbacks?: ShortcutCallbacks;
  style?: CSSProperties;
  className?: string;
  onPlaceBlock?: (blockType: string, position: Position, rotation: number, flipH: boolean, flipV: boolean) => void;
  onOperateBlockInteraction?: (blockId: string, phase: 'press' | 'release' | 'click') => void;
  onInteractionStateChange?: (state: string) => void;
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

const DEFAULT_CANVAS_SHEET = getDefaultCanvasSheetBounds();
const DEFAULT_PDF_OUTPUT_GUIDE = getDefaultPdfOutputGuideBounds();

/**
 * CanvasHost mounts the Pixi.js application and all rendering subsystems.
 * It exposes an imperative handle for the parent to drive rendering.
 */
export const CanvasHost = forwardRef<CanvasHostHandle, CanvasHostProps>(
  function CanvasHost({
    documentId,
    config,
    facade,
    interactionMode = 'edit',
    onViewportChange,
    shortcutCallbacks,
    onPlaceBlock,
    onOperateBlockInteraction,
    onInteractionStateChange,
    style,
    className,
  }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasConfig = config ?? DEFAULT_CANVAS_CONFIG;
    const effectiveGridConfig = useMemo(
      () => ({
        ...canvasConfig.grid,
        size: facade.gridSize ?? canvasConfig.grid.size,
        visible: facade.showGrid ?? canvasConfig.grid.visible ?? true,
        style: facade.gridStyle ?? canvasConfig.grid.style ?? 'dots',
        unit: facade.gridUnit ?? canvasConfig.grid.unit ?? 'mm',
      }),
      [canvasConfig.grid, facade.gridSize, facade.showGrid, facade.gridStyle, facade.gridUnit]
    );

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
    const pageGuideRendererRef = useRef<PageGuideRenderer | null>(null);
    const simulationRendererRef = useRef<SimulationRenderer | null>(null);
    const simulationOverlayRef = useRef<SimulationOverlay | null>(null);
    const ghostPreviewRef = useRef<GhostPreviewRenderer | null>(null);
    const sheetOverlayRef = useRef<SheetOverlayRenderer | null>(null);

    // Sheet overlay: load project sheet and push to renderer
    const projectSheet = useProjectSheet();
    useEffect(() => {
      sheetOverlayRef.current?.setDocument(projectSheet);
    }, [projectSheet]);

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
    const onOperateBlockInteractionRef = useRef(onOperateBlockInteraction);
    onOperateBlockInteractionRef.current = onOperateBlockInteraction;
    const onInteractionStateChangeRef = useRef(onInteractionStateChange);
    onInteractionStateChangeRef.current = onInteractionStateChange;
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
          gridSize: page.circuit.gridSize ?? facadeRef.current.gridSize,
          snapToGrid: true,
          showGrid: page.circuit.showGrid ?? facadeRef.current.showGrid,
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
      // Captured so cleanup can halt this app's render loop even while init() is
      // still awaiting (StrictMode mounts→unmounts→remounts; the discarded
      // instance must not keep rendering — pixiAppRef isn't assigned yet then).
      let activeApp: PixiApplication | null = null;

      const init = async () => {
        // 1. Create Pixi Application
        const pixiApp = new PixiApplication();
        activeApp = pixiApp;
        await pixiApp.init({
          container,
          config: canvasConfig,
          onResize: (width, height) => {
            if (destroyed) return;
            // 1. Notify Viewport
            viewportRef.current?.resize(width, height);

            // 2. Force Full Sync (Redraws grid, blocks, wires synchronously)
            syncEngineRef.current?.forceSync();

            // 3. Update Overlays
            simulationOverlayRef.current?.resize();
          },
        });

        if (destroyed) {
          pixiApp.destroy();
          return;
        }

        // Pause rendering while the scene graph is built; resumed once every
        // renderer is in place (see start() below). Prevents a frame from
        // rendering a half-built scene (null geometry in PIXI's batcher).
        pixiApp.stop();

        pixiAppRef.current = pixiApp;

        // 2. Create Viewport (pan/zoom camera)
        const viewport = new PixiViewport();
        const vpContainer = viewport.init({
          app: pixiApp.app,
          config: canvasConfig,
          worldWidth: DEFAULT_CANVAS_SHEET.width,
          worldHeight: DEFAULT_CANVAS_SHEET.height,
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
          config: effectiveGridConfig,
        });

        const pageGuideRenderer = new PageGuideRenderer();
        pageGuideRenderer.init({
          layer: layerMgr.getLayer('grid'),
          canvasBounds: DEFAULT_CANVAS_SHEET,
          pdfOutputBounds: DEFAULT_PDF_OUTPUT_GUIDE,
        });
        pageGuideRendererRef.current = pageGuideRenderer;

        // 6a. Sheet overlay renderer (non-interactive drawing sheet background)
        const sheetOverlay = new SheetOverlayRenderer();
        sheetOverlay.init(layerMgr.getLayer('sheet'));
        sheetOverlayRef.current = sheetOverlay;

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
          mode: interactionMode,
          onPlaceBlock: (...args) => onPlaceBlockRef.current?.(...args),
          onOperateBlockInteraction: (...args) =>
            onOperateBlockInteractionRef.current?.(...args),
          onStateChange: (state) => onInteractionStateChangeRef.current?.(state),
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
          callbacks: {
            ...shortcutCallbacks,
            startWireMode: shortcutCallbacks?.startWireMode ?? (() => controller.startWireMode()),
          },
          gridSize: getGridStepMm(effectiveGridConfig.size, effectiveGridConfig.unit),
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

        // Scene graph is fully built — resume the render loop.
        if (!destroyed) pixiApp.start();

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

        // Halt the render loop before tearing down renderers so a queued frame
        // can't render a renderable whose geometry is mid-destroy. activeApp
        // covers the case where init() is still in-flight (pixiAppRef unset).
        activeApp?.stop();
        pixiAppRef.current?.stop();

        // Best-effort teardown: a throw in any single step must not abort the
        // rest or escape the unmount and trip the error boundary (which would
        // tear down the whole app). Destroying PIXI Text renderables returns
        // their pooled render texture to PIXI's renderer-shared global
        // TexturePool; during mount/unmount churn (StrictMode, or OneCanvas and
        // the sheet editor briefly coexisting) a sibling renderer's teardown can
        // wipe the pool bucket first, making TexturePool.returnTexture throw
        // "Cannot read properties of undefined (reading 'push')". GPU memory is
        // reclaimed by the renderer's context teardown regardless.
        const safeDestroy = (fn: () => void) => {
          try {
            fn();
          } catch (err) {
            if (import.meta.env.DEV) {
              console.warn('[CanvasHost] non-fatal error during teardown:', err);
            }
          }
        };

        // Destroy in reverse order
        safeDestroy(() => simulationOverlayRef.current?.destroy());
        safeDestroy(() => ghostPreviewRef.current?.destroy());
        safeDestroy(() => simulationRendererRef.current?.destroy());
        safeDestroy(() => pageGuideRendererRef.current?.destroy());
        safeDestroy(() => viewportSyncRef.current?.destroy());
        safeDestroy(() => syncEngineRef.current?.destroy());
        safeDestroy(() => keyboardShortcutsRef.current?.destroy());
        safeDestroy(() => eventBridgeRef.current?.destroy());
        safeDestroy(() => controllerRef.current?.destroy());

        safeDestroy(() => selectionRendererRef.current?.destroy());
        safeDestroy(() => junctionRendererRef.current?.destroy());
        safeDestroy(() => portRendererRef.current?.destroy());
        safeDestroy(() => wireRendererRef.current?.destroy());
        safeDestroy(() => blockRendererRef.current?.destroy());
        safeDestroy(() => sheetOverlayRef.current?.destroy());
        safeDestroy(() => gridRendererRef.current?.destroy());

        safeDestroy(() => hitTesterRef.current?.destroy());
        safeDestroy(() => spatialRef.current?.destroy());
        safeDestroy(() => layerMgrRef.current?.destroy());
        safeDestroy(() => viewportRef.current?.destroy());
        safeDestroy(() => pixiAppRef.current?.destroy());

        keyboardShortcutsRef.current = null;
        eventBridgeRef.current = null;
        controllerRef.current = null;
        selectionRendererRef.current = null;
        pageGuideRendererRef.current = null;
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
      if (gridRendererRef.current) {
        gridRendererRef.current.config = effectiveGridConfig;
      }
      if (keyboardShortcutsRef.current) {
        keyboardShortcutsRef.current.setGridSize(
          getGridStepMm(effectiveGridConfig.size, effectiveGridConfig.unit)
        );
      }
      if (gridRendererRef.current && viewportRef.current) {
        gridRendererRef.current.render(
          viewportRef.current.visibleBounds,
          viewportRef.current.state.zoom,
        );
      }
    }, [effectiveGridConfig]);

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

    useEffect(() => {
      controllerRef.current?.setMode(interactionMode);
    }, [interactionMode]);

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

      startWireMode() {
        controllerRef.current?.startWireMode();
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
