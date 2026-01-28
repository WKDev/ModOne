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
  /** Callback when block is clicked (for selection) */
  onSelect?: (blockId: string, addToSelection: boolean) => void;
  /** Additional CSS classes */
  className?: string;
  /** Custom width */
  width?: number;
  /** Custom height */
  height?: number;
}

// ============================================================================
// Constants
// ============================================================================

const MIN_WIDTH = 60;
const MIN_HEIGHT = 60;

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
  onSelect,
  className = '',
  width = MIN_WIDTH,
  height = MIN_HEIGHT,
}: BlockWrapperProps) {
  // Handle click for selection
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const addToSelection = e.ctrlKey || e.metaKey;
      onSelect?.(blockId, addToSelection);
    },
    [blockId, onSelect]
  );

  return (
    <div
      className={`
        relative cursor-grab active:cursor-grabbing
        ${isSelected ? 'outline outline-2 outline-blue-500 outline-offset-2 rounded' : ''}
        ${className}
      `}
      style={{
        width: Math.max(width, MIN_WIDTH),
        height: Math.max(height, MIN_HEIGHT),
      }}
      onClick={handleClick}
      data-block-id={blockId}
    >
      {children}
    </div>
  );
});

export default BlockWrapper;
