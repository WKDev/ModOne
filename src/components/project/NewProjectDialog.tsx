/**
 * NewProjectDialog Component
 *
 * Modal dialog for creating a new project with form inputs for
 * project name, save path, PLC manufacturer, and model.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, FolderOpen, Loader2 } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { documentDir, join } from '@tauri-apps/api/path';
import { readDir, exists } from '@tauri-apps/plugin-fs';
import { useProject } from '../../hooks/useProject';
import type { PlcManufacturer, ProjectInfo } from '../../types/project';

// Validation constants
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/;
const RESERVED_NAMES = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];

/**
 * Validates project name for filesystem compatibility
 */
function validateProjectName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: '프로젝트 이름을 입력하세요.' };
  }

  if (INVALID_FILENAME_CHARS.test(trimmed)) {
    return { valid: false, error: '프로젝트 이름에 < > : " / \\ | ? * 문자를 사용할 수 없습니다.' };
  }

  if (RESERVED_NAMES.includes(trimmed.toUpperCase())) {
    return { valid: false, error: '시스템 예약어는 프로젝트 이름으로 사용할 수 없습니다.' };
  }

  if (trimmed.length > 255) {
    return { valid: false, error: '프로젝트 이름은 255자를 초과할 수 없습니다.' };
  }

  return { valid: true };
}

/**
 * Validates save path format
 */
function validateSavePath(path: string): { valid: boolean; error?: string } {
  if (!path.trim()) {
    return { valid: false, error: '저장 위치를 선택하세요.' };
  }

  // Windows absolute path check (C:\... or /...)
  const isAbsolutePath = /^[a-zA-Z]:[/\\]/.test(path) || path.startsWith('/');
  if (!isAbsolutePath) {
    return { valid: false, error: '올바른 폴더 경로를 입력하세요.' };
  }

  return { valid: true };
}

/**
 * Gets the next available project number by scanning existing ModOneProject folders
 */
async function getNextProjectNumber(basePath: string): Promise<number> {
  try {
    const entries = await readDir(basePath);
    const projectPattern = /^ModOneProject(\d+)$/;

    let maxNumber = 0;
    for (const entry of entries) {
      if (entry.isDirectory) {
        const match = entry.name.match(projectPattern);
        if (match) {
          maxNumber = Math.max(maxNumber, parseInt(match[1], 10));
        }
      }
    }
    return maxNumber + 1;
  } catch {
    // Directory doesn't exist or can't be read, start from 1
    return 1;
  }
}

interface NewProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (info: ProjectInfo) => void;
}

const PLC_MANUFACTURERS: { value: PlcManufacturer; label: string }[] = [
  { value: 'LS', label: 'LS Electric' },
  { value: 'Mitsubishi', label: 'Mitsubishi Electric' },
  { value: 'Siemens', label: 'Siemens' },
];

export function NewProjectDialog({ isOpen, onClose, onCreated }: NewProjectDialogProps) {
  // Form state
  const [projectName, setProjectName] = useState('');
  const [savePath, setSavePath] = useState('');
  const [plcManufacturer, setPlcManufacturer] = useState<PlcManufacturer>('LS');
  const [plcModel, setPlcModel] = useState('');
  const [scanTimeMs, setScanTimeMs] = useState(10);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation error states
  const [projectNameError, setProjectNameError] = useState<string | null>(null);
  const [savePathError, setSavePathError] = useState<string | null>(null);

  // Track if user manually selected a path (don't override with auto-path)
  const userSelectedPath = useRef(false);
  // Cache the base ModOne directory path
  const modOneBasePath = useRef<string | null>(null);

  const { createProject } = useProject();

  // Initialize base path and set default save path when dialog opens
  useEffect(() => {
    const initDialog = async () => {
      if (!isOpen) return;

      // Reset form
      setPlcManufacturer('LS');
      setPlcModel('');
      setScanTimeMs(10);
      setError(null);
      setProjectNameError(null);
      setSavePathError(null);
      userSelectedPath.current = false;

      // Initialize base path if not already set
      if (!modOneBasePath.current) {
        try {
          const docPath = await documentDir();
          modOneBasePath.current = await join(docPath, 'ModOne');
          console.log('ModOne base path initialized:', modOneBasePath.current);
        } catch (err) {
          console.error('Failed to get documents directory:', err);
          // Fallback: leave modOneBasePath as null, user must browse
        }
      }

      // Generate default project name
      if (modOneBasePath.current) {
        try {
          const nextNumber = await getNextProjectNumber(modOneBasePath.current);
          const defaultName = `ModOneProject${nextNumber}`;
          setProjectName(defaultName);
          // Set default save path
          const defaultPath = await join(modOneBasePath.current, defaultName);
          setSavePath(defaultPath);
        } catch (err) {
          console.error('Failed to generate default project name:', err);
          setProjectName('');
          setSavePath('');
        }
      } else {
        setProjectName('');
        setSavePath('');
      }
    };
    initDialog();
  }, [isOpen]);

  // Validate and auto-update save path when project name changes
  useEffect(() => {
    const updateDefaultPath = async () => {
      // Validate project name
      const validation = validateProjectName(projectName);
      if (!validation.valid) {
        setProjectNameError(projectName.trim() ? validation.error || null : null);
      } else {
        setProjectNameError(null);
      }

      // Auto-update save path if user hasn't manually selected
      if (!userSelectedPath.current && projectName.trim() && modOneBasePath.current) {
        try {
          const defaultPath = await join(modOneBasePath.current, projectName.trim());
          setSavePath(defaultPath);
        } catch (err) {
          console.error('Failed to construct default path:', err);
        }
      }
    };
    updateDefaultPath();
  }, [projectName]);

  // Validate save path when it changes
  useEffect(() => {
    if (savePath) {
      const validation = validateSavePath(savePath);
      setSavePathError(validation.valid ? null : validation.error || null);
    } else {
      setSavePathError(null);
    }
  }, [savePath]);

  // Handle save path manual edit
  const handleSavePathChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSavePath(e.target.value);
    userSelectedPath.current = true; // User manually edited, don't auto-update
  }, []);

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

  // Select folder using native dialog
  const handleSelectFolder = useCallback(async () => {
    try {
      // Use current savePath or ModOne base path as default
      const defaultPath = savePath || modOneBasePath.current || undefined;

      const selected = await open({
        directory: true,
        title: '프로젝트 저장 위치 선택',
        defaultPath,
      });

      if (selected) {
        setSavePath(selected as string);
        userSelectedPath.current = true; // User manually selected, don't auto-update
      }
    } catch (err) {
      console.error('Failed to open folder picker:', err);
    }
  }, [savePath]);

  // Form validation - all validations must pass
  const nameValidation = validateProjectName(projectName);
  const pathValidation = validateSavePath(savePath);
  const isFormValid = nameValidation.valid && pathValidation.valid;

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Final validation before submit
      const finalNameValidation = validateProjectName(projectName);
      const finalPathValidation = validateSavePath(savePath);

      if (!finalNameValidation.valid) {
        setProjectNameError(finalNameValidation.error || null);
        return;
      }

      if (!finalPathValidation.valid) {
        setSavePathError(finalPathValidation.error || null);
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        // For folder-based projects (v2.0), savePath IS the project directory
        // The backend will create: savePath/{name}.mop + canvas/ + ladder/ + scenario/
        const projectDir = savePath;

        // Check if project directory already exists
        const dirExists = await exists(projectDir);
        if (dirExists) {
          setError('이미 동일한 이름의 프로젝트 폴더가 존재합니다. 다른 이름을 선택하세요.');
          setIsSubmitting(false);
          return;
        }

        const info = await createProject(
          projectName.trim(),
          projectDir,
          plcManufacturer,
          plcModel,
          scanTimeMs
        );

        onCreated?.(info);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : '프로젝트 생성에 실패했습니다.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [projectName, savePath, plcManufacturer, plcModel, scanTimeMs, createProject, onCreated, onClose]
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
          data-testid="new-project-dialog"
          className="bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-600">
            <h2 className="text-lg font-medium text-gray-100">새 프로젝트</h2>
            <button
              data-testid="new-project-close"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-100 disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Project Name */}
            <div>
              <label
                htmlFor="projectName"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                프로젝트 이름 <span className="text-red-500">*</span>
              </label>
              <input
                id="projectName"
                data-testid="project-name-input"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="MyProject"
                disabled={isSubmitting}
                className={`w-full px-3 py-2 bg-gray-700 border rounded text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none disabled:opacity-50 ${
                  projectNameError ? 'border-red-500 focus:border-red-500' : 'border-gray-600 focus:border-blue-500'
                }`}
                autoFocus
              />
              {projectNameError && (
                <p className="mt-1 text-xs text-red-500">{projectNameError}</p>
              )}
            </div>

            {/* Save Path */}
            <div>
              <label
                htmlFor="savePath"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                프로젝트 폴더 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="savePath"
                  type="text"
                  value={savePath}
                  onChange={handleSavePathChange}
                  placeholder="프로젝트 폴더 경로"
                  disabled={isSubmitting}
                  className={`flex-1 px-3 py-2 bg-gray-700 border rounded text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none disabled:opacity-50 ${
                    savePathError ? 'border-red-500 focus:border-red-500' : 'border-gray-600 focus:border-blue-500'
                  }`}
                />
                <button
                  type="button"
                  data-testid="project-folder-select"
                  onClick={handleSelectFolder}
                  disabled={isSubmitting}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-400 hover:bg-gray-600 hover:text-gray-100 disabled:opacity-50 transition-colors"
                >
                  <FolderOpen size={18} />
                </button>
              </div>
              {savePathError && (
                <p className="mt-1 text-xs text-red-500">{savePathError}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                이 폴더에 프로젝트 파일과 canvas, ladder, scenario 폴더가 생성됩니다.
              </p>
            </div>

            {/* PLC Manufacturer */}
            <div>
              <label
                htmlFor="plcManufacturer"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                PLC 제조사
              </label>
              <select
                id="plcManufacturer"
                value={plcManufacturer}
                onChange={(e) => setPlcManufacturer(e.target.value as PlcManufacturer)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                {PLC_MANUFACTURERS.map((manufacturer) => (
                  <option key={manufacturer.value} value={manufacturer.value}>
                    {manufacturer.label}
                  </option>
                ))}
              </select>
            </div>

            {/* PLC Model */}
            <div>
              <label
                htmlFor="plcModel"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                PLC 모델
              </label>
              <input
                id="plcModel"
                type="text"
                value={plcModel}
                onChange={(e) => setPlcModel(e.target.value)}
                placeholder="XGK-CPUH (선택)"
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>

            {/* Scan Time */}
            <div>
              <label
                htmlFor="scanTimeMs"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                스캔 타임 (ms)
              </label>
              <input
                id="scanTimeMs"
                type="number"
                value={scanTimeMs}
                onChange={(e) => setScanTimeMs(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>

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
                data-testid="cancel-project-btn"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm text-gray-400 hover:bg-gray-700 rounded disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                data-testid="create-project-btn"
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

export default NewProjectDialog;
