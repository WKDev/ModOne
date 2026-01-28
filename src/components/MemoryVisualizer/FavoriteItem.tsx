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
          ? 'text-green-400'
          : 'text-neutral-400'
        : 'text-green-400'
      : 'text-neutral-500';

  return (
    <div
      className={`flex items-center gap-2 rounded border p-2 transition-colors ${
        isDragging
          ? 'border-blue-500 bg-neutral-700 opacity-50'
          : 'border-neutral-700 bg-neutral-800 hover:border-neutral-600'
      }`}
      onContextMenu={onContextMenu}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {/* Drag handle */}
      <div
        {...dragHandleProps}
        className="cursor-grab text-neutral-500 hover:text-neutral-400"
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
        <div className="truncate text-sm text-white">{item.label}</div>
        <div className="text-xs text-neutral-400">
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
        className="rounded p-1 text-neutral-400 hover:bg-neutral-700 hover:text-white"
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
        className="rounded p-1 text-neutral-400 hover:bg-neutral-700 hover:text-red-400"
        title="Remove favorite"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
});

export default FavoriteItem;
