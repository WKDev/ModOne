/**
 * UnsavedChangesDialog Component
 *
 * Modal warning dialog shown when attempting to close a project
 * with unsaved changes. Offers Save, Don't Save, and Cancel options.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onSave: () => Promise<void> | void;
  onDontSave: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({
  isOpen,
  onSave,
  onDontSave,
  onCancel,
}: UnsavedChangesDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving) {
        e.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onCancel]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[60]"
        onClick={() => !isSaving && onCancel()}
      />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
        <div
          className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Content */}
          <div className="p-6">
            {/* Warning Icon */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <AlertTriangle size={20} className="text-yellow-500" />
              </div>
              <h3 className="text-lg font-medium text-[var(--text-primary)]">
                저장되지 않은 변경 사항
              </h3>
            </div>

            {/* Message */}
            <p className="text-sm text-[var(--text-secondary)] mb-6 ml-[52px]">
              현재 프로젝트에 저장되지 않은 변경 사항이 있습니다.
              저장하지 않으면 변경 내용이 손실됩니다.
            </p>

            {/* Buttons */}
            <div className="flex justify-end gap-2">
              <button
                onClick={onCancel}
                disabled={isSaving}
                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={onDontSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded disabled:opacity-50 transition-colors"
              >
                저장 안 함
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm bg-[var(--accent-color)] text-white hover:bg-[var(--accent-color-hover)] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isSaving && <Loader2 size={16} className="animate-spin" />}
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default UnsavedChangesDialog;
