/**
 * Ladder Store - Zustand State Management for LadderEditor
 *
 * Manages ladder editor state including elements, wires, selection,
 * monitoring state, clipboard, and undo/redo history.
 *
 * Networks concept has been removed - elements and wires are stored directly.
 * Individual ladder files (CSV) serve as the unit of organization.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

// Enable Immer's MapSet plugin for Map and Set support
enableMapSet();
import type {
  LadderElement,
  LadderElementType,
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
  elements: Array<[string, LadderElement]>;
  wires: LadderWire[];
  comment?: string;
}

/** Ladder editor mode */
export type LadderEditorMode = 'edit' | 'monitor';

interface LadderState {
  // Data (directly owned, no network indirection)
  /** All elements by ID */
  elements: Map<string, LadderElement>;
  /** Wire connections */
  wires: LadderWire[];
  /** Ladder comment */
  comment?: string;

  // Selection
  /** Currently selected element IDs */
  selectedElementIds: Set<string>;
  /** Clipboard contents for elements */
  clipboard: LadderElement[];

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
  // Element operations
  /** Add a new element */
  addElement: (type: LadderElementType, position: GridPosition, props?: Partial<LadderElement>) => string | null;
  /** Remove an element by ID */
  removeElement: (id: string) => void;
  /** Move an element to a new position */
  moveElement: (id: string, position: GridPosition) => void;
  /** Update an element's properties */
  updateElement: (id: string, updates: Partial<LadderElement>) => void;
  /** Duplicate an element */
  duplicateElement: (id: string) => string | null;

  // Comment
  /** Update the ladder comment */
  updateComment: (comment: string) => void;

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
  /** Select all elements */
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
  elements: new Map(),
  wires: [],
  comment: undefined,
  selectedElementIds: new Set(),
  clipboard: [],
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

/** Generate unique ID for elements */
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

/** Create a history snapshot from current state */
function createSnapshot(elements: Map<string, LadderElement>, wires: LadderWire[], comment?: string): HistorySnapshot {
  const serializedElements: Array<[string, LadderElement]> = [];
  elements.forEach((element, id) => {
    serializedElements.push([id, cloneElementDeep(element)]);
  });

  return {
    elements: serializedElements,
    wires: wires.map(cloneWire),
    comment,
  };
}

/** Restore state from history snapshot */
function restoreSnapshot(snapshot: HistorySnapshot): {
  elements: Map<string, LadderElement>;
  wires: LadderWire[];
  comment?: string;
} {
  const elements = new Map<string, LadderElement>();
  snapshot.elements.forEach(([id, element]) => {
    elements.set(id, cloneElementDeep(element));
  });

  return {
    elements,
    wires: snapshot.wires.map(cloneWire),
    comment: snapshot.comment,
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
  elements: Map<string, LadderElement>,
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
  for (const [id, element] of elements) {
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

/**
 * Push current state to history for undo support.
 * Clears any redo history and enforces MAX_HISTORY_SIZE limit.
 */
function pushHistorySnapshot(state: LadderState): void {
  const snapshot = createSnapshot(state.elements, state.wires, state.comment);
  // Clear any redo history (slice to current position + 1)
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snapshot);
  // Enforce max history size
  if (state.history.length > MAX_HISTORY_SIZE) {
    state.history.shift();
  } else {
    state.historyIndex++;
  }
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
      // Element Operations
      // ========================================================================

      addElement: (type, position, props = {}) => {
        const state = get();

        // Validate position
        if (!isValidPosition(state.elements, position, state.gridConfig)) {
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
            pushHistorySnapshot(state);
            state.elements.set(id, newElement);
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
            if (!state.elements.has(id)) return;

            pushHistorySnapshot(state);

            state.elements.delete(id);

            // Remove connected wires
            state.wires = state.wires.filter(
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
        if (!state.elements.has(id)) return;

        // Validate new position
        if (!isValidPosition(state.elements, position, state.gridConfig, id)) {
          return;
        }

        set(
          (state) => {
            pushHistorySnapshot(state);

            const element = state.elements.get(id);
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
            const element = state.elements.get(id);
            if (!element) return;

            pushHistorySnapshot(state);

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

        const element = state.elements.get(id);
        if (!element) return null;

        // Find next available position (offset by 1 row)
        const newPosition: GridPosition = {
          row: element.position.row + 1,
          col: element.position.col,
        };

        if (!isValidPosition(state.elements, newPosition, state.gridConfig)) {
          // Try next column
          newPosition.row = element.position.row;
          newPosition.col = element.position.col + 1;
          if (!isValidPosition(state.elements, newPosition, state.gridConfig)) {
            return null;
          }
        }

        const newId = generateId(element.type);
        const newElement = cloneElement(element, newId);
        newElement.position = newPosition;

        set(
          (state) => {
            pushHistorySnapshot(state);
            state.elements.set(newId, newElement);
            state.isDirty = true;
          },
          false,
          `duplicateElement/${id}`
        );

        return newId;
      },

      // ========================================================================
      // Comment
      // ========================================================================

      updateComment: (comment) => {
        set(
          (state) => {
            pushHistorySnapshot(state);
            state.comment = comment;
            state.isDirty = true;
          },
          false,
          'updateComment'
        );
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
            state.selectedElementIds = new Set(state.elements.keys());
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

        const selectedElements: LadderElement[] = [];
        state.selectedElementIds.forEach((id) => {
          const element = state.elements.get(id);
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
        // Copy first
        get().copyToClipboard();

        // Then delete
        set(
          (state) => {
            pushHistorySnapshot(state);

            // Remove selected elements
            state.selectedElementIds.forEach((id) => {
              state.elements.delete(id);
              // Remove connected wires
              state.wires = state.wires.filter(
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
        if (state.clipboard.length === 0) return;

        // Calculate offset from first element in clipboard
        const firstElement = state.clipboard[0];
        const baseRow = firstElement.position.row;
        const baseCol = firstElement.position.col;

        const targetPosition = position ?? { row: baseRow + 1, col: baseCol };
        const offsetRow = targetPosition.row - baseRow;
        const offsetCol = targetPosition.col - baseCol;

        set(
          (state) => {
            pushHistorySnapshot(state);

            const newIds: string[] = [];

            state.clipboard.forEach((element) => {
              const newId = generateId(element.type);
              const newPosition: GridPosition = {
                row: element.position.row + offsetRow,
                col: element.position.col + offsetCol,
              };

              // Skip if position is invalid
              if (isValidPosition(state.elements, newPosition, state.gridConfig)) {
                const newElement = cloneElement(element, newId);
                newElement.position = newPosition;
                state.elements.set(newId, newElement);
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
              const snapshot = createSnapshot(state.elements, state.wires, state.comment);
              state.history.push(snapshot);
            }

            const snapshot = state.history[state.historyIndex];
            const restored = restoreSnapshot(snapshot);
            state.elements = restored.elements;
            state.wires = restored.wires;
            state.comment = restored.comment;
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
            // Can only redo if there's a snapshot beyond current position
            const nextSnapshotIndex = state.historyIndex + 2;
            if (nextSnapshotIndex >= state.history.length) return;

            state.historyIndex++;
            const snapshot = state.history[nextSnapshotIndex];
            if (snapshot) {
              const restored = restoreSnapshot(snapshot);
              state.elements = restored.elements;
              state.wires = restored.wires;
              state.comment = restored.comment;
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
            pushHistorySnapshot(state);
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

            // Merge all AST network nodes into flat elements
            const allElements: LadderElement[] = [];

            ast.networks.forEach((astNetwork) => {
              const elements = convertASTToElements(astNetwork.nodes, astNetwork.id ?? '');
              allElements.push(...elements);
            });

            const newElements = new Map<string, LadderElement>();
            allElements.forEach((element) => {
              newElements.set(element.id, element);
            });

            state.elements = newElements;
            state.wires = [];
            state.comment = ast.networks[0]?.comment;
            state.selectedElementIds = new Set();
            state.isDirty = false;
          },
          false,
          'loadFromAST'
        );
      },

      exportToAST: () => {
        const state = get();
        if (state.elements.size === 0) return null;

        // Convert flat elements to a single AST network
        const nodes = convertElementsToAST(state.elements, state.wires);
        const networks: LadderNetworkAST[] = [
          {
            id: 'main',
            step: 1,
            nodes,
            comment: state.comment,
          },
        ];

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
            pushHistorySnapshot(state);

            state.elements = new Map();
            state.wires = [];
            state.comment = undefined;
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
            elements: new Map(),
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
  return [];
}

/** Convert ladder elements to AST (stub - full implementation in Task 80) */
function convertElementsToAST(_elements: Map<string, LadderElement>, _wires: LadderWire[]): LadderNode[] {
  // This is a placeholder - full implementation will be in Task 80 (Grid to AST Conversion)
  return [];
}

// ============================================================================
// Selectors
// ============================================================================

/** Select elements */
export const selectElements = (state: LadderStore) => state.elements;

/** Select wires */
export const selectWires = (state: LadderStore) => state.wires;

/** Select comment */
export const selectComment = (state: LadderStore) => state.comment;

/** Select selected element IDs */
export const selectSelectedElementIds = (state: LadderStore) => state.selectedElementIds;

/** Select selected elements */
export const selectSelectedElements = (state: LadderStore) => {
  const selected: LadderElement[] = [];
  state.selectedElementIds.forEach((id) => {
    const element = state.elements.get(id);
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
  state.historyIndex + 2 < state.history.length;

/** Select whether there are unsaved changes */
export const selectIsDirty = (state: LadderStore) => state.isDirty;

/** Select clipboard contents */
export const selectClipboard = (state: LadderStore) => state.clipboard;

/** Select a specific element by ID */
export const selectElementById = (id: string) => (state: LadderStore) =>
  state.elements.get(id);

// ============================================================================
// Custom Hooks
// ============================================================================

/**
 * Hook to check if undo is available.
 */
export function useCanUndo(): boolean {
  return useLadderStore(selectCanUndo);
}

/**
 * Hook to check if redo is available.
 */
export function useCanRedo(): boolean {
  return useLadderStore(selectCanRedo);
}

export default useLadderStore;
