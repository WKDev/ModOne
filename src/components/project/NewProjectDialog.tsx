/**
 * NewProjectDialog Component
 *
 * Modal dialog for creating a new project with form inputs for
 * project name, save path, PLC manufacturer, and model.
 */

import { useState, useCallback, useEffect } from 'react';
import { X, FolderOpen, Loader2 } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useProject } from '../../hooks/useProject';
import type { PlcManufacturer, ProjectInfo } from '../../types/project';

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

  const { createProject } = useProject();

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setProjectName('');
      setSavePath('');
      setPlcManufacturer('LS');
      setPlcModel('');
      setScanTimeMs(10);
      setError(null);
    }
  }, [isOpen]);

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
      const selected = await open({
        directory: true,
        title: '프로젝트 저장 위치 선택',
      });

      if (selected) {
        setSavePath(selected as string);
      }
    } catch (err) {
      console.error('Failed to open folder picker:', err);
    }
  }, []);

  // Form validation
  const isFormValid = projectName.trim() !== '' && savePath !== '';

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!isFormValid) return;

      setIsSubmitting(true);
      setError(null);

      try {
        // Construct full file path
        const fileName = `${projectName.trim()}.mop`;
        const fullPath = `${savePath}/${fileName}`.replace(/\\/g, '/');

        const info = await createProject(
          projectName.trim(),
          fullPath,
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
    [isFormValid, projectName, savePath, plcManufacturer, plcModel, scanTimeMs, createProject, onCreated, onClose]
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
          className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
            <h2 className="text-lg font-medium text-[var(--text-primary)]">새 프로젝트</h2>
            <button
              data-testid="new-project-close"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1 hover:bg-[var(--bg-secondary)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
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
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
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
                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] disabled:opacity-50"
                autoFocus
              />
            </div>

            {/* Save Path */}
            <div>
              <label
                htmlFor="savePath"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
              >
                저장 위치 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="savePath"
                  type="text"
                  value={savePath}
                  onChange={(e) => setSavePath(e.target.value)}
                  placeholder="폴더를 선택하세요"
                  disabled={isSubmitting}
                  className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] disabled:opacity-50"
                  readOnly
                />
                <button
                  type="button"
                  data-testid="project-folder-select"
                  onClick={handleSelectFolder}
                  disabled={isSubmitting}
                  className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors"
                >
                  <FolderOpen size={18} />
                </button>
              </div>
            </div>

            {/* PLC Manufacturer */}
            <div>
              <label
                htmlFor="plcManufacturer"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
              >
                PLC 제조사
              </label>
              <select
                id="plcManufacturer"
                value={plcManufacturer}
                onChange={(e) => setPlcManufacturer(e.target.value as PlcManufacturer)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)] disabled:opacity-50"
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
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
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
                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] disabled:opacity-50"
              />
            </div>

            {/* Scan Time */}
            <div>
              <label
                htmlFor="scanTimeMs"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
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
                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)] disabled:opacity-50"
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
                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                data-testid="create-project-btn"
                disabled={!isFormValid || isSubmitting}
                className="px-4 py-2 text-sm bg-[var(--accent-color)] text-white hover:bg-[var(--accent-color-hover)] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
