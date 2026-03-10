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
import { SelectTool, RectTool, CircleTool, PolylineTool, ArcTool, TextTool, PinTool } from './tools';
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
  /** Callback to delete selected items */
  onDeleteSelected?: () => void;
  /** Callback to open pin config popover */
  onOpenPinPopover?: (screenX: number, screenY: number, canvasX: number, canvasY: number) => void;
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

    // Stable refs for callbacks (avoid stale closures)
    const symbolRef = useRef(symbol);
    symbolRef.current = symbol;
    const dispatchRef = useRef(dispatch);
    dispatchRef.current = dispatch;
    const onAddPrimitiveRef = useRef(onAddPrimitive);
    onAddPrimitiveRef.current = onAddPrimitive;
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
    }, [selectedIds, symbol]);

    // React to tool changes → swap tool instance
    useEffect(() => {
      toolRef.current.cancel();
      ghostRendererRef.current?.render(null);
      toolRef.current = createTool(currentTool);
    }, [currentTool]);

    // ========================================================================
    // Coordinate conversion
    // ========================================================================

    const toCanvasPoint = (screenX: number, screenY: number): CanvasPoint | null => {
      const coordSys = coordSysRef.current;
      if (!coordSys) return null;
      const world = coordSys.screenToWorldSnapped(screenX, screenY);
      return { x: world.x, y: world.y };
    };

    // ========================================================================
    // DOM Event Handlers
    // ========================================================================

    const getToolCallbacks = (): ToolCallbacks => ({
      symbol: symbolRef.current,
      onAddPrimitive: onAddPrimitiveRef.current ?? (() => {}),
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

      const point = toCanvasPoint(e.clientX, e.clientY);
      if (!point) return;

      const tool = toolRef.current;
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

      const point = toCanvasPoint(e.clientX, e.clientY);
      if (!point) return;

      const tool = toolRef.current;
      let ghost: GhostShape | null = null;

      if (tool instanceof PinTool) {
        tool.setLastScreen(e.clientX, e.clientY);
        ghost = tool.onMouseMove(point, getPinToolCallbacks());
      } else {
        ghost = tool.onMouseMove(point, getToolCallbacks());
      }

      ghostRendererRef.current?.render(ghost);
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button === 1) {
        panDragRef.current.active = false;
        return;
      }

      if (e.button !== 0) return;

      const point = toCanvasPoint(e.clientX, e.clientY);
      if (!point) return;

      const tool = toolRef.current;
      if (tool instanceof PinTool) {
        tool.setLastScreen(e.clientX, e.clientY);
        tool.onMouseUp(point, getPinToolCallbacks());
      } else {
        tool.onMouseUp(point, getToolCallbacks());
      }

      ghostRendererRef.current?.render(null);
    };

    const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;

      const point = toCanvasPoint(e.clientX, e.clientY);
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
        if (event.key === 'Delete' || event.key === 'Backspace') {
          onDeleteSelectedRef.current?.();
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
