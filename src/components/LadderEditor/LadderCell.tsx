/**
 * LadderCell Component
 *
 * Represents a single cell in the ladder diagram grid.
 * Can contain ladder elements and supports selection, hover states,
 * and @dnd-kit drag-and-drop operations.
 */

import { useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
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
  /** Whether this is a valid drop target for current drag */
  isValidDropTarget?: boolean;
  /** Called when cell is clicked */
  onClick?: (position: GridPosition, shiftKey: boolean, ctrlKey: boolean) => void;
  /** Called when cell is double-clicked */
  onDoubleClick?: (position: GridPosition) => void;
  /** Optional additional class names */
  className?: string;
  /** Children to render (element renderer) */
  children?: React.ReactNode;
}

/**
 * LadderCell - Single grid cell for ladder elements with @dnd-kit integration
 */
export function LadderCell({
  row,
  col,
  width,
  height,
  element,
  isSelected = false,
  readonly = false,
  isValidDropTarget = true,
  onClick,
  onDoubleClick,
  className,
  children,
}: LadderCellProps) {
  // @dnd-kit droppable setup
  const { setNodeRef, isOver, active } = useDroppable({
    id: `cell-${row}-${col}`,
    data: {
      type: 'grid-cell',
      row,
      col,
      hasElement: !!element,
      elementId: element?.id,
    },
    disabled: readonly,
  });

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

  // Drag state calculations
  const isDragActive = !!active;
  const canDrop = isDragActive && !element && isValidDropTarget;
  const showDropIndicator = isOver && canDrop;
  const showInvalidIndicator = isOver && !canDrop && isDragActive;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        // Base styles
        'relative flex items-center justify-center',
        'border border-dashed',
        'transition-all duration-150',
        // Base border color
        !isDragActive && 'border-neutral-700/50',
        // Hover state (only when not readonly and not dragging)
        !readonly && !isDragActive && 'hover:bg-neutral-800/30 hover:border-neutral-600',
        // Selection state
        isSelected && 'ring-2 ring-blue-500 ring-inset bg-blue-500/10',
        // Valid drop target indicator
        showDropIndicator && 'bg-green-500/20 border-green-500 border-solid',
        // Invalid drop target indicator
        showInvalidIndicator && 'bg-red-500/10 border-red-500/50',
        // Potential drop target (during drag)
        isDragActive && !isOver && isValidDropTarget && !element && 'border-neutral-600',
        // Empty cell indicator (no drag active)
        !element && !children && !isDragActive && 'bg-neutral-900/20',
        // Readonly state
        readonly && 'cursor-default',
        !readonly && !isDragActive && 'cursor-pointer',
        className
      )}
      style={{ width, height }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      role="gridcell"
      aria-selected={isSelected}
      aria-readonly={readonly}
      data-row={row}
      data-col={col}
    >
      {/* Drop indicator overlay */}
      {showDropIndicator && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-3 h-3 rounded-full bg-green-500/50 animate-pulse" />
        </div>
      )}

      {/* Invalid drop indicator */}
      {showInvalidIndicator && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-red-400 text-lg font-bold">×</div>
        </div>
      )}

      {/* Element content */}
      {children}

      {/* Cell position indicator (for debugging/development) */}
      {import.meta.env.DEV && !element && !children && !isDragActive && (
        <span className="absolute bottom-0.5 right-1 text-[8px] text-neutral-600 opacity-50">
          {row},{col}
        </span>
      )}
    </div>
  );
}

export default LadderCell;
