/**
 * TagImportConflictDialog Component
 *
 * Modal dialog shown during tag import when conflicts (duplicate tagId or
 * deviceAddress) are detected between imported tags and the existing registry.
 *
 * Presents three resolution options:
 * - Overwrite: replace existing tags with imported values
 * - Skip: keep existing tags, only import non-conflicting ones
 * - Abort: cancel the entire import operation
 */

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, SkipForward, XCircle } from 'lucide-react';
import type { ImportConflict, ConflictResolution } from '../../../../types/tagImportExport';

export interface TagImportConflictDialogProps {
  /** Whether the dialog is visible. */
  isOpen: boolean;
  /** List of detected conflicts to display. */
  conflicts: ImportConflict[];
  /** Called when the user selects a resolution strategy. */
  onResolve: (resolution: ConflictResolution) => void;
  /** Called when the user cancels (equivalent to abort). */
  onCancel: () => void;
}

/**
 * Human-readable labels for conflict types.
 */
function conflictTypeLabel(conflictType: string): string {
  switch (conflictType) {
    case 'duplicateTagId':
      return '태그 ID 중복';
    case 'duplicateAddress':
      return '디바이스 주소 중복';
    case 'internalDuplicateTagId':
      return '파일 내 태그 ID 중복';
    case 'internalDuplicateAddress':
      return '파일 내 디바이스 주소 중복';
    default:
      return '충돌';
  }
}

export function TagImportConflictDialog({
  isOpen,
  conflicts,
  onResolve,
  onCancel,
}: TagImportConflictDialogProps) {
  // Handle ESC key — treat as abort
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen || conflicts.length === 0) return null;

  // Separate registry conflicts from internal (within-file) conflicts
  const registryConflicts = conflicts.filter(
    (c) => c.conflictType === 'duplicateTagId' || c.conflictType === 'duplicateAddress',
  );
  const internalConflicts = conflicts.filter(
    (c) => c.conflictType === 'internalDuplicateTagId' || c.conflictType === 'internalDuplicateAddress',
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[70]"
        onClick={onCancel}
        data-testid="conflict-dialog-backdrop"
      />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
        <div
          data-testid="tag-import-conflict-dialog"
          className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-xl w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 pb-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-warning)]/10 flex items-center justify-center">
                <AlertTriangle size={20} className="text-[var(--color-warning)]" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                  가져오기 충돌 감지
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {conflicts.length}건의 충돌이 발견되었습니다
                </p>
              </div>
            </div>
          </div>

          {/* Conflict List */}
          <div className="px-6 pb-4">
            {/* Registry conflicts */}
            {registryConflicts.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
                  기존 태그와 충돌
                </p>
                <div
                  data-testid="conflict-list-registry"
                  className="max-h-40 overflow-y-auto border border-[var(--color-border)] rounded bg-[var(--color-bg-secondary)]"
                >
                  {registryConflicts.map((conflict, i) => (
                    <div
                      key={`reg-${i}`}
                      className="flex items-start gap-2 px-3 py-2 text-sm border-b border-[var(--color-border)] last:border-b-0"
                    >
                      <AlertTriangle
                        size={14}
                        className="text-[var(--color-warning)] flex-shrink-0 mt-0.5"
                      />
                      <div className="min-w-0">
                        <span className="font-mono text-[var(--color-text-primary)]">
                          {conflict.tagId}
                        </span>
                        <span className="text-[var(--color-text-muted)] ml-2 text-xs">
                          ({conflictTypeLabel(conflict.conflictType)})
                        </span>
                        {conflict.message && (
                          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">
                            {conflict.message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Internal conflicts */}
            {internalConflicts.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
                  파일 내부 중복
                </p>
                <div
                  data-testid="conflict-list-internal"
                  className="max-h-32 overflow-y-auto border border-[var(--color-border)] rounded bg-[var(--color-bg-secondary)]"
                >
                  {internalConflicts.map((conflict, i) => (
                    <div
                      key={`int-${i}`}
                      className="flex items-start gap-2 px-3 py-2 text-sm border-b border-[var(--color-border)] last:border-b-0"
                    >
                      <AlertTriangle
                        size={14}
                        className="text-[var(--color-error)] flex-shrink-0 mt-0.5"
                      />
                      <div className="min-w-0">
                        <span className="font-mono text-[var(--color-text-primary)]">
                          {conflict.tagId}
                        </span>
                        <span className="text-[var(--color-text-muted)] ml-2 text-xs">
                          ({conflictTypeLabel(conflict.conflictType)})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution explanation */}
            <div className="bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border)] rounded p-3 text-xs text-[var(--color-text-secondary)] space-y-1">
              <p className="font-medium text-[var(--color-text-primary)]">처리 방법을 선택하세요:</p>
              <p>
                <span className="font-medium">덮어쓰기</span> — 기존 태그를 가져오는 태그로 대체합니다
              </p>
              <p>
                <span className="font-medium">건너뛰기</span> — 충돌하는 태그를 제외하고 나머지만 가져옵니다
              </p>
              <p>
                <span className="font-medium">중단</span> — 가져오기를 취소하고 변경 사항 없이 종료합니다
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 px-6 pb-6">
            <button
              data-testid="conflict-abort-btn"
              onClick={() => onResolve('abort')}
              className="px-4 py-2 text-sm bg-[var(--color-error)]/10 text-[var(--color-error)] hover:bg-[var(--color-error)]/20 rounded transition-colors flex items-center gap-1.5"
            >
              <XCircle size={14} />
              중단
            </button>
            <button
              data-testid="conflict-skip-btn"
              onClick={() => onResolve('skip')}
              className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded transition-colors flex items-center gap-1.5"
            >
              <SkipForward size={14} />
              건너뛰기
            </button>
            <button
              data-testid="conflict-overwrite-btn"
              onClick={() => onResolve('overwrite')}
              className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] rounded transition-colors flex items-center gap-1.5"
            >
              <RefreshCw size={14} />
              덮어쓰기
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default TagImportConflictDialog;
