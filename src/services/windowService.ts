/**
 * Window Service
 *
 * Service layer for Tauri window commands and event subscriptions.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { Bounds, FloatingWindowInfo, WindowBounds } from '../types/window';

/**
 * Event payload for window created event
 */
interface WindowCreatedPayload {
  windowId: string;
  panelId: string;
  panelType: string;
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
    return invoke<string>('window_create_floating', {
      panelId,
      panelType,
      bounds: windowBounds,
    });
  },

  /**
   * Close a floating window
   */
  async closeFloatingWindow(windowId: string): Promise<void> {
    return invoke('window_close_floating', { windowId });
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
    return invoke('window_update_bounds', { windowId, bounds: windowBounds });
  },

  /**
   * Focus a floating window (bring to front)
   */
  async focusFloatingWindow(windowId: string): Promise<void> {
    return invoke('window_focus_floating', { windowId });
  },

  /**
   * List all floating windows
   */
  async listFloatingWindows(): Promise<FloatingWindowInfo[]> {
    return invoke<FloatingWindowInfo[]>('window_list_floating');
  },

  /**
   * Get information about a specific floating window
   */
  async getFloatingWindowInfo(windowId: string): Promise<FloatingWindowInfo | null> {
    return invoke<FloatingWindowInfo | null>('window_get_floating_info', { windowId });
  },

  /**
   * Minimize a floating window
   */
  async minimizeFloatingWindow(windowId: string): Promise<void> {
    return invoke('window_minimize_floating', { windowId });
  },

  /**
   * Maximize/restore a floating window
   */
  async maximizeFloatingWindow(windowId: string): Promise<void> {
    return invoke('window_maximize_floating', { windowId });
  },

  /**
   * Check if a floating window exists
   */
  async floatingWindowExists(windowId: string): Promise<boolean> {
    return invoke<boolean>('window_floating_exists', { windowId });
  },

  // Event listeners

  /**
   * Listen for floating window created events
   */
  onWindowCreated(
    callback: (data: { windowId: string; panelId: string; panelType: string }) => void
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
