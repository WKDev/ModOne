/**
 * Favorite Item Component
 *
 * Displays a single favorite memory address with its current value.
 */

import { memo } from 'react';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import type { FavoriteItem as FavoriteItemType } from './types';
import { formatValue } from './utils/formatters';
import { getMemoryTypeShortName } from './utils/addressUtils';

// ============================================================================
// Types
// ============================================================================

interface FavoriteItemProps {
  /** The favorite item data */
  item: FavoriteItemType;
  /** Current value from memory (undefined if not loaded) */
  currentValue: boolean | number | undefined;
  /** Callback when edit button is clicked */
  onEdit: () => void;
  /** Callback when remove button is clicked */
  onRemove: () => void;
  /** Callback when item is right-clicked */
  onContextMenu: (e: React.MouseEvent) => void;
  /** Callback when item is clicked to navigate */
  onClick?: () => void;
  /** Whether this item is currently being dragged */
  isDragging?: boolean;
  /** Drag handle props for @dnd-kit */
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

// ============================================================================
// Component
// ============================================================================

/**
 * A single favorite item with value display and actions.
 */
export const FavoriteItem = memo(function FavoriteItem({
  item,
  currentValue,
  onEdit,
  onRemove,
  onContextMenu,
  onClick,
  isDragging = false,
  dragHandleProps,
}: FavoriteItemProps) {
  // Format the current value
  const displayValue =
    currentValue !== undefined
      ? typeof currentValue === 'boolean'
        ? currentValue
          ? 'ON'
          : 'OFF'
        : formatValue(currentValue as number, item.displayFormat)
      : '--';

  // Determine value color
  const valueColor =
    currentValue !== undefined
      ? typeof currentValue === 'boolean'
        ? currentValue
          ? 'text-[var(--color-success)]'
          : 'text-[var(--color-text-muted)]'
        : 'text-[var(--color-success)]'
      : 'text-[var(--color-text-muted)]';

  return (
    <div
      className={`flex items-center gap-2 rounded border p-2 transition-colors ${
        isDragging
          ? 'border-[var(--color-border-focus)] bg-[var(--color-bg-tertiary)] opacity-50'
          : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-muted)]'
      }`}
      onContextMenu={onContextMenu}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {/* Drag handle */}
      <div
        {...dragHandleProps}
        className="cursor-grab text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
      >
        <GripVertical size={14} />
      </div>

      {/* Color indicator */}
      {item.color && (
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: item.color }}
        />
      )}

      {/* Label and address info */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-[var(--color-text-primary)]">{item.label}</div>
        <div className="text-xs text-[var(--color-text-muted)]">
          {getMemoryTypeShortName(item.memoryType)}:{item.address} •{' '}
          {item.displayFormat}
        </div>
      </div>

      {/* Current value */}
      <div className={`w-20 text-right font-mono text-sm ${valueColor}`}>
        {displayValue}
      </div>

      {/* Action buttons */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
        title="Edit favorite"
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-error)]"
        title="Remove favorite"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
});

export default FavoriteItem;
