/**
 * Floating Window Renderer
 *
 * Component that sets up event listeners for floating window lifecycle events.
 * Renders in the main window to sync floating window state.
 */

import { useEffect } from 'react';
import { useWindowStore } from '../../stores/windowStore';
import { usePanelStore } from '../../stores/panelStore';
import { windowService } from '../../services/windowService';

/**
 * Sets up event listeners for floating window events from Tauri.
 * Should be rendered once in the main application.
 */
export function FloatingWindowRenderer() {
  const registerFloatingWindow = useWindowStore(
    (state) => state.registerFloatingWindow
  );
  const unregisterFloatingWindow = useWindowStore(
    (state) => state.unregisterFloatingWindow
  );
  const updateWindowBounds = useWindowStore(
    (state) => state.updateWindowBounds
  );
  const setFocusedWindow = useWindowStore((state) => state.setFocusedWindow);

  const setPanelFloating = usePanelStore((state) => state.setPanelFloating);
  const removePanel = usePanelStore((state) => state.removePanel);

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    // Set up event listeners
    const setupListeners = async () => {
      try {
        // Window created event
        const unlistenCreated = await windowService.onWindowCreated((event) => {
          console.log('Floating window created:', event);
          registerFloatingWindow(event.windowId, event.panelId, {
            x: 0,
            y: 0,
            width: 600,
            height: 400,
          });
          setPanelFloating(event.panelId, true, event.windowId);
        });
        unlisteners.push(unlistenCreated);

        // Window closed event
        const unlistenClosed = await windowService.onWindowClosed((windowId) => {
          console.log('Floating window closed:', windowId);
          // Get panel ID before unregistering
          const windowState = useWindowStore.getState().floatingWindows.get(windowId);
          if (windowState) {
            removePanel(windowState.panelId);
          }
          unregisterFloatingWindow(windowId);
        });
        unlisteners.push(unlistenClosed);

        // Window focused event
        const unlistenFocused = await windowService.onWindowFocused((windowId) => {
          setFocusedWindow(windowId);
        });
        unlisteners.push(unlistenFocused);
      } catch (error) {
        console.warn('Failed to setup floating window listeners:', error);
      }
    };

    setupListeners();

    // Cleanup listeners on unmount
    return () => {
      unlisteners.forEach((unlisten) => {
        try {
          unlisten();
        } catch (e) {
          // Ignore cleanup errors
        }
      });
    };
  }, [
    registerFloatingWindow,
    unregisterFloatingWindow,
    updateWindowBounds,
    setFocusedWindow,
    setPanelFloating,
    removePanel,
  ]);

  // This component doesn't render anything visible
  // It only sets up event listeners
  return null;
}
