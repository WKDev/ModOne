/**
 * Window Store Unit Tests
 *
 * Tests for the windowStore Zustand store covering all actions:
 * register/unregister, bounds updates, focus management, z-index ordering,
 * and minimized/maximized states.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useWindowStore } from '../windowStore';
import type { Bounds } from '../../types/window';

// Helper to create bounds
const createBounds = (x = 100, y = 100, width = 400, height = 300): Bounds => ({
  x,
  y,
  width,
  height,
});

describe('windowStore', () => {
  // Reset store before each test
  beforeEach(() => {
    useWindowStore.getState().clearAllWindows();
  });

  describe('registerFloatingWindow', () => {
    it('adds window to registry', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());

      const state = useWindowStore.getState();
      expect(state.floatingWindows.size).toBe(1);
      expect(state.floatingWindows.has('win-1')).toBe(true);
    });

    it('sets initial window state correctly', () => {
      const bounds = createBounds(200, 150, 500, 400);
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', bounds);

      const window = useWindowStore.getState().floatingWindows.get('win-1');
      expect(window).toBeDefined();
      expect(window?.windowId).toBe('win-1');
      expect(window?.panelId).toBe('panel-1');
      expect(window?.bounds).toEqual(bounds);
      expect(window?.isMinimized).toBe(false);
      expect(window?.isMaximized).toBe(false);
    });

    it('sets focusedWindowId to new window', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      expect(useWindowStore.getState().focusedWindowId).toBe('win-1');
    });

    it('increments nextZIndex for each window', () => {
      const initialZIndex = useWindowStore.getState().nextZIndex;

      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      const win1 = useWindowStore.getState().floatingWindows.get('win-1');
      expect(win1?.zIndex).toBe(initialZIndex);
      expect(useWindowStore.getState().nextZIndex).toBe(initialZIndex + 1);

      useWindowStore.getState().registerFloatingWindow('win-2', 'panel-2', createBounds());
      const win2 = useWindowStore.getState().floatingWindows.get('win-2');
      expect(win2?.zIndex).toBe(initialZIndex + 1);
      expect(useWindowStore.getState().nextZIndex).toBe(initialZIndex + 2);
    });

    it('can register multiple windows', () => {
      const store = useWindowStore.getState();
      store.registerFloatingWindow('win-1', 'panel-1', createBounds());
      store.registerFloatingWindow('win-2', 'panel-2', createBounds());
      store.registerFloatingWindow('win-3', 'panel-3', createBounds());

      expect(useWindowStore.getState().floatingWindows.size).toBe(3);
    });
  });

  describe('unregisterFloatingWindow', () => {
    it('removes window from registry', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      useWindowStore.getState().unregisterFloatingWindow('win-1');

      expect(useWindowStore.getState().floatingWindows.size).toBe(0);
      expect(useWindowStore.getState().floatingWindows.has('win-1')).toBe(false);
    });

    it('clears focusedWindowId if matching', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      expect(useWindowStore.getState().focusedWindowId).toBe('win-1');

      useWindowStore.getState().unregisterFloatingWindow('win-1');
      expect(useWindowStore.getState().focusedWindowId).toBe(null);
    });

    it('preserves focusedWindowId if not matching', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      useWindowStore.getState().registerFloatingWindow('win-2', 'panel-2', createBounds());
      useWindowStore.getState().setFocusedWindow('win-1');

      useWindowStore.getState().unregisterFloatingWindow('win-2');
      expect(useWindowStore.getState().focusedWindowId).toBe('win-1');
    });

    it('handles non-existent window gracefully', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      useWindowStore.getState().unregisterFloatingWindow('win-nonexistent');

      expect(useWindowStore.getState().floatingWindows.size).toBe(1);
    });
  });

  describe('updateWindowBounds', () => {
    it('updates bounds for existing window', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds(100, 100, 400, 300));

      const newBounds = createBounds(200, 200, 600, 500);
      useWindowStore.getState().updateWindowBounds('win-1', newBounds);

      const window = useWindowStore.getState().floatingWindows.get('win-1');
      expect(window?.bounds).toEqual(newBounds);
    });

    it('does nothing for non-existent window', () => {
      const initialState = useWindowStore.getState();
      useWindowStore.getState().updateWindowBounds('win-nonexistent', createBounds());

      // State should be unchanged (no error thrown)
      expect(useWindowStore.getState().floatingWindows.size).toBe(initialState.floatingWindows.size);
    });

    it('preserves other window properties', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      useWindowStore.getState().setWindowMinimized('win-1', true);

      useWindowStore.getState().updateWindowBounds('win-1', createBounds(999, 999, 100, 100));

      const window = useWindowStore.getState().floatingWindows.get('win-1');
      expect(window?.isMinimized).toBe(true);
      expect(window?.panelId).toBe('panel-1');
    });
  });

  describe('setFocusedWindow', () => {
    it('sets focusedWindowId', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      useWindowStore.getState().registerFloatingWindow('win-2', 'panel-2', createBounds());

      useWindowStore.getState().setFocusedWindow('win-1');
      expect(useWindowStore.getState().focusedWindowId).toBe('win-1');

      useWindowStore.getState().setFocusedWindow('win-2');
      expect(useWindowStore.getState().focusedWindowId).toBe('win-2');
    });

    it('can clear focusedWindowId with null', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      useWindowStore.getState().setFocusedWindow(null);

      expect(useWindowStore.getState().focusedWindowId).toBe(null);
    });
  });

  describe('setWindowMinimized', () => {
    it('sets isMinimized state', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());

      useWindowStore.getState().setWindowMinimized('win-1', true);
      expect(useWindowStore.getState().floatingWindows.get('win-1')?.isMinimized).toBe(true);

      useWindowStore.getState().setWindowMinimized('win-1', false);
      expect(useWindowStore.getState().floatingWindows.get('win-1')?.isMinimized).toBe(false);
    });

    it('does nothing for non-existent window', () => {
      useWindowStore.getState().setWindowMinimized('win-nonexistent', true);
      // Should not throw
      expect(useWindowStore.getState().floatingWindows.size).toBe(0);
    });
  });

  describe('setWindowMaximized', () => {
    it('sets isMaximized state', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());

      useWindowStore.getState().setWindowMaximized('win-1', true);
      expect(useWindowStore.getState().floatingWindows.get('win-1')?.isMaximized).toBe(true);

      useWindowStore.getState().setWindowMaximized('win-1', false);
      expect(useWindowStore.getState().floatingWindows.get('win-1')?.isMaximized).toBe(false);
    });

    it('does nothing for non-existent window', () => {
      useWindowStore.getState().setWindowMaximized('win-nonexistent', true);
      expect(useWindowStore.getState().floatingWindows.size).toBe(0);
    });
  });

  describe('getWindowByPanelId', () => {
    it('returns window for existing panel', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      useWindowStore.getState().registerFloatingWindow('win-2', 'panel-2', createBounds());

      const window = useWindowStore.getState().getWindowByPanelId('panel-1');
      expect(window).toBeDefined();
      expect(window?.windowId).toBe('win-1');
      expect(window?.panelId).toBe('panel-1');
    });

    it('returns undefined for non-existent panel', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());

      const window = useWindowStore.getState().getWindowByPanelId('panel-nonexistent');
      expect(window).toBeUndefined();
    });
  });

  describe('getAllFloatingWindows', () => {
    it('returns empty array when no windows', () => {
      const windows = useWindowStore.getState().getAllFloatingWindows();
      expect(windows).toEqual([]);
    });

    it('returns array of all windows', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      useWindowStore.getState().registerFloatingWindow('win-2', 'panel-2', createBounds());
      useWindowStore.getState().registerFloatingWindow('win-3', 'panel-3', createBounds());

      const windows = useWindowStore.getState().getAllFloatingWindows();
      expect(windows).toHaveLength(3);
      expect(windows.map((w) => w.windowId)).toEqual(expect.arrayContaining(['win-1', 'win-2', 'win-3']));
    });
  });

  describe('isPanelFloating', () => {
    it('returns true for floating panel', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());

      expect(useWindowStore.getState().isPanelFloating('panel-1')).toBe(true);
    });

    it('returns false for non-floating panel', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());

      expect(useWindowStore.getState().isPanelFloating('panel-2')).toBe(false);
    });
  });

  describe('bringToFront', () => {
    it('updates zIndex to highest value', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      useWindowStore.getState().registerFloatingWindow('win-2', 'panel-2', createBounds());

      const win1ZIndexBefore = useWindowStore.getState().floatingWindows.get('win-1')?.zIndex;
      const win2ZIndexBefore = useWindowStore.getState().floatingWindows.get('win-2')?.zIndex;

      expect(win1ZIndexBefore).toBeLessThan(win2ZIndexBefore!);

      useWindowStore.getState().bringToFront('win-1');

      const win1ZIndexAfter = useWindowStore.getState().floatingWindows.get('win-1')?.zIndex;
      expect(win1ZIndexAfter).toBeGreaterThan(win2ZIndexBefore!);
    });

    it('sets focusedWindowId', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      useWindowStore.getState().registerFloatingWindow('win-2', 'panel-2', createBounds());

      useWindowStore.getState().bringToFront('win-1');
      expect(useWindowStore.getState().focusedWindowId).toBe('win-1');
    });

    it('increments nextZIndex', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      const nextZIndexBefore = useWindowStore.getState().nextZIndex;

      useWindowStore.getState().bringToFront('win-1');
      expect(useWindowStore.getState().nextZIndex).toBe(nextZIndexBefore + 1);
    });

    it('does nothing for non-existent window', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      const nextZIndexBefore = useWindowStore.getState().nextZIndex;

      useWindowStore.getState().bringToFront('win-nonexistent');
      expect(useWindowStore.getState().nextZIndex).toBe(nextZIndexBefore);
    });
  });

  describe('clearAllWindows', () => {
    it('removes all windows', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      useWindowStore.getState().registerFloatingWindow('win-2', 'panel-2', createBounds());
      useWindowStore.getState().registerFloatingWindow('win-3', 'panel-3', createBounds());

      useWindowStore.getState().clearAllWindows();

      expect(useWindowStore.getState().floatingWindows.size).toBe(0);
    });

    it('clears focusedWindowId', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      useWindowStore.getState().clearAllWindows();

      expect(useWindowStore.getState().focusedWindowId).toBe(null);
    });

    it('does not reset nextZIndex', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      useWindowStore.getState().registerFloatingWindow('win-2', 'panel-2', createBounds());
      const nextZIndexBefore = useWindowStore.getState().nextZIndex;

      useWindowStore.getState().clearAllWindows();

      // nextZIndex should be preserved to maintain unique z-index across sessions
      expect(useWindowStore.getState().nextZIndex).toBe(nextZIndexBefore);
    });
  });

  describe('z-index ordering', () => {
    it('maintains correct stacking order for multiple windows', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds());
      useWindowStore.getState().registerFloatingWindow('win-2', 'panel-2', createBounds());
      useWindowStore.getState().registerFloatingWindow('win-3', 'panel-3', createBounds());

      const win1 = useWindowStore.getState().floatingWindows.get('win-1');
      const win2 = useWindowStore.getState().floatingWindows.get('win-2');
      const win3 = useWindowStore.getState().floatingWindows.get('win-3');

      // Later windows should have higher z-index
      expect(win1!.zIndex).toBeLessThan(win2!.zIndex);
      expect(win2!.zIndex).toBeLessThan(win3!.zIndex);

      // Bring win-1 to front
      useWindowStore.getState().bringToFront('win-1');
      const win1After = useWindowStore.getState().floatingWindows.get('win-1');

      expect(win1After!.zIndex).toBeGreaterThan(win3!.zIndex);
    });
  });

  describe('state isolation', () => {
    it('operations on one window do not affect others', () => {
      useWindowStore.getState().registerFloatingWindow('win-1', 'panel-1', createBounds(100, 100, 400, 300));
      useWindowStore.getState().registerFloatingWindow('win-2', 'panel-2', createBounds(200, 200, 500, 400));

      // Update win-1
      useWindowStore.getState().updateWindowBounds('win-1', createBounds(999, 999, 100, 100));
      useWindowStore.getState().setWindowMinimized('win-1', true);
      useWindowStore.getState().setWindowMaximized('win-1', true);

      // Win-2 should be unchanged
      const win2 = useWindowStore.getState().floatingWindows.get('win-2');
      expect(win2?.bounds).toEqual(createBounds(200, 200, 500, 400));
      expect(win2?.isMinimized).toBe(false);
      expect(win2?.isMaximized).toBe(false);
    });
  });
});
