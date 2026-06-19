/**
 * Tag Import/Export Service - Tauri Command Wrappers
 *
 * Provides type-safe wrappers around Tauri backend commands
 * for importing tags from CSV/JSON and exporting to CSV/JSON/NodeSet2 XML.
 */

import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import type {
  ConflictResolution,
  CsvImportPreview,
  ExportParams,
  ExportResult,
  ImportSummary,
  JsonImportPreview,
} from '../types/tagImportExport';

export const tagImportExportService = {
  // ==========================================================================
  // CSV Import
  // ==========================================================================

  /** Import tags from CSV content with conflict resolution. */
  async importTagsCsv(
    csvContent: string,
    conflictResolution: ConflictResolution,
  ): Promise<ImportSummary> {
    try {
      return await invoke<ImportSummary>('import_tags_csv', {
        csvContent,
        conflictResolution,
      });
    } catch (error) {
      toast.error('CSV 태그 가져오기 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /** Validate CSV content and preview what would be imported. */
  async validateCsvImport(csvContent: string): Promise<CsvImportPreview> {
    try {
      return await invoke<CsvImportPreview>('validate_csv_import', {
        csvContent,
      });
    } catch (error) {
      toast.error('CSV 유효성 검사 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  // ==========================================================================
  // JSON Import
  // ==========================================================================

  /**
   * Import tags from a JSON nested object tree.
   *
   * The JSON uses a hierarchical structure where parent objects represent
   * folders in the OPC UA Address Space, and leaf objects (containing `tagId`
   * and `deviceAddress`) represent tags.
   *
   * Example input:
   * ```json
   * {
   *   "Plant": {
   *     "Area1": {
   *       "Motors": {
   *         "motor_run": { "tagId": "motor_run", "deviceAddress": "OutputBit:0" }
   *       }
   *     }
   *   }
   * }
   * ```
   */
  async importTagsJson(
    jsonContent: string,
    conflictResolution: ConflictResolution,
  ): Promise<ImportSummary> {
    try {
      return await invoke<ImportSummary>('import_tags_json', {
        jsonContent,
        conflictResolution,
      });
    } catch (error) {
      toast.error('JSON 태그 가져오기 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /** Validate JSON content and preview what would be imported. */
  async validateJsonImport(jsonContent: string): Promise<JsonImportPreview> {
    try {
      return await invoke<JsonImportPreview>('validate_json_import', {
        jsonContent,
      });
    } catch (error) {
      toast.error('JSON 유효성 검사 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  // ==========================================================================
  // CSV Export
  // ==========================================================================

  /**
   * Export tags as CSV content with full field set and OPC UA mapping data.
   *
   * @param params - Optional export parameters (tag selection, includeHeader).
   *                 When omitted, all tags are exported with headers.
   */
  async exportTagsCsv(params?: ExportParams): Promise<ExportResult> {
    try {
      return await invoke<ExportResult>('export_tags_csv', { params: params ?? null });
    } catch (error) {
      toast.error('CSV 태그 내보내기 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  // ==========================================================================
  // JSON Export
  // ==========================================================================

  /**
   * Export tags as a JSON nested folder tree structure.
   *
   * @param params - Optional export parameters (tag selection, pretty-print).
   *                 When omitted, all tags are exported with pretty-printing.
   */
  async exportTagsJson(params?: ExportParams): Promise<ExportResult> {
    try {
      return await invoke<ExportResult>('export_tags_json', { params: params ?? null });
    } catch (error) {
      toast.error('JSON 태그 내보내기 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  // ==========================================================================
  // NodeSet2 XML Export
  // ==========================================================================

  /**
   * Export tags as OPC UA NodeSet2 XML content.
   *
   * @param params - Optional export parameters (tag selection).
   *                 When omitted, all tags are exported.
   */
  async exportTagsNodeset2(params?: ExportParams): Promise<ExportResult> {
    try {
      return await invoke<ExportResult>('export_tags_nodeset2', { params: params ?? null });
    } catch (error) {
      toast.error('NodeSet2 XML 태그 내보내기 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};

export default tagImportExportService;
