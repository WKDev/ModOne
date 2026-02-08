/**
 * SchematicPageTab Component
 *
 * Individual page tab in the SchematicPageBar.
 * Supports renaming via double-click, close button on hover.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SchematicPageTabProps {
  pageId: string;
  pageNumber: number;
  pageName: string;
  isActive: boolean;
  canClose: boolean;
  onActivate: (pageId: string) => void;
  onClose: (pageId: string) => void;
  onRename: (pageId: string, newName: string) => void;
  onDuplicate: (pageId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export const SchematicPageTab = memo(function SchematicPageTab({
  pageId,
  pageNumber,
  pageName,
  isActive,
  canClose,
  onActivate,
  onClose,
  onRename,
}: SchematicPageTabProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(pageName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleClick = useCallback(() => {
    if (!isRenaming) {
      onActivate(pageId);
    }
  }, [pageId, isRenaming, onActivate]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(pageName);
    setIsRenaming(true);
  }, [pageName]);

  const handleRenameConfirm = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== pageName) {
      onRename(pageId, trimmed);
    }
    setIsRenaming(false);
  }, [pageId, editName, pageName, onRename]);

  const handleRenameCancel = useCallback(() => {
    setEditName(pageName);
    setIsRenaming(false);
  }, [pageName]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleRenameConfirm();
      } else if (e.key === 'Escape') {
        handleRenameCancel();
      }
    },
    [handleRenameConfirm, handleRenameCancel]
  );

  const handleCloseClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (canClose) {
        onClose(pageId);
      }
    },
    [pageId, canClose, onClose]
  );

  return (
    <div
      className={`
        h-8 px-3 text-xs font-medium flex items-center gap-1.5
        shrink-0 cursor-pointer relative select-none group
        border-b-2 transition-colors duration-100
        ${
          isActive
            ? 'bg-neutral-800 border-blue-500 text-white'
            : 'bg-neutral-900 border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
        }
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title={`Page ${pageNumber}: ${pageName}`}
    >
      {/* Page number */}
      <span className="text-neutral-500 text-[10px]">{pageNumber}</span>

      {/* Page name or rename input */}
      {isRenaming ? (
        <input
          ref={inputRef}
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleRenameConfirm}
          className="w-20 bg-neutral-700 border border-neutral-500 rounded px-1 py-0 text-xs text-white outline-none focus:border-blue-500"
          maxLength={32}
        />
      ) : (
        <span className="truncate max-w-[80px]">{pageName}</span>
      )}

      {/* Close button */}
      {canClose && !isRenaming && (
        <button
          type="button"
          onClick={handleCloseClick}
          className="
            opacity-0 group-hover:opacity-100
            p-0.5 rounded hover:bg-neutral-600
            text-neutral-500 hover:text-white
            transition-opacity duration-100
          "
          title="Close page"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
});

export default SchematicPageTab;
