/**
 * Window Boundary Detection Hook
 *
 * Detects when a dragged element crosses the main window boundary,
 * enabling automatic floating window creation.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Window } from '@tauri-apps/api/window';
import type { Bounds } from '../types/window';

interface WindowBoundaryResult {
  /** Whether the current position is outside the main window */
  isOutsideMainWindow: boolean;
  /** Current main window bounds */
  mainWindowBounds: Bounds | null;
  /** Check if a position is outside the main window */
  checkPosition: (clientX: number, clientY: number) => boolean;
  /** Convert client coordinates to screen coordinates */
  getScreenPosition: (clientX: number, clientY: number) => { x: number; y: number } | null;
  /** Update bounds manually (for resize events) */
  refreshBounds: () => void;
}

/**
 * Hook to detect when a position is outside the main window boundary
 */
export function useWindowBoundary(): WindowBoundaryResult {
  const [mainWindowBounds, setMainWindowBounds] = useState<Bounds | null>(null);
  const [isOutsideMainWindow, setIsOutsideMainWindow] = useState(false);
  const boundsRef = useRef<Bounds | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef(false);

  // Actual refresh logic: fetch bounds and update state only if changed
  const doActualRefresh = useCallback(async () => {
    try {
      const mainWindow = Window.getCurrent();
      const position = await mainWindow.outerPosition();
      const size = await mainWindow.innerSize();

      const newBounds: Bounds = {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
      };

      // Only update state if bounds actually changed (shallow compare)
      const currentBounds = boundsRef.current;
      if (
        !currentBounds ||
        currentBounds.x !== newBounds.x ||
        currentBounds.y !== newBounds.y ||
        currentBounds.width !== newBounds.width ||
        currentBounds.height !== newBounds.height
      ) {
        boundsRef.current = newBounds;
        setMainWindowBounds(newBounds);
      }
    } catch (error) {
      console.warn('Failed to get window bounds:', error);
    }
  }, []);

  // Schedule refresh with rAF coalescing to reduce IPC backlog during rapid resize/move
  const refreshBounds = useCallback(() => {
    if (rafRef.current !== null) {
      // Already scheduled, mark as pending for retry
      pendingRef.current = true;
      return;
    }

    rafRef.current = requestAnimationFrame(async () => {
      rafRef.current = null;
      const shouldRetry = pendingRef.current;
      pendingRef.current = false;

      await doActualRefresh();

      // If more events came in during the refresh, schedule another
      if (shouldRetry) {
        refreshBounds();
      }
    });
  }, [doActualRefresh]);

  // Fetch main window bounds on mount and listen for changes
  useEffect(() => {
    refreshBounds();

    let unlistenMove: (() => void) | null = null;
    let unlistenResize: (() => void) | null = null;

    const setupListeners = async () => {
      try {
        const mainWindow = Window.getCurrent();

        // Listen for window move events
        unlistenMove = await mainWindow.onMoved(() => {
          refreshBounds();
        });

        // Listen for window resize events
        unlistenResize = await mainWindow.onResized(() => {
          refreshBounds();
        });
      } catch (error) {
        console.warn('Failed to setup window listeners:', error);
      }
    };

    setupListeners();

    return () => {
      // Cleanup: cancel any pending rAF on unmount
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (unlistenMove) unlistenMove();
      if (unlistenResize) unlistenResize();
    };
  }, [refreshBounds]);

  // Check if a client position is outside the main window
  const checkPosition = useCallback(
    (clientX: number, clientY: number): boolean => {
      const bounds = boundsRef.current;
      if (!bounds) return false;

      // Margin for edge detection (pixels)
      const margin = 20;

      // Check if position is outside window bounds (with margin)
      const isOutside =
        clientX < margin ||
        clientY < margin ||
        clientX > bounds.width - margin ||
        clientY > bounds.height - margin;

      setIsOutsideMainWindow(isOutside);
      return isOutside;
    },
    []
  );

  // Convert client coordinates to screen coordinates
  const getScreenPosition = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const bounds = boundsRef.current;
      if (!bounds) return null;

      return {
        x: bounds.x + clientX,
        y: bounds.y + clientY,
      };
    },
    []
  );

  return {
    isOutsideMainWindow,
    mainWindowBounds,
    checkPosition,
    getScreenPosition,
    refreshBounds,
  };
}

/**
 * Utility to check if a point is inside a bounds rectangle
 */
export function isPointInBounds(
  x: number,
  y: number,
  bounds: Bounds,
  margin: number = 0
): boolean {
  return (
    x >= bounds.x - margin &&
    x <= bounds.x + bounds.width + margin &&
    y >= bounds.y - margin &&
    y <= bounds.y + bounds.height + margin
  );
}

/**
 * Calculate suggested position for a new floating window
 * based on where the panel was dragged out
 */
export function calculateFloatingWindowPosition(
  dragX: number,
  dragY: number,
  mainWindowBounds: Bounds,
  windowWidth: number = 600,
  windowHeight: number = 400
): { x: number; y: number } {
  // Convert to screen coordinates
  const screenX = mainWindowBounds.x + dragX;
  const screenY = mainWindowBounds.y + dragY;

  // Offset so window appears near cursor but not directly under it
  const offsetX = 20;
  const offsetY = 20;

  return {
    x: screenX - windowWidth / 2 + offsetX,
    y: screenY - windowHeight / 2 + offsetY,
  };
}
