/**
 * LadderCell Component
 *
 * Represents a single cell in the ladder diagram grid.
 * Can contain ladder elements and supports selection, hover states,
 * and drag-and-drop operations.
 */

import { useCallback } from 'react';
import { cn } from '../../lib/utils';
import type { LadderElement, GridPosition } from '../../types/ladder';

export interface LadderCellProps {
  /** Row index in the grid */
  row: number;
  /** Column index in the grid */
  col: number;
  /** Cell width in pixels */
  width: number;
  /** Cell height in pixels */
  height: number;
  /** Element in this cell (if any) */
  element?: LadderElement;
  /** Whether this cell is selected */
  isSelected?: boolean;
  /** Whether the grid is in readonly mode */
  readonly?: boolean;
  /** Called when cell is clicked */
  onClick?: (position: GridPosition, shiftKey: boolean, ctrlKey: boolean) => void;
  /** Called when cell is double-clicked */
  onDoubleClick?: (position: GridPosition) => void;
  /** Called when an element is dropped on this cell */
  onDrop?: (position: GridPosition) => void;
  /** Optional additional class names */
  className?: string;
  /** Children to render (element renderer) */
  children?: React.ReactNode;
}

/**
 * LadderCell - Single grid cell for ladder elements
 */
export function LadderCell({
  row,
  col,
  width,
  height,
  element,
  isSelected = false,
  readonly = false,
  onClick,
  onDoubleClick,
  onDrop,
  className,
  children,
}: LadderCellProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (onClick) {
        onClick({ row, col }, e.shiftKey, e.ctrlKey || e.metaKey);
      }
    },
    [onClick, row, col]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onDoubleClick) {
        onDoubleClick({ row, col });
      }
    },
    [onDoubleClick, row, col]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!readonly && onDrop) {
        onDrop({ row, col });
      }
    },
    [readonly, onDrop, row, col]
  );

  return (
    <div
      className={cn(
        // Base styles
        'relative flex items-center justify-center',
        'border border-dashed border-neutral-700/50',
        'transition-all duration-150',
        // Hover state (only when not readonly)
        !readonly && 'hover:bg-neutral-800/30 hover:border-neutral-600',
        // Selection state
        isSelected && 'ring-2 ring-blue-500 ring-inset bg-blue-500/10',
        // Empty cell indicator
        !element && !children && 'bg-neutral-900/20',
        // Readonly state
        readonly && 'cursor-default',
        !readonly && 'cursor-pointer',
        className
      )}
      style={{ width, height }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onDragOver={!readonly ? handleDragOver : undefined}
      onDrop={!readonly ? handleDrop : undefined}
      role="gridcell"
      aria-selected={isSelected}
      aria-readonly={readonly}
      data-row={row}
      data-col={col}
    >
      {/* Element content */}
      {children}

      {/* Cell position indicator (for debugging/development) */}
      {import.meta.env.DEV && !element && !children && (
        <span className="absolute bottom-0.5 right-1 text-[8px] text-neutral-600 opacity-50">
          {row},{col}
        </span>
      )}
    </div>
  );
}

export default LadderCell;
