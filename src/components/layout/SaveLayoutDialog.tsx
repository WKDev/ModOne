/**
 * SaveLayoutDialog Component
 *
 * Modal dialog for saving the current layout as a named preset.
 */

import { useState, useCallback, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { useLayoutPersistenceStore } from '../../stores/layoutPersistenceStore';
import { isBuiltInLayout, isReservedLayoutName } from '../../types/layout';

interface SaveLayoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (name: string) => void;
}

export function SaveLayoutDialog({ isOpen, onClose, onSaved }: SaveLayoutDialogProps) {
  const [layoutName, setLayoutName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);

  const { saveLayout, savedLayoutNames, currentLayoutName } = useLayoutPersistenceStore();

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Pre-fill with current layout name if it's a user layout
      if (currentLayoutName && !isBuiltInLayout(currentLayoutName)) {
        setLayoutName(currentLayoutName);
      } else {
        setLayoutName('');
      }
      setError(null);
      setShowOverwriteWarning(false);
    }
  }, [isOpen, currentLayoutName]);

  // Check for name conflicts
  useEffect(() => {
    if (layoutName.trim()) {
      const exists = savedLayoutNames.includes(layoutName.trim());
      const isBuiltIn = isBuiltInLayout(layoutName.trim());
      setShowOverwriteWarning(exists && !isBuiltIn);
    } else {
      setShowOverwriteWarning(false);
    }
  }, [layoutName, savedLayoutNames]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving) {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  // Validate the layout name
  const validateName = (name: string): string | null => {
    const trimmed = name.trim();

    if (!trimmed) {
      return 'Layout name is required';
    }

    if (trimmed.length > 50) {
      return 'Layout name must be 50 characters or less';
    }

    if (isReservedLayoutName(trimmed)) {
      return 'This name is reserved and cannot be used';
    }

    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
      return 'Layout name can only contain letters, numbers, spaces, hyphens, and underscores';
    }

    return null;
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const validationError = validateName(layoutName);
      if (validationError) {
        setError(validationError);
        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        await saveLayout(layoutName.trim());
        onSaved?.(layoutName.trim());
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save layout');
      } finally {
        setIsSaving(false);
      }
    },
    [layoutName, saveLayout, onSaved, onClose]
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => !isSaving && onClose()}
      />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          data-testid="save-layout-dialog"
          className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
            <h2 className="text-lg font-medium text-[var(--text-primary)]">Save Layout</h2>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="p-1 hover:bg-[var(--bg-secondary)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Layout Name */}
            <div>
              <label
                htmlFor="layoutName"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
              >
                Layout Name <span className="text-red-500">*</span>
              </label>
              <input
                id="layoutName"
                data-testid="layout-name-input"
                type="text"
                value={layoutName}
                onChange={(e) => {
                  setLayoutName(e.target.value);
                  setError(null);
                }}
                placeholder="My Custom Layout"
                disabled={isSaving}
                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] disabled:opacity-50"
                autoFocus
                maxLength={50}
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Use letters, numbers, spaces, hyphens, or underscores
              </p>
            </div>

            {/* Overwrite Warning */}
            {showOverwriteWarning && (
              <div className="flex items-start gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm text-yellow-600 dark:text-yellow-400">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>
                  A layout with this name already exists. Saving will replace it.
                </span>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-500">
                {error}
              </div>
            )}

            {/* Layout Preview (simplified) */}
            <div className="border border-[var(--border-color)] rounded p-3">
              <p className="text-xs font-medium text-[var(--text-muted)] mb-2">
                Current Layout Preview
              </p>
              <LayoutPreview />
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="save-layout-btn"
                disabled={!layoutName.trim() || isSaving}
                className="px-4 py-2 text-sm bg-[var(--accent-color)] text-white hover:bg-[var(--accent-color-hover)] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Layout'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

/**
 * Simple visual preview of the current layout grid
 */
function LayoutPreview() {
  // This is a simplified preview - could be enhanced to show actual panel arrangement
  return (
    <div className="aspect-video bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)] grid grid-cols-2 grid-rows-2 gap-1 p-1">
      <div className="bg-[var(--bg-secondary)] rounded flex items-center justify-center text-xs text-[var(--text-muted)]">
        Panel 1
      </div>
      <div className="bg-[var(--bg-secondary)] rounded flex items-center justify-center text-xs text-[var(--text-muted)]">
        Panel 2
      </div>
      <div className="bg-[var(--bg-secondary)] rounded flex items-center justify-center text-xs text-[var(--text-muted)]">
        Panel 3
      </div>
      <div className="bg-[var(--bg-secondary)] rounded flex items-center justify-center text-xs text-[var(--text-muted)]">
        Panel 4
      </div>
    </div>
  );
}

export default SaveLayoutDialog;
