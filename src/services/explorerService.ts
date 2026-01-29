/**
 * Explorer Service - Tauri Command Wrappers
 *
 * This service provides type-safe wrappers around Tauri backend commands
 * for file exploration and reading operations.
 */

import { invoke } from '@tauri-apps/api/core';
import type { FileNodeResult } from '../types/fileTypes';

/**
 * Error thrown by explorer service operations.
 */
export class ExplorerServiceError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly path?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ExplorerServiceError';
  }
}

/**
 * Service for file exploration and reading operations.
 */
export const explorerService = {
  /**
   * List all files and directories in a project directory.
   *
   * @param projectRoot - Path to the project root directory
   * @returns Hierarchical file tree structure
   * @throws ExplorerServiceError if listing fails
   */
  async listProjectFiles(projectRoot: string): Promise<FileNodeResult[]> {
    try {
      return await invoke<FileNodeResult[]>('list_project_files', {
        projectRoot,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ExplorerServiceError(
        `Failed to list project files: ${message}`,
        'listProjectFiles',
        projectRoot,
        error instanceof Error ? error : undefined
      );
    }
  },

  /**
   * Read the contents of a file.
   *
   * @param path - Full path to the file
   * @returns File contents as a string
   * @throws ExplorerServiceError if reading fails
   */
  async readFileContents(path: string): Promise<string> {
    try {
      return await invoke<string>('read_file_contents', { path });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ExplorerServiceError(
        `Failed to read file: ${message}`,
        'readFileContents',
        path,
        error instanceof Error ? error : undefined
      );
    }
  },

  /**
   * Check if a file or directory exists.
   *
   * @param path - Full path to check
   * @returns True if the path exists
   */
  async pathExists(path: string): Promise<boolean> {
    try {
      return await invoke<boolean>('path_exists', { path });
    } catch {
      return false;
    }
  },

  /**
   * Get information about a file or directory.
   *
   * @param path - Full path to the file or directory
   * @returns File node information
   * @throws ExplorerServiceError if getting info fails
   */
  async getFileInfo(path: string): Promise<FileNodeResult> {
    try {
      return await invoke<FileNodeResult>('get_file_info', { path });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ExplorerServiceError(
        `Failed to get file info: ${message}`,
        'getFileInfo',
        path,
        error instanceof Error ? error : undefined
      );
    }
  },
};

export default explorerService;
