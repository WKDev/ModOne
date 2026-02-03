/**
 * WireContextMenu Component
 *
 * Context menu that appears when right-clicking on a wire.
 * Provides options for wire manipulation like adding junctions, handles, or deleting.
 */

import { memo, useEffect, useCallback } from 'react';
import type { Position } from '../types';

// ============================================================================
// Types
// ============================================================================

/** Available context menu actions */
export type WireContextMenuAction = 'add_junction' | 'add_handle' | 'delete';

interface WireContextMenuProps {
  /** Screen position to display the menu */
  screenPosition: { x: number; y: number };
  /** Wire ID for the wire being acted upon */
  wireId: string;
  /** Position on the wire where user right-clicked */
  wireClickPosition: Position;
  /** Close the menu */
  onClose: () => void;
  /** Handle menu action selection */
  onAction: (action: WireContextMenuAction) => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * WireContextMenu - Right-click context menu for wire operations.
 *
 * Features:
 * - Add Junction: Creates a junction node splitting the wire
 * - Add Control Point: Adds a draggable handle for custom routing
 * - Delete Wire: Removes the wire connection
 */
export const WireContextMenu = memo(function WireContextMenu({
  screenPosition,
  wireId: _wireId,
  wireClickPosition: _wireClickPosition,
  onClose,
  onAction,
}: WireContextMenuProps) {
  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = () => {
      // Small delay to prevent immediate close on the same click
      setTimeout(() => {
        onClose();
      }, 0);
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Add listeners with a small delay to prevent immediate trigger
    const timeoutId = setTimeout(() => {
      window.addEventListener('click', handleClickOutside);
      window.addEventListener('keydown', handleEscape);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Handle menu item click
  const handleItemClick = useCallback(
    (action: WireContextMenuAction) => (e: React.MouseEvent) => {
      e.stopPropagation();
      onAction(action);
    },
    [onAction]
  );

  // Prevent context menu from closing when clicking inside it
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Calculate position to keep menu in viewport
  const menuStyle = {
    left: screenPosition.x,
    top: screenPosition.y,
  };

  return (
    <div
      className="fixed z-50 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={menuStyle}
      onClick={handleMenuClick}
    >
      {/* Add Junction */}
      <button
        className="w-full px-4 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700 flex items-center gap-2 transition-colors"
        onClick={handleItemClick('add_junction')}
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="3" />
          <line x1="0" y1="8" x2="5" y2="8" />
          <line x1="11" y1="8" x2="16" y2="8" />
          <line x1="8" y1="0" x2="8" y2="5" />
        </svg>
        Add Junction
      </button>

      {/* Add Control Point */}
      <button
        className="w-full px-4 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700 flex items-center gap-2 transition-colors"
        onClick={handleItemClick('add_handle')}
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="2.5" fill="currentColor" />
          <line x1="0" y1="8" x2="5.5" y2="8" />
          <line x1="10.5" y1="8" x2="16" y2="8" />
        </svg>
        Add Control Point
      </button>

      {/* Separator */}
      <hr className="my-1 border-neutral-700" />

      {/* Delete Wire */}
      <button
        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-neutral-700 flex items-center gap-2 transition-colors"
        onClick={handleItemClick('delete')}
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="3" y1="3" x2="13" y2="13" />
          <line x1="13" y1="3" x2="3" y2="13" />
        </svg>
        Delete Wire
      </button>
    </div>
  );
});

export default WireContextMenu;
