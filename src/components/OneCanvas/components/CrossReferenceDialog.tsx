/**
 * CrossReferenceDialog Component
 *
 * Modal that lists all cross-page references in the schematic.
 * Clicking a reference navigates to the target page.
 */

import { memo, useMemo, useCallback } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { getAllCrossReferences } from '../utils/schematicHelpers';

// ============================================================================
// Types
// ============================================================================

interface CrossReferenceDialogProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToPage: (pageId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export const CrossReferenceDialog = memo(function CrossReferenceDialog({
  documentId,
  isOpen,
  onClose,
  onNavigateToPage,
}: CrossReferenceDialogProps) {
  const references = useMemo(() => {
    if (!isOpen) return [];
    return getAllCrossReferences(documentId);
  }, [documentId, isOpen]);

  const handleRefClick = useCallback(
    (pageId: string) => {
      onNavigateToPage(pageId);
      onClose();
    },
    [onNavigateToPage, onClose]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative bg-neutral-900 rounded-lg border border-neutral-700 shadow-2xl w-[480px] max-h-[60vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
          <h2 className="text-sm font-semibold text-white">Cross References</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {references.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-neutral-400">No cross-references found.</p>
              <p className="text-xs text-neutral-500 mt-1">
                Add off-page connectors to create cross-page links.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {references.map((ref, index) => (
                <button
                  key={`${ref.localId}-${index}`}
                  type="button"
                  onClick={() => handleRefClick(ref.toPage.id)}
                  className="
                    w-full flex items-center gap-3 px-3 py-2 rounded
                    text-left hover:bg-neutral-800 transition-colors group
                  "
                >
                  {/* Source page */}
                  <span className="text-xs text-neutral-400 shrink-0">
                    P{ref.fromPage.number}
                  </span>

                  {/* Arrow */}
                  <ArrowRight size={12} className="text-neutral-600 shrink-0" />

                  {/* Target page */}
                  <span className="text-xs text-blue-400 shrink-0">
                    P{ref.toPage.number}
                  </span>

                  {/* Label */}
                  <span className="text-xs text-neutral-300 truncate flex-1 group-hover:text-white">
                    {ref.label || `${ref.fromPage.name} → ${ref.toPage.name}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default CrossReferenceDialog;
