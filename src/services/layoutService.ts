/**
 * Layout Service - Tauri Command Wrappers
 *
 * This service provides type-safe wrappers around Tauri backend commands
 * for layout persistence operations.
 */

import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
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
    try {
      await invoke('save_layout', { config });
    } catch (error) {
      toast.error('Failed to save layout', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Load a layout configuration by name
   * @param name - Name of the layout to load
   */
  async loadLayout(name: string): Promise<LayoutConfig> {
    try {
      return await invoke('load_layout', { name });
    } catch (error) {
      toast.error('Failed to load layout', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * List all saved layout names
   */
  async listLayouts(): Promise<string[]> {
    try {
      return await invoke('list_layouts');
    } catch (error) {
      toast.error('Failed to list layouts', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Delete a layout by name
   * @param name - Name of the layout to delete
   */
  async deleteLayout(name: string): Promise<void> {
    try {
      await invoke('delete_layout', { name });
    } catch (error) {
      toast.error('Failed to delete layout', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Set the last active layout name
   * @param name - Name of the last active layout (or null to clear)
   */
  async setLastActiveLayout(name: string | null): Promise<void> {
    try {
      await invoke('set_last_active_layout', { name });
    } catch (error) {
      toast.error('Failed to set last active layout', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Get the last active layout name
   */
  async getLastActiveLayout(): Promise<string | null> {
    try {
      return await invoke('get_last_active_layout');
    } catch (error) {
      toast.error('Failed to get last active layout', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Set whether to restore last session on startup
   * @param restore - Whether to restore last session
   */
  async setRestoreLastSession(restore: boolean): Promise<void> {
    try {
      await invoke('set_restore_last_session', { restore });
    } catch (error) {
      toast.error('Failed to update restore session setting', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Get whether to restore last session on startup
   */
  async getRestoreLastSession(): Promise<boolean> {
    try {
      return await invoke('get_restore_last_session');
    } catch (error) {
      toast.error('Failed to get restore session setting', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};

export default layoutService;
