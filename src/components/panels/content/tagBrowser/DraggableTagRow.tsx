/**
 * DraggableTagRow – wraps a single tag list row with @dnd-kit useDraggable
 *
 * Makes tag rows draggable so they can be dropped onto the watch list.
 * Supports multi-select: when a selected tag is dragged, all selected tags
 * are included in the drag data.
 */

import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { TagDefinition } from '../../../../types/tags';
import type { TagDragData } from '../../../../types/dnd';
import { TAG_DRAG_TYPE } from '../../../../types/dnd';

// ============================================================================
// Types
// ============================================================================

interface DraggableTagRowProps {
  tag: TagDefinition;
  /** Index within the virtualised list (used as part of draggable id) */
  index: number;
  /** Whether this row is the active (detail-panel) selection */
  isActive: boolean;
  /** Whether this row is part of a multi-selection */
  isSelected: boolean;
  /** Inferred data type label */
  dataType: string;
  /** Formatted canonical address string */
  formattedAddress: string;
  /** All currently selected tag IDs (for multi-drag payload) */
  selectedIds: Set<string>;
  /** Click handler */
  onClick: (e: React.MouseEvent) => void;
  /** Absolute positioning style from virtualiser */
  style: React.CSSProperties;
}

// ============================================================================
// Component
// ============================================================================

export const DraggableTagRow = memo(function DraggableTagRow({
  tag,
  index,
  isActive,
  isSelected,
  dataType,
  formattedAddress,
  selectedIds,
  onClick,
  style,
}: DraggableTagRowProps) {
  // Build the drag payload – include all selected tags when dragging a selected row
  const dragTagIds =
    selectedIds.has(tag.tagId) && selectedIds.size > 1
      ? Array.from(selectedIds)
      : [tag.tagId];

  const dragData: TagDragData = {
    type: TAG_DRAG_TYPE,
    tagId: tag.tagId,
    tagIds: dragTagIds,
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: `tag-row-${tag.tagId}`,
    data: dragData,
  });

  return (
    <div
      ref={setNodeRef}
      data-index={index}
      style={{
        ...style,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={`flex items-center cursor-pointer text-xs transition-colors select-none ${
        isActive
          ? 'bg-[var(--accent-color)] text-white'
          : isSelected
            ? 'bg-[var(--accent-color)]/15 text-[var(--text-primary)]'
            : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
      }`}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      {/* Name column */}
      <div className="flex items-center gap-2 flex-1 min-w-0 px-3">
        {/* Tag class indicator dot */}
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            tag.class === 'semantic'
              ? isActive
                ? 'bg-white/70'
                : 'bg-[var(--accent-color)]'
              : isActive
                ? 'bg-white/50'
                : 'bg-[var(--text-muted)]'
          }`}
        />
        <span className="truncate font-medium">
          {tag.displayName}
        </span>
        {/* Multi-drag count badge */}
        {isDragging && dragTagIds.length > 1 && (
          <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--accent-color)] text-white font-semibold">
            {dragTagIds.length}
          </span>
        )}
      </div>

      {/* Area column */}
      <div className="w-[72px] shrink-0 px-2">
        <span
          className={`text-[10px] font-mono ${
            isActive ? 'text-white/80' : 'text-[var(--text-muted)]'
          }`}
        >
          {formattedAddress}
        </span>
      </div>

      {/* Type column */}
      <div className="w-[64px] shrink-0 px-2">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
            isActive
              ? 'bg-white/20 text-white/90'
              : dataType === 'BOOL'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
          }`}
        >
          {dataType}
        </span>
      </div>
    </div>
  );
});
