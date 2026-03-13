import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { LadderElement, LadderElementType, LadderMonitoringState, GridPosition, VerticalLinkPosition } from '../types/ladder';
import type { RuntimeBinding } from '../types/onesim';
import { createEmptyMonitoringState } from '../types/ladder';

enableMapSet();

export interface LadderEdgeHover {
  kind: 'horizontal-edge' | 'vertical-edge';
  row: number;
  col: number;
}

export interface LadderUIState {
  selectedElementIds: Set<string>;
  clipboard: LadderElement[];
  mode: 'edit' | 'monitor';
  monitoringState: LadderMonitoringState | null;
  /** Currently selected tool type for click-to-place (GxWorks-style) */
  activeTool: LadderElementType | null;
  /** Last placed wire_v position for Shift+Click vertical spanning */
  lastWireVPlacement: GridPosition | null;
  /** Active cursor cell position (Excel-style active cell indicator) */
  cursorCell: GridPosition | null;
  /** Hovered edge candidate under the pointer */
  edgeHover: LadderEdgeHover | null;
  /** Anchor cell for range selection (Shift+Click/ArrowKey extends from here) */
  selectionAnchor: GridPosition | null;
  /** Current vertical scroll offset of the Pixi viewport (world Y) */
  viewportY: number;
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

  setActiveTool: (type: LadderElementType) => void;
  clearActiveTool: () => void;

  setLastWireVPlacement: (position: VerticalLinkPosition | null) => void;

  /** Set the active cursor cell (Excel-style current cell) */
  setCursorCell: (position: GridPosition | null) => void;
  setEdgeHover: (hover: LadderEdgeHover | null) => void;
  /** Set the selection anchor for range selection (Shift+click/arrows) */
  setSelectionAnchor: (position: GridPosition | null) => void;

  startMonitoring: () => void;
  stopMonitoring: () => void;
  updateMonitoringState: (updates: Partial<LadderMonitoringState>) => void;
  forceDevice: (address: string, value: boolean | number, binding?: RuntimeBinding) => void;
  releaseForce: (address: string) => void;

  /** Set the current vertical scroll offset */
  setViewportY: (y: number) => void;

  reset: () => void;
}

export type LadderUIStore = LadderUIState & LadderUIActions;

const createInitialState = (): LadderUIState => ({
  selectedElementIds: new Set(),
  clipboard: [],
  mode: 'edit',
  monitoringState: null,
  activeTool: null,
  lastWireVPlacement: null,
  cursorCell: null,
  edgeHover: null,
  selectionAnchor: null,
  viewportY: 0,
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

      setActiveTool: (type) => {
        set(
          (state) => {
            state.activeTool = type;
          },
          false,
          `setActiveTool/${type}`
        );
      },

      clearActiveTool: () => {
        set(
          (state) => {
            state.activeTool = null;
            state.lastWireVPlacement = null;
          },
          false,
          'clearActiveTool'
        );
      },

      setLastWireVPlacement: (position) => {
        set(
          (state) => {
            state.lastWireVPlacement = position;
          },
          false,
          'setLastWireVPlacement'
        );
      },

      setCursorCell: (position) => {
        set(
          (state) => {
            state.cursorCell = position;
          },
          false,
          'setCursorCell'
        );
      },

      setEdgeHover: (hover) => {
        set(
          (state) => {
            state.edgeHover = hover;
          },
          false,
          'setEdgeHover'
        );
      },

      setSelectionAnchor: (position) => {
        set(
          (state) => {
            state.selectionAnchor = position;
          },
          false,
          'setSelectionAnchor'
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
              state.monitoringState.deviceStates = updates.deviceStates;
            }
            if (updates.deviceBindings) {
              state.monitoringState.deviceBindings = updates.deviceBindings;
            }
            if (updates.forcedDevices) {
              state.monitoringState.forcedDevices = updates.forcedDevices;
            }
            if (updates.forcedDeviceBindings) {
              state.monitoringState.forcedDeviceBindings = updates.forcedDeviceBindings;
            }
            if (updates.energizedWires) {
              state.monitoringState.energizedWires = updates.energizedWires;
            }
            if (updates.timerStates) {
              state.monitoringState.timerStates = updates.timerStates;
            }
            if (updates.timerBindings) {
              state.monitoringState.timerBindings = updates.timerBindings;
            }
            if (updates.counterStates) {
              state.monitoringState.counterStates = updates.counterStates;
            }
            if (updates.counterBindings) {
              state.monitoringState.counterBindings = updates.counterBindings;
            }
          },
          false,
          'updateMonitoringState'
        );
      },

      forceDevice: (address, value, binding) => {
        set(
          (state) => {
            if (!state.monitoringState) return;
            state.monitoringState.deviceStates.set(address, value);
            state.monitoringState.forcedDevices.add(address);
            if (binding) {
              state.monitoringState.deviceBindings.set(address, binding);
              state.monitoringState.forcedDeviceBindings.set(address, binding);
            }
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
            state.monitoringState.forcedDeviceBindings.delete(address);
          },
          false,
          `releaseForce/${address}`
        );
      },

      setViewportY: (y) => {
        set(
          (state) => {
            state.viewportY = y;
          },
          false,
          'setViewportY'
        );
      },

      reset: () => {
        set(
          () => ({
            ...createInitialState(),
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
export const selectActiveTool = (state: LadderUIStore) => state.activeTool;

export default useLadderUIStore;
