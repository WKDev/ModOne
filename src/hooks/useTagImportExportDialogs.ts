/**
 * useTagImportExportDialogs Hook
 *
 * Integrates Tauri file open/save dialogs with the tag import/export service.
 * Handles:
 * - Import: file open dialog → read file → pass content to backend
 * - Export: backend generates content → save dialog → write file to disk
 *
 * Each export format uses the correct file extension, filter name, and
 * default filename pattern.
 */

import { useState, useCallback } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { toast } from 'sonner';
import { tagImportExportService } from '../services/tagImportExportService';
import type { ExportParams, ExportResult } from '../types/tagImportExport';

// ============================================================================
// Types
// ============================================================================

export type ExportFormat = 'csv' | 'json' | 'nodeset2';
export type ImportFormat = 'csv' | 'json';

/** Configuration for each export format's file dialog */
interface ExportFormatConfig {
  /** Display name for the file filter */
  filterName: string;
  /** Allowed file extensions */
  extensions: string[];
  /** Default filename (without extension) prefix */
  defaultPrefix: string;
  /** File extension to append */
  defaultExtension: string;
  /** Dialog title */
  dialogTitle: string;
  /** MIME type description for toast messages */
  mimeLabel: string;
}

/** Configuration for each import format's file dialog */
interface ImportFormatConfig {
  /** Display name for the file filter */
  filterName: string;
  /** Allowed file extensions */
  extensions: string[];
  /** Dialog title */
  dialogTitle: string;
}

export interface UseTagImportExportDialogsReturn {
  /**
   * Open file dialog for importing tags.
   * Returns the file content and detected format, or null if cancelled.
   */
  openImportDialog: (format: ImportFormat) => Promise<{ content: string; format: ImportFormat } | null>;

  /**
   * Export tags and open save dialog to write to disk.
   * Returns true if the file was saved successfully.
   */
  exportWithSaveDialog: (format: ExportFormat, params?: ExportParams) => Promise<boolean>;

  /** Whether a file dialog or I/O operation is in progress */
  isDialogOpen: boolean;

  /** Last export result (for post-export UI feedback) */
  lastExportResult: ExportResult | null;

  /** Current error, if any */
  error: string | null;

  /** Clear the error state */
  clearError: () => void;
}

// ============================================================================
// Format Configurations
// ============================================================================

const EXPORT_FORMATS: Record<ExportFormat, ExportFormatConfig> = {
  csv: {
    filterName: 'CSV 파일',
    extensions: ['csv'],
    defaultPrefix: 'tags_export',
    defaultExtension: 'csv',
    dialogTitle: '태그 내보내기 (CSV)',
    mimeLabel: 'CSV',
  },
  json: {
    filterName: 'JSON 파일',
    extensions: ['json'],
    defaultPrefix: 'tags_export',
    defaultExtension: 'json',
    dialogTitle: '태그 내보내기 (JSON)',
    mimeLabel: 'JSON',
  },
  nodeset2: {
    filterName: 'OPC UA NodeSet2 XML',
    extensions: ['xml'],
    defaultPrefix: 'tags_nodeset2',
    defaultExtension: 'xml',
    dialogTitle: '태그 내보내기 (NodeSet2 XML)',
    mimeLabel: 'NodeSet2 XML',
  },
};

const IMPORT_FORMATS: Record<ImportFormat, ImportFormatConfig> = {
  csv: {
    filterName: 'CSV 파일',
    extensions: ['csv'],
    dialogTitle: '태그 가져오기 (CSV)',
  },
  json: {
    filterName: 'JSON 파일',
    extensions: ['json'],
    dialogTitle: '태그 가져오기 (JSON)',
  },
};

// ============================================================================
// Helpers
// ============================================================================

/** Generate a timestamped default filename for exports */
function generateDefaultFilename(prefix: string, extension: string): string {
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '_',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join('');
  return `${prefix}_${timestamp}.${extension}`;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useTagImportExportDialogs(): UseTagImportExportDialogsReturn {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [lastExportResult, setLastExportResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // --------------------------------------------------------------------------
  // Import: Open file dialog → read content
  // --------------------------------------------------------------------------
  const openImportDialog = useCallback(
    async (format: ImportFormat): Promise<{ content: string; format: ImportFormat } | null> => {
      const config = IMPORT_FORMATS[format];

      setIsDialogOpen(true);
      setError(null);

      try {
        const selected = await open({
          multiple: false,
          filters: [
            {
              name: config.filterName,
              extensions: config.extensions,
            },
          ],
          title: config.dialogTitle,
        });

        if (!selected) {
          // User cancelled the dialog
          return null;
        }

        const filePath = selected as string;
        const content = await readTextFile(filePath);

        return { content, format };
      } catch (err) {
        const message = err instanceof Error ? err.message : '파일을 읽을 수 없습니다';
        setError(message);
        toast.error('파일 열기 실패', { description: message });
        return null;
      } finally {
        setIsDialogOpen(false);
      }
    },
    [],
  );

  // --------------------------------------------------------------------------
  // Export: Generate content → save dialog → write file
  // --------------------------------------------------------------------------
  const exportWithSaveDialog = useCallback(
    async (format: ExportFormat, params?: ExportParams): Promise<boolean> => {
      const config = EXPORT_FORMATS[format];

      setIsDialogOpen(true);
      setError(null);
      setLastExportResult(null);

      try {
        // Step 1: Generate export content from backend
        let exportResult: ExportResult;

        switch (format) {
          case 'csv':
            exportResult = await tagImportExportService.exportTagsCsv(params);
            break;
          case 'json':
            exportResult = await tagImportExportService.exportTagsJson(params);
            break;
          case 'nodeset2':
            exportResult = await tagImportExportService.exportTagsNodeset2(params);
            break;
        }

        if (exportResult.tagCount === 0) {
          toast.warning('내보낼 태그가 없습니다', {
            description: '태그 레지스트리가 비어 있습니다.',
          });
          return false;
        }

        // Step 2: Show save dialog
        const defaultFilename = generateDefaultFilename(
          config.defaultPrefix,
          config.defaultExtension,
        );

        const savePath = await save({
          filters: [
            {
              name: config.filterName,
              extensions: config.extensions,
            },
          ],
          defaultPath: defaultFilename,
          title: config.dialogTitle,
        });

        if (!savePath) {
          // User cancelled the save dialog
          return false;
        }

        // Step 3: Write content to selected file path
        await writeTextFile(savePath, exportResult.content);

        // Step 4: Success feedback
        setLastExportResult(exportResult);
        toast.success(`${config.mimeLabel} 내보내기 완료`, {
          description: `${exportResult.tagCount}개 태그를 저장했습니다.`,
        });

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : '내보내기에 실패했습니다';
        setError(message);
        // Note: tagImportExportService methods already show error toasts,
        // so we only toast here for file I/O errors not already covered
        return false;
      } finally {
        setIsDialogOpen(false);
      }
    },
    [],
  );

  return {
    openImportDialog,
    exportWithSaveDialog,
    isDialogOpen,
    lastExportResult,
    error,
    clearError,
  };
}

export default useTagImportExportDialogs;
