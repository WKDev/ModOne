/**
 * DroppableCell Component
 *
 * A grid cell that can receive dropped ladder elements using @dnd-kit.
 * Provides visual feedback for drag-over states and validates drop targets.
 */

import { useDroppable } from '@dnd-kit/core';
import { cn } from '../../lib/utils';
import type { LadderElement } from '../../types/ladder';

export interface DroppableCellProps {
  /** Grid row position */
  row: number;
  /** Grid column position */
  col: number;
  /** Cell width in pixels */
  width: number;
  /** Cell height in pixels */
  height: number;
  /** Element currently in this cell (if any) */
  element?: LadderElement;
  /** Whether cell is selected */
  isSelected?: boolean;
  /** Whether cell is valid drop target for current drag */
  isValidTarget?: boolean;
  /** Whether cell is in readonly mode */
  readonly?: boolean;
  /** Child content to render */
  children?: React.ReactNode;
  /** Click handler */
  onClick?: (event: React.MouseEvent) => void;
  /** Double-click handler */
  onDoubleClick?: (event: React.MouseEvent) => void;
}

/**
 * DroppableCell - Grid cell that accepts dropped elements
 */
export function DroppableCell({
  row,
  col,
  width,
  height,
  element,
  isSelected = false,
  isValidTarget = true,
  readonly = false,
  children,
  onClick,
  onDoubleClick,
}: DroppableCellProps) {
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

  // Determine if this is a valid drop target
  const isDragActive = !!active;
  const canDrop = isDragActive && !element && isValidTarget;
  const showDropIndicator = isOver && canDrop;
  const showInvalidIndicator = isOver && !canDrop && isDragActive;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative flex items-center justify-center',
        'border border-dashed',
        'transition-all duration-150',
        // Base styling
        !isDragActive && 'border-neutral-700/50',
        // Hover state when not dragging
        !isDragActive && !readonly && 'hover:bg-neutral-800/30',
        // Selection state
        isSelected && 'ring-2 ring-blue-500 ring-inset bg-blue-500/10',
        // Valid drop target
        showDropIndicator && 'bg-green-500/20 border-green-500 border-solid',
        // Invalid drop target
        showInvalidIndicator && 'bg-red-500/10 border-red-500/50',
        // Has element
        element && 'border-transparent',
        // Dragging over (general)
        isDragActive && !isOver && isValidTarget && !element && 'border-neutral-600',
        // Readonly
        readonly && 'cursor-default'
      )}
      style={{ width, height }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      data-row={row}
      data-col={col}
      data-has-element={!!element}
    >
      {/* Drop indicator overlay */}
      {showDropIndicator && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-3 h-3 rounded-full bg-green-500/50 animate-pulse" />
        </div>
      )}

      {/* Invalid drop indicator */}
      {showInvalidIndicator && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-red-400 text-lg font-bold">×</div>
        </div>
      )}

      {/* Cell content */}
      {children}
    </div>
  );
}

export default DroppableCell;
