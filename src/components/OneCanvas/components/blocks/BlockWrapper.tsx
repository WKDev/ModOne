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
  className = '',
  width = 60,
  height = 60,
}: BlockWrapperProps) {
  // Handle click for selection
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      // Prefer new event-based handler
      if (onBlockClick) {
        onBlockClick(blockId, e);
      } else if (onSelect) {
        // Fallback to legacy handler
        const addToSelection = e.ctrlKey || e.metaKey;
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
      onClick={handleClick}
      data-block-id={blockId}
    >
      {children}
    </div>
  );
});

export default BlockWrapper;
