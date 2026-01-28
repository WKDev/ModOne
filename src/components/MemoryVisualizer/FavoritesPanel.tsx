/**
 * Favorites Panel Component
 *
 * Collapsible panel for managing favorite memory addresses.
 */

import { useState } from 'react';
import { Star, ChevronDown, ChevronRight } from 'lucide-react';
import { FavoriteItem } from './FavoriteItem';
import type {
  FavoriteItem as FavoriteItemType,
  ContextMenuPosition,
} from './types';
import type { MemoryType } from '../../types/modbus';

// ============================================================================
// Types
// ============================================================================

interface FavoritesPanelProps {
  /** List of favorite items */
  favorites: FavoriteItemType[];
  /** Callback to navigate to an address in the table */
  onNavigateToAddress?: (memoryType: MemoryType, address: number) => void;
  /** Function to get current value for an address */
  getValueForAddress: (
    memoryType: MemoryType,
    address: number
  ) => boolean | number | undefined;
  /** Callback when a favorite is edited */
  onEditFavorite: (item: FavoriteItemType) => void;
  /** Callback when a favorite is removed */
  onRemoveFavorite: (id: string) => void;
  /** Callback for context menu */
  onContextMenu?: (
    e: React.MouseEvent,
    item: FavoriteItemType,
    position: ContextMenuPosition
  ) => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Collapsible panel displaying favorite memory addresses.
 */
export function FavoritesPanel({
  favorites,
  onNavigateToAddress,
  getValueForAddress,
  onEditFavorite,
  onRemoveFavorite,
  onContextMenu,
}: FavoritesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border-t border-neutral-700">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 p-2 transition-colors hover:bg-neutral-800"
      >
        {isExpanded ? (
          <ChevronDown size={14} className="text-neutral-400" />
        ) : (
          <ChevronRight size={14} className="text-neutral-400" />
        )}
        <Star size={14} className="text-yellow-500" />
        <span className="text-sm font-medium text-white">Favorites</span>
        <span className="text-xs text-neutral-500">({favorites.length})</span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="max-h-48 space-y-1 overflow-y-auto p-2">
          {favorites.length === 0 ? (
            <p className="py-4 text-center text-xs text-neutral-500">
              Right-click on a cell and select "Add to Favorites" to add items
              here.
            </p>
          ) : (
            favorites.map((item) => (
              <FavoriteItem
                key={item.id}
                item={item}
                currentValue={getValueForAddress(item.memoryType, item.address)}
                onEdit={() => onEditFavorite(item)}
                onRemove={() => onRemoveFavorite(item.id)}
                onClick={
                  onNavigateToAddress
                    ? () => onNavigateToAddress(item.memoryType, item.address)
                    : undefined
                }
                onContextMenu={(e) => {
                  if (onContextMenu) {
                    e.preventDefault();
                    onContextMenu(e, item, { x: e.clientX, y: e.clientY });
                  }
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default FavoritesPanel;
