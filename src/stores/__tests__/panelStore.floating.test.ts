/**
 * Panel Store Floating Window Integration Tests
 *
 * Tests for panelStore's undockPanel and dockPanel actions,
 * mocking windowService calls and verifying state transitions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePanelStore } from '../panelStore';
import { useWindowStore } from '../windowStore';
import type { Bounds } from '../../types/window';

// Mock windowService
vi.mock('../../services/windowService', () => ({
  windowService: {
    createFloatingWindow: vi.fn(),
    closeFloatingWindow: vi.fn(),
    updateFloatingWindowBounds: vi.fn(),
    focusFloatingWindow: vi.fn(),
    listFloatingWindows: vi.fn(),
  },
}));

// Mock screenUtils (to avoid Tauri API calls)
vi.mock('../../utils/screenUtils', () => ({
  correctWindowPosition: vi.fn((bounds: Bounds) => Promise.resolve(bounds)),
}));

// Import mocked modules
import { windowService } from '../../services/windowService';

// Helper to create bounds
const createBounds = (x = 100, y = 100, width = 600, height = 400): Bounds => ({
  x,
  y,
  width,
  height,
});

describe('panelStore floating window actions', () => {
  beforeEach(() => {
    // Reset stores
    const panelState = usePanelStore.getState();
    panelState.panels.forEach((panel) => {
      usePanelStore.getState().removePanel(panel.id);
    });
    useWindowStore.getState().clearAllWindows();

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('undockPanel', () => {
    it('creates floating window via windowService', async () => {
      // Setup: Add a docked panel
      const panelId = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');
      const bounds = createBounds();

      // Mock windowService to return a window ID
      vi.mocked(windowService.createFloatingWindow).mockResolvedValue('floating-win-1');

      // Act
      const windowId = await usePanelStore.getState().undockPanel(panelId, bounds);

      // Assert
      expect(windowService.createFloatingWindow).toHaveBeenCalledTimes(1);
      expect(windowService.createFloatingWindow).toHaveBeenCalledWith(
        panelId,
        'console',
        bounds
      );
      expect(windowId).toBe('floating-win-1');
    });

    it('updates panel state to floating', async () => {
      const panelId = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');
      vi.mocked(windowService.createFloatingWindow).mockResolvedValue('floating-win-1');

      await usePanelStore.getState().undockPanel(panelId, createBounds());

      const panel = usePanelStore.getState().panels.find((p) => p.id === panelId);
      expect(panel?.isFloating).toBe(true);
      expect(panel?.windowId).toBe('floating-win-1');
    });

    it('registers in windowStore', async () => {
      const panelId = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');
      const bounds = createBounds();
      vi.mocked(windowService.createFloatingWindow).mockResolvedValue('floating-win-1');

      await usePanelStore.getState().undockPanel(panelId, bounds);

      const windowState = useWindowStore.getState();
      expect(windowState.floatingWindows.has('floating-win-1')).toBe(true);
      expect(windowState.floatingWindows.get('floating-win-1')?.panelId).toBe(panelId);
      expect(windowState.floatingWindows.get('floating-win-1')?.bounds).toEqual(bounds);
    });

    it('returns null if panel is already floating', async () => {
      const panelId = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');
      vi.mocked(windowService.createFloatingWindow).mockResolvedValue('floating-win-1');

      // First undock
      await usePanelStore.getState().undockPanel(panelId, createBounds());

      // Clear mocks to verify second call
      vi.clearAllMocks();

      // Try to undock again
      const windowId = await usePanelStore.getState().undockPanel(panelId, createBounds());

      expect(windowId).toBe(null);
      expect(windowService.createFloatingWindow).not.toHaveBeenCalled();
    });

    it('returns null if panel not found', async () => {
      const windowId = await usePanelStore.getState().undockPanel('nonexistent-panel', createBounds());

      expect(windowId).toBe(null);
      expect(windowService.createFloatingWindow).not.toHaveBeenCalled();
    });

    it('handles windowService error gracefully', async () => {
      const panelId = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');
      vi.mocked(windowService.createFloatingWindow).mockRejectedValue(new Error('Window creation failed'));

      // Spy on console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const windowId = await usePanelStore.getState().undockPanel(panelId, createBounds());

      expect(windowId).toBe(null);
      expect(consoleSpy).toHaveBeenCalled();

      // Panel should remain docked (not floating)
      const panel = usePanelStore.getState().panels.find((p) => p.id === panelId);
      expect(panel?.isFloating).toBeFalsy();

      consoleSpy.mockRestore();
    });

    it('uses default bounds when not provided', async () => {
      const panelId = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');
      vi.mocked(windowService.createFloatingWindow).mockResolvedValue('floating-win-1');

      await usePanelStore.getState().undockPanel(panelId);

      expect(windowService.createFloatingWindow).toHaveBeenCalledWith(
        panelId,
        'console',
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          width: 600, // DEFAULT_FLOATING_WINDOW_SIZE.width
          height: 400, // DEFAULT_FLOATING_WINDOW_SIZE.height
        })
      );
    });
  });

  describe('dockPanel', () => {
    it('closes window via windowService', async () => {
      // Setup: Create a floating panel
      const panelId = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');
      vi.mocked(windowService.createFloatingWindow).mockResolvedValue('floating-win-1');
      await usePanelStore.getState().undockPanel(panelId, createBounds());

      vi.mocked(windowService.closeFloatingWindow).mockResolvedValue(undefined);

      // Act
      const result = await usePanelStore.getState().dockPanel(panelId);

      // Assert
      expect(windowService.closeFloatingWindow).toHaveBeenCalledTimes(1);
      expect(windowService.closeFloatingWindow).toHaveBeenCalledWith('floating-win-1');
      expect(result).toBe(true);
    });

    it('unregisters from windowStore', async () => {
      const panelId = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');
      vi.mocked(windowService.createFloatingWindow).mockResolvedValue('floating-win-1');
      await usePanelStore.getState().undockPanel(panelId, createBounds());

      vi.mocked(windowService.closeFloatingWindow).mockResolvedValue(undefined);

      await usePanelStore.getState().dockPanel(panelId);

      expect(useWindowStore.getState().floatingWindows.has('floating-win-1')).toBe(false);
    });

    it('updates panel state to docked', async () => {
      const panelId = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');
      vi.mocked(windowService.createFloatingWindow).mockResolvedValue('floating-win-1');
      await usePanelStore.getState().undockPanel(panelId, createBounds());

      vi.mocked(windowService.closeFloatingWindow).mockResolvedValue(undefined);

      await usePanelStore.getState().dockPanel(panelId);

      const panel = usePanelStore.getState().panels.find((p) => p.id === panelId);
      expect(panel?.isFloating).toBe(false);
      expect(panel?.windowId).toBe(null);
    });

    it('returns false if panel not floating', async () => {
      const panelId = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');

      const result = await usePanelStore.getState().dockPanel(panelId);

      expect(result).toBe(false);
      expect(windowService.closeFloatingWindow).not.toHaveBeenCalled();
    });

    it('handles windowService error gracefully', async () => {
      const panelId = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');
      vi.mocked(windowService.createFloatingWindow).mockResolvedValue('floating-win-1');
      await usePanelStore.getState().undockPanel(panelId, createBounds());

      vi.mocked(windowService.closeFloatingWindow).mockRejectedValue(new Error('Close failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await usePanelStore.getState().dockPanel(panelId);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('setPanelFloating', () => {
    it('sets isFloating to true', () => {
      const panelId = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');

      usePanelStore.getState().setPanelFloating(panelId, true, 'win-1');

      const panel = usePanelStore.getState().panels.find((p) => p.id === panelId);
      expect(panel?.isFloating).toBe(true);
      expect(panel?.windowId).toBe('win-1');
    });

    it('sets isFloating to false', () => {
      const panelId = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');
      usePanelStore.getState().setPanelFloating(panelId, true, 'win-1');

      usePanelStore.getState().setPanelFloating(panelId, false, null);

      const panel = usePanelStore.getState().panels.find((p) => p.id === panelId);
      expect(panel?.isFloating).toBe(false);
      expect(panel?.windowId).toBe(null);
    });
  });

  describe('updatePanelFloatingBounds', () => {
    it('updates floatingBounds on panel', async () => {
      const panelId = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');
      vi.mocked(windowService.createFloatingWindow).mockResolvedValue('floating-win-1');
      await usePanelStore.getState().undockPanel(panelId, createBounds(100, 100, 400, 300));

      const newBounds = createBounds(200, 200, 800, 600);
      usePanelStore.getState().updatePanelFloatingBounds(panelId, newBounds);

      const panel = usePanelStore.getState().panels.find((p) => p.id === panelId);
      expect(panel?.floatingBounds).toEqual(newBounds);
    });
  });

  describe('getFloatingPanels', () => {
    it('returns empty array when no floating panels', () => {
      usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');

      const floatingPanels = usePanelStore.getState().getFloatingPanels();

      expect(floatingPanels).toEqual([]);
    });

    it('returns only floating panels', async () => {
      const panelId1 = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');
      // Add second panel (docked) to ensure it's not returned
      usePanelStore.getState().addPanel('properties', '1 / 2 / 2 / 3');

      vi.mocked(windowService.createFloatingWindow).mockResolvedValue('floating-win-1');
      await usePanelStore.getState().undockPanel(panelId1, createBounds());

      const floatingPanels = usePanelStore.getState().getFloatingPanels();

      expect(floatingPanels).toHaveLength(1);
      expect(floatingPanels[0].id).toBe(panelId1);
    });
  });

  describe('getDockedPanels', () => {
    it('returns only docked panels', async () => {
      const panelId1 = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');
      const panelId2 = usePanelStore.getState().addPanel('properties', '1 / 2 / 2 / 3');

      vi.mocked(windowService.createFloatingWindow).mockResolvedValue('floating-win-1');
      await usePanelStore.getState().undockPanel(panelId1, createBounds());

      const dockedPanels = usePanelStore.getState().getDockedPanels();

      expect(dockedPanels).toHaveLength(1);
      expect(dockedPanels[0].id).toBe(panelId2);
    });
  });

  describe('state consistency', () => {
    it('maintains consistency between panelStore and windowStore after undock', async () => {
      const panelId = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');
      const bounds = createBounds();
      vi.mocked(windowService.createFloatingWindow).mockResolvedValue('floating-win-1');

      await usePanelStore.getState().undockPanel(panelId, bounds);

      // Check panelStore
      const panel = usePanelStore.getState().panels.find((p) => p.id === panelId);
      expect(panel?.isFloating).toBe(true);
      expect(panel?.windowId).toBe('floating-win-1');
      expect(panel?.floatingBounds).toEqual(bounds);

      // Check windowStore
      const windowState = useWindowStore.getState().floatingWindows.get('floating-win-1');
      expect(windowState?.panelId).toBe(panelId);
      expect(windowState?.bounds).toEqual(bounds);
    });

    it('maintains consistency between panelStore and windowStore after dock', async () => {
      const panelId = usePanelStore.getState().addPanel('console', '1 / 1 / 2 / 2');
      vi.mocked(windowService.createFloatingWindow).mockResolvedValue('floating-win-1');
      await usePanelStore.getState().undockPanel(panelId, createBounds());

      vi.mocked(windowService.closeFloatingWindow).mockResolvedValue(undefined);
      await usePanelStore.getState().dockPanel(panelId);

      // Check panelStore
      const panel = usePanelStore.getState().panels.find((p) => p.id === panelId);
      expect(panel?.isFloating).toBe(false);
      expect(panel?.windowId).toBe(null);

      // Check windowStore
      expect(useWindowStore.getState().floatingWindows.has('floating-win-1')).toBe(false);
    });
  });
});
