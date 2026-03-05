/**
 * Window Service
 *
 * Service layer for Tauri window commands and event subscriptions.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import type { Bounds, FloatingWindowInfo, WindowBounds } from '../types/window';

/**
 * Event payload for window created event
 */
interface WindowCreatedPayload {
  windowId: string;
  panelId: string;
  panelType: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Event payload for window closed event
 */
interface WindowClosedPayload {
  windowId: string;
}

/**
 * Event payload for window focused event
 */
interface WindowFocusedPayload {
  windowId: string;
}

/**
 * Window service for managing floating windows via Tauri
 */
export const windowService = {
  /**
   * Create a new floating window for a panel
   */
  async createFloatingWindow(
    panelId: string,
    panelType: string,
    bounds: Bounds
  ): Promise<string> {
    const windowBounds: WindowBounds = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
    try {
      return await invoke<string>('window_create_floating', {
        panelId,
        panelType,
        bounds: windowBounds,
      });
    } catch (error) {
      toast.error('Failed to create floating window', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Close a floating window
   */
  async closeFloatingWindow(windowId: string): Promise<void> {
    try {
      await invoke('window_close_floating', { windowId });
    } catch (error) {
      toast.error('Failed to close floating window', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Update the bounds of a floating window
   */
  async updateFloatingWindowBounds(windowId: string, bounds: Bounds): Promise<void> {
    const windowBounds: WindowBounds = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
    try {
      await invoke('window_update_bounds', { windowId, bounds: windowBounds });
    } catch (error) {
      toast.error('Failed to update floating window bounds', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Focus a floating window (bring to front)
   */
  async focusFloatingWindow(windowId: string): Promise<void> {
    try {
      await invoke('window_focus_floating', { windowId });
    } catch (error) {
      toast.error('Failed to focus floating window', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * List all floating windows
   */
  async listFloatingWindows(): Promise<FloatingWindowInfo[]> {
    try {
      return await invoke<FloatingWindowInfo[]>('window_list_floating');
    } catch (error) {
      toast.error('Failed to list floating windows', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Get information about a specific floating window
   */
  async getFloatingWindowInfo(windowId: string): Promise<FloatingWindowInfo | null> {
    try {
      return await invoke<FloatingWindowInfo | null>('window_get_floating_info', { windowId });
    } catch (error) {
      toast.error('Failed to get floating window info', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Minimize a floating window
   */
  async minimizeFloatingWindow(windowId: string): Promise<void> {
    try {
      await invoke('window_minimize_floating', { windowId });
    } catch (error) {
      toast.error('Failed to minimize floating window', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Maximize/restore a floating window
   */
  async maximizeFloatingWindow(windowId: string): Promise<void> {
    try {
      await invoke('window_maximize_floating', { windowId });
    } catch (error) {
      toast.error('Failed to maximize floating window', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Check if a floating window exists
   */
  async floatingWindowExists(windowId: string): Promise<boolean> {
    try {
      return await invoke<boolean>('window_floating_exists', { windowId });
    } catch (error) {
      toast.error('Failed to check floating window', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  // Event listeners

  /**
   * Listen for floating window created events
   */
  onWindowCreated(
    callback: (data: { windowId: string; panelId: string; panelType: string; x: number; y: number; width: number; height: number }) => void
  ): Promise<UnlistenFn> {
    return listen<WindowCreatedPayload>('floating-window-created', (event) => {
      callback(event.payload);
    });
  },

  /**
   * Listen for floating window closed events
   */
  onWindowClosed(callback: (windowId: string) => void): Promise<UnlistenFn> {
    return listen<WindowClosedPayload>('floating-window-closed', (event) => {
      callback(event.payload.windowId);
    });
  },

  /**
   * Listen for floating window focused events
   */
  onWindowFocused(callback: (windowId: string) => void): Promise<UnlistenFn> {
    return listen<WindowFocusedPayload>('floating-window-focused', (event) => {
      callback(event.payload.windowId);
    });
  },
};

export default windowService;
