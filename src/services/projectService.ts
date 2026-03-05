/**
 * Project Service - Tauri Command Wrappers
 *
 * This service provides type-safe wrappers around Tauri backend commands
 * for project CRUD operations.
 */

import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import type {
  ProjectInfo,
  ProjectData,
  ProjectStatus,
  RecentProject,
  PlcManufacturer,
  AutoSaveSettings,
} from '../types/project';

/**
 * Project service for interacting with the Tauri backend
 */
export const projectService = {
  /**
   * Create a new project
   *
   * Creates a folder-based project (v2.0) with the following structure:
   * ```
   * projectDir/
   * ├── {name}.mop     # YAML manifest
   * ├── canvas/        # Canvas diagrams
   * ├── ladder/        # Ladder logic files
   * └── scenario/      # Scenario files
   * ```
   *
   * @param name - Project name
   * @param projectDir - Path to the project directory (e.g., Documents/ModOne/MyProject)
   * @param plcManufacturer - PLC manufacturer (LS, Mitsubishi, Siemens)
   * @param plcModel - PLC model name
   * @param scanTimeMs - Optional scan time in milliseconds (defaults to 10)
   */
  async createProject(
    name: string,
    projectDir: string,
    plcManufacturer: PlcManufacturer,
    plcModel: string,
    scanTimeMs?: number
  ): Promise<ProjectInfo> {
    try {
      return await invoke('create_project', {
        name,
        projectDir,
        plcManufacturer,
        plcModel,
        scanTimeMs: scanTimeMs ?? null,
      });
    } catch (error) {
      toast.error('Failed to create project', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Open an existing project from a .mop file
   * @param path - Path to the .mop file
   */
  async openProject(path: string): Promise<ProjectData> {
    try {
      return await invoke('open_project', { path });
    } catch (error) {
      toast.error('Failed to open project', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Save the current project
   * @param path - Optional path for "Save As" operation
   */
  async saveProject(path?: string): Promise<void> {
    try {
      await invoke('save_project', { path: path ?? null });
    } catch (error) {
      toast.error('Failed to save project', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Close the current project (fails if unsaved changes)
   */
  async closeProject(): Promise<void> {
    try {
      await invoke('close_project');
    } catch (error) {
      toast.error('Failed to close project', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Close the current project without saving (discards changes)
   */
  async closeProjectForce(): Promise<void> {
    try {
      await invoke('close_project_force');
    } catch (error) {
      toast.error('Failed to force close project', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Get the list of recently opened projects
   */
  async getRecentProjects(): Promise<RecentProject[]> {
    try {
      return await invoke('get_recent_projects');
    } catch (error) {
      toast.error('Failed to load recent projects', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Get the current project status
   */
  async getProjectStatus(): Promise<ProjectStatus> {
    try {
      return await invoke('get_project_status');
    } catch (error) {
      toast.error('Failed to get project status', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Mark the current project as modified
   */
  async markProjectModified(): Promise<void> {
    try {
      await invoke('mark_project_modified');
    } catch (error) {
      toast.error('Failed to mark project as modified', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Remove a project from the recent projects list
   * @param path - Path of the project to remove
   */
  async removeFromRecent(path: string): Promise<void> {
    try {
      await invoke('remove_from_recent', { path });
    } catch (error) {
      toast.error('Failed to remove recent project', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Clear all recent projects
   */
  async clearRecentProjects(): Promise<void> {
    try {
      await invoke('clear_recent_projects');
    } catch (error) {
      toast.error('Failed to clear recent projects', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Get the current auto-save settings
   */
  async getAutoSaveSettings(): Promise<AutoSaveSettings> {
    try {
      return await invoke('get_auto_save_settings');
    } catch (error) {
      toast.error('Failed to get auto-save settings', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Enable or disable auto-save
   * @param enabled - Whether auto-save should be enabled
   */
  async setAutoSaveEnabled(enabled: boolean): Promise<void> {
    try {
      await invoke('set_auto_save_enabled', { enabled });
    } catch (error) {
      toast.error('Failed to update auto-save setting', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Set the auto-save interval
   * @param secs - Interval in seconds (minimum 30)
   */
  async setAutoSaveInterval(secs: number): Promise<void> {
    try {
      await invoke('set_auto_save_interval', { secs });
    } catch (error) {
      toast.error('Failed to set auto-save interval', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Set the number of backup files to keep
   * @param count - Number of backups (1-10)
   */
  async setBackupCount(count: number): Promise<void> {
    try {
      await invoke('set_backup_count', { count });
    } catch (error) {
      toast.error('Failed to set backup count', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Start the auto-save loop
   */
  async startAutoSave(): Promise<void> {
    try {
      await invoke('start_auto_save');
    } catch (error) {
      toast.error('Failed to start auto-save', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Stop the auto-save loop
   */
  async stopAutoSave(): Promise<void> {
    try {
      await invoke('stop_auto_save');
    } catch (error) {
      toast.error('Failed to stop auto-save', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};

export default projectService;
