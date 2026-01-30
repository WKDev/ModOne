/**
 * File Type Resolver
 *
 * Resolves file paths to their appropriate file types, panel types, and icons.
 * Uses both file extension and parent directory context for accurate categorization.
 */

import type { FileTypeInfo } from '../types/fileTypes';

/**
 * Default file type info for unknown files.
 */
const UNKNOWN_FILE_TYPE: FileTypeInfo = {
  category: 'unknown',
  panelType: null,
  icon: 'File',
  color: 'text-gray-400',
  description: 'Unknown file',
};

/**
 * File type definitions by extension and context.
 */
const FILE_TYPE_MAP: Record<string, FileTypeInfo> = {
  // Project files
  '.mop': {
    category: 'project',
    panelType: null, // Special handling - opens project
    icon: 'FolderKanban',
    color: 'text-purple-500',
    description: 'ModOne Project',
  },

  // Ladder logic files
  '.lad': {
    category: 'ladder',
    panelType: 'ladder-editor',
    icon: 'Workflow',
    color: 'text-blue-500',
    description: 'Ladder Logic Program',
  },

  // Config files
  'config.yml': {
    category: 'config',
    panelType: 'properties',
    icon: 'Settings',
    color: 'text-green-500',
    description: 'Project Configuration',
  },
  'config.yaml': {
    category: 'config',
    panelType: 'properties',
    icon: 'Settings',
    color: 'text-green-500',
    description: 'Project Configuration',
  },

  // Generic YAML - will be overridden by context
  '.yaml': {
    category: 'unknown',
    panelType: null,
    icon: 'FileCode',
    color: 'text-yellow-500',
    description: 'YAML File',
  },
  '.yml': {
    category: 'unknown',
    panelType: null,
    icon: 'FileCode',
    color: 'text-yellow-500',
    description: 'YAML File',
  },

  // Generic JSON - will be overridden by context
  '.json': {
    category: 'unknown',
    panelType: null,
    icon: 'FileJson',
    color: 'text-orange-500',
    description: 'JSON File',
  },

  // CSV files
  '.csv': {
    category: 'csv',
    panelType: 'csv-viewer',
    icon: 'Table',
    color: 'text-emerald-500',
    description: 'CSV Data File',
  },
};

/**
 * Context-aware file type overrides based on parent directory.
 */
const CONTEXT_OVERRIDES: Record<string, Partial<FileTypeInfo>> = {
  // Files in canvas directory (v2.0 folder-based projects)
  'canvas/.yaml': {
    category: 'canvas',
    panelType: 'one-canvas',
    icon: 'CircuitBoard',
    color: 'text-cyan-500',
    description: 'Circuit Canvas',
  },
  'canvas/.yml': {
    category: 'canvas',
    panelType: 'one-canvas',
    icon: 'CircuitBoard',
    color: 'text-cyan-500',
    description: 'Circuit Canvas',
  },

  // Files in one_canvas directory (legacy projects)
  'one_canvas/.yaml': {
    category: 'canvas',
    panelType: 'one-canvas',
    icon: 'CircuitBoard',
    color: 'text-cyan-500',
    description: 'Circuit Canvas',
  },
  'one_canvas/.yml': {
    category: 'canvas',
    panelType: 'one-canvas',
    icon: 'CircuitBoard',
    color: 'text-cyan-500',
    description: 'Circuit Canvas',
  },

  // Files in scenario directory
  'scenario/.json': {
    category: 'scenario',
    panelType: 'scenario-editor',
    icon: 'PlayCircle',
    color: 'text-pink-500',
    description: 'Test Scenario',
  },
  'scenario/.csv': {
    category: 'scenario',
    panelType: 'scenario-editor',
    icon: 'PlayCircle',
    color: 'text-pink-500',
    description: 'Test Scenario',
  },

  // Files in ladder directory (v2.0 folder-based projects)
  'ladder/.csv': {
    category: 'ladder',
    panelType: 'ladder-editor',
    icon: 'Workflow',
    color: 'text-blue-500',
    description: 'Ladder Logic Program',
  },

  // Files in plc_csv directory (legacy projects)
  'plc_csv/.csv': {
    category: 'memory-map',
    panelType: 'csv-viewer',
    icon: 'Database',
    color: 'text-violet-500',
    description: 'Memory Map Data',
  },
};

/**
 * Folder icons by name.
 */
export const FOLDER_ICONS: Record<string, { icon: string; color: string }> = {
  // v2.0 folder-based project directories
  canvas: { icon: 'CircuitBoard', color: 'text-cyan-500' },
  ladder: { icon: 'Workflow', color: 'text-blue-500' },
  scenario: { icon: 'PlayCircle', color: 'text-pink-500' },
  // Legacy project directories
  one_canvas: { icon: 'CircuitBoard', color: 'text-cyan-500' },
  plc_csv: { icon: 'Database', color: 'text-violet-500' },
};

/**
 * Normalize path separators to forward slashes.
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Get the file extension from a path.
 */
function getExtension(path: string): string {
  const normalized = normalizePath(path);
  const filename = normalized.split('/').pop() || '';
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex > 0 ? filename.substring(dotIndex).toLowerCase() : '';
}

/**
 * Get the filename from a path.
 */
function getFilename(path: string): string {
  const normalized = normalizePath(path);
  return normalized.split('/').pop() || '';
}

/**
 * Get the parent directory name from a path.
 */
function getParentDir(path: string): string {
  const normalized = normalizePath(path);
  const parts = normalized.split('/');
  return parts.length >= 2 ? parts[parts.length - 2] : '';
}

/**
 * Resolve a file path to its file type information.
 *
 * @param path - The file path (relative or absolute)
 * @returns File type information including category, panel type, icon, and color
 */
export function resolveFileType(path: string): FileTypeInfo {
  const normalized = normalizePath(path);
  const filename = getFilename(normalized).toLowerCase();
  const extension = getExtension(normalized);
  const parentDir = getParentDir(normalized);

  // Check for exact filename matches first (e.g., config.yml)
  if (FILE_TYPE_MAP[filename]) {
    return FILE_TYPE_MAP[filename];
  }

  // Check for context-aware overrides
  const contextKey = `${parentDir}/${extension}`;
  if (CONTEXT_OVERRIDES[contextKey]) {
    const base = FILE_TYPE_MAP[extension] || UNKNOWN_FILE_TYPE;
    return { ...base, ...CONTEXT_OVERRIDES[contextKey] };
  }

  // Check for extension-based type
  if (extension && FILE_TYPE_MAP[extension]) {
    return FILE_TYPE_MAP[extension];
  }

  return UNKNOWN_FILE_TYPE;
}

/**
 * Get the icon configuration for a folder.
 *
 * @param folderName - Name of the folder
 * @returns Icon and color configuration
 */
export function getFolderIcon(folderName: string): { icon: string; color: string } {
  const lowerName = folderName.toLowerCase();
  return FOLDER_ICONS[lowerName] || { icon: 'Folder', color: 'text-yellow-500' };
}

/**
 * Check if a file should be opened in an editor panel.
 *
 * @param fileInfo - File type information
 * @returns True if the file should open in an editor panel
 */
export function canOpenInEditor(fileInfo: FileTypeInfo): boolean {
  return fileInfo.panelType !== null;
}

/**
 * Check if a file is a project file that should trigger project opening.
 *
 * @param fileInfo - File type information
 * @returns True if the file is a project file
 */
export function isProjectFile(fileInfo: FileTypeInfo): boolean {
  return fileInfo.category === 'project';
}

/**
 * Get the default tab title for a file.
 *
 * @param path - The file path
 * @returns A suitable tab title
 */
export function getTabTitle(path: string): string {
  return getFilename(path);
}
