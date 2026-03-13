import { useCallback, useEffect, useRef } from 'react';
import { usePanelStore } from '../stores/panelStore';
import { useWindowBoundary } from './useWindowBoundary';
import { DEFAULT_FLOATING_WINDOW_SIZE } from '../types/window';

interface DragState {
  tabId: string;
  panelId: string;
  /** Last known clientX from dragover (viewport-relative, always reliable) */
  lastClientX: number;
  lastClientY: number;
  /** Whether the cursor was outside the window boundary on last check */
  isOutside: boolean;
}

/**
 * Hook that detects when a tab is dragged outside the window boundary
 * and automatically tears it off into a floating window.
 *
 * Uses the same useWindowBoundary + clientX/clientY approach as
 * PanelDndProvider (proven to work on WebView2), instead of relying
 * on screenX/screenY from dragend which can be (0,0) on some platforms.
 */
export function useTabDragOut() {
  const dragStateRef = useRef<DragState | null>(null);
  const globalHandlerRef = useRef<((e: DragEvent) => void) | null>(null);
  const moveTabToFloatingWindow = usePanelStore((s) => s.moveTabToFloatingWindow);
  const { checkPosition, getScreenPosition, refreshBounds } = useWindowBoundary();

  const cleanupGlobalListener = useCallback(() => {
    if (globalHandlerRef.current) {
      document.removeEventListener('dragover', globalHandlerRef.current);
      globalHandlerRef.current = null;
    }
  }, []);

  const onTabDragStart = useCallback(
    (panelId: string, tabId: string) => {
      refreshBounds();
      dragStateRef.current = {
        tabId,
        panelId,
        lastClientX: 0,
        lastClientY: 0,
        isOutside: false,
      };

      // Track cursor position globally during drag using clientX/clientY
      cleanupGlobalListener();
      const handler = (e: DragEvent) => {
        if (!dragStateRef.current) return;
        // clientX/clientY are always reliable in dragover, even on WebView2
        if (e.clientX !== 0 || e.clientY !== 0) {
          dragStateRef.current.lastClientX = e.clientX;
          dragStateRef.current.lastClientY = e.clientY;
          dragStateRef.current.isOutside = checkPosition(e.clientX, e.clientY);
        }
      };
      document.addEventListener('dragover', handler);
      globalHandlerRef.current = handler;
    },
    [checkPosition, cleanupGlobalListener, refreshBounds]
  );

  /**
   * Returns true if the drop was handled as a tear-off (caller should skip reorder).
   */
  const onTabDragEnd = useCallback(
    async (_e: React.DragEvent): Promise<boolean> => {
      cleanupGlobalListener();

      const state = dragStateRef.current;
      dragStateRef.current = null;

      if (!state) return false;

      // Use the continuously-tracked isOutside flag from dragover events
      // (much more reliable than dragend screenX/screenY on WebView2)
      if (!state.isOutside) return false;

      // Convert last known client position to screen coordinates for window placement
      const screenPos = getScreenPosition(state.lastClientX, state.lastClientY);
      if (!screenPos) return false;

      await moveTabToFloatingWindow(state.panelId, state.tabId, {
        x: screenPos.x - DEFAULT_FLOATING_WINDOW_SIZE.width / 2,
        y: screenPos.y - 20,
        width: DEFAULT_FLOATING_WINDOW_SIZE.width,
        height: DEFAULT_FLOATING_WINDOW_SIZE.height,
      });
      return true;
    },
    [cleanupGlobalListener, getScreenPosition, moveTabToFloatingWindow]
  );

  // Cleanup on unmount (e.g., workspace switch mid-drag)
  useEffect(() => {
    return () => cleanupGlobalListener();
  }, [cleanupGlobalListener]);

  return { onTabDragStart, onTabDragEnd };
}
