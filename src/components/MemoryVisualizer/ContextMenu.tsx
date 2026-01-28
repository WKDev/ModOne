/**
 * Context Menu Component
 *
 * Reusable context menu for Memory Visualizer with table cell and favorites support.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Star,
  Copy,
  ArrowUp,
  ArrowDown,
  Pencil,
  Palette,
  Hash,
  Trash2,
} from 'lucide-react';
import type {
  ContextMenuPosition,
  CellSelection,
  FavoriteItem,
  DisplayFormat,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  /** Position to display the menu */
  position: ContextMenuPosition;
  /** Callback when menu should close */
  onClose: () => void;
  /** Menu items to display */
  items: MenuItem[];
}

// ============================================================================
// Context Menu Component
// ============================================================================

/**
 * Reusable context menu with keyboard navigation and click-outside handling.
 */
export function ContextMenu({ position, onClose, items }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const newPosition = { ...position };

      // Adjust horizontal position
      if (position.x + rect.width > window.innerWidth) {
        newPosition.x = window.innerWidth - rect.width - 10;
      }

      // Adjust vertical position
      if (position.y + rect.height > window.innerHeight) {
        newPosition.y = window.innerHeight - rect.height - 10;
      }

      setAdjustedPosition(newPosition);
    }
  }, [position]);

  // Click outside and keyboard handling
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;

        case 'ArrowDown': {
          e.preventDefault();
          const nextIndex = findNextEnabledIndex(focusedIndex, 1);
          setFocusedIndex(nextIndex);
          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          const prevIndex = findNextEnabledIndex(focusedIndex, -1);
          setFocusedIndex(prevIndex);
          break;
        }

        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < items.length) {
            const item = items[focusedIndex];
            if (!item.disabled && !item.divider) {
              item.onClick();
              onClose();
            }
          }
          break;
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, focusedIndex, items]);

  // Find next enabled (non-divider, non-disabled) item index
  const findNextEnabledIndex = (current: number, direction: 1 | -1): number => {
    let index = current;
    const length = items.length;

    for (let i = 0; i < length; i++) {
      index = (index + direction + length) % length;
      const item = items[index];
      if (!item.divider && !item.disabled) {
        return index;
      }
    }

    return current;
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-40 rounded-lg border border-neutral-600 bg-neutral-800 py-1 shadow-xl"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      {items.map((item, index) =>
        item.divider ? (
          <hr key={index} className="my-1 border-neutral-700" />
        ) : (
          <button
            key={index}
            type="button"
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
              focusedIndex === index
                ? 'bg-neutral-700 text-white'
                : 'text-neutral-200 hover:bg-neutral-700'
            } ${item.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {item.icon}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

// ============================================================================
// Menu Item Builders
// ============================================================================

/**
 * Build context menu items for a table cell.
 */
export function buildCellMenuItems(
  _cell: CellSelection,
  isReadOnly: boolean,
  isFavorite: boolean,
  handlers: {
    onAddToFavorites: () => void;
    onRemoveFromFavorites: () => void;
    onCopyAddress: () => void;
    onCopyValue: () => void;
    onSetValue: (value: number) => void;
  }
): MenuItem[] {
  const items: MenuItem[] = [
    isFavorite
      ? {
          label: 'Remove from Favorites',
          icon: <Star size={14} className="text-yellow-500" fill="currentColor" />,
          onClick: handlers.onRemoveFromFavorites,
        }
      : {
          label: 'Add to Favorites',
          icon: <Star size={14} className="text-yellow-500" />,
          onClick: handlers.onAddToFavorites,
        },
    { label: '', divider: true, onClick: () => {} },
    {
      label: 'Copy Address',
      icon: <Copy size={14} />,
      onClick: handlers.onCopyAddress,
    },
    {
      label: 'Copy Value',
      icon: <Copy size={14} />,
      onClick: handlers.onCopyValue,
    },
  ];

  if (!isReadOnly) {
    items.push(
      { label: '', divider: true, onClick: () => {} },
      {
        label: 'Set to 0',
        icon: <Hash size={14} />,
        onClick: () => handlers.onSetValue(0),
      },
      {
        label: 'Set to 1',
        icon: <Hash size={14} />,
        onClick: () => handlers.onSetValue(1),
      }
    );
  }

  return items;
}

/**
 * Build context menu items for a favorite item.
 */
export function buildFavoriteMenuItems(
  favorite: FavoriteItem,
  handlers: {
    onEditLabel: () => void;
    onChangeColor: () => void;
    onChangeFormat: (format: DisplayFormat) => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onRemove: () => void;
  },
  canMoveUp: boolean,
  canMoveDown: boolean
): MenuItem[] {
  return [
    {
      label: 'Edit Label',
      icon: <Pencil size={14} />,
      onClick: handlers.onEditLabel,
    },
    {
      label: 'Change Color',
      icon: <Palette size={14} />,
      onClick: handlers.onChangeColor,
    },
    { label: '', divider: true, onClick: () => {} },
    {
      label: 'Format: DEC',
      onClick: () => handlers.onChangeFormat('DEC'),
      disabled: favorite.displayFormat === 'DEC',
    },
    {
      label: 'Format: HEX',
      onClick: () => handlers.onChangeFormat('HEX'),
      disabled: favorite.displayFormat === 'HEX',
    },
    {
      label: 'Format: BINARY',
      onClick: () => handlers.onChangeFormat('BINARY'),
      disabled: favorite.displayFormat === 'BINARY',
    },
    { label: '', divider: true, onClick: () => {} },
    {
      label: 'Move Up',
      icon: <ArrowUp size={14} />,
      onClick: handlers.onMoveUp,
      disabled: !canMoveUp,
    },
    {
      label: 'Move Down',
      icon: <ArrowDown size={14} />,
      onClick: handlers.onMoveDown,
      disabled: !canMoveDown,
    },
    { label: '', divider: true, onClick: () => {} },
    {
      label: 'Remove',
      icon: <Trash2 size={14} className="text-red-400" />,
      onClick: handlers.onRemove,
    },
  ];
}

export default ContextMenu;
