/**
 * State Synchronization Hook
 *
 * Initializes cross-window state synchronization for Zustand stores.
 * Should be used once at the app root level.
 */

import { useEffect, useRef } from 'react';
import { usePanelStore } from '../stores/panelStore';
import { useWindowStore } from '../stores/windowStore';
import { useSidebarStore } from '../stores/sidebarStore';
import type { FloatingWindowState } from '../types/window';
import {
  setupStateSync,
  setupStateRequestHandler,
  requestStateFromMain,
  type StateSyncController,
} from '../utils/stateSync';

/**
 * Get the current window ID from URL parameters
 */
function getWindowId(): string {
  if (typeof window === 'undefined') return 'main';
  const params = new URLSearchParams(window.location.search);
  return params.get('windowId') || 'main';
}

/**
 * Hook to initialize state synchronization between windows
 *
 * This hook sets up bidirectional state sync for:
 * - panelStore: Panel configurations and state
 * - windowStore: Floating window registry
 * - sidebarStore: Sidebar state
 */
export function useStateSync(): void {
  const syncControllersRef = useRef<StateSyncController<unknown>[]>([]);
  const cleanupFnsRef = useRef<(() => Promise<void>)[]>([]);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const windowId = getWindowId();
    const isMainWindow = windowId === 'main';

    // Panel store sync - sync panel state but not transient properties
    const panelSync = setupStateSync<Pick<ReturnType<typeof usePanelStore.getState>, 'panels' | 'gridConfig' | 'activePanel'>>(
      'panel-store',
      (state) => {
        const currentState = usePanelStore.getState();
        // Merge received state, preserving local-only properties
        usePanelStore.setState({
          panels: state.panels ?? currentState.panels,
          gridConfig: state.gridConfig ?? currentState.gridConfig,
          // Keep current activePanel as it may differ per window
          activePanel: currentState.activePanel,
        });
      },
      {
        // Only broadcast significant state changes
        shouldBroadcast: (state) => {
          return state.panels.length > 0;
        },
        // Transform state to exclude functions and transient properties
        transformForBroadcast: (state) => ({
          panels: state.panels,
          gridConfig: state.gridConfig,
          activePanel: state.activePanel,
        }),
      }
    );
    syncControllersRef.current.push(panelSync as StateSyncController<unknown>);

    // Window store sync - keep floating window registry in sync
    // Use a custom type for serialized window state since Map can't be serialized
    interface SerializedWindowState {
      floatingWindows: [string, FloatingWindowState][];
      nextZIndex: number;
      focusedWindowId: string | null;
    }

    const windowSync = setupStateSync<SerializedWindowState>(
      'window-store',
      (state) => {
        const windowStore = useWindowStore.getState();
        // Recreate the Map from the received array
        if (state.floatingWindows && Array.isArray(state.floatingWindows)) {
          const newMap = new Map(state.floatingWindows);
          useWindowStore.setState({
            floatingWindows: newMap,
            nextZIndex: state.nextZIndex || windowStore.nextZIndex,
            focusedWindowId: state.focusedWindowId,
          });
        }
      },
      {
        // Transform Map to array for serialization
        transformForBroadcast: () => {
          const state = useWindowStore.getState();
          return {
            floatingWindows: Array.from(state.floatingWindows.entries()),
            nextZIndex: state.nextZIndex,
            focusedWindowId: state.focusedWindowId,
          };
        },
      }
    );
    syncControllersRef.current.push(windowSync as StateSyncController<unknown>);

    // Sidebar store sync
    const sidebarSync = setupStateSync<ReturnType<typeof useSidebarStore.getState>>(
      'sidebar-store',
      (state) => {
        useSidebarStore.setState({
          isVisible: state.isVisible,
          width: state.width,
          activePanel: state.activePanel,
        });
      },
      {
        transformForBroadcast: (state) => ({
          isVisible: state.isVisible,
          width: state.width,
          activePanel: state.activePanel,
        }),
      }
    );
    syncControllersRef.current.push(sidebarSync as StateSyncController<unknown>);

    // Set up state request handlers (main window only)
    if (isMainWindow) {
      const panelRequestCleanup = setupStateRequestHandler(
        'panel-store',
        () => usePanelStore.getState()
      );
      cleanupFnsRef.current.push(panelRequestCleanup);

      const windowRequestCleanup = setupStateRequestHandler(
        'window-store',
        () => useWindowStore.getState()
      );
      cleanupFnsRef.current.push(windowRequestCleanup);

      const sidebarRequestCleanup = setupStateRequestHandler(
        'sidebar-store',
        () => useSidebarStore.getState()
      );
      cleanupFnsRef.current.push(sidebarRequestCleanup);
    } else {
      // Floating windows request state from main on init
      requestStateFromMain('panel-store');
      requestStateFromMain('window-store');
      requestStateFromMain('sidebar-store');
    }

    // Subscribe to store changes and broadcast
    const unsubPanel = usePanelStore.subscribe((state, prevState) => {
      // Only broadcast if panels or grid changed
      if (state.panels !== prevState.panels || state.gridConfig !== prevState.gridConfig) {
        // Transform to serialized format before broadcasting
        panelSync.broadcastState({
          panels: state.panels,
          gridConfig: state.gridConfig,
          activePanel: state.activePanel,
        });
      }
    });

    const unsubWindow = useWindowStore.subscribe((state, prevState) => {
      if (state.floatingWindows !== prevState.floatingWindows) {
        // Transform to serialized format before broadcasting
        const serialized = {
          floatingWindows: Array.from(state.floatingWindows.entries()),
          nextZIndex: state.nextZIndex,
          focusedWindowId: state.focusedWindowId,
        };
        windowSync.broadcastState(serialized);
      }
    });

    const unsubSidebar = useSidebarStore.subscribe((state, prevState) => {
      if (
        state.isVisible !== prevState.isVisible ||
        state.width !== prevState.width ||
        state.activePanel !== prevState.activePanel
      ) {
        sidebarSync.broadcastState(state);
      }
    });

    // Cleanup on unmount
    return () => {
      unsubPanel();
      unsubWindow();
      unsubSidebar();

      syncControllersRef.current.forEach((controller) => {
        controller.cleanup();
      });
      syncControllersRef.current = [];

      cleanupFnsRef.current.forEach((cleanup) => {
        cleanup();
      });
      cleanupFnsRef.current = [];

      isInitializedRef.current = false;
    };
  }, []);
}

/**
 * Hook to check if current window is the main window
 */
export function useIsMainWindow(): boolean {
  return getWindowId() === 'main';
}

/**
 * Hook to get the current window ID
 */
export function useWindowId(): string {
  return getWindowId();
}
