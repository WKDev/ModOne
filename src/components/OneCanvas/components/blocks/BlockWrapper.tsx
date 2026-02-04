/**
 * Block Wrapper Component
 *
 * Provides common block styling including selection ring, drag handle,
 * and minimum size constraints.
 */

import { memo, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface BlockWrapperProps {
  /** Block ID */
  blockId: string;
  /** Whether the block is currently selected */
  isSelected?: boolean;
  /** Block content */
  children: React.ReactNode;
  /** Callback when block is clicked (for selection) - supports new event-based handler */
  onBlockClick?: (blockId: string, e: React.MouseEvent) => void;
  /** Legacy callback for backward compatibility */
  onSelect?: (blockId: string, addToSelection: boolean) => void;
  /** Drag start handler */
  onDragStart?: (blockId: string, event: React.MouseEvent) => void;
  /** Additional CSS classes */
  className?: string;
  /** Custom width */
  width?: number;
  /** Custom height */
  height?: number;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Wrapper component providing common block functionality.
 */
export const BlockWrapper = memo(function BlockWrapper({
  blockId,
  isSelected = false,
  children,
  onBlockClick,
  onSelect,
  onDragStart,
  className = '',
  width = 60,
  height = 60,
}: BlockWrapperProps) {
  // Handle mouse down for drag start
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      console.log('[BlockWrapper] MouseDown:', blockId);
      e.stopPropagation();

      // Don't handle if clicking port
      if ((e.target as HTMLElement).closest('[data-port-id]')) {
        console.log('[BlockWrapper] Port clicked, skipping');
        return;
      }

      // Call drag start handler
      if (onDragStart) {
        console.log('[BlockWrapper] Calling onDragStart:', blockId);
        onDragStart(blockId, e);
      }
    },
    [blockId, onDragStart]
  );

  // Handle mouse up - prevent canvas handler from clearing selection
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      console.log('[BlockWrapper] MouseUp:', blockId);
      e.stopPropagation();

      // Don't handle if clicking port
      if ((e.target as HTMLElement).closest('[data-port-id]')) {
        console.log('[BlockWrapper] Port clicked, skipping');
        return;
      }
    },
    [blockId]
  );

  // Handle click for selection
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      console.log('[BlockWrapper] Click:', blockId, 'onBlockClick:', !!onBlockClick, 'onSelect:', !!onSelect);
      e.stopPropagation();

      // Don't handle if clicking port
      if ((e.target as HTMLElement).closest('[data-port-id]')) {
        console.log('[BlockWrapper] Port clicked, skipping');
        return;
      }

      // Prefer new event-based handler
      if (onBlockClick) {
        console.log('[BlockWrapper] Calling onBlockClick:', blockId);
        onBlockClick(blockId, e);
      } else if (onSelect) {
        // Fallback to legacy handler
        const addToSelection = e.ctrlKey || e.metaKey;
        console.log('[BlockWrapper] Calling onSelect:', blockId, addToSelection);
        onSelect(blockId, addToSelection);
      }
    },
    [blockId, onBlockClick, onSelect]
  );

  return (
    <div
      className={`
        relative cursor-grab active:cursor-grabbing
        ${isSelected
          ? 'ring-4 ring-blue-500 ring-offset-2 bg-blue-50/30 rounded shadow-lg shadow-blue-500/50'
          : ''
        }
        ${className}
      `}
      style={{
        width,
        height,
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      data-block-id={blockId}
    >
      {children}
    </div>
  );
});

export default BlockWrapper;
