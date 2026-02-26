/**
 * ImportDialog Component
 *
 * Modal dialog for importing PLC programs from external formats (XG5000 CSV).
 * Handles file selection, parsing, validation, and file saving.
 */

import { useState, useCallback, useEffect } from 'react';
import { X, Loader2, Upload, FileSpreadsheet, AlertTriangle, CheckCircle } from 'lucide-react';
import { useImportPlcProgram, type ParsePreview } from '../../hooks/useImportPlcProgram';
import type { PlcVendor } from '../../services/importService';

// Validation constants
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/;
const RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
];

const VENDOR_CONFIG: Record<PlcVendor, {
  label: string;
  description: string;
}> = {
  xg5000: {
    label: 'XG5000',
    description: 'LS Electric XG5000 래더 프로그램 CSV 파일',
  },
};

/**
 * Validates file name for filesystem compatibility
 */
function validateFileName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: '파일 이름을 입력하세요.' };
  }

  if (INVALID_FILENAME_CHARS.test(trimmed)) {
    return { valid: false, error: '파일 이름에 < > : " / \\ | ? * 문자를 사용할 수 없습니다.' };
  }

  if (RESERVED_NAMES.includes(trimmed.toUpperCase())) {
    return { valid: false, error: '시스템 예약어는 파일 이름으로 사용할 수 없습니다.' };
  }

  if (trimmed.length > 255) {
    return { valid: false, error: '파일 이름은 255자를 초과할 수 없습니다.' };
  }

  return { valid: true };
}

/**
 * Extract filename from full path
 */
function extractFileName(path: string): string {
  const parts = path.split(/[/\\]/);
  const fileName = parts[parts.length - 1] || '';
  // Remove extension
  return fileName.replace(/\.[^.]+$/, '');
}

export interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: PlcVendor;
  targetDir?: string;
  onImported?: (filePath: string) => void;
}

export function ImportDialog({
  isOpen,
  onClose,
  vendor,
  targetDir,
  onImported,
}: ImportDialogProps) {
  // Form state
  const [fileName, setFileName] = useState('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsePreview | null>(null);

  // UI state
  const [fileNameError, setFileNameError] = useState<string | null>(null);

  // Import hook
  const {
    selectFile,
    parsePreview,
    importFile,
    isImporting,
    error,
    clearError,
  } = useImportPlcProgram();

  // Get vendor config
  const config = VENDOR_CONFIG[vendor];

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFileName('');
      setSelectedFilePath(null);
      setFileContent(null);
      setPreview(null);
      setFileNameError(null);
      clearError();
    }
  }, [isOpen, vendor, clearError]);

  // Validate file name when it changes
  useEffect(() => {
    if (fileName) {
      const validation = validateFileName(fileName);
      setFileNameError(validation.valid ? null : validation.error || null);
    } else {
      setFileNameError(null);
    }
  }, [fileName]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isImporting) {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isImporting, onClose]);

  // Handle file selection
  const handleSelectFile = useCallback(async () => {
    const result = await selectFile();
    if (result) {
      setSelectedFilePath(result.path);
      setFileContent(result.content);

      // Set default filename from the selected file
      const suggestedName = extractFileName(result.path);
      setFileName(suggestedName);

      // Parse preview
      const previewResult = parsePreview(result.content, vendor);
      setPreview(previewResult);
    }
  }, [selectFile, parsePreview, vendor]);

  // Form validation
  const nameValidation = validateFileName(fileName);
  const isFormValid = nameValidation.valid && fileContent !== null && preview !== null && preview.rowCount > 0;

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!fileContent) {
        return;
      }

      // Final validation before submit
      const finalValidation = validateFileName(fileName);
      if (!finalValidation.valid) {
        setFileNameError(finalValidation.error || null);
        return;
      }

      const result = await importFile(fileContent, fileName.trim(), targetDir);

      if (result.success && result.filePath) {
        onImported?.(result.filePath);
        onClose();
      }
    },
    [fileName, fileContent, targetDir, importFile, onImported, onClose]
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => !isImporting && onClose()}
      />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          data-testid="import-dialog"
          className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <Upload size={20} className="text-[var(--color-accent)]" />
              <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
                Import from {config.label}
              </h2>
            </div>
            <button
              data-testid="import-close"
              onClick={onClose}
              disabled={isImporting}
              className="p-1 hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* File Selection */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                소스 파일 <span className="text-[var(--color-error)]">*</span>
              </label>
              <button
                type="button"
                onClick={handleSelectFile}
                disabled={isImporting}
                className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-border)] transition-colors disabled:opacity-50 text-left"
              >
                {selectedFilePath ? (
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet size={16} className="text-[var(--color-success)] flex-shrink-0" />
                    <span className="text-[var(--color-text-primary)] truncate">{selectedFilePath}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                    <Upload size={16} />
                    <span>CSV 파일 선택...</span>
                  </div>
                )}
              </button>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{config.description}</p>
            </div>

            {/* Preview */}
            {preview && (
              <div className="px-3 py-2 bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border)] rounded space-y-2">
                <div className="flex items-center gap-2">
                  {preview.rowCount > 0 ? (
                    <CheckCircle size={14} className="text-[var(--color-success)]" />
                  ) : (
                    <AlertTriangle size={14} className="text-[var(--color-warning)]" />
                  )}
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {preview.networkCount} 네트워크, {preview.rowCount} 명령어
                  </span>
                </div>
                {preview.warnings.length > 0 && (
                  <div className="text-xs text-[var(--color-warning)]">
                    {preview.warnings.map((warning, i) => (
                      <p key={i} className="flex items-center gap-1">
                        <AlertTriangle size={12} />
                        {warning}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* File Name */}
            {fileContent && (
              <div>
                <label
                  htmlFor="importFileName"
                  className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
                >
                  저장할 파일 이름 <span className="text-[var(--color-error)]">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="importFileName"
                    data-testid="import-file-name-input"
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="my_program"
                    disabled={isImporting}
                    className={`flex-1 px-3 py-2 bg-[var(--color-bg-secondary)] border rounded text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none disabled:opacity-50 ${
                      fileNameError
                        ? 'border-[var(--color-error)] focus:border-[var(--color-error)]'
                        : 'border-[var(--color-border)] focus:border-[var(--color-accent)]'
                    }`}
                    autoFocus
                  />
                  <span className="text-[var(--color-text-secondary)] text-sm">.csv</span>
                </div>
                {fileNameError && (
                  <p className="mt-1 text-xs text-[var(--color-error)]">{fileNameError}</p>
                )}
              </div>
            )}

            {/* Target directory info */}
            {targetDir && (
              <div className="px-3 py-2 bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border)] rounded text-xs text-[var(--color-text-secondary)]">
                <span className="text-[var(--color-text-muted)]">저장 위치: </span>
                <span className="font-mono">{targetDir}</span>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="px-3 py-2 bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded text-sm text-[var(--color-error)]">
                {error}
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                data-testid="cancel-import-btn"
                onClick={onClose}
                disabled={isImporting}
                className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] rounded disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                data-testid="import-btn"
                disabled={!isFormValid || isImporting}
                className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isImporting && <Loader2 size={16} className="animate-spin" />}
                {isImporting ? 'Import 중...' : 'Import'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default ImportDialog;
