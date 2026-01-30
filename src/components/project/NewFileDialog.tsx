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
    icon: <CircuitBoard size={20} className="text-blue-400" />,
    description: '회로 다이어그램 파일',
  },
  ladder: {
    label: 'Ladder',
    extension: '.csv',
    icon: <Workflow size={20} className="text-green-400" />,
    description: '래더 로직 CSV 파일',
  },
  scenario: {
    label: 'Scenario',
    extension: '.csv',
    icon: <PlayCircle size={20} className="text-purple-400" />,
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
          className="bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-600">
            <div className="flex items-center gap-2">
              {config.icon}
              <h2 className="text-lg font-medium text-gray-100">
                New {config.label}
              </h2>
            </div>
            <button
              data-testid="new-file-close"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-100 disabled:opacity-50"
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
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                파일 이름 <span className="text-red-500">*</span>
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
                  className={`flex-1 px-3 py-2 bg-gray-700 border rounded text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none disabled:opacity-50 ${
                    fileNameError
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-gray-600 focus:border-blue-500'
                  }`}
                  autoFocus
                />
                <span className="text-gray-400 text-sm">{config.extension}</span>
              </div>
              {fileNameError && (
                <p className="mt-1 text-xs text-red-500">{fileNameError}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">{config.description}</p>
            </div>

            {/* Target directory info */}
            {targetDir && (
              <div className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded text-xs text-gray-400">
                <span className="text-gray-500">위치: </span>
                <span className="font-mono">{targetDir}</span>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-500">
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
                className="px-4 py-2 text-sm text-gray-400 hover:bg-gray-700 rounded disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                data-testid="create-file-btn"
                disabled={!isFormValid || isSubmitting}
                className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
