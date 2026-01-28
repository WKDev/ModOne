/**
 * Scenario Store
 *
 * Zustand store for managing scenario data, execution state, and actions.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  Scenario,
  ScenarioEvent,
  ScenarioMetadata,
  ScenarioSettings,
  ScenarioExecutionState,
} from '../types/scenario';
import {
  createEmptyScenario,
  createScenarioEvent,
  sortEventsByTime,
  DEFAULT_EXECUTION_STATE,
} from '../types/scenario';

// ============================================================================
// Types
// ============================================================================

/**
 * Scenario store state.
 */
interface ScenarioStoreState {
  /** Current scenario */
  scenario: Scenario | null;
  /** Whether scenario has unsaved changes */
  isDirty: boolean;
  /** File path if loaded from file */
  filePath: string | null;
  /** Execution state */
  executionState: ScenarioExecutionState;
  /** Selected event IDs */
  selectedEventIds: string[];
  /** ID of event being edited */
  editingEventId: string | null;
}

/**
 * Scenario store actions.
 */
interface ScenarioStoreActions {
  // Scenario operations
  newScenario: () => void;
  loadScenario: (scenario: Scenario, filePath?: string) => void;
  updateMetadata: (metadata: Partial<ScenarioMetadata>) => void;
  updateSettings: (settings: Partial<ScenarioSettings>) => void;
  markClean: () => void;
  setFilePath: (filePath: string | null) => void;

  // Event CRUD
  addEvent: (event: Omit<ScenarioEvent, 'id'>) => string;
  updateEvent: (id: string, updates: Partial<ScenarioEvent>) => void;
  removeEvent: (id: string) => void;
  duplicateEvent: (id: string) => string | null;
  reorderEvents: (fromIndex: number, toIndex: number) => void;
  toggleEventEnabled: (id: string) => void;

  // Bulk operations
  removeSelectedEvents: () => void;
  enableSelectedEvents: () => void;
  disableSelectedEvents: () => void;

  // Selection
  selectEvent: (id: string, multi?: boolean) => void;
  selectRange: (fromId: string, toId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setEditingEventId: (id: string | null) => void;

  // Execution control
  setExecutionState: (state: Partial<ScenarioExecutionState>) => void;
  resetExecution: () => void;

  // Reset
  reset: () => void;
}

type ScenarioStore = ScenarioStoreState & ScenarioStoreActions;

// ============================================================================
// Initial State
// ============================================================================

const initialState: ScenarioStoreState = {
  scenario: null,
  isDirty: false,
  filePath: null,
  executionState: { ...DEFAULT_EXECUTION_STATE },
  selectedEventIds: [],
  editingEventId: null,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Mark scenario as dirty and update timestamp.
 */
function markDirty(state: ScenarioStoreState): void {
  state.isDirty = true;
  if (state.scenario) {
    state.scenario.metadata.updatedAt = new Date().toISOString();
  }
}

/**
 * Sort events in place by time.
 */
function sortEvents(state: ScenarioStoreState): void {
  if (state.scenario) {
    state.scenario.events = sortEventsByTime(state.scenario.events);
  }
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useScenarioStore = create<ScenarioStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      ...initialState,

      // ========================================================================
      // Scenario Operations
      // ========================================================================

      newScenario: () =>
        set(
          (state) => {
            state.scenario = createEmptyScenario();
            state.isDirty = false;
            state.filePath = null;
            state.executionState = { ...DEFAULT_EXECUTION_STATE };
            state.selectedEventIds = [];
            state.editingEventId = null;
          },
          false,
          'newScenario'
        ),

      loadScenario: (scenario, filePath) =>
        set(
          (state) => {
            // Sort events by time on load
            state.scenario = {
              ...scenario,
              events: sortEventsByTime(scenario.events),
            };
            state.isDirty = false;
            state.filePath = filePath ?? null;
            state.executionState = { ...DEFAULT_EXECUTION_STATE };
            state.selectedEventIds = [];
            state.editingEventId = null;
          },
          false,
          'loadScenario'
        ),

      updateMetadata: (metadata) =>
        set(
          (state) => {
            if (state.scenario) {
              state.scenario.metadata = {
                ...state.scenario.metadata,
                ...metadata,
              };
              markDirty(state);
            }
          },
          false,
          'updateMetadata'
        ),

      updateSettings: (settings) =>
        set(
          (state) => {
            if (state.scenario) {
              state.scenario.settings = {
                ...state.scenario.settings,
                ...settings,
              };
              markDirty(state);
            }
          },
          false,
          'updateSettings'
        ),

      markClean: () =>
        set(
          (state) => {
            state.isDirty = false;
          },
          false,
          'markClean'
        ),

      setFilePath: (filePath) =>
        set(
          (state) => {
            state.filePath = filePath;
          },
          false,
          'setFilePath'
        ),

      // ========================================================================
      // Event CRUD
      // ========================================================================

      addEvent: (eventData) => {
        const newEvent = createScenarioEvent(eventData);
        set(
          (state) => {
            if (state.scenario) {
              state.scenario.events.push(newEvent);
              sortEvents(state);
              markDirty(state);
            }
          },
          false,
          `addEvent/${newEvent.id}`
        );
        return newEvent.id;
      },

      updateEvent: (id, updates) =>
        set(
          (state) => {
            if (state.scenario) {
              const index = state.scenario.events.findIndex((e) => e.id === id);
              if (index !== -1) {
                state.scenario.events[index] = {
                  ...state.scenario.events[index],
                  ...updates,
                };
                // Re-sort if time changed
                if ('time' in updates) {
                  sortEvents(state);
                }
                markDirty(state);
              }
            }
          },
          false,
          `updateEvent/${id}`
        ),

      removeEvent: (id) =>
        set(
          (state) => {
            if (state.scenario) {
              state.scenario.events = state.scenario.events.filter(
                (e) => e.id !== id
              );
              // Clean up selection
              state.selectedEventIds = state.selectedEventIds.filter(
                (eid) => eid !== id
              );
              if (state.editingEventId === id) {
                state.editingEventId = null;
              }
              markDirty(state);
            }
          },
          false,
          `removeEvent/${id}`
        ),

      duplicateEvent: (id) => {
        const { scenario } = get();
        if (!scenario) return null;

        const event = scenario.events.find((e) => e.id === id);
        if (!event) return null;

        const newEvent = createScenarioEvent({
          ...event,
          time: event.time + 0.1, // Offset slightly
          note: event.note ? `${event.note} (copy)` : '(copy)',
        });

        set(
          (state) => {
            if (state.scenario) {
              state.scenario.events.push(newEvent);
              sortEvents(state);
              markDirty(state);
            }
          },
          false,
          `duplicateEvent/${id}`
        );

        return newEvent.id;
      },

      reorderEvents: (fromIndex, toIndex) =>
        set(
          (state) => {
            if (state.scenario) {
              const events = state.scenario.events;
              if (
                fromIndex >= 0 &&
                fromIndex < events.length &&
                toIndex >= 0 &&
                toIndex < events.length
              ) {
                // Remove and reinsert
                const [removed] = events.splice(fromIndex, 1);
                events.splice(toIndex, 0, removed);

                // Update times to reflect new order
                // Assign new times based on position
                const minTime = Math.min(...events.map((e) => e.time));
                const maxTime = Math.max(...events.map((e) => e.time));
                const timeStep =
                  events.length > 1
                    ? (maxTime - minTime) / (events.length - 1)
                    : 1;

                events.forEach((event, index) => {
                  event.time = minTime + index * timeStep;
                });

                markDirty(state);
              }
            }
          },
          false,
          'reorderEvents'
        ),

      toggleEventEnabled: (id) =>
        set(
          (state) => {
            if (state.scenario) {
              const event = state.scenario.events.find((e) => e.id === id);
              if (event) {
                event.enabled = !event.enabled;
                markDirty(state);
              }
            }
          },
          false,
          `toggleEventEnabled/${id}`
        ),

      // ========================================================================
      // Bulk Operations
      // ========================================================================

      removeSelectedEvents: () =>
        set(
          (state) => {
            if (state.scenario && state.selectedEventIds.length > 0) {
              const selectedSet = new Set(state.selectedEventIds);
              state.scenario.events = state.scenario.events.filter(
                (e) => !selectedSet.has(e.id)
              );
              state.selectedEventIds = [];
              if (
                state.editingEventId &&
                selectedSet.has(state.editingEventId)
              ) {
                state.editingEventId = null;
              }
              markDirty(state);
            }
          },
          false,
          'removeSelectedEvents'
        ),

      enableSelectedEvents: () =>
        set(
          (state) => {
            if (state.scenario && state.selectedEventIds.length > 0) {
              const selectedSet = new Set(state.selectedEventIds);
              for (const event of state.scenario.events) {
                if (selectedSet.has(event.id)) {
                  event.enabled = true;
                }
              }
              markDirty(state);
            }
          },
          false,
          'enableSelectedEvents'
        ),

      disableSelectedEvents: () =>
        set(
          (state) => {
            if (state.scenario && state.selectedEventIds.length > 0) {
              const selectedSet = new Set(state.selectedEventIds);
              for (const event of state.scenario.events) {
                if (selectedSet.has(event.id)) {
                  event.enabled = false;
                }
              }
              markDirty(state);
            }
          },
          false,
          'disableSelectedEvents'
        ),

      // ========================================================================
      // Selection
      // ========================================================================

      selectEvent: (id, multi = false) =>
        set(
          (state) => {
            if (multi) {
              // Toggle selection
              const index = state.selectedEventIds.indexOf(id);
              if (index === -1) {
                state.selectedEventIds.push(id);
              } else {
                state.selectedEventIds.splice(index, 1);
              }
            } else {
              // Replace selection
              state.selectedEventIds = [id];
            }
            state.editingEventId = null;
          },
          false,
          `selectEvent/${id}`
        ),

      selectRange: (fromId, toId) =>
        set(
          (state) => {
            if (state.scenario) {
              const events = state.scenario.events;
              const fromIndex = events.findIndex((e) => e.id === fromId);
              const toIndex = events.findIndex((e) => e.id === toId);

              if (fromIndex !== -1 && toIndex !== -1) {
                const start = Math.min(fromIndex, toIndex);
                const end = Math.max(fromIndex, toIndex);

                state.selectedEventIds = events
                  .slice(start, end + 1)
                  .map((e) => e.id);
              }
            }
          },
          false,
          'selectRange'
        ),

      selectAll: () =>
        set(
          (state) => {
            if (state.scenario) {
              state.selectedEventIds = state.scenario.events.map((e) => e.id);
            }
          },
          false,
          'selectAll'
        ),

      clearSelection: () =>
        set(
          (state) => {
            state.selectedEventIds = [];
            state.editingEventId = null;
          },
          false,
          'clearSelection'
        ),

      setEditingEventId: (id) =>
        set(
          (state) => {
            state.editingEventId = id;
          },
          false,
          'setEditingEventId'
        ),

      // ========================================================================
      // Execution Control
      // ========================================================================

      setExecutionState: (execState) =>
        set(
          (state) => {
            state.executionState = {
              ...state.executionState,
              ...execState,
            };
          },
          false,
          'setExecutionState'
        ),

      resetExecution: () =>
        set(
          (state) => {
            state.executionState = { ...DEFAULT_EXECUTION_STATE };
          },
          false,
          'resetExecution'
        ),

      // ========================================================================
      // Reset
      // ========================================================================

      reset: () => set(() => ({ ...initialState }), false, 'reset'),
    })),
    { name: 'scenario-store' }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectScenario = (state: ScenarioStore) => state.scenario;
export const selectEvents = (state: ScenarioStore) =>
  state.scenario?.events ?? [];
export const selectEnabledEvents = (state: ScenarioStore) =>
  state.scenario?.events.filter((e) => e.enabled) ?? [];
export const selectSelectedEventIds = (state: ScenarioStore) =>
  state.selectedEventIds;
export const selectSelectedEvents = (state: ScenarioStore) => {
  const selectedSet = new Set(state.selectedEventIds);
  return state.scenario?.events.filter((e) => selectedSet.has(e.id)) ?? [];
};
export const selectExecutionState = (state: ScenarioStore) =>
  state.executionState;
export const selectIsDirty = (state: ScenarioStore) => state.isDirty;
export const selectFilePath = (state: ScenarioStore) => state.filePath;
export const selectMetadata = (state: ScenarioStore) =>
  state.scenario?.metadata ?? null;
export const selectSettings = (state: ScenarioStore) =>
  state.scenario?.settings ?? null;
export const selectEditingEventId = (state: ScenarioStore) =>
  state.editingEventId;

/**
 * Get a specific event by ID.
 */
export const selectEventById = (id: string) => (state: ScenarioStore) =>
  state.scenario?.events.find((e) => e.id === id) ?? null;

/**
 * Check if an event is selected.
 */
export const selectIsEventSelected =
  (id: string) => (state: ScenarioStore) =>
    state.selectedEventIds.includes(id);

/**
 * Check if scenario is currently running.
 */
export const selectIsRunning = (state: ScenarioStore) =>
  state.executionState.status === 'running';

/**
 * Check if scenario is paused.
 */
export const selectIsPaused = (state: ScenarioStore) =>
  state.executionState.status === 'paused';

export default useScenarioStore;
