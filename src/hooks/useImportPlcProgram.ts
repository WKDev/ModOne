/**
 * useImportPlcProgram Hook
 *
 * Encapsulates the logic for importing PLC programs from external formats.
 * Currently supports XG5000 CSV format.
 */

import { useState, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { CsvReader } from '../components/OneParser/CsvReader';
import { useExplorerStore } from '../stores/explorerStore';
import { useProjectStore } from '../stores/projectStore';
import type { PlcVendor } from '../services/importService';

export interface ImportResult {
  success: boolean;
  filePath?: string;
  networkCount?: number;
  rowCount?: number;
  error?: string;
}

export interface ParsePreview {
  networkCount: number;
  rowCount: number;
  warnings: string[];
}

export interface UseImportPlcProgramReturn {
  /** Select and parse a CSV file for preview */
  selectFile: () => Promise<{ path: string; content: string } | null>;
  /** Parse CSV content for preview */
  parsePreview: (content: string, vendor: PlcVendor) => ParsePreview;
  /** Import the file to the target directory */
  importFile: (
    content: string,
    fileName: string,
    targetDir?: string
  ) => Promise<ImportResult>;
  /** Whether an import operation is in progress */
  isImporting: boolean;
  /** Current error message if any */
  error: string | null;
  /** Clear the error */
  clearError: () => void;
}

/**
 * Hook for importing PLC programs from external formats
 */
export function useImportPlcProgram(): UseImportPlcProgramReturn {
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFileTree = useExplorerStore((state) => state.refreshFileTree);
  const currentProjectPath = useProjectStore((state) => state.currentProjectPath);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Open file dialog to select a CSV file
   */
  const selectFile = useCallback(async (): Promise<{
    path: string;
    content: string;
  } | null> => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'XG5000 CSV',
            extensions: ['csv'],
          },
        ],
      });

      if (!selected) {
        return null;
      }

      const filePath = selected as string;
      const content = await readTextFile(filePath);

      return { path: filePath, content };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read file';
      setError(message);
      return null;
    }
  }, []);

  /**
   * Parse CSV content and return preview information
   */
  const parsePreview = useCallback(
    (content: string, vendor: PlcVendor): ParsePreview => {
      const warnings: string[] = [];

      if (vendor !== 'xg5000') {
        return {
          networkCount: 0,
          rowCount: 0,
          warnings: [`Unsupported vendor: ${vendor}`],
        };
      }

      try {
        const reader = new CsvReader(content);
        const rows = reader.readAllRows();
        const grouped = reader.groupByStep(rows);

        // Count networks (unique step numbers)
        const networkCount = grouped.size;

        // Validate data
        if (rows.length === 0) {
          warnings.push('No valid data rows found');
        }

        // Check for empty instructions
        const emptyInstructions = rows.filter((r) => !r.instruction).length;
        if (emptyInstructions > 0) {
          warnings.push(`${emptyInstructions} rows with empty instructions`);
        }

        return {
          networkCount,
          rowCount: rows.length,
          warnings,
        };
      } catch (err) {
        return {
          networkCount: 0,
          rowCount: 0,
          warnings: [
            err instanceof Error ? err.message : 'Failed to parse CSV',
          ],
        };
      }
    },
    []
  );

  /**
   * Import the CSV file to the target directory
   */
  const importFile = useCallback(
    async (
      content: string,
      fileName: string,
      targetDir?: string
    ): Promise<ImportResult> => {
      if (!currentProjectPath) {
        return {
          success: false,
          error: 'No project is open',
        };
      }

      setIsImporting(true);
      setError(null);

      try {
        // Validate content first
        const reader = new CsvReader(content);
        const rows = reader.readAllRows();

        if (rows.length === 0) {
          throw new Error('No valid data found in CSV');
        }

        const grouped = reader.groupByStep(rows);

        // Determine target directory
        const baseDir = targetDir || (await join(currentProjectPath, 'ladder'));

        // Ensure filename has .csv extension
        const fullFileName = fileName.endsWith('.csv')
          ? fileName
          : `${fileName}.csv`;

        // Build full path
        const filePath = await join(baseDir, fullFileName);

        // Write the CSV file
        await writeTextFile(filePath, content);

        // Refresh file tree
        await refreshFileTree();

        return {
          success: true,
          filePath,
          networkCount: grouped.size,
          rowCount: rows.length,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to import file';
        setError(message);
        return {
          success: false,
          error: message,
        };
      } finally {
        setIsImporting(false);
      }
    },
    [currentProjectPath, refreshFileTree]
  );

  return {
    selectFile,
    parsePreview,
    importFile,
    isImporting,
    error,
    clearError,
  };
}

export default useImportPlcProgram;
