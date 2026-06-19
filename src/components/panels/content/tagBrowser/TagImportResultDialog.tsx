/**
 * TagImportResultDialog Component
 *
 * Displays import progress (spinner) during processing and a result summary
 * (success/error breakdown) when the import operation completes.
 *
 * States:
 * - Processing: shows a spinner with "가져오는 중..." message
 * - Success: shows created/overwritten/skipped/failed counts with icon
 * - Error: shows error message with retry guidance
 */

import { useEffect } from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileUp,
  X,
  RefreshCw,
  SkipForward,
  Plus,
  XCircle,
} from 'lucide-react';
import type { ImportSummary, TagImportResult } from '../../../../types/tagImportExport';

export interface TagImportResultDialogProps {
  /** Whether the dialog is visible. */
  isOpen: boolean;
  /** Whether an import operation is currently running. */
  isProcessing: boolean;
  /** The import result summary (null while processing or if error). */
  result: ImportSummary | null;
  /** Error message if the import failed entirely. */
  error: string | null;
  /** Called when user closes the dialog. */
  onClose: () => void;
}

/**
 * Returns an overall status from the import summary.
 */
function getOverallStatus(result: ImportSummary): 'success' | 'partial' | 'empty' {
  if (result.failed > 0 || (result.created === 0 && result.overwritten === 0 && result.skipped > 0)) {
    return 'partial';
  }
  if (result.created === 0 && result.overwritten === 0) {
    return 'empty';
  }
  return 'success';
}

export function TagImportResultDialog({
  isOpen,
  isProcessing,
  result,
  error,
  onClose,
}: TagImportResultDialogProps) {
  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isProcessing) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const showResult = !isProcessing && result != null;
  const showError = !isProcessing && error != null && result == null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[70]"
        onClick={isProcessing ? undefined : onClose}
        data-testid="import-result-backdrop"
      />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
        <div
          data-testid="tag-import-result-dialog"
          className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Processing State */}
          {isProcessing && (
            <div data-testid="import-progress" className="p-8 flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center">
                  <Loader2 size={32} className="text-[var(--color-accent)] animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                  태그 가져오는 중...
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  파일을 처리하고 있습니다. 잠시만 기다려 주세요.
                </p>
              </div>
            </div>
          )}

          {/* Success/Partial Result State */}
          {showResult && (
            <>
              <div className="p-6 pb-0">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {/* Status Icon */}
                    {getOverallStatus(result) === 'success' ? (
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <CheckCircle2 size={20} className="text-green-500" />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-warning)]/10 flex items-center justify-center">
                        <AlertCircle size={20} className="text-[var(--color-warning)]" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                        {getOverallStatus(result) === 'success'
                          ? '가져오기 완료'
                          : '가져오기 부분 완료'}
                      </h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        총 {result.totalRows}건 처리됨
                      </p>
                    </div>
                  </div>
                  <button
                    data-testid="import-result-close-btn"
                    onClick={onClose}
                    className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="px-6 py-4" data-testid="import-result-summary">
                <div className="grid grid-cols-2 gap-3">
                  {/* Created */}
                  <div className="flex items-center gap-2 p-3 bg-green-500/5 border border-green-500/20 rounded">
                    <Plus size={16} className="text-green-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-[var(--color-text-muted)]">생성됨</p>
                      <p data-testid="import-count-created" className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {result.created}
                      </p>
                    </div>
                  </div>

                  {/* Overwritten */}
                  <div className="flex items-center gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded">
                    <RefreshCw size={16} className="text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-[var(--color-text-muted)]">덮어쓰기</p>
                      <p data-testid="import-count-overwritten" className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {result.overwritten}
                      </p>
                    </div>
                  </div>

                  {/* Skipped */}
                  <div className="flex items-center gap-2 p-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded">
                    <SkipForward size={16} className="text-[var(--color-text-muted)] flex-shrink-0" />
                    <div>
                      <p className="text-xs text-[var(--color-text-muted)]">건너뜀</p>
                      <p data-testid="import-count-skipped" className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {result.skipped}
                      </p>
                    </div>
                  </div>

                  {/* Failed */}
                  <div className="flex items-center gap-2 p-3 bg-[var(--color-error)]/5 border border-[var(--color-error)]/20 rounded">
                    <XCircle size={16} className="text-[var(--color-error)] flex-shrink-0" />
                    <div>
                      <p className="text-xs text-[var(--color-text-muted)]">실패</p>
                      <p data-testid="import-count-failed" className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {result.failed}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Failed Items Detail (if any) */}
              {result.results.some((r: TagImportResult) => r.status === 'failed') && (
                <div className="px-6 pb-4">
                  <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
                    실패 상세
                  </p>
                  <div
                    data-testid="import-failed-list"
                    className="max-h-32 overflow-y-auto border border-[var(--color-border)] rounded bg-[var(--color-bg-secondary)]"
                  >
                    {result.results
                      .filter((r: TagImportResult) => r.status === 'failed')
                      .map((r: TagImportResult, i: number) => (
                        <div
                          key={`fail-${i}`}
                          className="flex items-start gap-2 px-3 py-2 text-sm border-b border-[var(--color-border)] last:border-b-0"
                        >
                          <XCircle
                            size={14}
                            className="text-[var(--color-error)] flex-shrink-0 mt-0.5"
                          />
                          <div className="min-w-0">
                            <span className="font-mono text-[var(--color-text-primary)]">
                              {r.tagId}
                            </span>
                            {r.error && (
                              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">
                                {r.error}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end px-6 pb-6">
                <button
                  data-testid="import-result-done-btn"
                  onClick={onClose}
                  className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] rounded transition-colors flex items-center gap-1.5"
                >
                  <FileUp size={14} />
                  확인
                </button>
              </div>
            </>
          )}

          {/* Error State */}
          {showError && (
            <>
              <div className="p-6 pb-0">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-error)]/10 flex items-center justify-center">
                      <AlertCircle size={20} className="text-[var(--color-error)]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                        가져오기 실패
                      </h3>
                    </div>
                  </div>
                  <button
                    data-testid="import-error-close-btn"
                    onClick={onClose}
                    className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="px-6 py-4">
                <div
                  data-testid="import-error-message"
                  className="p-3 bg-[var(--color-error)]/5 border border-[var(--color-error)]/20 rounded text-sm text-[var(--color-text-secondary)]"
                >
                  {error}
                </div>
              </div>

              <div className="flex justify-end px-6 pb-6">
                <button
                  data-testid="import-error-done-btn"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded transition-colors"
                >
                  닫기
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default TagImportResultDialog;
