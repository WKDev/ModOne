/**
 * SymbolEditorHost — React ↔ Pixi.js Bridge for Symbol Editor
 *
 * Follows the same pattern as OneCanvas/CanvasHost.tsx:
 * 1. Single useEffect([]) with async Pixi init
 * 2. Strict init order: PixiApp → Viewport → LayerManager → CoordSys → Renderers
 * 3. All systems in useRef for persistence across renders
 * 4. Cleanup in reverse init order
 * 5. useImperativeHandle for parent control
 *
 * Key differences from CanvasHost:
 * - No XState machine (lightweight direct event routing to tools)
 * - No SyncEngine/SpatialIndex/HitTester (symbol editor is simpler)
 * - Custom layer configuration (grid, primitives, pins, selection, ghost, overlay)
 * - DOM events convert screen→world→snapped and route to BaseTool callbacks
 */

import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  type CSSProperties,
} from 'react';
import { Container } from 'pixi.js';

import type { GraphicPrimitive, SymbolDefinition } from '@/types/symbol';
import type { EditorAction } from './SymbolEditor';
import type { GhostShape, SymbolEditorHostHandle, SymbolEditorLayerConfig, SymbolEditorLayerName } from './types';
import { SYMBOL_EDITOR_LAYERS } from './types';

import { PixiApplication } from '@components/OneCanvas/core/PixiApplication';
import { PixiViewport } from '@components/OneCanvas/core/PixiViewport';
import { CoordinateSystem } from '@components/OneCanvas/core/CoordinateSystem';
import { GridRenderer } from '@components/OneCanvas/renderers/GridRenderer';
import { ToolInputBinding, GRID_MODULE_MM, isEditableTarget } from '@/canvas-core';

import { PrimitiveRenderer } from './renderers/PrimitiveRenderer';
import { PinRenderer } from './renderers/PinRenderer';
import { GhostRenderer } from './renderers/GhostRenderer';
import { OverlayRenderer } from './renderers/OverlayRenderer';

import type { BaseTool, CanvasPoint, ToolCallbacks } from './tools';
import { SelectTool, RectTool, CircleTool, LineTool, PolylineTool, ArcTool, TextTool, PinTool } from './tools';
import type { PinToolCallbacks } from './tools/PinTool';
import type { TextToolCallbacks } from './tools/TextTool';

import type { EditorTool } from './SymbolEditor';

// ============================================================================
// Props
// ============================================================================

export interface SymbolEditorHostProps {
  /** The symbol being edited */
  symbol: SymbolDefinition | null;
  /** Current editor state (tool, zoom, pan, selection) */
  currentTool: EditorTool;
  /** Selected primitive/pin IDs */
  selectedIds: Set<string>;
  /** Editor action dispatcher */
  dispatch: React.Dispatch<EditorAction>;
  /** Callback when a primitive is added */
  onAddPrimitive?: (prim: GraphicPrimitive) => void;
  /** Callback when an existing pin is dragged to a new position (legacy singular) */
  onMovePin?: (pinId: string, newPosition: { x: number; y: number }) => void;
  /** Callback when selected primitives are dragged */
  onMovePrimitives?: (indices: number[], dx: number, dy: number) => void;
  /** Callback when selected pins are dragged */
  onMovePins?: (pinIds: string[], dx: number, dy: number) => void;
  /** Callback when a primitive is resized via handles */
  onResizePrimitive?: (index: number, newBounds: { x: number; y: number; width: number; height: number }) => void;
  /** Callback when a primitive is rotated via the rotation handle */
  onRotatePrimitive?: (index: number, angle: number) => void;
  /** Callback when a primitive is updated (e.g. polyline point editing) */
  onUpdatePrimitive?: (index: number, prim: GraphicPrimitive) => void;
  /** Index of polyline in point-edit mode (null = not editing) */
  editingPolylineIndex?: number | null;
  /** Callback to delete selected items */
  onDeleteSelected?: () => void;
  /** Callback to open pin config popover */
  onOpenPinPopover?: (screenX: number, screenY: number, canvasX: number, canvasY: number) => void;
  /** Callback to open the text-input popover (text tool) */
  onOpenTextPopover?: (screenX: number, screenY: number, canvasX: number, canvasY: number) => void;
  /** Interactive preview mode — clicking a pin toggles its powered state. */
  previewMode?: boolean;
  /** Pin ids currently powered (preview) — drawn with a glow. */
  poweredPins?: ReadonlySet<string>;
  /** Called in preview when a pin is clicked (to toggle its powered state). */
  onTogglePoweredPin?: (pinId: string) => void;
  /** Active visual state context (null = base/default). Overrides applied upstream. */
  activeVisualState?: string | null;
  /** Container CSS class */
  className?: string;
  /** Container CSS style overrides */
  style?: CSSProperties;
}

// ============================================================================
// Constants
// ============================================================================

const CONTAINER_STYLE: CSSProperties = {
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  position: 'relative',
  cursor: 'crosshair',
};

/** Maps resize-handle IDs to CSS cursor values */
const HANDLE_CURSOR_MAP: Record<string, string> = {
  'nw': 'nwse-resize',
  'se': 'nwse-resize',
  'ne': 'nesw-resize',
  'sw': 'nesw-resize',
  'n': 'ns-resize',
  's': 'ns-resize',
  'e': 'ew-resize',
  'w': 'ew-resize',
  'rotate': 'grab',
};

// The symbol editor works in mm, matching OneCanvas and the now-mm symbol
// library. 5mm grid module = the same grid the schematic editor uses.
const GRID_SIZE = GRID_MODULE_MM;
// Default zoom. Symbols are mm-valued (half their former px magnitude), so a 2×
// zoom renders them at roughly their previous on-screen size for comfortable
// editing while staying unit-consistent with the schematic.
const DEFAULT_SYMBOL_ZOOM = 2;

// ============================================================================
// Layer Manager (lightweight — no need for the full LayerManager class)
// ============================================================================

type LayerMap = Map<SymbolEditorLayerName, Container>;

function createLayers(parent: Container, configs: readonly SymbolEditorLayerConfig[]): LayerMap {
  const layers: LayerMap = new Map();
  for (const config of configs) {
    const container = new Container();
    container.label = `se-layer-${config.name}`;
    container.zIndex = config.zIndex;
    container.visible = config.visible;
    container.interactive = config.interactive;
    container.interactiveChildren = config.interactive;
    container.sortableChildren = true;
    layers.set(config.name, container);
    parent.addChild(container);
  }
  return layers;
}

function getLayer(layers: LayerMap, name: SymbolEditorLayerName): Container {
  const layer = layers.get(name);
  if (!layer) throw new Error(`SymbolEditor layer "${name}" not found`);
  return layer;
}

function destroyLayers(layers: LayerMap): void {
  for (const layer of layers.values()) {
    layer.removeChildren();
    layer.destroy({ children: true });
  }
  layers.clear();
}

// ============================================================================
// Tool Factory
// ============================================================================

function createTool(toolName: EditorTool): BaseTool {
  switch (toolName) {
    case 'rect': return new RectTool();
    case 'circle': return new CircleTool();
    case 'line': return new LineTool();
    case 'polyline': return new PolylineTool();
    case 'arc': return new ArcTool();
    case 'text': return new TextTool();
    case 'pin': return new PinTool();
    case 'select':
    default:
      return new SelectTool();
  }
}

// ============================================================================
// Component
// ============================================================================

export const SymbolEditorHost = forwardRef<SymbolEditorHostHandle, SymbolEditorHostProps>(
  function SymbolEditorHost(props, ref) {
    const {
      symbol,
      currentTool,
      selectedIds,
      dispatch,
      onAddPrimitive,
      onMovePin,
      onMovePrimitives,
      onMovePins,
      onResizePrimitive,
      onRotatePrimitive,
      onUpdatePrimitive,
      editingPolylineIndex,
      onDeleteSelected,
      onOpenPinPopover,
      onOpenTextPopover,
      previewMode,
      poweredPins,
      onTogglePoweredPin,
      className,
      style,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);

    // System refs
    const pixiAppRef = useRef<PixiApplication | null>(null);
    const viewportRef = useRef<PixiViewport | null>(null);
    const coordSysRef = useRef<CoordinateSystem | null>(null);
    const layersRef = useRef<LayerMap>(new Map());

    // Renderer refs
    const gridRendererRef = useRef<GridRenderer | null>(null);
    const primitiveRendererRef = useRef<PrimitiveRenderer | null>(null);
    const pinRendererRef = useRef<PinRenderer | null>(null);
    const ghostRendererRef = useRef<GhostRenderer | null>(null);
    const overlayRendererRef = useRef<OverlayRenderer | null>(null);

    // Tool ref
    const toolRef = useRef<BaseTool>(new SelectTool());

    // Shared canvas-core pointer-input pipeline (federated → normalized → tool).
    const toolInputRef = useRef<ToolInputBinding | null>(null);

    // Cursor feedback
    const cursorRef = useRef<string>('crosshair');

    // Stable refs for callbacks (avoid stale closures)
    const symbolRef = useRef(symbol);
    symbolRef.current = symbol;
    const dispatchRef = useRef(dispatch);
    dispatchRef.current = dispatch;
    const onAddPrimitiveRef = useRef(onAddPrimitive);
    onAddPrimitiveRef.current = onAddPrimitive;
    const onMovePinRef = useRef(onMovePin);
    onMovePinRef.current = onMovePin;
    const onMovePrimitivesRef = useRef(onMovePrimitives);
    onMovePrimitivesRef.current = onMovePrimitives;
    const onMovePinsRef = useRef(onMovePins);
    onMovePinsRef.current = onMovePins;
    const onResizePrimitiveRef = useRef(onResizePrimitive);
    onResizePrimitiveRef.current = onResizePrimitive;
    const onRotatePrimitiveRef = useRef(onRotatePrimitive);
    onRotatePrimitiveRef.current = onRotatePrimitive;
    const onUpdatePrimitiveRef = useRef(onUpdatePrimitive);
    onUpdatePrimitiveRef.current = onUpdatePrimitive;
    const editingPolylineIndexRef = useRef(editingPolylineIndex);
    editingPolylineIndexRef.current = editingPolylineIndex;
    const onDeleteSelectedRef = useRef(onDeleteSelected);
    onDeleteSelectedRef.current = onDeleteSelected;
    const onOpenPinPopoverRef = useRef(onOpenPinPopover);
    onOpenPinPopoverRef.current = onOpenPinPopover;
    const onOpenTextPopoverRef = useRef(onOpenTextPopover);
    onOpenTextPopoverRef.current = onOpenTextPopover;
    const previewModeRef = useRef(previewMode);
    previewModeRef.current = previewMode;
    const poweredPinsRef = useRef(poweredPins);
    poweredPinsRef.current = poweredPins;
    const onTogglePoweredPinRef = useRef(onTogglePoweredPin);
    onTogglePoweredPinRef.current = onTogglePoweredPin;
    const selectedIdsRef = useRef(selectedIds);
    selectedIdsRef.current = selectedIds;
    const currentToolRef = useRef(currentTool);
    currentToolRef.current = currentTool;

    // ========================================================================
    // Initialization & Cleanup
    // ========================================================================

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let destroyed = false;
      // Captured so cleanup can halt this app's render loop even while init() is
      // still awaiting (StrictMode discarded instance must stop rendering).
      let activeApp: PixiApplication | null = null;

      const init = async () => {
        // 1. Create Pixi Application
        const pixiApp = new PixiApplication();
        activeApp = pixiApp;
        await pixiApp.init({
          container,
          config: {
            backgroundColor: 0xffffff,
            grid: {
              size: GRID_SIZE,
              visible: true,
              color: '#cccccc',
              majorColor: '#999999',
              subdivisions: 5,
            },
            minZoom: 0.1,
            maxZoom: 10,
          },
        });

        if (destroyed) {
          pixiApp.destroy();
          return;
        }
        // Pause rendering while the scene graph is built (resumed after the
        // initial render below) to avoid rendering a half-built scene.
        pixiApp.stop();
        pixiAppRef.current = pixiApp;

        // 2. Create Viewport
        const viewport = new PixiViewport();
        const vpContainer = viewport.init({
          app: pixiApp.app,
          config: {
            backgroundColor: 0xffffff,
            grid: {
              size: GRID_SIZE,
              visible: true,
              color: '#cccccc',
              majorColor: '#999999',
              subdivisions: 5,
            },
            minZoom: 0.1,
            maxZoom: 10,
          },
          onViewportChange: () => {
            // Re-render grid on viewport change
            if (gridRendererRef.current && viewportRef.current) {
              gridRendererRef.current.render(
                viewportRef.current.visibleBounds,
                viewportRef.current.state.zoom,
              );
            }
          },
        });
        viewportRef.current = viewport;
        pixiApp.app.stage.addChild(vpContainer);

        // 3. Create Layers
        const layers = createLayers(vpContainer, SYMBOL_EDITOR_LAYERS);
        layersRef.current = layers;

        // 4. Create Coordinate System
        const coordSys = new CoordinateSystem();
        coordSys.init(viewport.viewport);
        coordSys.gridSize = GRID_SIZE;
        coordSysRef.current = coordSys;

        // 5. Create Renderers
        gridRendererRef.current = new GridRenderer({
          layer: getLayer(layers, 'grid'),
          config: {
            size: GRID_SIZE,
            visible: true,
            color: '#cccccc',
            majorColor: '#999999',
            alpha: 0.3,
            majorAlpha: 0.5,
            style: 'dots',
            subdivisions: 5,
          },
        });

        primitiveRendererRef.current = new PrimitiveRenderer({
          layer: getLayer(layers, 'primitives'),
        });

        pinRendererRef.current = new PinRenderer({
          layer: getLayer(layers, 'pins'),
        });

        ghostRendererRef.current = new GhostRenderer({
          layer: getLayer(layers, 'ghost'),
        });

        overlayRendererRef.current = new OverlayRenderer({
          selectionLayer: getLayer(layers, 'selection'),
          overlayLayer: getLayer(layers, 'overlay'),
        });

        // 5b. Inject overlay handle methods into the initial SelectTool
        const currentTool = toolRef.current;
        if (currentTool instanceof SelectTool) {
          const overlay = overlayRendererRef.current;
          currentTool.getHandleAt = (x: number, y: number) => overlay.getHandleAt(x, y);
          currentTool.getSelectedResizableBounds = (ids: Set<string>, graphics: GraphicPrimitive[]) =>
            overlay.getSelectedResizableBounds(ids, graphics);
        }

        // 5c. Bind pointer input through the shared canvas-core pipeline. The
        // ToolInputBinding converts PIXI federated events into normalized world/
        // snapped/client coordinates (the same source OneCanvas uses) and routes
        // the primary button to the active tool; middle/right is left to
        // pixi-viewport for native pan. The editor adapts its BaseTool model via
        // these handlers — snapped world point + client coords for the popover.
        const toolInput = new ToolInputBinding();
        toolInput.init({
          viewport: viewport.viewport,
          coordSys,
          handlers: {
            onPointerDown: (p) => {
              // Interactive preview: a click toggles the nearest pin's power
              // instead of running an editing tool.
              if (previewModeRef.current) {
                handlePreviewPointerDown(p.snapped.x, p.snapped.y);
                return;
              }
              runToolDown(
                { x: p.snapped.x, y: p.snapped.y, shiftKey: p.shiftKey, altKey: p.altKey },
                p.client.x,
                p.client.y,
              );
            },
            onPointerMove: (p) =>
              runToolMove(
                { x: p.snapped.x, y: p.snapped.y, shiftKey: p.shiftKey, altKey: p.altKey },
                p.client.x,
                p.client.y,
              ),
            onPointerUp: (p) =>
              runToolUp(
                { x: p.snapped.x, y: p.snapped.y, shiftKey: p.shiftKey, altKey: p.altKey },
                p.client.x,
                p.client.y,
              ),
          },
        });
        toolInputRef.current = toolInput;

        // 6. Initial grid render
        gridRendererRef.current.render(
          viewport.visibleBounds,
          viewport.state.zoom,
        );

        // 7. Initial symbol render
        if (symbolRef.current) {
          primitiveRendererRef.current.renderAll(symbolRef.current.graphics);
          pinRendererRef.current.renderAll(symbolRef.current.pins, poweredPinsRef.current);
        }

        // 8. Center viewport on origin
        viewport.centerOn(0, 0, DEFAULT_SYMBOL_ZOOM);

        // Scene graph is fully built — resume the render loop.
        if (!destroyed) pixiApp.start();
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
        // rest or escape the unmount and trip the error boundary. Destroying PIXI
        // Text renderables (pin labels) returns their pooled render texture to
        // PIXI's renderer-shared global TexturePool; during mount/unmount churn
        // (StrictMode, or this editor and OneCanvas briefly coexisting) a sibling
        // renderer's teardown can wipe the pool bucket first, making
        // TexturePool.returnTexture throw "Cannot read properties of undefined
        // (reading 'push')". GPU memory is reclaimed by context teardown anyway.
        const safeDestroy = (fn: () => void) => {
          try {
            fn();
          } catch (err) {
            if (import.meta.env.DEV) {
              console.warn('[SymbolEditorHost] non-fatal error during teardown:', err);
            }
          }
        };

        // Destroy in reverse order. Detach pointer input first so no federated
        // event fires into half-destroyed renderers.
        safeDestroy(() => toolInputRef.current?.destroy());
        safeDestroy(() => overlayRendererRef.current?.destroy());
        safeDestroy(() => ghostRendererRef.current?.destroy());
        safeDestroy(() => pinRendererRef.current?.destroy());
        safeDestroy(() => primitiveRendererRef.current?.destroy());
        safeDestroy(() => gridRendererRef.current?.destroy());

        safeDestroy(() => coordSysRef.current?.destroy());
        safeDestroy(() => destroyLayers(layersRef.current));
        safeDestroy(() => viewportRef.current?.destroy());
        safeDestroy(() => pixiAppRef.current?.destroy());

        overlayRendererRef.current = null;
        ghostRendererRef.current = null;
        pinRendererRef.current = null;
        primitiveRendererRef.current = null;
        gridRendererRef.current = null;
        coordSysRef.current = null;
        viewportRef.current = null;
        pixiAppRef.current = null;
        toolInputRef.current = null;
      };
    }, []); // Mount once

    // ========================================================================
    // React to symbol changes → re-render
    // ========================================================================

    useEffect(() => {
      if (!primitiveRendererRef.current || !pinRendererRef.current) return;
      if (symbol) {
        primitiveRendererRef.current.renderAll(symbol.graphics);
        pinRendererRef.current.renderAll(symbol.pins, poweredPins);
      } else {
        primitiveRendererRef.current.renderAll([]);
        pinRendererRef.current.renderAll([]);
      }
    }, [symbol, poweredPins]);

    // React to selection changes → update highlights
    useEffect(() => {
      if (!overlayRendererRef.current) return;
      if (selectedIds.size === 0) {
        overlayRendererRef.current.clearSelection();
      } else {
        overlayRendererRef.current.renderSelection(
          selectedIds,
          symbol?.graphics ?? [],
          symbol?.pins ?? [],
        );
      }
      // Update point-edit handles
      overlayRendererRef.current.renderPointEditHandles(
        editingPolylineIndex ?? null,
        symbol?.graphics ?? [],
      );
    }, [selectedIds, symbol, editingPolylineIndex]);

    // React to tool changes → swap tool instance + inject overlay methods
    useEffect(() => {
      toolRef.current.cancel();
      ghostRendererRef.current?.render(null);
      const newTool = createTool(currentTool);

      // Inject overlay renderer's handle methods into SelectTool
      if (newTool instanceof SelectTool && overlayRendererRef.current) {
        const overlay = overlayRendererRef.current;
        newTool.getHandleAt = (x: number, y: number) => overlay.getHandleAt(x, y);
        newTool.getSelectedResizableBounds = (ids: Set<string>, graphics: GraphicPrimitive[]) =>
          overlay.getSelectedResizableBounds(ids, graphics);
      }

      toolRef.current = newTool;

      // Reset cursor when switching tools
      const defaultCursor = currentTool === 'select' ? 'default' : 'crosshair';
      if (containerRef.current) {
        containerRef.current.style.cursor = defaultCursor;
        cursorRef.current = defaultCursor;
      }
    }, [currentTool]);

    // ========================================================================
    // Coordinate conversion
    // ========================================================================

    /**
     * Convert a screen position to a snapped canvas/symbol-space point.
     * Optionally carries pointer modifier state (shiftKey) for tools that need it.
     */
    const toCanvasPoint = (
      screenX: number,
      screenY: number,
      shiftKey = false,
      altKey = false,
    ): CanvasPoint | null => {
      const coordSys = coordSysRef.current;
      if (!coordSys) return null;
      // DOM mouse events report window-relative coords (clientX/clientY), but the
      // viewport's screen->world transform expects coords relative to the canvas
      // (0,0 = canvas top-left). Subtract the host element's screen position, or
      // the cursor is off by the canvas offset (sidebar/header) when docked.
      const rect = containerRef.current?.getBoundingClientRect();
      const localX = rect ? screenX - rect.left : screenX;
      const localY = rect ? screenY - rect.top : screenY;
      const world = coordSys.screenToWorldSnapped(localX, localY);
      return { x: world.x, y: world.y, shiftKey, altKey };
    };

    // ========================================================================
    // Tool dispatch (driven by canvas-core ToolInputBinding; toCanvasPoint above
    // still serves the DOM double-click handler).
    // ========================================================================

    const getToolCallbacks = (): ToolCallbacks => ({
      symbol: symbolRef.current,
      selectedIds: selectedIdsRef.current,
      onAddPrimitive: onAddPrimitiveRef.current ?? (() => {}),
      onMovePrimitives: onMovePrimitivesRef.current,
      onMovePins: onMovePinsRef.current,
      onResizePrimitive: onResizePrimitiveRef.current,
      onRotatePrimitive: onRotatePrimitiveRef.current,
      onUpdatePrimitive: onUpdatePrimitiveRef.current,
      editingPolylineIndex: editingPolylineIndexRef.current,
      onMovePin: onMovePinRef.current,
      dispatch: dispatchRef.current,
    });

    const getPinToolCallbacks = (): PinToolCallbacks => ({
      ...getToolCallbacks(),
      onOpenPinPopover: onOpenPinPopoverRef.current ?? (() => {}),
    });

    const getTextToolCallbacks = (): TextToolCallbacks => ({
      ...getToolCallbacks(),
      onOpenTextPopover: onOpenTextPopoverRef.current ?? (() => {}),
    });

    // ── Tool dispatch (coordinate-source agnostic) ──
    // These run the active tool for a pointer event. `clientX/clientY` are the
    // window-relative coords used only to position the pin popover (DOM overlay);
    // `point` is the snapped world point. Fed by PIXI federated events below.

    // ── Interactive preview: hit-test pins and toggle their powered state ──
    const handlePreviewPointerDown = (x: number, y: number) => {
      const sym = symbolRef.current;
      const toggle = onTogglePoweredPinRef.current;
      if (!sym || !toggle) return;
      const HIT_RADIUS = 8;
      let best: { id: string; dist: number } | null = null;
      for (const pin of sym.pins) {
        if (pin.hidden) continue;
        const dx = pin.position.x - x;
        const dy = pin.position.y - y;
        const dist = Math.hypot(dx, dy);
        if (dist <= HIT_RADIUS && (!best || dist < best.dist)) {
          best = { id: pin.id, dist };
        }
      }
      if (best) toggle(best.id);
    };

    const runToolDown = (point: CanvasPoint, clientX: number, clientY: number) => {
      const tool = toolRef.current;
      if (tool instanceof SelectTool) {
        tool.updateModifiers(point.shiftKey ?? false, point.altKey ?? false);
      }
      if (tool instanceof PinTool) {
        tool.setLastScreen(clientX, clientY);
        tool.onMouseDown(point, getPinToolCallbacks());
      } else if (tool instanceof TextTool) {
        tool.setLastScreen(clientX, clientY);
        tool.onMouseDown(point, getTextToolCallbacks());
      } else {
        tool.onMouseDown(point, getToolCallbacks());
      }
    };

    const runToolMove = (point: CanvasPoint, clientX: number, clientY: number) => {
      const tool = toolRef.current;
      let ghost: GhostShape | null = null;

      if (tool instanceof SelectTool) {
        tool.updateModifiers(point.shiftKey ?? false, point.altKey ?? false);
      }
      if (tool instanceof PinTool) {
        tool.setLastScreen(clientX, clientY);
        ghost = tool.onMouseMove(point, getPinToolCallbacks());
      } else if (tool instanceof TextTool) {
        tool.setLastScreen(clientX, clientY);
        ghost = tool.onMouseMove(point, getTextToolCallbacks());
      } else {
        ghost = tool.onMouseMove(point, getToolCallbacks());
      }

      ghostRendererRef.current?.render(ghost);

      // ── Dynamic cursor feedback ──
      let cursor = 'crosshair';
      if (currentToolRef.current === 'select' && tool instanceof SelectTool) {
        const state = tool.getState();
        switch (state) {
          case 'moving':
          case 'point-move':
            cursor = 'move';
            break;
          case 'rotating':
            cursor = 'grabbing';
            break;
          case 'resizing': {
            const handle = (tool as unknown as { _resizeHandle: string | null })._resizeHandle;
            cursor = (handle && HANDLE_CURSOR_MAP[handle]) || 'nwse-resize';
            break;
          }
          default: {
            const overlay = overlayRendererRef.current;
            if (overlay) {
              const handle = overlay.getHandleAt(point.x, point.y);
              if (handle) {
                cursor = HANDLE_CURSOR_MAP[handle] || 'crosshair';
              } else {
                cursor = 'default';
              }
            } else {
              cursor = 'default';
            }
            break;
          }
        }
      }

      if (containerRef.current && cursorRef.current !== cursor) {
        containerRef.current.style.cursor = cursor;
        cursorRef.current = cursor;
      }
    };

    const runToolUp = (point: CanvasPoint, clientX: number, clientY: number) => {
      const tool = toolRef.current;
      if (tool instanceof SelectTool) {
        tool.updateModifiers(point.shiftKey ?? false, point.altKey ?? false);
      }
      if (tool instanceof PinTool) {
        tool.setLastScreen(clientX, clientY);
        tool.onMouseUp(point, getPinToolCallbacks());
      } else if (tool instanceof TextTool) {
        tool.setLastScreen(clientX, clientY);
        tool.onMouseUp(point, getTextToolCallbacks());
      } else {
        tool.onMouseUp(point, getToolCallbacks());
      }

      // Only clear ghost if the tool is NOT in a multi-step drawing mode
      // (e.g. polyline point placement keeps the preview visible between clicks)
      if (!tool.isDrawing()) {
        ghostRendererRef.current?.render(null);
      }
    };

    const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;

      const point = toCanvasPoint(e.clientX, e.clientY, e.shiftKey, e.altKey);
      if (!point) return;

      const tool = toolRef.current;
      if (tool instanceof PinTool) {
        tool.setLastScreen(e.clientX, e.clientY);
        tool.onDoubleClick?.(point, getPinToolCallbacks());
      } else {
        tool.onDoubleClick?.(point, getToolCallbacks());
      }

      ghostRendererRef.current?.render(null);
    };

    // ========================================================================
    // Keyboard shortcuts (delete, escape)
    // ========================================================================

    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        // ── Tool switching shortcuts (no modifiers, not in input fields) ──
        const isInputField = isEditableTarget(event.target);

        if (
          !isInputField &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey
        ) {
          const toolMap: Record<string, EditorTool> = {
            v: 'select',
            r: 'rect',
            c: 'circle',
            l: 'line',
            p: 'polyline',
            a: 'arc',
            t: 'text',
            n: 'pin',
          };
          const mapped = toolMap[event.key.toLowerCase()];
          if (mapped) {
            event.preventDefault();
            dispatchRef.current({ type: 'SET_TOOL', tool: mapped });
            ghostRendererRef.current?.render(null);
            return;
          }
        }

        if (event.key === 'Delete' || event.key === 'Backspace') {
          // Don't delete the whole primitive when in point-edit mode
          // (the SelectTool's onKeyDown handles vertex deletion)
          if ((editingPolylineIndexRef.current ?? null) === null) {
            onDeleteSelectedRef.current?.();
          }
        }

        const tool = toolRef.current;
        if (tool instanceof PinTool) {
          tool.onKeyDown?.(event, getPinToolCallbacks());
        } else {
          tool.onKeyDown?.(event, getToolCallbacks());
        }

        if (event.key === 'Escape') {
          ghostRendererRef.current?.render(null);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // ========================================================================
    // Imperative Handle
    // ========================================================================

    useImperativeHandle(ref, () => ({
      getViewportState() {
        return viewportRef.current?.state ?? { panX: 0, panY: 0, zoom: 1 };
      },

      renderSymbol() {
        const sym = symbolRef.current;
        if (sym) {
          primitiveRendererRef.current?.renderAll(sym.graphics);
          pinRendererRef.current?.renderAll(sym.pins);
        }
      },

      setGhostShape(shape: GhostShape | null) {
        ghostRendererRef.current?.render(shape);
      },

      setSelection(ids: Set<string>) {
        const sym = symbolRef.current;
        if (ids.size === 0) {
          overlayRendererRef.current?.clearSelection();
        } else {
          overlayRendererRef.current?.renderSelection(
            ids,
            sym?.graphics ?? [],
            sym?.pins ?? [],
          );
        }
      },
    }), []);

    // ========================================================================
    // Render
    // ========================================================================

    return (
      <div
        ref={containerRef}
        className={className}
        style={{ ...CONTAINER_STYLE, ...style }}
        data-testid="symbol-editor-pixi-host"
        onDoubleClick={handleDoubleClick}
      />
    );
  },
);
