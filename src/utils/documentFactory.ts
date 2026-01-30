/**
 * Document Factory Utilities
 *
 * Utilities for creating documents from file paths and determining document types.
 */

import type { DocumentType } from '../types/document';
import type { FileTypeInfo } from '../types/fileTypes';
import { resolveFileType } from './fileTypeResolver';

// ============================================================================
// Document Type Resolution
// ============================================================================

/** File extensions that support document-based editing */
const DOCUMENT_EXTENSIONS: Record<string, DocumentType> = {
  // Canvas files
  '.ocanvas': 'canvas',
  '.canvas': 'canvas',
  '.yaml': 'canvas', // Legacy support for YAML circuit files
  '.yml': 'canvas',

  // Ladder files
  '.ladder': 'ladder',
  '.lad': 'ladder',
  '.oll': 'ladder', // OneLadder Logic

  // Scenario files
  '.scenario': 'scenario',
  '.scn': 'scenario',
};

/**
 * Get document type from file path.
 *
 * @param filePath - Full file path
 * @returns Document type, or null if not a supported document type
 */
export function getDocumentTypeFromPath(filePath: string): DocumentType | null {
  const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');

  // Check by extension
  const ext = getFileExtension(normalizedPath);
  if (ext && DOCUMENT_EXTENSIONS[ext]) {
    return DOCUMENT_EXTENSIONS[ext];
  }

  // Check by directory structure within project
  if (normalizedPath.includes('/canvas/')) {
    return 'canvas';
  }
  if (normalizedPath.includes('/ladder/')) {
    return 'ladder';
  }
  if (normalizedPath.includes('/scenarios/')) {
    return 'scenario';
  }

  return null;
}

/**
 * Get document type from FileTypeInfo.
 *
 * @param fileTypeInfo - File type info from resolver
 * @returns Document type, or null if not a supported document type
 */
export function getDocumentTypeFromFileType(fileTypeInfo: FileTypeInfo): DocumentType | null {
  switch (fileTypeInfo.category) {
    case 'canvas':
      return 'canvas';
    case 'ladder':
      return 'ladder';
    case 'scenario':
      return 'scenario';
    default:
      return null;
  }
}

/**
 * Check if a file path supports document-based editing.
 *
 * @param filePath - Full file path
 * @returns true if the file type supports documents
 */
export function isDocumentSupportedFile(filePath: string): boolean {
  return getDocumentTypeFromPath(filePath) !== null;
}

// ============================================================================
// File Name Utilities
// ============================================================================

/**
 * Get file extension from path (lowercase, with dot).
 *
 * @param filePath - File path
 * @returns Extension like ".txt" or empty string if no extension
 */
export function getFileExtension(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const fileName = normalizedPath.split('/').pop() || '';
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === 0) return '';
  return fileName.substring(dotIndex).toLowerCase();
}

/**
 * Get file name from path without extension.
 *
 * @param filePath - File path
 * @returns File name without extension
 */
export function getFileNameWithoutExtension(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const fileName = normalizedPath.split('/').pop() || '';
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === 0) return fileName;
  return fileName.substring(0, dotIndex);
}

/**
 * Get file name from path (with extension).
 *
 * @param filePath - File path
 * @returns File name with extension
 */
export function getFileName(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.split('/').pop() || '';
}

/**
 * Get directory path from file path.
 *
 * @param filePath - File path
 * @returns Directory path (without trailing slash)
 */
export function getDirectoryPath(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const lastSlash = normalizedPath.lastIndexOf('/');
  return lastSlash === -1 ? '' : normalizedPath.substring(0, lastSlash);
}

// ============================================================================
// Document Creation Helpers
// ============================================================================

/**
 * Create initial document title from file path.
 *
 * @param filePath - File path
 * @returns Title suitable for tab display
 */
export function createDocumentTitle(filePath: string): string {
  return getFileNameWithoutExtension(filePath) || 'Untitled';
}

/**
 * Determine if a file should open in document mode.
 *
 * Some files (like config files, text files) should open in simple viewers
 * rather than document-based editors.
 *
 * @param filePath - File path
 * @returns true if file should use document-based editing
 */
export function shouldUseDocumentMode(filePath: string): boolean {
  const fileTypeInfo = resolveFileType(filePath);

  // Only certain file categories support document mode
  const documentCategories = ['canvas', 'ladder', 'scenario'];
  return documentCategories.includes(fileTypeInfo.category);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate file path for document creation.
 *
 * @param filePath - File path to validate
 * @returns Error message if invalid, null if valid
 */
export function validateDocumentFilePath(filePath: string): string | null {
  if (!filePath || filePath.trim() === '') {
    return 'File path is required';
  }

  const docType = getDocumentTypeFromPath(filePath);
  if (!docType) {
    const ext = getFileExtension(filePath);
    return `Unsupported file type: ${ext || 'unknown'}`;
  }

  return null;
}
