/**
 * SchematicPageBar Component
 *
 * Bottom bar displaying page tabs for multi-page schematics.
 * Only rendered when the active document is a schematic type.
 */

import { memo, useCallback, useState, useEffect, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { SchematicPageTab } from './SchematicPageTab';

// ============================================================================
// Types
// ============================================================================

interface PageInfo {
  id: string;
  number: number;
  name: string;
}

interface SchematicPageBarProps {
  pages: PageInfo[];
  activePageId: string;
  onActivatePage: (pageId: string) => void;
  onAddPage: () => void;
  onRemovePage: (pageId: string) => void;
  onRenamePage: (pageId: string, newName: string) => void;
  onDuplicatePage: (pageId: string) => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
}

interface ContextMenuState {
  pageId: string;
  x: number;
  y: number;
}

// ============================================================================
// Component
// ============================================================================

export const SchematicPageBar = memo(function SchematicPageBar({
  pages,
  activePageId,
  onActivatePage,
  onAddPage,
  onRemovePage,
  onRenamePage,
  onDuplicatePage,
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
}: SchematicPageBarProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const canClose = pages.length > 1;

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  const handleContextMenu = useCallback((pageId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ pageId, x: e.clientX, y: e.clientY });
  }, []);

  const handleContextAction = useCallback(
    (action: 'duplicate' | 'delete') => {
      if (!contextMenu) return;
      if (action === 'duplicate') {
        onDuplicatePage(contextMenu.pageId);
      } else if (action === 'delete' && canClose) {
        onRemovePage(contextMenu.pageId);
      }
      setContextMenu(null);
    },
    [contextMenu, canClose, onDuplicatePage, onRemovePage]
  );

  return (
    <>
      <div className="absolute bottom-0 left-0 right-0 h-9 bg-neutral-900/95 backdrop-blur-sm border-t border-neutral-700 flex items-center z-10 px-1 gap-0.5">
        {/* Previous page button */}
        <button
          type="button"
          onClick={onPreviousPage}
          disabled={!hasPreviousPage}
          className="p-1 text-neutral-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-neutral-700 transition-colors"
          title="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Tabs area */}
        <div className="flex-1 flex items-center overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {pages.map((page) => (
            <div
              key={page.id}
              onContextMenu={(e) => handleContextMenu(page.id, e)}
            >
              <SchematicPageTab
                pageId={page.id}
                pageNumber={page.number}
                pageName={page.name}
                isActive={page.id === activePageId}
                canClose={canClose}
                onActivate={onActivatePage}
                onClose={onRemovePage}
                onRename={onRenamePage}
                onDuplicate={onDuplicatePage}
              />
            </div>
          ))}
        </div>

        {/* Add page button */}
        <button
          type="button"
          onClick={onAddPage}
          className="px-2 h-7 text-xs text-neutral-400 hover:text-white hover:bg-neutral-700 rounded flex items-center gap-1 transition-colors"
          title="Add new page"
        >
          <Plus size={14} />
        </button>

        {/* Next page button */}
        <button
          type="button"
          onClick={onNextPage}
          disabled={!hasNextPage}
          className="p-1 text-neutral-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-neutral-700 transition-colors"
          title="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-neutral-800 border border-neutral-600 rounded-md shadow-xl py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y - 80 }}
        >
          <button
            type="button"
            onClick={() => handleContextAction('duplicate')}
            className="w-full px-3 py-1.5 text-xs text-left text-neutral-200 hover:bg-neutral-700 transition-colors"
          >
            Duplicate Page
          </button>
          <button
            type="button"
            onClick={() => handleContextAction('delete')}
            disabled={!canClose}
            className="w-full px-3 py-1.5 text-xs text-left text-red-400 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Delete Page
          </button>
        </div>
      )}
    </>
  );
});

export default SchematicPageBar;
