import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface MultiSelectState<T> {
  /** Set of currently selected item IDs */
  selectedIds: Set<string>;
  /** Handle a click on an item with Ctrl/Shift modifier support */
  handleItemClick: (item: T, e: React.MouseEvent) => void;
  /** Select all items currently in the list */
  selectAll: () => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Replace the selected set (e.g. when external code needs to set selection) */
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export interface UseMultiSelectOptions<T> {
  /** The ordered list of items (used for range selection) */
  items: T[];
  /** Extract a unique string ID from an item */
  getItemId: (item: T) => string;
  /** Callback when a single item is clicked (no modifier) */
  onSingleSelect?: (itemId: string) => void;
  /** Callback whenever the selected IDs set changes */
  onSelectionChange?: (selectedIds: Set<string>) => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useMultiSelect – generic multi-select hook with Shift+click range
 * and Ctrl/Cmd+click individual toggle.
 *
 * Uses an internal ID-based index map so range selection works correctly
 * regardless of the caller's row index (e.g. virtualised tree views
 * that mix headers and items).
 *
 * Also supports Ctrl/Cmd+A to select all when the container is focused.
 */
export function useMultiSelect<T>({
  items,
  getItemId,
  onSingleSelect,
  onSelectionChange,
}: UseMultiSelectOptions<T>): MultiSelectState<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedId = useRef<string | null>(null);

  // Notify parent when selection changes
  useEffect(() => {
    onSelectionChange?.(selectedIds);
  }, [selectedIds, onSelectionChange]);

  // Map item ID → index in the items array for O(1) range resolution
  const idToIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < items.length; i++) {
      map.set(getItemId(items[i]), i);
    }
    return map;
  }, [items, getItemId]);

  const handleItemClick = useCallback(
    (item: T, e: React.MouseEvent) => {
      const itemId = getItemId(item);
      const currentIndex = idToIndex.get(itemId);
      if (currentIndex === undefined) return;

      if (e.ctrlKey || e.metaKey) {
        // ── Ctrl/Cmd+Click: toggle individual selection ──────────────
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(itemId)) {
            next.delete(itemId);
          } else {
            next.add(itemId);
          }
          return next;
        });
      } else if (e.shiftKey && lastClickedId.current !== null) {
        // ── Shift+Click: range selection ─────────────────────────────
        const anchorIndex = idToIndex.get(lastClickedId.current);
        if (anchorIndex !== undefined) {
          const start = Math.min(anchorIndex, currentIndex);
          const end = Math.max(anchorIndex, currentIndex);
          const rangeIds = new Set<string>();
          for (let i = start; i <= end; i++) {
            rangeIds.add(getItemId(items[i]));
          }
          setSelectedIds(rangeIds);
        } else {
          // Anchor no longer in list – treat as single select
          setSelectedIds(new Set([itemId]));
          onSingleSelect?.(itemId);
        }
      } else {
        // ── Plain click: single selection ────────────────────────────
        setSelectedIds(new Set([itemId]));
        onSingleSelect?.(itemId);
      }

      lastClickedId.current = itemId;
    },
    [getItemId, idToIndex, items, onSingleSelect],
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(getItemId)));
  }, [items, getItemId]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    handleItemClick,
    selectAll,
    clearSelection,
    setSelectedIds,
  };
}
