/**
 * Error Dialog Component
 *
 * Modal dialog for displaying errors with action buttons.
 */

import type React from 'react';
import { AlertCircle, RefreshCw, X, FileArchive, XCircle, FolderOpen } from 'lucide-react';
import type { ModOneError } from '../../types/error';
import {
  getErrorTitle,
  getErrorMessage,
  isRecoverableError,
  hasBackupOption,
} from '../../types/error';

interface ErrorDialogProps {
  /** The error to display, or null if no error */
  error: ModOneError | null;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Callback when ignore button is clicked */
  onIgnore?: () => void;
  /** Callback when close button is clicked */
  onClose: () => void;
  /** Callback when open backup button is clicked */
  onOpenBackup?: () => void;
  /** Callback when view logs button is clicked */
  onViewLogs?: () => void;
}

/**
 * Modal dialog for displaying ModOne errors
 */
export function ErrorDialog({
  error,
  onRetry,
  onIgnore,
  onClose,
  onOpenBackup,
  onViewLogs,
}: ErrorDialogProps): React.JSX.Element | null {
  if (!error) {
    return null;
  }

  const title = getErrorTitle(error);
  const message = getErrorMessage(error);
  const canRetry = isRecoverableError(error) && onRetry;
  const canOpenBackup = hasBackupOption(error) && onOpenBackup;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="mx-4 w-full max-w-md rounded-lg border border-neutral-700 bg-neutral-800 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-700 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <h2 className="font-semibold text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4">
          <p className="text-sm text-neutral-300">{message}</p>

          {/* Additional info for specific error types */}
          {error.type === 'ConfigValidationError' && (
            <div className="mt-3 rounded bg-neutral-900 p-2 text-xs text-neutral-400">
              <span className="font-medium text-neutral-300">Field:</span>{' '}
              {(error.message as { field: string; message: string }).field}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-neutral-700 px-4 py-3">
          {canOpenBackup && (
            <button
              onClick={onOpenBackup}
              className="flex items-center gap-2 rounded bg-amber-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-amber-500"
            >
              <FileArchive className="h-4 w-4" />
              Open Backup
            </button>
          )}

          {onIgnore && (
            <button
              onClick={onIgnore}
              className="flex items-center gap-2 rounded bg-neutral-700 px-3 py-1.5 text-sm text-white transition-colors hover:bg-neutral-600"
            >
              <XCircle className="h-4 w-4" />
              Ignore
            </button>
          )}

          {canRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 rounded bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-500"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}

          {onViewLogs && (
            <button
              onClick={onViewLogs}
              className="flex items-center gap-2 rounded bg-neutral-700 px-3 py-1.5 text-sm text-white transition-colors hover:bg-neutral-600"
            >
              <FolderOpen className="h-4 w-4" />
              View Logs
            </button>
          )}

          <button
            onClick={onClose}
            className="rounded bg-neutral-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-neutral-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ErrorDialog;
