/**
 * Canvas Store - Zustand State Management for OneCanvas
 *
 * Manages circuit canvas state including components, wires, selection,
 * viewport (zoom/pan), grid settings, and undo/redo history.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  Block,
  BlockType,
  Wire,
  WireEndpoint,
  Position,
  CircuitMetadata,
  SerializableCircuitState,
} from '../components/OneCanvas/types';

// ============================================================================
// Types
// ============================================================================

/** Active tool for canvas interaction */
export type CanvasTool = 'select' | 'wire' | 'pan';

/** State for in-progress wire drawing */
export interface WireDrawingState {
  /** Starting endpoint */
  from: WireEndpoint;
  /** Current mouse position for visual feedback */
  tempPosition: Position;
}

/** History snapshot for undo/redo */
interface HistorySnapshot {
  /** Components as array of entries for serialization */
  components: Array<[string, Block]>;
  /** Wire connections */
  wires: Wire[];
}

interface CanvasState {
  // Circuit data
  /** All component blocks by ID */
  components: Map<string, Block>;
  /** All wire connections */
  wires: Wire[];
  /** Circuit metadata */
  metadata: CircuitMetadata;

  // Selection
  /** Currently selected component/wire IDs */
  selectedIds: Set<string>;

  // Viewport
  /** Current zoom level (0.1 to 4.0) */
  zoom: number;
  /** Current pan offset */
  pan: Position;

  // Grid
  /** Grid cell size in pixels */
  gridSize: number;
  /** Whether to snap to grid when placing/moving */
  snapToGrid: boolean;
  /** Whether to show grid lines */
  showGrid: boolean;

  // Interaction state
  /** Current active tool */
  tool: CanvasTool;
  /** In-progress wire drawing state */
  wireDrawing: WireDrawingState | null;

  // History for undo/redo
  /** History snapshots */
  history: HistorySnapshot[];
  /** Current position in history */
  historyIndex: number;

  // Flags
  /** Whether circuit has unsaved changes */
  isDirty: boolean;
}

interface CanvasActions {
  // Component operations
  /** Add a new component to the canvas */
  addComponent: (type: BlockType, position: Position, props?: Partial<Block>) => string;
  /** Remove a component by ID (also removes connected wires) */
  removeComponent: (id: string) => void;
  /** Update a component's properties */
  updateComponent: (id: string, updates: Partial<Block>) => void;
  /** Move a component to a new position */
  moveComponent: (id: string, position: Position) => void;

  // Wire operations
  /** Add a wire connection between two ports */
  addWire: (from: WireEndpoint, to: WireEndpoint) => string | null;
  /** Remove a wire by ID */
  removeWire: (id: string) => void;
  /** Start drawing a wire from an endpoint */
  startWireDrawing: (from: WireEndpoint) => void;
  /** Update temporary wire position during drawing */
  updateWireDrawing: (position: Position) => void;
  /** Complete wire drawing to an endpoint */
  completeWireDrawing: (to: WireEndpoint) => string | null;
  /** Cancel wire drawing */
  cancelWireDrawing: () => void;

  // Selection operations
  /** Set selection to specific IDs (replaces current) */
  setSelection: (ids: string[]) => void;
  /** Add an ID to current selection */
  addToSelection: (id: string) => void;
  /** Remove an ID from selection */
  removeFromSelection: (id: string) => void;
  /** Toggle selection of an ID */
  toggleSelection: (id: string) => void;
  /** Clear all selection */
  clearSelection: () => void;
  /** Select all components */
  selectAll: () => void;

  // Viewport operations
  /** Set zoom level (clamped to 0.1-4.0) */
  setZoom: (zoom: number) => void;
  /** Set pan offset */
  setPan: (pan: Position) => void;
  /** Zoom to fit all components in view */
  zoomToFit: (viewportWidth: number, viewportHeight: number, padding?: number) => void;
  /** Reset viewport to default */
  resetViewport: () => void;

  // Grid operations
  /** Toggle grid visibility */
  toggleGrid: () => void;
  /** Toggle snap to grid */
  toggleSnap: () => void;
  /** Set grid size */
  setGridSize: (size: number) => void;

  // Tool operations
  /** Set active tool */
  setTool: (tool: CanvasTool) => void;

  // History operations
  /** Undo last action */
  undo: () => void;
  /** Redo previously undone action */
  redo: () => void;

  // Circuit operations
  /** Load circuit data */
  loadCircuit: (data: SerializableCircuitState) => void;
  /** Get current circuit data for saving */
  getCircuitData: () => SerializableCircuitState;
  /** Clear canvas and reset to empty state */
  clearCanvas: () => void;
  /** Update circuit metadata */
  updateMetadata: (updates: Partial<CircuitMetadata>) => void;
  /** Mark as saved (clear dirty flag) */
  markSaved: () => void;

  // Reset
  /** Reset store to initial state */
  reset: () => void;
}

type CanvasStore = CanvasState & CanvasActions;

// ============================================================================
// Constants
// ============================================================================

const MAX_HISTORY_SIZE = 50;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.0;
const MIN_GRID_SIZE = 5;
const DEFAULT_GRID_SIZE = 20;

// ============================================================================
// Initial State
// ============================================================================

const initialState: CanvasState = {
  components: new Map(),
  wires: [],
  metadata: {
    name: 'Untitled Circuit',
    description: '',
    tags: [],
  },
  selectedIds: new Set(),
  zoom: 1.0,
  pan: { x: 0, y: 0 },
  gridSize: DEFAULT_GRID_SIZE,
  snapToGrid: true,
  showGrid: true,
  tool: 'select',
  wireDrawing: null,
  history: [],
  historyIndex: -1,
  isDirty: false,
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Generate unique ID for components */
function generateId(type: string): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Snap position to grid */
function snapToGridPosition(position: Position, gridSize: number): Position {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  };
}

/** Create a deep clone of circuit state for history */
function createSnapshot(components: Map<string, Block>, wires: Wire[]): HistorySnapshot {
  return {
    components: Array.from(components.entries()).map(([id, block]) => [
      id,
      { ...block, ports: [...block.ports] },
    ]),
    wires: wires.map((wire) => ({
      ...wire,
      from: { ...wire.from },
      to: { ...wire.to },
      points: wire.points ? [...wire.points] : undefined,
    })),
  };
}

/** Restore circuit state from history snapshot */
function restoreSnapshot(snapshot: HistorySnapshot): {
  components: Map<string, Block>;
  wires: Wire[];
} {
  return {
    components: new Map(
      snapshot.components.map(([id, block]) => [id, { ...block, ports: [...block.ports] }])
    ),
    wires: snapshot.wires.map((wire) => ({
      ...wire,
      from: { ...wire.from },
      to: { ...wire.to },
      points: wire.points ? [...wire.points] : undefined,
    })),
  };
}

/** Validate wire endpoint exists */
function isValidEndpoint(
  endpoint: WireEndpoint,
  components: Map<string, Block>
): boolean {
  const component = components.get(endpoint.componentId);
  if (!component) return false;
  return component.ports.some((port) => port.id === endpoint.portId);
}

/** Check if wire already exists (in either direction) */
function wireExists(wires: Wire[], from: WireEndpoint, to: WireEndpoint): boolean {
  return wires.some(
    (wire) =>
      (wire.from.componentId === from.componentId &&
        wire.from.portId === from.portId &&
        wire.to.componentId === to.componentId &&
        wire.to.portId === to.portId) ||
      (wire.from.componentId === to.componentId &&
        wire.from.portId === to.portId &&
        wire.to.componentId === from.componentId &&
        wire.to.portId === from.portId)
  );
}

/** Get default properties for a block type */
function getDefaultBlockProps(type: BlockType): Partial<Block> {
  switch (type) {
    case 'power_24v':
      return { maxCurrent: 1000 };
    case 'power_12v':
      return { maxCurrent: 1000 };
    case 'gnd':
      return {};
    case 'plc_out':
      return { address: 'C:0x0000', normallyOpen: true, inverted: false };
    case 'plc_in':
      return { address: 'DI:0x0000', thresholdVoltage: 12, inverted: false };
    case 'led':
      return { color: 'red', forwardVoltage: 2.0, lit: false };
    case 'button':
      return { mode: 'momentary', contactConfig: '1a', pressed: false };
    case 'scope':
      return { channels: 1, triggerMode: 'auto', timeBase: 100, voltageScale: 5 };
    default:
      return {};
  }
}

/** Get default ports for a block type */
function getDefaultPorts(type: BlockType): Block['ports'] {
  switch (type) {
    case 'power_24v':
    case 'power_12v':
      return [{ id: 'out', type: 'output', label: '+', position: 'bottom' }];
    case 'gnd':
      return [{ id: 'in', type: 'input', label: 'GND', position: 'top' }];
    case 'plc_out':
      return [
        { id: 'in', type: 'input', label: 'IN', position: 'left' },
        { id: 'out', type: 'output', label: 'OUT', position: 'right' },
      ];
    case 'plc_in':
      return [
        { id: 'in', type: 'input', label: 'IN', position: 'left' },
        { id: 'out', type: 'output', label: 'OUT', position: 'right' },
      ];
    case 'led':
      return [
        { id: 'anode', type: 'input', label: '+', position: 'top' },
        { id: 'cathode', type: 'output', label: '-', position: 'bottom' },
      ];
    case 'button':
      return [
        { id: 'in', type: 'input', label: 'IN', position: 'left' },
        { id: 'out', type: 'output', label: 'OUT', position: 'right' },
      ];
    case 'scope':
      return [
        { id: 'ch1', type: 'input', label: 'CH1', position: 'left', offset: 0.25 },
        { id: 'ch2', type: 'input', label: 'CH2', position: 'left', offset: 0.5 },
        { id: 'ch3', type: 'input', label: 'CH3', position: 'left', offset: 0.75 },
        { id: 'ch4', type: 'input', label: 'CH4', position: 'left', offset: 1.0 },
      ];
    default:
      return [];
  }
}

// ============================================================================
// Store
// ============================================================================

export const useCanvasStore = create<CanvasStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      ...initialState,

      // ========================================================================
      // Component Operations
      // ========================================================================

      addComponent: (type, position, props = {}) => {
        const id = generateId(type);
        const state = get();
        const finalPosition = state.snapToGrid
          ? snapToGridPosition(position, state.gridSize)
          : position;

        const newBlock: Block = {
          id,
          type,
          position: finalPosition,
          ports: getDefaultPorts(type),
          ...getDefaultBlockProps(type),
          ...props,
        } as Block;

        set(
          (state) => {
            // Push history before modification
            const snapshot = createSnapshot(state.components, state.wires);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            state.components.set(id, newBlock);
            state.isDirty = true;
          },
          false,
          `addComponent/${type}`
        );

        return id;
      },

      removeComponent: (id) => {
        set(
          (state) => {
            if (!state.components.has(id)) return;

            // Push history
            const snapshot = createSnapshot(state.components, state.wires);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            // Remove component
            state.components.delete(id);

            // Remove connected wires
            state.wires = state.wires.filter(
              (wire) => wire.from.componentId !== id && wire.to.componentId !== id
            );

            // Remove from selection
            state.selectedIds.delete(id);
            state.isDirty = true;
          },
          false,
          `removeComponent/${id}`
        );
      },

      updateComponent: (id, updates) => {
        set(
          (state) => {
            const component = state.components.get(id);
            if (!component) return;

            // Push history
            const snapshot = createSnapshot(state.components, state.wires);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            state.components.set(id, { ...component, ...updates } as Block);
            state.isDirty = true;
          },
          false,
          `updateComponent/${id}`
        );
      },

      moveComponent: (id, position) => {
        const state = get();
        const finalPosition = state.snapToGrid
          ? snapToGridPosition(position, state.gridSize)
          : position;
        get().updateComponent(id, { position: finalPosition });
      },

      // ========================================================================
      // Wire Operations
      // ========================================================================

      addWire: (from, to) => {
        const state = get();

        // Validate endpoints
        if (!isValidEndpoint(from, state.components)) {
          console.warn('Invalid wire source endpoint:', from);
          return null;
        }
        if (!isValidEndpoint(to, state.components)) {
          console.warn('Invalid wire target endpoint:', to);
          return null;
        }

        // Prevent self-connection
        if (from.componentId === to.componentId) {
          console.warn('Cannot connect component to itself');
          return null;
        }

        // Prevent duplicate wires
        if (wireExists(state.wires, from, to)) {
          console.warn('Wire already exists');
          return null;
        }

        const id = generateId('wire');

        set(
          (state) => {
            // Push history
            const snapshot = createSnapshot(state.components, state.wires);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            state.wires.push({ id, from, to });
            state.isDirty = true;
          },
          false,
          `addWire/${from.componentId}-${to.componentId}`
        );

        return id;
      },

      removeWire: (id) => {
        set(
          (state) => {
            const wireIndex = state.wires.findIndex((w) => w.id === id);
            if (wireIndex === -1) return;

            // Push history
            const snapshot = createSnapshot(state.components, state.wires);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            state.wires.splice(wireIndex, 1);
            state.selectedIds.delete(id);
            state.isDirty = true;
          },
          false,
          `removeWire/${id}`
        );
      },

      startWireDrawing: (from) => {
        const state = get();
        if (!isValidEndpoint(from, state.components)) {
          console.warn('Invalid wire start endpoint:', from);
          return;
        }

        set(
          (state) => {
            state.wireDrawing = { from, tempPosition: { x: 0, y: 0 } };
          },
          false,
          'startWireDrawing'
        );
      },

      updateWireDrawing: (position) => {
        set(
          (state) => {
            if (state.wireDrawing) {
              state.wireDrawing.tempPosition = position;
            }
          },
          false,
          'updateWireDrawing'
        );
      },

      completeWireDrawing: (to) => {
        const state = get();
        if (!state.wireDrawing) return null;

        const wireId = get().addWire(state.wireDrawing.from, to);
        set(
          (state) => {
            state.wireDrawing = null;
          },
          false,
          'completeWireDrawing'
        );

        return wireId;
      },

      cancelWireDrawing: () => {
        set(
          (state) => {
            state.wireDrawing = null;
          },
          false,
          'cancelWireDrawing'
        );
      },

      // ========================================================================
      // Selection Operations
      // ========================================================================

      setSelection: (ids) => {
        set(
          (state) => {
            state.selectedIds = new Set(ids);
          },
          false,
          'setSelection'
        );
      },

      addToSelection: (id) => {
        set(
          (state) => {
            state.selectedIds.add(id);
          },
          false,
          `addToSelection/${id}`
        );
      },

      removeFromSelection: (id) => {
        set(
          (state) => {
            state.selectedIds.delete(id);
          },
          false,
          `removeFromSelection/${id}`
        );
      },

      toggleSelection: (id) => {
        set(
          (state) => {
            if (state.selectedIds.has(id)) {
              state.selectedIds.delete(id);
            } else {
              state.selectedIds.add(id);
            }
          },
          false,
          `toggleSelection/${id}`
        );
      },

      clearSelection: () => {
        set(
          (state) => {
            state.selectedIds = new Set();
          },
          false,
          'clearSelection'
        );
      },

      selectAll: () => {
        set(
          (state) => {
            state.selectedIds = new Set([
              ...state.components.keys(),
              ...state.wires.map((w) => w.id),
            ]);
          },
          false,
          'selectAll'
        );
      },

      // ========================================================================
      // Viewport Operations
      // ========================================================================

      setZoom: (zoom) => {
        const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
        set(
          (state) => {
            state.zoom = clampedZoom;
          },
          false,
          `setZoom/${clampedZoom.toFixed(2)}`
        );
      },

      setPan: (pan) => {
        set(
          (state) => {
            state.pan = pan;
          },
          false,
          'setPan'
        );
      },

      zoomToFit: (viewportWidth, viewportHeight, padding = 50) => {
        const state = get();
        if (state.components.size === 0) {
          get().resetViewport();
          return;
        }

        // Calculate bounding box of all components
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        state.components.forEach((component) => {
          minX = Math.min(minX, component.position.x);
          minY = Math.min(minY, component.position.y);
          // Assume default component size of 100x80
          maxX = Math.max(maxX, component.position.x + 100);
          maxY = Math.max(maxY, component.position.y + 80);
        });

        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;

        // Calculate zoom to fit
        const zoomX = viewportWidth / contentWidth;
        const zoomY = viewportHeight / contentHeight;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zoomX, zoomY)));

        // Calculate pan to center content
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const newPanX = viewportWidth / 2 - centerX * newZoom;
        const newPanY = viewportHeight / 2 - centerY * newZoom;

        set(
          (state) => {
            state.zoom = newZoom;
            state.pan = { x: newPanX, y: newPanY };
          },
          false,
          'zoomToFit'
        );
      },

      resetViewport: () => {
        set(
          (state) => {
            state.zoom = 1.0;
            state.pan = { x: 0, y: 0 };
          },
          false,
          'resetViewport'
        );
      },

      // ========================================================================
      // Grid Operations
      // ========================================================================

      toggleGrid: () => {
        set(
          (state) => {
            state.showGrid = !state.showGrid;
          },
          false,
          'toggleGrid'
        );
      },

      toggleSnap: () => {
        set(
          (state) => {
            state.snapToGrid = !state.snapToGrid;
          },
          false,
          'toggleSnap'
        );
      },

      setGridSize: (size) => {
        const clampedSize = Math.max(MIN_GRID_SIZE, size);
        set(
          (state) => {
            state.gridSize = clampedSize;
          },
          false,
          `setGridSize/${clampedSize}`
        );
      },

      // ========================================================================
      // Tool Operations
      // ========================================================================

      setTool: (tool) => {
        set(
          (state) => {
            state.tool = tool;
            // Cancel wire drawing when switching tools
            if (tool !== 'wire') {
              state.wireDrawing = null;
            }
          },
          false,
          `setTool/${tool}`
        );
      },

      // ========================================================================
      // History Operations
      // ========================================================================

      undo: () => {
        set(
          (state) => {
            if (state.historyIndex < 0) return;

            // Save current state for redo if at the end
            if (state.historyIndex === state.history.length - 1) {
              const snapshot = createSnapshot(state.components, state.wires);
              state.history.push(snapshot);
            }

            const snapshot = state.history[state.historyIndex];
            const restored = restoreSnapshot(snapshot);
            state.components = restored.components;
            state.wires = restored.wires;
            state.historyIndex--;
            state.selectedIds = new Set();
            state.isDirty = true;
          },
          false,
          'undo'
        );
      },

      redo: () => {
        set(
          (state) => {
            if (state.historyIndex >= state.history.length - 1) return;

            state.historyIndex++;
            const snapshot = state.history[state.historyIndex + 1];
            if (snapshot) {
              const restored = restoreSnapshot(snapshot);
              state.components = restored.components;
              state.wires = restored.wires;
              state.selectedIds = new Set();
              state.isDirty = true;
            }
          },
          false,
          'redo'
        );
      },

      // ========================================================================
      // Circuit Operations
      // ========================================================================

      loadCircuit: (data) => {
        set(
          (state) => {
            state.components = new Map(Object.entries(data.components));
            state.wires = data.wires.map((wire) => ({
              ...wire,
              from: { ...wire.from },
              to: { ...wire.to },
            }));
            state.metadata = { ...data.metadata };
            state.selectedIds = new Set();
            state.history = [];
            state.historyIndex = -1;
            state.isDirty = false;
            if (data.viewport) {
              state.zoom = data.viewport.zoom;
              state.pan = { x: data.viewport.panX, y: data.viewport.panY };
            }
          },
          false,
          'loadCircuit'
        );
      },

      getCircuitData: () => {
        const state = get();
        return {
          components: Object.fromEntries(state.components),
          wires: state.wires,
          metadata: state.metadata,
          viewport: {
            zoom: state.zoom,
            panX: state.pan.x,
            panY: state.pan.y,
          },
        };
      },

      clearCanvas: () => {
        set(
          (state) => {
            // Push history
            const snapshot = createSnapshot(state.components, state.wires);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            state.components = new Map();
            state.wires = [];
            state.selectedIds = new Set();
            state.metadata = {
              name: 'Untitled Circuit',
              description: '',
              tags: [],
            };
            state.isDirty = true;
          },
          false,
          'clearCanvas'
        );
      },

      updateMetadata: (updates) => {
        set(
          (state) => {
            state.metadata = { ...state.metadata, ...updates };
            state.isDirty = true;
          },
          false,
          'updateMetadata'
        );
      },

      markSaved: () => {
        set(
          (state) => {
            state.isDirty = false;
          },
          false,
          'markSaved'
        );
      },

      // ========================================================================
      // Reset
      // ========================================================================

      reset: () => {
        set(
          () => ({
            ...initialState,
            components: new Map(),
            wires: [],
            selectedIds: new Set(),
            history: [],
          }),
          false,
          'reset'
        );
      },
    })),
    { name: 'canvas-store' }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/** Select all components */
export const selectComponents = (state: CanvasStore) => state.components;

/** Select all wires */
export const selectWires = (state: CanvasStore) => state.wires;

/** Select circuit metadata */
export const selectMetadata = (state: CanvasStore) => state.metadata;

/** Select selected IDs */
export const selectSelectedIds = (state: CanvasStore) => state.selectedIds;

/** Select zoom level */
export const selectZoom = (state: CanvasStore) => state.zoom;

/** Select pan offset */
export const selectPan = (state: CanvasStore) => state.pan;

/** Select grid settings */
export const selectGridSettings = (state: CanvasStore) => ({
  gridSize: state.gridSize,
  snapToGrid: state.snapToGrid,
  showGrid: state.showGrid,
});

/** Select active tool */
export const selectTool = (state: CanvasStore) => state.tool;

/** Select wire drawing state */
export const selectWireDrawing = (state: CanvasStore) => state.wireDrawing;

/** Select whether undo is available */
export const selectCanUndo = (state: CanvasStore) => state.historyIndex >= 0;

/** Select whether redo is available */
export const selectCanRedo = (state: CanvasStore) =>
  state.historyIndex < state.history.length - 1;

/** Select whether circuit has unsaved changes */
export const selectIsDirty = (state: CanvasStore) => state.isDirty;

/** Select a single component by ID */
export const selectComponent = (id: string) => (state: CanvasStore) =>
  state.components.get(id);

/** Select selected components */
export const selectSelectedComponents = (state: CanvasStore) => {
  const selected: Block[] = [];
  state.selectedIds.forEach((id) => {
    const component = state.components.get(id);
    if (component) selected.push(component);
  });
  return selected;
};

/** Select selected wires */
export const selectSelectedWires = (state: CanvasStore) =>
  state.wires.filter((wire) => state.selectedIds.has(wire.id));

/** Select bounding box of all components */
export const selectBoundingBox = (state: CanvasStore) => {
  if (state.components.size === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  state.components.forEach((component) => {
    minX = Math.min(minX, component.position.x);
    minY = Math.min(minY, component.position.y);
    maxX = Math.max(maxX, component.position.x + 100);
    maxY = Math.max(maxY, component.position.y + 80);
  });

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

export default useCanvasStore;
