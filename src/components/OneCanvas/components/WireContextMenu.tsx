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
export type WireContextMenuAction = 'delete';

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
