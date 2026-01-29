/**
 * Window Store
 *
 * Zustand store for managing floating window state and registry.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { FloatingWindowState, Bounds } from '../types/window';

interface WindowStoreState {
  /** Map of window ID to floating window state */
  floatingWindows: Map<string, FloatingWindowState>;
  /** Currently focused floating window ID */
  focusedWindowId: string | null;
  /** Next z-index for stacking order */
  nextZIndex: number;
}

interface WindowStoreActions {
  /** Register a new floating window */
  registerFloatingWindow: (windowId: string, panelId: string, bounds: Bounds) => void;
  /** Unregister a floating window */
  unregisterFloatingWindow: (windowId: string) => void;
  /** Update bounds of a floating window */
  updateWindowBounds: (windowId: string, bounds: Bounds) => void;
  /** Set the focused floating window */
  setFocusedWindow: (windowId: string | null) => void;
  /** Set minimized state of a floating window */
  setWindowMinimized: (windowId: string, isMinimized: boolean) => void;
  /** Set maximized state of a floating window */
  setWindowMaximized: (windowId: string, isMaximized: boolean) => void;
  /** Get floating window by panel ID */
  getWindowByPanelId: (panelId: string) => FloatingWindowState | undefined;
  /** Get all floating windows as array */
  getAllFloatingWindows: () => FloatingWindowState[];
  /** Check if a panel is in a floating window */
  isPanelFloating: (panelId: string) => boolean;
  /** Bring a window to front (update z-index) */
  bringToFront: (windowId: string) => void;
  /** Clear all floating windows */
  clearAllWindows: () => void;
}

type WindowStore = WindowStoreState & WindowStoreActions;

const initialState: WindowStoreState = {
  floatingWindows: new Map(),
  focusedWindowId: null,
  nextZIndex: 1000,
};

export const useWindowStore = create<WindowStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      registerFloatingWindow: (windowId, panelId, bounds) => {
        set(
          (state) => {
            const newWindows = new Map(state.floatingWindows);
            newWindows.set(windowId, {
              windowId,
              panelId,
              bounds,
              isMinimized: false,
              isMaximized: false,
              zIndex: state.nextZIndex,
            });
            return {
              floatingWindows: newWindows,
              focusedWindowId: windowId,
              nextZIndex: state.nextZIndex + 1,
            };
          },
          false,
          'registerFloatingWindow'
        );
      },

      unregisterFloatingWindow: (windowId) => {
        set(
          (state) => {
            const newWindows = new Map(state.floatingWindows);
            newWindows.delete(windowId);
            return {
              floatingWindows: newWindows,
              focusedWindowId:
                state.focusedWindowId === windowId ? null : state.focusedWindowId,
            };
          },
          false,
          'unregisterFloatingWindow'
        );
      },

      updateWindowBounds: (windowId, bounds) => {
        set(
          (state) => {
            const window = state.floatingWindows.get(windowId);
            if (!window) return state;

            const newWindows = new Map(state.floatingWindows);
            newWindows.set(windowId, { ...window, bounds });
            return { floatingWindows: newWindows };
          },
          false,
          'updateWindowBounds'
        );
      },

      setFocusedWindow: (windowId) => {
        set({ focusedWindowId: windowId }, false, 'setFocusedWindow');
      },

      setWindowMinimized: (windowId, isMinimized) => {
        set(
          (state) => {
            const window = state.floatingWindows.get(windowId);
            if (!window) return state;

            const newWindows = new Map(state.floatingWindows);
            newWindows.set(windowId, { ...window, isMinimized });
            return { floatingWindows: newWindows };
          },
          false,
          'setWindowMinimized'
        );
      },

      setWindowMaximized: (windowId, isMaximized) => {
        set(
          (state) => {
            const window = state.floatingWindows.get(windowId);
            if (!window) return state;

            const newWindows = new Map(state.floatingWindows);
            newWindows.set(windowId, { ...window, isMaximized });
            return { floatingWindows: newWindows };
          },
          false,
          'setWindowMaximized'
        );
      },

      getWindowByPanelId: (panelId) => {
        const { floatingWindows } = get();
        for (const window of floatingWindows.values()) {
          if (window.panelId === panelId) {
            return window;
          }
        }
        return undefined;
      },

      getAllFloatingWindows: () => {
        return Array.from(get().floatingWindows.values());
      },

      isPanelFloating: (panelId) => {
        return get().getWindowByPanelId(panelId) !== undefined;
      },

      bringToFront: (windowId) => {
        set(
          (state) => {
            const window = state.floatingWindows.get(windowId);
            if (!window) return state;

            const newWindows = new Map(state.floatingWindows);
            newWindows.set(windowId, { ...window, zIndex: state.nextZIndex });
            return {
              floatingWindows: newWindows,
              focusedWindowId: windowId,
              nextZIndex: state.nextZIndex + 1,
            };
          },
          false,
          'bringToFront'
        );
      },

      clearAllWindows: () => {
        set(
          {
            floatingWindows: new Map(),
            focusedWindowId: null,
          },
          false,
          'clearAllWindows'
        );
      },
    }),
    { name: 'window-store' }
  )
);

/**
 * Selector to get floating windows as array (for iteration)
 */
export const selectFloatingWindowsArray = (state: WindowStore) =>
  Array.from(state.floatingWindows.values());

/**
 * Selector to check if any floating windows exist
 */
export const selectHasFloatingWindows = (state: WindowStore) =>
  state.floatingWindows.size > 0;
