/**
 * useTagImportWithConflicts Hook
 *
 * Orchestrates the tag import workflow with conflict resolution:
 * 1. Validate import content (CSV or JSON) to detect conflicts
 * 2. If conflicts exist, present the conflict dialog to the user
 * 3. Execute the import with the user's chosen resolution strategy
 * 4. Return the import summary
 */

import { useState, useCallback } from 'react';
import { tagImportExportService } from '../services/tagImportExportService';
import type {
  ConflictResolution,
  ImportConflict,
  ImportSummary,
  CsvImportPreview,
  JsonImportPreview,
} from '../types/tagImportExport';

export type ImportFormat = 'csv' | 'json';

export interface UseTagImportWithConflictsReturn {
  /** Start the import flow — validates then imports (or shows conflict dialog). */
  startImport: (content: string, format: ImportFormat) => Promise<void>;
  /** Whether a validation or import operation is in progress. */
  isProcessing: boolean;
  /** Current conflicts awaiting user resolution (empty if none). */
  pendingConflicts: ImportConflict[];
  /** Whether the conflict dialog should be shown. */
  showConflictDialog: boolean;
  /** Handle user's conflict resolution choice. */
  resolveConflicts: (resolution: ConflictResolution) => Promise<void>;
  /** Cancel / dismiss the conflict dialog (equivalent to abort). */
  cancelConflictDialog: () => void;
  /** The most recent import result, if any. */
  lastResult: ImportSummary | null;
  /** The most recent validation preview, if any. */
  lastPreview: CsvImportPreview | JsonImportPreview | null;
  /** Error message, if any. */
  error: string | null;
  /** Clear the error state. */
  clearError: () => void;
  /** Whether the result/progress dialog should be shown. */
  showResultDialog: boolean;
  /** Dismiss the result/progress dialog and clear result/error state. */
  dismissResult: () => void;
}

export function useTagImportWithConflicts(): UseTagImportWithConflictsReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingConflicts, setPendingConflicts] = useState<ImportConflict[]>([]);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [lastResult, setLastResult] = useState<ImportSummary | null>(null);
  const [lastPreview, setLastPreview] = useState<CsvImportPreview | JsonImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  // Store pending import details for after conflict resolution
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const [pendingFormat, setPendingFormat] = useState<ImportFormat>('csv');

  const clearError = useCallback(() => setError(null), []);

  const dismissResult = useCallback(() => {
    setShowResultDialog(false);
    setLastResult(null);
    setError(null);
  }, []);

  const executeImport = useCallback(
    async (content: string, format: ImportFormat, resolution: ConflictResolution) => {
      setIsProcessing(true);
      try {
        const result =
          format === 'csv'
            ? await tagImportExportService.importTagsCsv(content, resolution)
            : await tagImportExportService.importTagsJson(content, resolution);
        setLastResult(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  const startImport = useCallback(
    async (content: string, format: ImportFormat) => {
      setError(null);
      setLastResult(null);
      setPendingConflicts([]);
      setShowConflictDialog(false);
      setShowResultDialog(true);
      setIsProcessing(true);

      try {
        // Step 1: Validate
        const preview =
          format === 'csv'
            ? await tagImportExportService.validateCsvImport(content)
            : await tagImportExportService.validateJsonImport(content);

        setLastPreview(preview);

        const allConflicts = preview.allConflicts ?? [];

        if (allConflicts.length > 0) {
          // Step 2a: Conflicts found — hide progress, show conflict dialog
          setShowResultDialog(false);
          setPendingConflicts(allConflicts);
          setPendingContent(content);
          setPendingFormat(format);
          setShowConflictDialog(true);
          setIsProcessing(false);
        } else {
          // Step 2b: No conflicts — import directly
          await executeImport(content, format, 'skip');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setIsProcessing(false);
      }
    },
    [executeImport],
  );

  const resolveConflicts = useCallback(
    async (resolution: ConflictResolution) => {
      setShowConflictDialog(false);
      setPendingConflicts([]);

      if (resolution === 'abort') {
        // User chose to cancel — nothing to do
        setPendingContent(null);
        setShowResultDialog(false);
        return;
      }

      // Show progress dialog during import execution
      setShowResultDialog(true);

      if (pendingContent) {
        try {
          await executeImport(pendingContent, pendingFormat, resolution);
        } finally {
          setPendingContent(null);
        }
      }
    },
    [pendingContent, pendingFormat, executeImport],
  );

  const cancelConflictDialog = useCallback(() => {
    setShowConflictDialog(false);
    setPendingConflicts([]);
    setPendingContent(null);
  }, []);

  return {
    startImport,
    isProcessing,
    pendingConflicts,
    showConflictDialog,
    resolveConflicts,
    cancelConflictDialog,
    lastResult,
    lastPreview,
    error,
    clearError,
    showResultDialog,
    dismissResult,
  };
}
