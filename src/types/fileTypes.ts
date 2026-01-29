/**
 * File type definitions for the Solution Explorer style file browser.
 */

import type { PanelType } from './panel';

/**
 * Categories of files recognized in the project structure.
 */
export type FileCategory =
  | 'project'     // .mop project files
  | 'canvas'      // OneCanvas circuit files (.yaml in one_canvas/)
  | 'ladder'      // Ladder logic files (.lad)
  | 'scenario'    // Scenario files (.json in scenario/)
  | 'memory-map'  // Memory map CSV files (in plc_csv/)
  | 'config'      // Configuration files (config.yml)
  | 'csv'         // Generic CSV files
  | 'unknown';    // Unrecognized file types

/**
 * Information about a file type for display and handling.
 */
export interface FileTypeInfo {
  /** Category classification for the file */
  category: FileCategory;
  /** Panel type to use when opening this file, null for special handling */
  panelType: PanelType | null;
  /** Icon name from lucide-react */
  icon: string;
  /** Tailwind color class for the icon */
  color: string;
  /** Human-readable description of the file type */
  description: string;
}

/**
 * Represents a node in the project file tree.
 */
export interface ProjectFileNode {
  /** Unique identifier for the node */
  id: string;
  /** Display name of the file or folder */
  name: string;
  /** Path relative to project root */
  path: string;
  /** Full filesystem path */
  absolutePath: string;
  /** Whether this is a file or folder */
  type: 'file' | 'folder';
  /** File type information (only for files) */
  fileInfo?: FileTypeInfo;
  /** Child nodes (only for folders) */
  children?: ProjectFileNode[];
}

/**
 * Result from the backend list_project_files command.
 */
export interface FileNodeResult {
  name: string;
  path: string;
  absolute_path: string;
  is_dir: boolean;
  children?: FileNodeResult[];
}
