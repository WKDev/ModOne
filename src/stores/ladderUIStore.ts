import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { LadderElement, LadderMonitoringState } from '../types/ladder';
import { createEmptyMonitoringState } from '../types/ladder';

enableMapSet();

export interface LadderUIState {
  selectedElementIds: Set<string>;
  clipboard: LadderElement[];
  mode: 'edit' | 'monitor';
  monitoringState: LadderMonitoringState | null;
}

export interface LadderUIActions {
  setSelection: (ids: Set<string> | string[]) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: (allIds: string[]) => void;

  setClipboard: (elements: LadderElement[]) => void;
  clearClipboard: () => void;

  startMonitoring: () => void;
  stopMonitoring: () => void;
  updateMonitoringState: (updates: Partial<LadderMonitoringState>) => void;
  forceDevice: (address: string, value: boolean | number) => void;
  releaseForce: (address: string) => void;

  reset: () => void;
}

export type LadderUIStore = LadderUIState & LadderUIActions;

const createInitialState = (): LadderUIState => ({
  selectedElementIds: new Set(),
  clipboard: [],
  mode: 'edit',
  monitoringState: null,
});

export const useLadderUIStore = create<LadderUIStore>()(
  devtools(
    immer((set) => ({
      ...createInitialState(),

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

      selectAll: (allIds) => {
        set(
          (state) => {
            state.selectedElementIds = new Set(allIds);
          },
          false,
          'selectAll'
        );
      },

      setClipboard: (elements) => {
        set(
          (state) => {
            state.clipboard = elements;
          },
          false,
          'setClipboard'
        );
      },

      clearClipboard: () => {
        set(
          (state) => {
            state.clipboard = [];
          },
          false,
          'clearClipboard'
        );
      },

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

      reset: () => {
        set(
          () => ({
            ...createInitialState(),
            selectedElementIds: new Set(),
            clipboard: [],
          }),
          false,
          'reset'
        );
      },
    })),
    { name: 'ladder-ui' }
  )
);

export const selectSelectedElementIds = (state: LadderUIStore) => state.selectedElementIds;
export const selectClipboard = (state: LadderUIStore) => state.clipboard;
export const selectMode = (state: LadderUIStore) => state.mode;
export const selectMonitoringState = (state: LadderUIStore) => state.monitoringState;

export default useLadderUIStore;
