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

import type { GraphicPrimitive, SymbolDefinition, SymbolPin } from '@/types/symbol';
import type { EditorAction } from './SymbolEditor';
import type { GhostShape, SymbolEditorHostHandle, SymbolEditorLayerConfig, SymbolEditorLayerName } from './types';
import { SYMBOL_EDITOR_LAYERS } from './types';

import { PixiApplication } from '@components/OneCanvas/core/PixiApplication';
import { PixiViewport } from '@components/OneCanvas/core/PixiViewport';
import { CoordinateSystem } from '@components/OneCanvas/core/CoordinateSystem';
import { GridRenderer } from '@components/OneCanvas/renderers/GridRenderer';

import { PrimitiveRenderer } from './renderers/PrimitiveRenderer';
import { PinRenderer } from './renderers/PinRenderer';
import { GhostRenderer } from './renderers/GhostRenderer';
import { OverlayRenderer } from './renderers/OverlayRenderer';

import type { BaseTool, CanvasPoint, ToolCallbacks } from './tools';
import { SelectTool, RectTool, CircleTool, LineTool, PolylineTool, ArcTool, TextTool, PinTool } from './tools';
import type { PinToolCallbacks } from './tools/PinTool';

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
  /** Callback when a pin is being placed (opens popover) */
  onAddPin?: (pin: SymbolPin) => void;
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

const GRID_SIZE = 20;

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

    // Pan drag tracking (middle-mouse)
    const panDragRef = useRef({ active: false, x: 0, y: 0 });

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

      const init = async () => {
        // 1. Create Pixi Application
        const pixiApp = new PixiApplication();
        await pixiApp.init({
          container,
          config: {
            backgroundColor: 0x1a1a1a,
            grid: {
              size: GRID_SIZE,
              visible: true,
              color: '#333333',
              majorColor: '#444444',
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
        pixiAppRef.current = pixiApp;

        // 2. Create Viewport
        const viewport = new PixiViewport();
        const vpContainer = viewport.init({
          app: pixiApp.app,
          config: {
            backgroundColor: 0x1a1a1a,
            grid: {
              size: GRID_SIZE,
              visible: true,
              color: '#333333',
              majorColor: '#444444',
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
            color: '#333333',
            majorColor: '#444444',
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

        // 6. Initial grid render
        gridRendererRef.current.render(
          viewport.visibleBounds,
          viewport.state.zoom,
        );

        // 7. Initial symbol render
        if (symbolRef.current) {
          primitiveRendererRef.current.renderAll(symbolRef.current.graphics);
          pinRendererRef.current.renderAll(symbolRef.current.pins);
        }

        // 8. Center viewport on origin
        viewport.centerOn(0, 0, 1);
      };

      init();

      return () => {
        destroyed = true;

        // Destroy in reverse order
        overlayRendererRef.current?.destroy();
        ghostRendererRef.current?.destroy();
        pinRendererRef.current?.destroy();
        primitiveRendererRef.current?.destroy();
        gridRendererRef.current?.destroy();

        coordSysRef.current?.destroy();
        destroyLayers(layersRef.current);
        viewportRef.current?.destroy();
        pixiAppRef.current?.destroy();

        overlayRendererRef.current = null;
        ghostRendererRef.current = null;
        pinRendererRef.current = null;
        primitiveRendererRef.current = null;
        gridRendererRef.current = null;
        coordSysRef.current = null;
        viewportRef.current = null;
        pixiAppRef.current = null;
      };
    }, []); // Mount once

    // ========================================================================
    // React to symbol changes → re-render
    // ========================================================================

    useEffect(() => {
      if (!primitiveRendererRef.current || !pinRendererRef.current) return;
      if (symbol) {
        primitiveRendererRef.current.renderAll(symbol.graphics);
        pinRendererRef.current.renderAll(symbol.pins);
      } else {
        primitiveRendererRef.current.renderAll([]);
        pinRendererRef.current.renderAll([]);
      }
    }, [symbol]);

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
      const world = coordSys.screenToWorldSnapped(screenX, screenY);
      return { x: world.x, y: world.y, shiftKey, altKey };
    };

    // ========================================================================
    // DOM Event Handlers
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

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      // Middle-click pan
      if (e.button === 1) {
        e.preventDefault();
        panDragRef.current = { active: true, x: e.clientX, y: e.clientY };
        return;
      }

      if (e.button !== 0) return;

      const point = toCanvasPoint(e.clientX, e.clientY, e.shiftKey, e.altKey);
      if (!point) return;

      const tool = toolRef.current;
      // Update modifier keys for resize/rotate
      if (tool instanceof SelectTool) {
        tool.updateModifiers(e.shiftKey, e.altKey);
      }
      if (tool instanceof PinTool) {
        tool.setLastScreen(e.clientX, e.clientY);
        tool.onMouseDown(point, getPinToolCallbacks());
      } else {
        tool.onMouseDown(point, getToolCallbacks());
      }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (panDragRef.current.active) {
        // Middle-click pan is handled by pixi-viewport natively
        // But we track it to avoid tool interference
        return;
      }

      const point = toCanvasPoint(e.clientX, e.clientY, e.shiftKey, e.altKey);
      if (!point) return;

      const tool = toolRef.current;
      let ghost: GhostShape | null = null;

      // Update modifier keys for resize/rotate
      if (tool instanceof SelectTool) {
        tool.updateModifiers(e.shiftKey, e.altKey);
      }
      if (tool instanceof PinTool) {
        tool.setLastScreen(e.clientX, e.clientY);
        ghost = tool.onMouseMove(point, getPinToolCallbacks());
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

    const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button === 1) {
        panDragRef.current.active = false;
        return;
      }

      if (e.button !== 0) return;

      const point = toCanvasPoint(e.clientX, e.clientY, e.shiftKey, e.altKey);
      if (!point) return;

      const tool = toolRef.current;
      // Update modifier keys for resize/rotate commit
      if (tool instanceof SelectTool) {
        tool.updateModifiers(e.shiftKey, e.altKey);
      }
      if (tool instanceof PinTool) {
        tool.setLastScreen(e.clientX, e.clientY);
        tool.onMouseUp(point, getPinToolCallbacks());
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
        const target = event.target as HTMLElement;
        const isInputField =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable;

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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      />
    );
  },
);
