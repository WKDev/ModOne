/**
 * NewFileDialog Component
 *
 * Modal dialog for creating a new project file (canvas, ladder, or scenario)
 * with validation for file name.
 */

import { useState, useCallback, useEffect } from 'react';
import { X, Loader2, CircuitBoard, Workflow, PlayCircle } from 'lucide-react';
import explorerService from '../../services/explorerService';
import { useExplorerStore } from '../../stores/explorerStore';
import type { FileType } from '../../services/fileDialogService';

// Validation constants
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/;
const RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
];

/**
 * File type configuration
 */
const FILE_TYPE_CONFIG: Record<FileType, {
  label: string;
  extension: string;
  icon: React.ReactNode;
  description: string;
}> = {
  canvas: {
    label: 'Canvas',
    extension: '.yaml',
    icon: <CircuitBoard size={20} className="text-[var(--color-accent)]" />,
    description: '회로 다이어그램 파일',
  },
  ladder: {
    label: 'Ladder',
    extension: '.csv',
    icon: <Workflow size={20} className="text-[var(--color-accent)]" />,
    description: '래더 로직 CSV 파일',
  },
  scenario: {
    label: 'Scenario',
    extension: '.csv',
    icon: <PlayCircle size={20} className="text-[var(--color-accent)]" />,
    description: '시나리오 테스트 CSV 파일',
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

export interface NewFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileType: FileType;
  targetDir?: string;
  onCreated?: (filePath: string) => void;
}

export function NewFileDialog({
  isOpen,
  onClose,
  fileType,
  targetDir,
  onCreated,
}: NewFileDialogProps) {
  // Form state
  const [fileName, setFileName] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileNameError, setFileNameError] = useState<string | null>(null);

  // Get refresh function from store
  const refreshFileTree = useExplorerStore((state) => state.refreshFileTree);

  // Get file type config
  const config = FILE_TYPE_CONFIG[fileType];

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFileName('');
      setError(null);
      setFileNameError(null);
    }
  }, [isOpen, fileType]);

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
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Form validation
  const nameValidation = validateFileName(fileName);
  const isFormValid = nameValidation.valid;

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Final validation before submit
      const finalValidation = validateFileName(fileName);
      if (!finalValidation.valid) {
        setFileNameError(finalValidation.error || null);
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const createdPath = await explorerService.createProjectFile(
          fileType,
          fileName.trim(),
          targetDir
        );

        // Refresh the file tree to show the new file
        await refreshFileTree();

        onCreated?.(createdPath);
        onClose();
      } catch (err) {
        const message = err instanceof Error ? err.message : '파일 생성에 실패했습니다.';
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [fileName, fileType, targetDir, onCreated, onClose, refreshFileTree]
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => !isSubmitting && onClose()}
      />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          data-testid="new-file-dialog"
          className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-xl w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              {config.icon}
              <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
                New {config.label}
              </h2>
            </div>
            <button
              data-testid="new-file-close"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1 hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* File Name */}
            <div>
              <label
                htmlFor="fileName"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
              >
                파일 이름 <span className="text-[var(--color-error)]">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="fileName"
                  data-testid="file-name-input"
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder={`my_${fileType}`}
                  disabled={isSubmitting}
                  className={`flex-1 px-3 py-2 bg-[var(--color-bg-secondary)] border rounded text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none disabled:opacity-50 ${
                    fileNameError
                      ? 'border-[var(--color-error)] focus:border-[var(--color-error)]'
                      : 'border-[var(--color-border)] focus:border-[var(--color-accent)]'
                  }`}
                  autoFocus
                />
                <span className="text-[var(--color-text-secondary)] text-sm">{config.extension}</span>
              </div>
              {fileNameError && (
                <p className="mt-1 text-xs text-[var(--color-error)]">{fileNameError}</p>
              )}
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{config.description}</p>
            </div>

            {/* Target directory info */}
            {targetDir && (
              <div className="px-3 py-2 bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border)] rounded text-xs text-[var(--color-text-secondary)]">
                <span className="text-[var(--color-text-muted)]">위치: </span>
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
                data-testid="cancel-file-btn"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] rounded disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                data-testid="create-file-btn"
                disabled={!isFormValid || isSubmitting}
                className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isSubmitting ? '생성 중...' : '생성'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default NewFileDialog;
