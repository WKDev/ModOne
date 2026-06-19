/**
 * Tag Import/Export Type Definitions
 *
 * Types for CSV and JSON tag import, CSV/JSON/NodeSet2 XML export,
 * conflict resolution, and import preview results.
 */

// ============================================================================
// Conflict Resolution
// ============================================================================

/** How to handle conflicts when an imported tag ID already exists. */
export type ConflictResolution = 'overwrite' | 'skip' | 'abort';

// ============================================================================
// Import Results
// ============================================================================

/** Status of a single tag import attempt. */
export type TagImportStatus = 'created' | 'overwritten' | 'skipped' | 'failed';

/** Result of importing a single tag. */
export interface TagImportResult {
  tagId: string;
  status: TagImportStatus;
  error?: string;
}

/** Describes a conflict found during import validation. */
export interface ImportConflict {
  /** The tag ID involved in the conflict. */
  tagId: string;
  /** Type: "duplicateTagId", "duplicateAddress", "internalDuplicateTagId", or "internalDuplicateAddress". */
  conflictType: string;
  /** Human-readable description. */
  message: string;
}

/** Summary of an import operation. */
export interface ImportSummary {
  totalRows: number;
  created: number;
  overwritten: number;
  skipped: number;
  failed: number;
  results: TagImportResult[];
  /** Conflicts detected during import (tagId and deviceAddress, internal and registry). */
  conflicts?: ImportConflict[];
}

// ============================================================================
// CSV Import Preview
// ============================================================================

export interface CsvImportError {
  tagId: string;
  error: string;
}

export interface CsvImportPreview {
  totalRows: number;
  newTags: string[];
  /** Backward-compatible: tag IDs conflicting with existing registry entries. */
  conflicts: string[];
  /** Detailed conflict info including tagId and deviceAddress conflicts. */
  allConflicts: ImportConflict[];
  errors: CsvImportError[];
}

// ============================================================================
// JSON Import Preview
// ============================================================================

export interface JsonImportPreview {
  totalTags: number;
  newTags: string[];
  /** Backward-compatible: tag IDs conflicting with existing registry entries. */
  conflicts: string[];
  /** Detailed conflict info including tagId and deviceAddress conflicts. */
  allConflicts: ImportConflict[];
  errors: CsvImportError[];
}

// ============================================================================
// JSON Import Tree Structure
// ============================================================================

/**
 * A tag leaf node in the JSON import tree.
 * Must contain `tagId` and `deviceAddress`; all other fields are optional.
 */
export interface JsonTagLeaf {
  tagId: string;
  deviceAddress: string;
  displayName?: string;
  access?: 'read' | 'readwrite';
  description?: string;
  engineeringUnit?: string;
  /** Explicit folder path override. When absent, derived from tree nesting. */
  folderPath?: string;
}

/**
 * A JSON import tree node.
 * Either a folder (containing child nodes) or a tag leaf.
 */
export type JsonImportNode = JsonTagLeaf | { [folderName: string]: JsonImportNode };

// ============================================================================
// JSON Export Tree Structure
// ============================================================================

/**
 * A tag leaf in the JSON export tree, containing all fields plus OPC UA mapping data.
 */
export interface JsonExportTagLeaf {
  tagId: string;
  deviceAddress: string;
  displayName: string;
  class: 'raw' | 'semantic';
  access: 'read' | 'readwrite';
  description?: string;
  engineeringUnit?: string;
  folderPath?: string;
  opcuaDataType: string;
  opcuaWordCount: number;
  opcuaByteOrder: string;
  opcuaAccessLevel: string;
}

/**
 * A JSON export tree node.
 * Either a folder (containing child nodes) or an exported tag leaf.
 */
export type JsonExportNode = JsonExportTagLeaf | { [folderName: string]: JsonExportNode };

// ============================================================================
// Export Parameters & Result
// ============================================================================

/**
 * Parameters for export commands.
 * All fields are optional — sensible defaults apply when omitted.
 */
export interface ExportParams {
  /** Optional list of tag IDs to export. When omitted or empty, all tags are exported. */
  tagIds?: string[];
  /** (CSV only) Whether to include the header row. Defaults to true. */
  includeHeader?: boolean;
  /** (JSON only) Whether to pretty-print the output. Defaults to true. */
  pretty?: boolean;
}

/** Successful export result returned from the backend. */
export interface ExportResult {
  /** The exported content string (CSV, JSON, or XML). */
  content: string;
  /** Number of tags included in the export. */
  tagCount: number;
  /** The export format used: "csv", "json", or "nodeset2". */
  format: 'csv' | 'json' | 'nodeset2';
}
