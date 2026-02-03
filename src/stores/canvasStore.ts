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
  WireHandle,
  WireEndpoint,
  Junction,
  Position,
  PortPosition,
  HandleConstraint,
  CircuitMetadata,
  SerializableCircuitState,
} from '../components/OneCanvas/types';
import { isPortEndpoint } from '../components/OneCanvas/types';
import {
  getPortRelativePosition,
  calculateWireBendPoints,
} from '../components/OneCanvas/utils/wirePathCalculator';
import {
  getBlockSize,
} from '../components/OneCanvas/blockDefinitions';

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
  /** Starting port position for direction detection */
  startPosition?: Position;
  /** Detected exit direction from initial drag */
  exitDirection?: PortPosition;
}

/** History snapshot for undo/redo */
interface HistorySnapshot {
  /** Components as array of entries for serialization */
  components: Array<[string, Block]>;
  /** Junction points as array of entries */
  junctions: Array<[string, Junction]>;
  /** Wire connections */
  wires: Wire[];
}

interface CanvasState {
  // Circuit data
  /** All component blocks by ID */
  components: Map<string, Block>;
  /** All junction points by ID */
  junctions: Map<string, Junction>;
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
  addWire: (from: WireEndpoint, to: WireEndpoint, options?: { fromExitDirection?: PortPosition; toExitDirection?: PortPosition }) => string | null;
  /** Remove a wire by ID */
  removeWire: (id: string) => void;
  /** Create a junction on an existing wire, splitting it into two wires */
  createJunctionOnWire: (wireId: string, position: Position) => string | null;
  /** Start drawing a wire from an endpoint */
  startWireDrawing: (from: WireEndpoint, options?: { skipValidation?: boolean; startPosition?: Position }) => void;
  /** Update temporary wire position during drawing */
  updateWireDrawing: (position: Position) => void;
  /** Complete wire drawing to an endpoint */
  completeWireDrawing: (to: WireEndpoint) => string | null;
  /** Cancel wire drawing */
  cancelWireDrawing: () => void;

  // Wire handle operations
  /** Add handle to wire at position */
  addWireHandle: (wireId: string, position: Position) => void;
  /** Update handle position (constrained). Set isFirstMove=true on drag start to record history. */
  updateWireHandle: (wireId: string, handleIndex: number, position: Position, isFirstMove?: boolean) => void;
  /** Remove handle from wire */
  removeWireHandle: (wireId: string, handleIndex: number) => void;

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
  junctions: new Map(),
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
function createSnapshot(components: Map<string, Block>, wires: Wire[], junctions?: Map<string, Junction>): HistorySnapshot {
  return {
    components: Array.from(components.entries()).map(([id, block]) => [
      id,
      { ...block, ports: [...block.ports] },
    ]),
    junctions: junctions ? Array.from(junctions.entries()).map(([id, j]) => [id, { ...j, position: { ...j.position } }]) : [],
    wires: wires.map((wire) => ({
      ...wire,
      from: { ...wire.from },
      to: { ...wire.to },
      handles: wire.handles ? wire.handles.map((h) => ({ ...h, position: { ...h.position } })) : undefined,
    })),
  };
}

/** Restore circuit state from history snapshot */
function restoreSnapshot(snapshot: HistorySnapshot): {
  components: Map<string, Block>;
  junctions: Map<string, Junction>;
  wires: Wire[];
} {
  return {
    components: new Map(
      snapshot.components.map(([id, block]) => [id, { ...block, ports: [...block.ports] }])
    ),
    junctions: new Map(
      snapshot.junctions.map(([id, j]) => [id, { ...j, position: { ...j.position } }])
    ),
    wires: snapshot.wires.map((wire) => ({
      ...wire,
      from: { ...wire.from },
      to: { ...wire.to },
      handles: wire.handles ? wire.handles.map((h) => ({ ...h, position: { ...h.position } })) : undefined,
    })),
  };
}

/** Validate wire endpoint exists */
function isValidEndpoint(
  endpoint: WireEndpoint,
  components: Map<string, Block>,
  junctions?: Map<string, Junction>
): boolean {
  if (isPortEndpoint(endpoint)) {
    const component = components.get(endpoint.componentId);
    if (!component) return false;
    return component.ports.some((port) => port.id === endpoint.portId);
  } else {
    // Junction endpoint
    return junctions ? junctions.has(endpoint.junctionId) : false;
  }
}

/** Get a unique key for a wire endpoint for comparison */
function endpointKey(ep: WireEndpoint): string {
  if (isPortEndpoint(ep)) {
    return `port:${ep.componentId}:${ep.portId}`;
  }
  return `junction:${ep.junctionId}`;
}

/** Check if wire already exists (in either direction) */
function wireExists(wires: Wire[], from: WireEndpoint, to: WireEndpoint): boolean {
  const fromKey = endpointKey(from);
  const toKey = endpointKey(to);
  return wires.some(
    (wire) =>
      (endpointKey(wire.from) === fromKey && endpointKey(wire.to) === toKey) ||
      (endpointKey(wire.from) === toKey && endpointKey(wire.to) === fromKey)
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

/** Threshold in pixels before direction is detected */
const DIRECTION_THRESHOLD = 15;

/**
 * Detect drag direction from start position to current position.
 * Returns null if below threshold.
 */
function detectDragDirection(startPos: Position, currentPos: Position): PortPosition | null {
  const dx = currentPos.x - startPos.x;
  const dy = currentPos.y - startPos.y;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < DIRECTION_THRESHOLD) {
    return null;
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'bottom' : 'top';
}

/** Helper to get port relative position without importing from wirePathCalculator (avoid circular) */
function getPortRelativePos(
  portPosition: PortPosition,
  portOffset: number,
  blockSize: { width: number; height: number }
): Position {
  switch (portPosition) {
    case 'top': return { x: blockSize.width * portOffset, y: 0 };
    case 'bottom': return { x: blockSize.width * portOffset, y: blockSize.height };
    case 'left': return { x: 0, y: blockSize.height * portOffset };
    case 'right': return { x: blockSize.width, y: blockSize.height * portOffset };
    default: return { x: blockSize.width / 2, y: blockSize.height / 2 };
  }
}

/**
 * Find where to insert a new handle in the points array based on path order.
 * Uses distance from the wire's from-port to determine ordering along the path.
 */
function findHandleInsertIndex(wire: Wire, position: Position, components: Map<string, Block>): number {
  if (!wire.handles || wire.handles.length === 0) {
    return 0;
  }

  // Get from port position as reference point for ordering
  let fromPos: Position = { x: 0, y: 0 };
  const wireFrom = wire.from;
  const fromBlock = isPortEndpoint(wireFrom) ? components.get(wireFrom.componentId) : undefined;
  if (fromBlock && isPortEndpoint(wireFrom)) {
    const fromPort = fromBlock.ports.find((p) => p.id === wireFrom.portId);
    if (fromPort) {
      const blockSize = fromBlock.size;
      const relPos = getPortRelativePos(fromPort.position, fromPort.offset ?? 0.5, blockSize);
      fromPos = { x: fromBlock.position.x + relPos.x, y: fromBlock.position.y + relPos.y };
    }
  }

  // Calculate distance from fromPort for each existing handle and the new position
  const distFromStart = (p: Position) =>
    Math.sqrt(Math.pow(p.x - fromPos.x, 2) + Math.pow(p.y - fromPos.y, 2));

  const newDist = distFromStart(position);

  // Find the correct insertion index to maintain order by distance from start
  for (let i = 0; i < wire.handles.length; i++) {
    if (newDist < distFromStart(wire.handles[i].position)) {
      return i;
    }
  }

  return wire.handles.length;
}

/**
 * Compute auto-generated bend points for a wire based on port directions.
 * Returns the points and constraints, or undefined if no bends needed.
 */
function computeWireBendPoints(
  from: WireEndpoint,
  to: WireEndpoint,
  components: Map<string, Block>,
  fromExitDirection?: PortPosition,
  toExitDirection?: PortPosition
): WireHandle[] | undefined {
  // Only compute bend points for port-to-port wires
  if (!isPortEndpoint(from) || !isPortEndpoint(to)) return undefined;

  const fromBlock = components.get(from.componentId);
  const toBlock = components.get(to.componentId);
  if (!fromBlock || !toBlock) return undefined;

  const fromPort = fromBlock.ports.find((p) => p.id === from.portId);
  const toPort = toBlock.ports.find((p) => p.id === to.portId);
  if (!fromPort || !toPort) return undefined;

  const fromSize = fromBlock.size;
  const toSize = toBlock.size;

  const fromRelPos = getPortRelativePosition(fromPort.position, fromPort.offset ?? 0.5, fromSize);
  const toRelPos = getPortRelativePosition(toPort.position, toPort.offset ?? 0.5, toSize);

  const fromPos = { x: fromBlock.position.x + fromRelPos.x, y: fromBlock.position.y + fromRelPos.y };
  const toPos = { x: toBlock.position.x + toRelPos.x, y: toBlock.position.y + toRelPos.y };

  const fromDir = fromExitDirection || fromPort.position;
  const toDir = toExitDirection || toPort.position;

  const result = calculateWireBendPoints(fromPos, toPos, fromDir, toDir);
  if (result.points.length === 0) return undefined;

  return result.points.map((p, i) => ({
    position: p,
    constraint: result.constraints[i],
    source: 'auto' as const,
  }));
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
          size: getBlockSize(type),
          ports: getDefaultPorts(type),
          ...getDefaultBlockProps(type),
          ...props,
        } as Block;

        set(
          (state) => {
            // Push history before modification
            const snapshot = createSnapshot(state.components, state.wires, state.junctions);
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
            const snapshot = createSnapshot(state.components, state.wires, state.junctions);
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
              (wire) =>
                !(isPortEndpoint(wire.from) && wire.from.componentId === id) &&
                !(isPortEndpoint(wire.to) && wire.to.componentId === id)
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
            const snapshot = createSnapshot(state.components, state.wires, state.junctions);
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

      addWire: (from, to, options) => {
        const state = get();

        // Validate endpoints
        if (!isValidEndpoint(from, state.components, state.junctions)) {
          console.warn('Invalid wire source endpoint:', from);
          return null;
        }
        if (!isValidEndpoint(to, state.components, state.junctions)) {
          console.warn('Invalid wire target endpoint:', to);
          return null;
        }

        // Prevent self-connection (only for port endpoints on the same component)
        if (isPortEndpoint(from) && isPortEndpoint(to) && from.componentId === to.componentId) {
          console.warn('Cannot connect component to itself');
          return null;
        }

        // Prevent connecting same endpoint to itself
        if (endpointKey(from) === endpointKey(to)) {
          console.warn('Cannot connect endpoint to itself');
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
            const snapshot = createSnapshot(state.components, state.wires, state.junctions);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            const newWire: Wire = { id, from, to };
            if (options?.fromExitDirection) {
              newWire.fromExitDirection = options.fromExitDirection;
            }
            if (options?.toExitDirection) {
              newWire.toExitDirection = options.toExitDirection;
            }

            // Auto-generate bend points
            const handles = computeWireBendPoints(
              from, to, state.components,
              options?.fromExitDirection, options?.toExitDirection
            );
            if (handles) {
              newWire.handles = handles;
            }

            state.wires.push(newWire);
            state.isDirty = true;
          },
          false,
          `addWire/${endpointKey(from)}-${endpointKey(to)}`
        );

        return id;
      },

      removeWire: (id) => {
        set(
          (state) => {
            const wireIndex = state.wires.findIndex((w) => w.id === id);
            if (wireIndex === -1) return;

            // Push history
            const snapshot = createSnapshot(state.components, state.wires, state.junctions);
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

      createJunctionOnWire: (wireId, position) => {
        const state = get();
        const wire = state.wires.find((w) => w.id === wireId);
        if (!wire) {
          console.warn('Wire not found:', wireId);
          return null;
        }

        // Create junction (wire-level concept, not a block)
        const junctionId = generateId('junction');
        const junction: Junction = {
          id: junctionId,
          position: { x: position.x, y: position.y },
        };

        set(
          (state) => {
            // Push history
            const snapshot = createSnapshot(state.components, state.wires, state.junctions);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            // Find and remove original wire
            const wireIndex = state.wires.findIndex((w) => w.id === wireId);
            if (wireIndex === -1) return;
            const originalWire = state.wires[wireIndex];
            state.wires.splice(wireIndex, 1);

            // Add junction to junctions map
            state.junctions.set(junctionId, junction);

            // Create two new wires: from->junction and junction->to
            // Use JunctionEndpoint for junction connections
            const wire1Id = generateId('wire');
            const wire2Id = generateId('wire');

            const wire1: Wire = {
              id: wire1Id,
              from: { ...originalWire.from },
              to: { junctionId },
            };
            if (originalWire.fromExitDirection) {
              wire1.fromExitDirection = originalWire.fromExitDirection;
            }

            const wire2: Wire = {
              id: wire2Id,
              from: { junctionId },
              to: { ...originalWire.to },
            };
            if (originalWire.toExitDirection) {
              wire2.toExitDirection = originalWire.toExitDirection;
            }

            state.wires.push(wire1);
            state.wires.push(wire2);

            // Select the new junction
            state.selectedIds = new Set([junctionId]);
            state.isDirty = true;
          },
          false,
          `createJunctionOnWire/${wireId}`
        );

        return junctionId;
      },

      startWireDrawing: (from, options) => {
        const state = get();
        // Skip validation if caller already validated against their own components
        if (!options?.skipValidation && !isValidEndpoint(from, state.components)) {
          console.warn('Invalid wire start endpoint:', from);
          return;
        }

        set(
          (state) => {
            state.wireDrawing = {
              from,
              tempPosition: { x: 0, y: 0 },
              startPosition: options?.startPosition,
              exitDirection: undefined,
            };
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

              // Detect exit direction if we have a start position and haven't detected yet
              if (state.wireDrawing.startPosition && !state.wireDrawing.exitDirection) {
                const direction = detectDragDirection(state.wireDrawing.startPosition, position);
                if (direction) {
                  state.wireDrawing.exitDirection = direction;
                }
              }
            }
          },
          false,
          'updateWireDrawing'
        );
      },

      completeWireDrawing: (to) => {
        const state = get();
        if (!state.wireDrawing) return null;

        const { from, exitDirection } = state.wireDrawing;

        // Determine target port's natural direction for toExitDirection
        let toExitDirection: PortPosition | undefined;
        if (isPortEndpoint(to)) {
          const toBlock = state.components.get(to.componentId);
          if (toBlock) {
            const toPort = toBlock.ports.find((p) => p.id === to.portId);
            if (toPort) {
              toExitDirection = toPort.position;
            }
          }
        }

        const wireId = get().addWire(from, to, {
          fromExitDirection: exitDirection,
          toExitDirection,
        });
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
      // Wire Handle Operations
      // ========================================================================

      addWireHandle: (wireId, position) => {
        set(
          (state) => {
            const wire = state.wires.find((w) => w.id === wireId);
            if (!wire) return;

            // Push history
            const snapshot = createSnapshot(state.components, state.wires, state.junctions);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            // Initialize array if needed
            wire.handles = wire.handles || [];

            // Insert handle at correct position
            const insertIndex = findHandleInsertIndex(wire, position, state.components);

            const newHandle: WireHandle = {
              position,
              constraint: 'free',
              source: 'user',
            };

            wire.handles.splice(insertIndex, 0, newHandle);

            state.isDirty = true;
          },
          false,
          `addWireHandle/${wireId}`
        );
      },

      updateWireHandle: (wireId, handleIndex, position, isFirstMove) => {
        set(
          (state) => {
            const wire = state.wires.find((w) => w.id === wireId);
            if (!wire?.handles?.[handleIndex]) return;

            // Push history on first move of a drag so Undo reverts the whole drag
            if (isFirstMove) {
              const snapshot = createSnapshot(state.components, state.wires, state.junctions);
              state.history = state.history.slice(0, state.historyIndex + 1);
              state.history.push(snapshot);
              if (state.history.length > MAX_HISTORY_SIZE) {
                state.history.shift();
              } else {
                state.historyIndex++;
              }
            }

            const handle = wire.handles[handleIndex];
            const constraint = handle.constraint;
            const original = handle.position;

            // Apply constraint - only allow movement in constrained direction
            if (constraint === 'free') {
              handle.position = { x: position.x, y: position.y };
            } else {
              handle.position = constraint === 'horizontal'
                ? { x: position.x, y: original.y }
                : { x: original.x, y: position.y };
            }

            state.isDirty = true;
          },
          false,
          `updateWireHandle/${wireId}/${handleIndex}`
        );
      },

      removeWireHandle: (wireId, handleIndex) => {
        set(
          (state) => {
            const wire = state.wires.find((w) => w.id === wireId);
            if (!wire?.handles?.[handleIndex]) return;

            // Push history
            const snapshot = createSnapshot(state.components, state.wires, state.junctions);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            wire.handles.splice(handleIndex, 1);

            state.isDirty = true;
          },
          false,
          `removeWireHandle/${wireId}/${handleIndex}`
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
          maxX = Math.max(maxX, component.position.x + component.size.width);
          maxY = Math.max(maxY, component.position.y + component.size.height);
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
              const snapshot = createSnapshot(state.components, state.wires, state.junctions);
              state.history.push(snapshot);
            }

            const snapshot = state.history[state.historyIndex];
            const restored = restoreSnapshot(snapshot);
            state.components = restored.components;
            state.junctions = restored.junctions;
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
              state.junctions = restored.junctions;
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
            const rawComponents = new Map(Object.entries(data.components));

            // Migrate: separate junction blocks into junctions map
            const migratedJunctions = new Map<string, Junction>();
            const junctionBlockIds = new Set<string>();
            for (const [id, block] of rawComponents) {
              const blockAny = block as unknown as Record<string, unknown>;
              if (blockAny.type === 'junction') {
                // Old format: junction-as-block with position offset by 6px
                migratedJunctions.set(id, {
                  id,
                  position: {
                    x: (block.position?.x ?? 0) + 6,
                    y: (block.position?.y ?? 0) + 6,
                  },
                });
                junctionBlockIds.add(id);
              }
            }

            // Remove junction blocks from components
            for (const id of junctionBlockIds) {
              rawComponents.delete(id);
            }

            // Backfill size for remaining blocks
            state.components = rawComponents as Map<string, Block>;
            for (const [, block] of state.components) {
              if (!block.size) {
                block.size = getBlockSize(block.type);
              }
            }

            // Migrate wires: convert junction block endpoints to junction endpoints
            state.wires = data.wires.map((wire) => {
              const fromRaw = wire.from as unknown as Record<string, string>;
              const toRaw = wire.to as unknown as Record<string, string>;

              let migratedFrom = { ...wire.from };
              let migratedTo = { ...wire.to };

              // If wire endpoint points to a junction block, convert to JunctionEndpoint
              if (fromRaw.componentId && junctionBlockIds.has(fromRaw.componentId)) {
                migratedFrom = { junctionId: fromRaw.componentId } as unknown as typeof wire.from;
              }
              if (toRaw.componentId && junctionBlockIds.has(toRaw.componentId)) {
                migratedTo = { junctionId: toRaw.componentId } as unknown as typeof wire.to;
              }

              const migrated: Wire = {
                ...wire,
                from: migratedFrom,
                to: migratedTo,
              };
              // Migrate old points/handleConstraints to handles
              const oldWire = wire as unknown as { points?: Position[]; handleConstraints?: HandleConstraint[] };
              if (oldWire.points && oldWire.points.length > 0 && !migrated.handles) {
                migrated.handles = oldWire.points.map((p: Position, i: number) => ({
                  position: { ...p },
                  constraint: oldWire.handleConstraints?.[i] || ('horizontal' as HandleConstraint),
                  source: 'auto' as const,
                }));
              }
              // Clean up old fields if present on the data object
              const raw = migrated as unknown as Record<string, unknown>;
              delete raw.points;
              delete raw.handleConstraints;
              return migrated;
            });

            // Merge migrated junctions with any existing junctions in data
            state.junctions = data.junctions
              ? new Map(Object.entries(data.junctions))
              : new Map();
            for (const [id, j] of migratedJunctions) {
              if (!state.junctions.has(id)) {
                state.junctions.set(id, j);
              }
            }

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
          junctions: state.junctions.size > 0 ? Object.fromEntries(state.junctions) : undefined,
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
            const snapshot = createSnapshot(state.components, state.wires, state.junctions);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            state.components = new Map();
            state.junctions = new Map();
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
            junctions: new Map(),
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

/** Select all junctions */
export const selectJunctions = (state: CanvasStore) => state.junctions;

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
    maxX = Math.max(maxX, component.position.x + component.size.width);
    maxY = Math.max(maxY, component.position.y + component.size.height);
  });

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

export default useCanvasStore;
