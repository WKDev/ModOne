import { useCallback, useRef } from 'react';
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

const EDGE_THRESHOLD = 0; // px outside window boundary to trigger tear-off

/**
 * Hook that detects when a tab is dragged outside the window boundary
 * and automatically tears it off into a floating window.
 */
export function useTabDragOut() {
  const dragStateRef = useRef<DragState | null>(null);
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
    },
    [cacheWindowBounds]
  );

  const onTabDrag = useCallback((e: React.DragEvent) => {
    // Track last known screen position (fallback for dragend reporting 0,0)
    if (dragStateRef.current && (e.screenX !== 0 || e.screenY !== 0)) {
      dragStateRef.current.lastScreenX = e.screenX;
      dragStateRef.current.lastScreenY = e.screenY;
    }
  }, []);

  const isOutsideWindow = useCallback(
    (screenX: number, screenY: number, bounds: WindowBounds): boolean => {
      return (
        screenX < bounds.x - EDGE_THRESHOLD ||
        screenX > bounds.x + bounds.width + EDGE_THRESHOLD ||
        screenY < bounds.y - EDGE_THRESHOLD ||
        screenY > bounds.y + bounds.height + EDGE_THRESHOLD
      );
    },
    []
  );

  /**
   * Returns true if the drop was handled as a tear-off (caller should skip reorder).
   */
  const onTabDragEnd = useCallback(
    async (e: React.DragEvent): Promise<boolean> => {
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
        // Tear off: create floating window at the drop position
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
    [isOutsideWindow, moveTabToFloatingWindow]
  );

  return { onTabDragStart, onTabDrag, onTabDragEnd };
}
