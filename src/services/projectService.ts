/**
 * Project Service - Tauri Command Wrappers
 *
 * This service provides type-safe wrappers around Tauri backend commands
 * for project CRUD operations.
 */

import { invoke } from '@tauri-apps/api/core';
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
    return invoke('create_project', {
      name,
      projectDir,
      plcManufacturer,
      plcModel,
      scanTimeMs: scanTimeMs ?? null,
    });
  },

  /**
   * Open an existing project from a .mop file
   * @param path - Path to the .mop file
   */
  async openProject(path: string): Promise<ProjectData> {
    return invoke('open_project', { path });
  },

  /**
   * Save the current project
   * @param path - Optional path for "Save As" operation
   */
  async saveProject(path?: string): Promise<void> {
    return invoke('save_project', { path: path ?? null });
  },

  /**
   * Close the current project (fails if unsaved changes)
   */
  async closeProject(): Promise<void> {
    return invoke('close_project');
  },

  /**
   * Close the current project without saving (discards changes)
   */
  async closeProjectForce(): Promise<void> {
    return invoke('close_project_force');
  },

  /**
   * Get the list of recently opened projects
   */
  async getRecentProjects(): Promise<RecentProject[]> {
    return invoke('get_recent_projects');
  },

  /**
   * Get the current project status
   */
  async getProjectStatus(): Promise<ProjectStatus> {
    return invoke('get_project_status');
  },

  /**
   * Mark the current project as modified
   */
  async markProjectModified(): Promise<void> {
    return invoke('mark_project_modified');
  },

  /**
   * Remove a project from the recent projects list
   * @param path - Path of the project to remove
   */
  async removeFromRecent(path: string): Promise<void> {
    return invoke('remove_from_recent', { path });
  },

  /**
   * Clear all recent projects
   */
  async clearRecentProjects(): Promise<void> {
    return invoke('clear_recent_projects');
  },

  /**
   * Get the current auto-save settings
   */
  async getAutoSaveSettings(): Promise<AutoSaveSettings> {
    return invoke('get_auto_save_settings');
  },

  /**
   * Enable or disable auto-save
   * @param enabled - Whether auto-save should be enabled
   */
  async setAutoSaveEnabled(enabled: boolean): Promise<void> {
    return invoke('set_auto_save_enabled', { enabled });
  },

  /**
   * Set the auto-save interval
   * @param secs - Interval in seconds (minimum 30)
   */
  async setAutoSaveInterval(secs: number): Promise<void> {
    return invoke('set_auto_save_interval', { secs });
  },

  /**
   * Set the number of backup files to keep
   * @param count - Number of backups (1-10)
   */
  async setBackupCount(count: number): Promise<void> {
    return invoke('set_backup_count', { count });
  },

  /**
   * Start the auto-save loop
   */
  async startAutoSave(): Promise<void> {
    return invoke('start_auto_save');
  },

  /**
   * Stop the auto-save loop
   */
  async stopAutoSave(): Promise<void> {
    return invoke('stop_auto_save');
  },
};

export default projectService;
