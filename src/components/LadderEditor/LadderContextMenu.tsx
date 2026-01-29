/**
 * LadderContextMenu Component
 *
 * Right-click context menu for ladder editor operations.
 * Provides quick access to edit, clipboard, and insert operations.
 */

import { useCallback, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import type { LadderElement } from '../../types/ladder';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface LadderContextMenuProps {
  /** Menu position (screen coordinates) */
  position: ContextMenuPosition;
  /** The element at the click location (null if empty cell) */
  element: LadderElement | null;
  /** Whether there are selected elements */
  hasSelection: boolean;
  /** Whether clipboard has content */
  hasClipboard: boolean;
  /** Whether editor is in edit mode */
  isEditMode: boolean;
  /** Called when menu should close */
  onClose: () => void;
  /** Action handlers */
  onAction: (action: ContextMenuAction) => void;
}

/** Available context menu actions */
export type ContextMenuAction =
  | 'edit'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'delete'
  | 'duplicate'
  | 'insert_contact_no'
  | 'insert_contact_nc'
  | 'insert_contact_p'
  | 'insert_coil'
  | 'insert_coil_set'
  | 'insert_coil_reset'
  | 'insert_timer'
  | 'insert_counter'
  | 'add_branch'
  | 'cross_reference'
  | 'goto_definition';

/** Menu item definition */
interface MenuItem {
  label: string;
  action: ContextMenuAction;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
}

/** Divider marker */
interface MenuDivider {
  divider: true;
}

type MenuEntry = MenuItem | MenuDivider;

function isDivider(entry: MenuEntry): entry is MenuDivider {
  return 'divider' in entry && entry.divider === true;
}

/**
 * LadderContextMenu - Right-click context menu for ladder elements
 */
export function LadderContextMenu({
  position,
  element,
  hasSelection,
  hasClipboard,
  isEditMode,
  onClose,
  onAction,
}: LadderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Build menu items based on context
  const menuItems: MenuEntry[] = [];

  // Edit properties (only if element selected)
  if (element) {
    menuItems.push({
      label: 'Edit Properties',
      action: 'edit',
      shortcut: 'Enter',
    });
    menuItems.push({ divider: true });
  }

  // Clipboard operations
  menuItems.push({
    label: 'Cut',
    action: 'cut',
    shortcut: 'Ctrl+X',
    disabled: !hasSelection || !isEditMode,
  });
  menuItems.push({
    label: 'Copy',
    action: 'copy',
    shortcut: 'Ctrl+C',
    disabled: !hasSelection,
  });
  menuItems.push({
    label: 'Paste',
    action: 'paste',
    shortcut: 'Ctrl+V',
    disabled: !hasClipboard || !isEditMode,
  });
  menuItems.push({
    label: 'Delete',
    action: 'delete',
    shortcut: 'Del',
    disabled: !hasSelection || !isEditMode,
  });

  if (hasSelection && isEditMode) {
    menuItems.push({
      label: 'Duplicate',
      action: 'duplicate',
      shortcut: 'Ctrl+D',
    });
  }

  // Insert operations (only in edit mode and empty cell or with selection)
  if (isEditMode) {
    menuItems.push({ divider: true });
    menuItems.push({
      label: 'Insert NO Contact',
      action: 'insert_contact_no',
    });
    menuItems.push({
      label: 'Insert NC Contact',
      action: 'insert_contact_nc',
    });
    menuItems.push({
      label: 'Insert P Contact (Rising)',
      action: 'insert_contact_p',
    });
    menuItems.push({ divider: true });
    menuItems.push({
      label: 'Insert Coil (OUT)',
      action: 'insert_coil',
    });
    menuItems.push({
      label: 'Insert Coil (SET)',
      action: 'insert_coil_set',
    });
    menuItems.push({
      label: 'Insert Coil (RST)',
      action: 'insert_coil_reset',
    });
    menuItems.push({ divider: true });
    menuItems.push({
      label: 'Insert Timer',
      action: 'insert_timer',
    });
    menuItems.push({
      label: 'Insert Counter',
      action: 'insert_counter',
    });
  }

  // Branch operations
  if (isEditMode && element) {
    menuItems.push({ divider: true });
    menuItems.push({
      label: 'Add Parallel Branch',
      action: 'add_branch',
    });
  }

  // Cross reference (always available for elements)
  if (element) {
    menuItems.push({ divider: true });
    menuItems.push({
      label: 'Cross Reference',
      action: 'cross_reference',
    });
    menuItems.push({
      label: 'Go to Definition',
      action: 'goto_definition',
    });
  }

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    // Add listeners with slight delay to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Calculate position to keep menu within viewport
  const getAdjustedPosition = useCallback(() => {
    const menuWidth = 220;
    const menuHeight = menuItems.length * 32 + 16; // Approximate

    let x = position.x;
    let y = position.y;

    // Adjust horizontal position
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 8;
    }

    // Adjust vertical position
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 8;
    }

    // Ensure minimum position
    x = Math.max(8, x);
    y = Math.max(8, y);

    return { x, y };
  }, [position, menuItems.length]);

  const adjustedPosition = getAdjustedPosition();

  // Handle menu item click
  const handleItemClick = useCallback(
    (item: MenuItem) => {
      if (item.disabled) return;
      onAction(item.action);
      onClose();
    },
    [onAction, onClose]
  );

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-50 min-w-[200px] max-w-[280px]',
        'bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl',
        'py-1 overflow-hidden',
        'animate-in fade-in-0 zoom-in-95'
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
      role="menu"
      aria-label="Context menu"
    >
      {menuItems.map((item, index) => {
        if (isDivider(item)) {
          return (
            <div
              key={`divider-${index}`}
              className="my-1 border-t border-neutral-700"
              role="separator"
            />
          );
        }

        return (
          <button
            key={item.action}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => handleItemClick(item)}
            className={cn(
              'w-full px-3 py-1.5 text-left text-sm',
              'flex items-center justify-between gap-4',
              'transition-colors',
              item.disabled
                ? 'text-neutral-500 cursor-not-allowed'
                : 'text-neutral-200 hover:bg-neutral-700 cursor-pointer'
            )}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="text-xs text-neutral-500">{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default LadderContextMenu;
