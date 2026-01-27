/**
 * Layout Service - Tauri Command Wrappers
 *
 * This service provides type-safe wrappers around Tauri backend commands
 * for layout persistence operations.
 */

import { invoke } from '@tauri-apps/api/core';
import type { LayoutConfig } from '../types/layout';

/**
 * Layout service for interacting with the Tauri backend
 */
export const layoutService = {
  /**
   * Save a layout configuration
   * @param config - The layout configuration to save
   */
  async saveLayout(config: LayoutConfig): Promise<void> {
    return invoke('save_layout', { config });
  },

  /**
   * Load a layout configuration by name
   * @param name - Name of the layout to load
   */
  async loadLayout(name: string): Promise<LayoutConfig> {
    return invoke('load_layout', { name });
  },

  /**
   * List all saved layout names
   */
  async listLayouts(): Promise<string[]> {
    return invoke('list_layouts');
  },

  /**
   * Delete a layout by name
   * @param name - Name of the layout to delete
   */
  async deleteLayout(name: string): Promise<void> {
    return invoke('delete_layout', { name });
  },

  /**
   * Set the last active layout name
   * @param name - Name of the last active layout (or null to clear)
   */
  async setLastActiveLayout(name: string | null): Promise<void> {
    return invoke('set_last_active_layout', { name });
  },

  /**
   * Get the last active layout name
   */
  async getLastActiveLayout(): Promise<string | null> {
    return invoke('get_last_active_layout');
  },

  /**
   * Set whether to restore last session on startup
   * @param restore - Whether to restore last session
   */
  async setRestoreLastSession(restore: boolean): Promise<void> {
    return invoke('set_restore_last_session', { restore });
  },

  /**
   * Get whether to restore last session on startup
   */
  async getRestoreLastSession(): Promise<boolean> {
    return invoke('get_restore_last_session');
  },
};

export default layoutService;
