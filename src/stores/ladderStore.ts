/**
 * Ladder Store - Zustand State Management for LadderEditor
 *
 * Manages ladder editor state including networks, elements, selection,
 * monitoring state, clipboard, and undo/redo history.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  LadderElement,
  LadderElementType,
  LadderNetwork,
  LadderGridConfig,
  LadderMonitoringState,
  ContactElement,
  CoilElement,
  TimerElement,
  CounterElement,
  CompareElement,
  ContactProperties,
  CoilProperties,
  TimerProperties,
  CounterProperties,
  CompareProperties,
  ElementProperties,
  GridPosition,
  LadderProgramAST,
  LadderNetworkAST,
  LadderWire,
  LadderNode,
} from '../types/ladder';
import {
  DEFAULT_LADDER_GRID_CONFIG,
  createEmptyNetwork,
  createEmptyMonitoringState,
  isContactType,
  isCoilType,
  isTimerType,
  isCounterType,
  isCompareType,
} from '../types/ladder';

// ============================================================================
// Types
// ============================================================================

/** History snapshot for undo/redo */
interface HistorySnapshot {
  /** Networks as array of entries for serialization */
  networks: Array<[string, SerializableNetwork]>;
  /** Current network ID */
  currentNetworkId: string | null;
}

/** Serializable network for history */
interface SerializableNetwork {
  id: string;
  label?: string;
  comment?: string;
  elements: Array<[string, LadderElement]>;
  wires: LadderNetwork['wires'];
  enabled: boolean;
}

/** Ladder editor mode */
export type LadderEditorMode = 'edit' | 'monitor';

interface LadderState {
  // Network data
  /** All networks by ID */
  networks: Map<string, LadderNetwork>;
  /** Currently selected network ID */
  currentNetworkId: string | null;

  // Selection
  /** Currently selected element IDs */
  selectedElementIds: Set<string>;
  /** Clipboard contents for elements */
  clipboard: LadderElement[];
  /** Clipboard contents for network copy */
  networkClipboard: SerializableNetwork | null;

  // Configuration
  /** Grid configuration */
  gridConfig: LadderGridConfig;

  // Mode and Monitoring
  /** Current editor mode */
  mode: LadderEditorMode;
  /** Monitoring state (only populated in monitor mode) */
  monitoringState: LadderMonitoringState | null;

  // History for undo/redo
  /** History snapshots */
  history: HistorySnapshot[];
  /** Current position in history */
  historyIndex: number;

  // Flags
  /** Whether editor has unsaved changes */
  isDirty: boolean;
}

interface LadderActions {
  // Network operations
  /** Add a new network */
  addNetwork: (label?: string) => string;
  /** Remove a network by ID */
  removeNetwork: (id: string) => void;
  /** Select a network as current */
  selectNetwork: (id: string) => void;
  /** Update network label/comment */
  updateNetwork: (id: string, updates: Partial<Pick<LadderNetwork, 'label' | 'comment' | 'enabled'>>) => void;
  /** Reorder networks */
  reorderNetworks: (fromIndex: number, toIndex: number) => void;
  /** Copy current network to clipboard */
  copyNetwork: (networkId?: string) => void;
  /** Paste network from clipboard */
  pasteNetwork: (afterNetworkId?: string) => string | null;

  // Element operations
  /** Add a new element to the current network */
  addElement: (type: LadderElementType, position: GridPosition, props?: Partial<LadderElement>) => string | null;
  /** Remove an element by ID */
  removeElement: (id: string) => void;
  /** Move an element to a new position */
  moveElement: (id: string, position: GridPosition) => void;
  /** Update an element's properties */
  updateElement: (id: string, updates: Partial<LadderElement>) => void;
  /** Duplicate an element */
  duplicateElement: (id: string) => string | null;

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
  /** Select all elements in current network */
  selectAll: () => void;

  // Clipboard operations
  /** Copy selected elements to clipboard */
  copyToClipboard: () => void;
  /** Cut selected elements (copy + delete) */
  cutSelection: () => void;
  /** Paste clipboard contents at position */
  pasteFromClipboard: (position?: GridPosition) => void;

  // History operations
  /** Undo last action */
  undo: () => void;
  /** Redo previously undone action */
  redo: () => void;
  /** Push current state to history (manual) */
  pushHistory: () => void;

  // Monitoring operations
  /** Start monitoring mode */
  startMonitoring: () => void;
  /** Stop monitoring mode */
  stopMonitoring: () => void;
  /** Update monitoring state with new values */
  updateMonitoringState: (state: Partial<LadderMonitoringState>) => void;
  /** Force a device to a specific value */
  forceDevice: (address: string, value: boolean | number) => void;
  /** Release force on a device */
  releaseForce: (address: string) => void;

  // Grid configuration
  /** Update grid configuration */
  setGridConfig: (config: Partial<LadderGridConfig>) => void;

  // AST Integration
  /** Load program from AST */
  loadFromAST: (ast: LadderProgramAST) => void;
  /** Export current program to AST */
  exportToAST: () => LadderProgramAST | null;

  // Utility operations
  /** Clear all data */
  clearAll: () => void;
  /** Mark as saved (clear dirty flag) */
  markSaved: () => void;
  /** Reset store to initial state */
  reset: () => void;
}

type LadderStore = LadderState & LadderActions;

// ============================================================================
// Constants
// ============================================================================

const MAX_HISTORY_SIZE = 50;

// ============================================================================
// Initial State
// ============================================================================

const initialState: LadderState = {
  networks: new Map(),
  currentNetworkId: null,
  selectedElementIds: new Set(),
  clipboard: [],
  networkClipboard: null,
  gridConfig: { ...DEFAULT_LADDER_GRID_CONFIG },
  mode: 'edit',
  monitoringState: null,
  history: [],
  historyIndex: -1,
  isDirty: false,
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Generate unique ID for elements/networks */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Deep clone a ladder element */
function cloneElementDeep(element: LadderElement): LadderElement {
  return JSON.parse(JSON.stringify(element)) as LadderElement;
}

/** Deep clone a wire */
function cloneWire(wire: LadderWire): LadderWire {
  return {
    ...wire,
    from: { ...wire.from },
    to: { ...wire.to },
  };
}

/** Create a deep clone of network for serialization */
function serializeNetwork(network: LadderNetwork): SerializableNetwork {
  const elements: Array<[string, LadderElement]> = [];
  network.elements.forEach((element, id) => {
    elements.push([id, cloneElementDeep(element)]);
  });

  return {
    id: network.id,
    label: network.label,
    comment: network.comment,
    elements,
    wires: network.wires.map(cloneWire),
    enabled: network.enabled,
  };
}

/** Restore network from serialized format */
function deserializeNetwork(data: SerializableNetwork): LadderNetwork {
  const elements = new Map<string, LadderElement>();
  data.elements.forEach(([id, element]) => {
    elements.set(id, cloneElementDeep(element));
  });

  return {
    id: data.id,
    label: data.label,
    comment: data.comment,
    elements,
    wires: data.wires.map(cloneWire),
    enabled: data.enabled,
  };
}

/** Create a history snapshot from current state */
function createSnapshot(networks: Map<string, LadderNetwork>, currentNetworkId: string | null): HistorySnapshot {
  return {
    networks: Array.from(networks.entries()).map(([id, network]) => [id, serializeNetwork(network)]),
    currentNetworkId,
  };
}

/** Restore state from history snapshot */
function restoreSnapshot(snapshot: HistorySnapshot): {
  networks: Map<string, LadderNetwork>;
  currentNetworkId: string | null;
} {
  return {
    networks: new Map(snapshot.networks.map(([id, network]) => [id, deserializeNetwork(network)])),
    currentNetworkId: snapshot.currentNetworkId,
  };
}

/** Get default properties for an element type */
function getDefaultProperties(type: LadderElementType): ElementProperties {
  if (isContactType(type)) {
    return {} as ContactProperties;
  }
  if (isCoilType(type)) {
    return {} as CoilProperties;
  }
  if (isTimerType(type)) {
    return {
      presetTime: 1000,
      timeBase: 'ms',
    } as TimerProperties;
  }
  if (isCounterType(type)) {
    return {
      presetValue: 10,
    } as CounterProperties;
  }
  if (isCompareType(type)) {
    return {
      operator: '=',
      compareValue: 0,
    } as CompareProperties;
  }
  return {};
}

/** Check if a position is valid (within grid bounds and not occupied) */
function isValidPosition(
  network: LadderNetwork,
  position: GridPosition,
  gridConfig: LadderGridConfig,
  excludeId?: string
): boolean {
  // Check bounds
  if (position.col < 0 || position.col >= gridConfig.columns) {
    return false;
  }
  if (position.row < 0) {
    return false;
  }

  // Check for collision
  for (const [id, element] of network.elements) {
    if (excludeId && id === excludeId) continue;
    if (element.position.row === position.row && element.position.col === position.col) {
      return false;
    }
  }

  return true;
}

/** Clone an element with a new ID */
function cloneElement(element: LadderElement, newId: string): LadderElement {
  const cloned = cloneElementDeep(element);
  cloned.id = newId;
  cloned.selected = false;
  return cloned;
}

// ============================================================================
// Store
// ============================================================================

export const useLadderStore = create<LadderStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      ...initialState,

      // ========================================================================
      // Network Operations
      // ========================================================================

      addNetwork: (label) => {
        const id = generateId('network');
        const newNetwork = createEmptyNetwork(id, label);

        set(
          (state) => {
            // Push history before modification
            const snapshot = createSnapshot(state.networks, state.currentNetworkId);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            state.networks.set(id, newNetwork);
            state.currentNetworkId = id;
            state.selectedElementIds = new Set();
            state.isDirty = true;
          },
          false,
          'addNetwork'
        );

        return id;
      },

      removeNetwork: (id) => {
        set(
          (state) => {
            if (!state.networks.has(id)) return;
            if (state.networks.size <= 1) return; // Keep at least one network

            // Push history
            const snapshot = createSnapshot(state.networks, state.currentNetworkId);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            state.networks.delete(id);

            // Update current network if needed
            if (state.currentNetworkId === id) {
              const remainingIds = Array.from(state.networks.keys());
              state.currentNetworkId = remainingIds[0] ?? null;
              state.selectedElementIds = new Set();
            }

            state.isDirty = true;
          },
          false,
          `removeNetwork/${id}`
        );
      },

      selectNetwork: (id) => {
        set(
          (state) => {
            if (!state.networks.has(id)) return;
            state.currentNetworkId = id;
            state.selectedElementIds = new Set();
          },
          false,
          `selectNetwork/${id}`
        );
      },

      updateNetwork: (id, updates) => {
        set(
          (state) => {
            const network = state.networks.get(id);
            if (!network) return;

            // Push history
            const snapshot = createSnapshot(state.networks, state.currentNetworkId);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            if (updates.label !== undefined) network.label = updates.label;
            if (updates.comment !== undefined) network.comment = updates.comment;
            if (updates.enabled !== undefined) network.enabled = updates.enabled;

            state.isDirty = true;
          },
          false,
          `updateNetwork/${id}`
        );
      },

      reorderNetworks: (fromIndex, toIndex) => {
        set(
          (state) => {
            const networkArray = Array.from(state.networks.entries());
            if (fromIndex < 0 || fromIndex >= networkArray.length) return;
            if (toIndex < 0 || toIndex >= networkArray.length) return;

            // Push history
            const snapshot = createSnapshot(state.networks, state.currentNetworkId);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            const [removed] = networkArray.splice(fromIndex, 1);
            networkArray.splice(toIndex, 0, removed);
            state.networks = new Map(networkArray);
            state.isDirty = true;
          },
          false,
          `reorderNetworks/${fromIndex}->${toIndex}`
        );
      },

      copyNetwork: (networkId) => {
        const state = get();
        const targetId = networkId || state.currentNetworkId;
        if (!targetId) return;

        const network = state.networks.get(targetId);
        if (!network) return;

        set(
          (state) => {
            state.networkClipboard = serializeNetwork(network);
          },
          false,
          `copyNetwork/${targetId}`
        );
      },

      pasteNetwork: (afterNetworkId) => {
        const state = get();
        if (!state.networkClipboard) return null;

        const newId = generateId('network');
        const originalLabel = state.networkClipboard.label || 'Network';

        set(
          (state) => {
            if (!state.networkClipboard) return;

            // Push history
            const snapshot = createSnapshot(state.networks, state.currentNetworkId);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            // Create ID mapping for elements
            const idMap = new Map<string, string>();
            const newElements: Array<[string, LadderElement]> = [];

            // Clone elements with new IDs
            state.networkClipboard.elements.forEach(([oldId, element]) => {
              const newElementId = generateId(element.type);
              idMap.set(oldId, newElementId);
              newElements.push([newElementId, {
                ...cloneElementDeep(element),
                id: newElementId,
              }]);
            });

            // Clone wires with updated element references
            const newWires = state.networkClipboard.wires.map((wire) => {
              const newWire = cloneWire(wire);
              // Update element ID references in wire endpoints
              if (newWire.from.elementId) {
                newWire.from.elementId = idMap.get(newWire.from.elementId) || newWire.from.elementId;
              }
              if (newWire.to.elementId) {
                newWire.to.elementId = idMap.get(newWire.to.elementId) || newWire.to.elementId;
              }
              return newWire;
            });

            // Create new network
            const newNetwork: LadderNetwork = {
              id: newId,
              label: `Copy of ${originalLabel}`,
              comment: state.networkClipboard.comment,
              elements: new Map(newElements),
              wires: newWires,
              enabled: state.networkClipboard.enabled,
            };

            // Insert at correct position
            const networkArray = Array.from(state.networks.entries());
            if (afterNetworkId) {
              const afterIndex = networkArray.findIndex(([id]) => id === afterNetworkId);
              if (afterIndex !== -1) {
                networkArray.splice(afterIndex + 1, 0, [newId, newNetwork]);
              } else {
                networkArray.push([newId, newNetwork]);
              }
            } else {
              networkArray.push([newId, newNetwork]);
            }

            state.networks = new Map(networkArray);
            state.currentNetworkId = newId;
            state.isDirty = true;
          },
          false,
          `pasteNetwork/${newId}`
        );

        return newId;
      },

      // ========================================================================
      // Element Operations
      // ========================================================================

      addElement: (type, position, props = {}) => {
        const state = get();
        if (!state.currentNetworkId) return null;

        const network = state.networks.get(state.currentNetworkId);
        if (!network) return null;

        // Validate position
        if (!isValidPosition(network, position, state.gridConfig)) {
          return null;
        }

        const id = generateId(type);
        const newElement: LadderElement = {
          id,
          type,
          position: { ...position },
          properties: getDefaultProperties(type),
          ...props,
        } as LadderElement;

        set(
          (state) => {
            // Push history
            const snapshot = createSnapshot(state.networks, state.currentNetworkId);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            const currentNetwork = state.networks.get(state.currentNetworkId!);
            if (currentNetwork) {
              currentNetwork.elements.set(id, newElement);
            }
            state.isDirty = true;
          },
          false,
          `addElement/${type}`
        );

        return id;
      },

      removeElement: (id) => {
        set(
          (state) => {
            if (!state.currentNetworkId) return;
            const network = state.networks.get(state.currentNetworkId);
            if (!network || !network.elements.has(id)) return;

            // Push history
            const snapshot = createSnapshot(state.networks, state.currentNetworkId);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            network.elements.delete(id);

            // Remove connected wires
            network.wires = network.wires.filter(
              (wire) => wire.from.elementId !== id && wire.to.elementId !== id
            );

            // Remove from selection
            state.selectedElementIds.delete(id);
            state.isDirty = true;
          },
          false,
          `removeElement/${id}`
        );
      },

      moveElement: (id, position) => {
        const state = get();
        if (!state.currentNetworkId) return;

        const network = state.networks.get(state.currentNetworkId);
        if (!network || !network.elements.has(id)) return;

        // Validate new position
        if (!isValidPosition(network, position, state.gridConfig, id)) {
          return;
        }

        set(
          (state) => {
            // Push history
            const snapshot = createSnapshot(state.networks, state.currentNetworkId);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            const currentNetwork = state.networks.get(state.currentNetworkId!);
            const element = currentNetwork?.elements.get(id);
            if (element) {
              element.position = { ...position };
            }
            state.isDirty = true;
          },
          false,
          `moveElement/${id}`
        );
      },

      updateElement: (id, updates) => {
        set(
          (state) => {
            if (!state.currentNetworkId) return;
            const network = state.networks.get(state.currentNetworkId);
            const element = network?.elements.get(id);
            if (!element) return;

            // Push history
            const snapshot = createSnapshot(state.networks, state.currentNetworkId);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            // Apply updates
            if (updates.address !== undefined) {
              (element as ContactElement | CoilElement | TimerElement | CounterElement | CompareElement).address = updates.address as string;
            }
            if (updates.label !== undefined) {
              element.label = updates.label;
            }
            if (updates.properties) {
              element.properties = { ...element.properties, ...updates.properties };
            }

            state.isDirty = true;
          },
          false,
          `updateElement/${id}`
        );
      },

      duplicateElement: (id) => {
        const state = get();
        if (!state.currentNetworkId) return null;

        const network = state.networks.get(state.currentNetworkId);
        if (!network) return null;

        const element = network.elements.get(id);
        if (!element) return null;

        // Find next available position (offset by 1 row)
        const newPosition: GridPosition = {
          row: element.position.row + 1,
          col: element.position.col,
        };

        if (!isValidPosition(network, newPosition, state.gridConfig)) {
          // Try next column
          newPosition.row = element.position.row;
          newPosition.col = element.position.col + 1;
          if (!isValidPosition(network, newPosition, state.gridConfig)) {
            return null;
          }
        }

        const newId = generateId(element.type);
        const newElement = cloneElement(element, newId);
        newElement.position = newPosition;

        set(
          (state) => {
            // Push history
            const snapshot = createSnapshot(state.networks, state.currentNetworkId);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            const currentNetwork = state.networks.get(state.currentNetworkId!);
            if (currentNetwork) {
              currentNetwork.elements.set(newId, newElement);
            }
            state.isDirty = true;
          },
          false,
          `duplicateElement/${id}`
        );

        return newId;
      },

      // ========================================================================
      // Selection Operations
      // ========================================================================

      setSelection: (ids) => {
        set(
          (state) => {
            state.selectedElementIds = new Set(ids);
          },
          false,
          'setSelection'
        );
      },

      addToSelection: (id) => {
        set(
          (state) => {
            state.selectedElementIds.add(id);
          },
          false,
          `addToSelection/${id}`
        );
      },

      removeFromSelection: (id) => {
        set(
          (state) => {
            state.selectedElementIds.delete(id);
          },
          false,
          `removeFromSelection/${id}`
        );
      },

      toggleSelection: (id) => {
        set(
          (state) => {
            if (state.selectedElementIds.has(id)) {
              state.selectedElementIds.delete(id);
            } else {
              state.selectedElementIds.add(id);
            }
          },
          false,
          `toggleSelection/${id}`
        );
      },

      clearSelection: () => {
        set(
          (state) => {
            state.selectedElementIds = new Set();
          },
          false,
          'clearSelection'
        );
      },

      selectAll: () => {
        set(
          (state) => {
            if (!state.currentNetworkId) return;
            const network = state.networks.get(state.currentNetworkId);
            if (!network) return;
            state.selectedElementIds = new Set(network.elements.keys());
          },
          false,
          'selectAll'
        );
      },

      // ========================================================================
      // Clipboard Operations
      // ========================================================================

      copyToClipboard: () => {
        const state = get();
        if (!state.currentNetworkId) return;

        const network = state.networks.get(state.currentNetworkId);
        if (!network) return;

        const selectedElements: LadderElement[] = [];
        state.selectedElementIds.forEach((id) => {
          const element = network.elements.get(id);
          if (element) {
            selectedElements.push(cloneElement(element, element.id));
          }
        });

        set(
          (state) => {
            state.clipboard = selectedElements;
          },
          false,
          'copyToClipboard'
        );
      },

      cutSelection: () => {
        const state = get();
        if (!state.currentNetworkId) return;

        // Copy first
        get().copyToClipboard();

        // Then delete
        set(
          (state) => {
            if (!state.currentNetworkId) return;
            const network = state.networks.get(state.currentNetworkId);
            if (!network) return;

            // Push history
            const snapshot = createSnapshot(state.networks, state.currentNetworkId);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            // Remove selected elements
            state.selectedElementIds.forEach((id) => {
              network.elements.delete(id);
              // Remove connected wires
              network.wires = network.wires.filter(
                (wire) => wire.from.elementId !== id && wire.to.elementId !== id
              );
            });

            state.selectedElementIds = new Set();
            state.isDirty = true;
          },
          false,
          'cutSelection'
        );
      },

      pasteFromClipboard: (position) => {
        const state = get();
        if (!state.currentNetworkId || state.clipboard.length === 0) return;

        const network = state.networks.get(state.currentNetworkId);
        if (!network) return;

        // Calculate offset from first element in clipboard
        const firstElement = state.clipboard[0];
        const baseRow = firstElement.position.row;
        const baseCol = firstElement.position.col;

        const targetPosition = position ?? { row: baseRow + 1, col: baseCol };
        const offsetRow = targetPosition.row - baseRow;
        const offsetCol = targetPosition.col - baseCol;

        set(
          (state) => {
            if (!state.currentNetworkId) return;
            const currentNetwork = state.networks.get(state.currentNetworkId);
            if (!currentNetwork) return;

            // Push history
            const snapshot = createSnapshot(state.networks, state.currentNetworkId);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            const newIds: string[] = [];

            state.clipboard.forEach((element) => {
              const newId = generateId(element.type);
              const newPosition: GridPosition = {
                row: element.position.row + offsetRow,
                col: element.position.col + offsetCol,
              };

              // Skip if position is invalid
              if (isValidPosition(currentNetwork, newPosition, state.gridConfig)) {
                const newElement = cloneElement(element, newId);
                newElement.position = newPosition;
                currentNetwork.elements.set(newId, newElement);
                newIds.push(newId);
              }
            });

            // Select newly pasted elements
            state.selectedElementIds = new Set(newIds);
            state.isDirty = true;
          },
          false,
          'pasteFromClipboard'
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
              const snapshot = createSnapshot(state.networks, state.currentNetworkId);
              state.history.push(snapshot);
            }

            const snapshot = state.history[state.historyIndex];
            const restored = restoreSnapshot(snapshot);
            state.networks = restored.networks;
            state.currentNetworkId = restored.currentNetworkId;
            state.historyIndex--;
            state.selectedElementIds = new Set();
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
              state.networks = restored.networks;
              state.currentNetworkId = restored.currentNetworkId;
              state.selectedElementIds = new Set();
              state.isDirty = true;
            }
          },
          false,
          'redo'
        );
      },

      pushHistory: () => {
        set(
          (state) => {
            const snapshot = createSnapshot(state.networks, state.currentNetworkId);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }
          },
          false,
          'pushHistory'
        );
      },

      // ========================================================================
      // Monitoring Operations
      // ========================================================================

      startMonitoring: () => {
        set(
          (state) => {
            state.mode = 'monitor';
            state.monitoringState = createEmptyMonitoringState();
          },
          false,
          'startMonitoring'
        );
      },

      stopMonitoring: () => {
        set(
          (state) => {
            state.mode = 'edit';
            state.monitoringState = null;
          },
          false,
          'stopMonitoring'
        );
      },

      updateMonitoringState: (updates) => {
        set(
          (state) => {
            if (!state.monitoringState) return;

            if (updates.deviceStates) {
              updates.deviceStates.forEach((value, key) => {
                state.monitoringState!.deviceStates.set(key, value);
              });
            }
            if (updates.forcedDevices) {
              updates.forcedDevices.forEach((value) => {
                state.monitoringState!.forcedDevices.add(value);
              });
            }
            if (updates.energizedWires) {
              state.monitoringState.energizedWires = updates.energizedWires;
            }
            if (updates.timerStates) {
              updates.timerStates.forEach((value, key) => {
                state.monitoringState!.timerStates.set(key, value);
              });
            }
            if (updates.counterStates) {
              updates.counterStates.forEach((value, key) => {
                state.monitoringState!.counterStates.set(key, value);
              });
            }
          },
          false,
          'updateMonitoringState'
        );
      },

      forceDevice: (address, value) => {
        set(
          (state) => {
            if (!state.monitoringState) return;
            state.monitoringState.deviceStates.set(address, value);
            state.monitoringState.forcedDevices.add(address);
          },
          false,
          `forceDevice/${address}`
        );
      },

      releaseForce: (address) => {
        set(
          (state) => {
            if (!state.monitoringState) return;
            state.monitoringState.forcedDevices.delete(address);
          },
          false,
          `releaseForce/${address}`
        );
      },

      // ========================================================================
      // Grid Configuration
      // ========================================================================

      setGridConfig: (config) => {
        set(
          (state) => {
            state.gridConfig = { ...state.gridConfig, ...config };
          },
          false,
          'setGridConfig'
        );
      },

      // ========================================================================
      // AST Integration
      // ========================================================================

      loadFromAST: (ast) => {
        set(
          (state) => {
            // Clear history when loading new program
            state.history = [];
            state.historyIndex = -1;

            // Create editor networks from AST networks
            const newNetworks = new Map<string, LadderNetwork>();

            ast.networks.forEach((astNetwork) => {
              const networkId = astNetwork.id ?? generateId('network');
              const network = createEmptyNetwork(
                networkId,
                `Step ${astNetwork.step}`
              );
              network.comment = astNetwork.comment;

              // Convert AST nodes to elements (stub - full implementation in Task 79)
              const elements = convertASTToElements(astNetwork.nodes, networkId);
              elements.forEach((element) => {
                network.elements.set(element.id, element);
              });

              newNetworks.set(network.id, network);
            });

            state.networks = newNetworks;
            state.currentNetworkId = newNetworks.size > 0 ? Array.from(newNetworks.keys())[0] : null;
            state.selectedElementIds = new Set();
            state.isDirty = false;
          },
          false,
          'loadFromAST'
        );
      },

      exportToAST: () => {
        const state = get();
        if (state.networks.size === 0) return null;

        const networks: LadderNetworkAST[] = [];
        let stepCounter = 1;

        state.networks.forEach((network) => {
          // Convert editor network to AST network (stub - full implementation in Task 80)
          const nodes = convertElementsToAST(network);
          networks.push({
            id: network.id,
            step: stepCounter++,
            nodes,
            comment: network.comment,
          });
        });

        return {
          metadata: {
            name: 'Exported Program',
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
          },
          networks,
          symbolTable: { entries: new Map() },
        };
      },

      // ========================================================================
      // Utility Operations
      // ========================================================================

      clearAll: () => {
        set(
          (state) => {
            // Push history
            const snapshot = createSnapshot(state.networks, state.currentNetworkId);
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(snapshot);
            if (state.history.length > MAX_HISTORY_SIZE) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }

            // Create one empty network
            const newNetwork = createEmptyNetwork(generateId('network'), 'Network 1');
            state.networks = new Map([[newNetwork.id, newNetwork]]);
            state.currentNetworkId = newNetwork.id;
            state.selectedElementIds = new Set();
            state.clipboard = [];
            state.isDirty = true;
          },
          false,
          'clearAll'
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

      reset: () => {
        set(
          () => ({
            ...initialState,
            networks: new Map(),
            selectedElementIds: new Set(),
            clipboard: [],
            history: [],
            gridConfig: { ...DEFAULT_LADDER_GRID_CONFIG },
          }),
          false,
          'reset'
        );
      },
    })),
    { name: 'ladder-store' }
  )
);

// ============================================================================
// AST Conversion Helpers (Stub implementations)
// ============================================================================

/** Convert AST nodes to ladder elements (stub - full implementation in Task 79) */
function convertASTToElements(_nodes: LadderNode[], _networkId: string): LadderElement[] {
  // This is a placeholder - full implementation will be in Task 79 (AST to Grid Conversion)
  // For now, return empty array
  return [];
}

/** Convert ladder elements to AST (stub - full implementation in Task 80) */
function convertElementsToAST(_network: LadderNetwork): LadderNode[] {
  // This is a placeholder - full implementation will be in Task 80 (Grid to AST Conversion)
  // For now, return empty array
  return [];
}

// ============================================================================
// Selectors
// ============================================================================

/** Select all networks */
export const selectNetworks = (state: LadderStore) => state.networks;

/** Select current network ID */
export const selectCurrentNetworkId = (state: LadderStore) => state.currentNetworkId;

/** Select current network */
export const selectCurrentNetwork = (state: LadderStore) =>
  state.currentNetworkId ? state.networks.get(state.currentNetworkId) : null;

/** Select elements from current network */
export const selectElements = (state: LadderStore) => {
  const network = selectCurrentNetwork(state);
  return network?.elements ?? new Map<string, LadderElement>();
};

/** Select selected element IDs */
export const selectSelectedElementIds = (state: LadderStore) => state.selectedElementIds;

/** Select selected elements */
export const selectSelectedElements = (state: LadderStore) => {
  const network = selectCurrentNetwork(state);
  if (!network) return [];

  const selected: LadderElement[] = [];
  state.selectedElementIds.forEach((id) => {
    const element = network.elements.get(id);
    if (element) selected.push(element);
  });
  return selected;
};

/** Select grid configuration */
export const selectGridConfig = (state: LadderStore) => state.gridConfig;

/** Select editor mode */
export const selectMode = (state: LadderStore) => state.mode;

/** Select monitoring state */
export const selectMonitoringState = (state: LadderStore) => state.monitoringState;

/** Select whether undo is available */
export const selectCanUndo = (state: LadderStore) => state.historyIndex >= 0;

/** Select whether redo is available */
export const selectCanRedo = (state: LadderStore) =>
  state.historyIndex < state.history.length - 1;

/** Select whether there are unsaved changes */
export const selectIsDirty = (state: LadderStore) => state.isDirty;

/** Select clipboard contents */
export const selectClipboard = (state: LadderStore) => state.clipboard;

/** Select a specific element by ID */
export const selectElementById = (id: string) => (state: LadderStore) => {
  const network = selectCurrentNetwork(state);
  return network?.elements.get(id);
};

/** Select a specific network by ID */
export const selectNetworkById = (id: string) => (state: LadderStore) =>
  state.networks.get(id);

/** Select networks as array (for ordering) */
export const selectNetworksArray = (state: LadderStore) =>
  Array.from(state.networks.values());

/** Select wires from current network */
export const selectWires = (state: LadderStore) => {
  const network = selectCurrentNetwork(state);
  return network?.wires ?? [];
};

export default useLadderStore;
