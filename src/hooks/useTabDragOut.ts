import { useCallback, useEffect, useRef } from 'react';
import { Window } from '@tauri-apps/api/window';
import { usePanelStore } from '../stores/panelStore';
import { DEFAULT_FLOATING_WINDOW_SIZE } from '../types/window';

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  tabId: string;
  panelId: string;
  lastScreenX: number;
  lastScreenY: number;
  windowBounds: WindowBounds | null;
}

/**
 * Hook that detects when a tab is dragged outside the window boundary
 * and automatically tears it off into a floating window.
 *
 * Uses a document-level dragover listener to track cursor position
 * continuously, even when the cursor is over non-drop-target areas.
 */
export function useTabDragOut() {
  const dragStateRef = useRef<DragState | null>(null);
  const globalHandlerRef = useRef<((e: DragEvent) => void) | null>(null);
  const moveTabToFloatingWindow = usePanelStore((s) => s.moveTabToFloatingWindow);

  const cacheWindowBounds = useCallback(async () => {
    try {
      const win = Window.getCurrent();
      const [pos, size] = await Promise.all([
        win.outerPosition(),
        win.innerSize(),
      ]);
      return {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
      };
    } catch {
      return null;
    }
  }, []);

  const cleanupGlobalListener = useCallback(() => {
    if (globalHandlerRef.current) {
      document.removeEventListener('dragover', globalHandlerRef.current);
      globalHandlerRef.current = null;
    }
  }, []);

  const onTabDragStart = useCallback(
    async (panelId: string, tabId: string) => {
      const bounds = await cacheWindowBounds();
      dragStateRef.current = {
        tabId,
        panelId,
        lastScreenX: 0,
        lastScreenY: 0,
        windowBounds: bounds,
      };

      // Track cursor position globally during drag
      cleanupGlobalListener();
      const handler = (e: DragEvent) => {
        if (dragStateRef.current && (e.screenX !== 0 || e.screenY !== 0)) {
          dragStateRef.current.lastScreenX = e.screenX;
          dragStateRef.current.lastScreenY = e.screenY;
        }
      };
      document.addEventListener('dragover', handler);
      globalHandlerRef.current = handler;
    },
    [cacheWindowBounds, cleanupGlobalListener]
  );

  const isOutsideWindow = useCallback(
    (screenX: number, screenY: number, bounds: WindowBounds): boolean => {
      return (
        screenX < bounds.x ||
        screenX > bounds.x + bounds.width ||
        screenY < bounds.y ||
        screenY > bounds.y + bounds.height
      );
    },
    []
  );

  /**
   * Returns true if the drop was handled as a tear-off (caller should skip reorder).
   */
  const onTabDragEnd = useCallback(
    async (e: React.DragEvent): Promise<boolean> => {
      cleanupGlobalListener();

      const state = dragStateRef.current;
      dragStateRef.current = null;

      if (!state || !state.windowBounds) return false;

      // Use event coordinates, fall back to cached if browser reports 0,0
      let screenX = e.screenX;
      let screenY = e.screenY;
      if (screenX === 0 && screenY === 0) {
        screenX = state.lastScreenX;
        screenY = state.lastScreenY;
      }

      if (screenX === 0 && screenY === 0) return false;

      if (isOutsideWindow(screenX, screenY, state.windowBounds)) {
        await moveTabToFloatingWindow(state.panelId, state.tabId, {
          x: screenX - DEFAULT_FLOATING_WINDOW_SIZE.width / 2,
          y: screenY - 20, // offset so title bar is near cursor
          width: DEFAULT_FLOATING_WINDOW_SIZE.width,
          height: DEFAULT_FLOATING_WINDOW_SIZE.height,
        });
        return true;
      }

      return false;
    },
    [cleanupGlobalListener, isOutsideWindow, moveTabToFloatingWindow]
  );

  // Cleanup on unmount (e.g., workspace switch mid-drag)
  useEffect(() => {
    return () => cleanupGlobalListener();
  }, [cleanupGlobalListener]);

  return { onTabDragStart, onTabDragEnd };
}
