/**
 * useFavorites Hook
 *
 * Manages favorite memory addresses with localStorage persistence.
 */

import { useState, useCallback, useEffect } from 'react';
import type { FavoriteItem } from '../types';

const STORAGE_KEY = 'modone-memory-favorites';

/**
 * Hook for managing favorite memory addresses.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setFavorites(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to parse favorites from localStorage:', e);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage on change (only after initial load)
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
      } catch (e) {
        console.error('Failed to save favorites to localStorage:', e);
      }
    }
  }, [favorites, isLoaded]);

  /**
   * Add a new favorite item.
   */
  const addFavorite = useCallback(
    (item: Omit<FavoriteItem, 'id'>): FavoriteItem => {
      const newItem: FavoriteItem = {
        ...item,
        id: crypto.randomUUID(),
      };
      setFavorites((prev) => [...prev, newItem]);
      return newItem;
    },
    []
  );

  /**
   * Update an existing favorite item.
   */
  const updateFavorite = useCallback(
    (id: string, updates: Partial<Omit<FavoriteItem, 'id'>>) => {
      setFavorites((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    },
    []
  );

  /**
   * Remove a favorite item.
   */
  const removeFavorite = useCallback((id: string) => {
    setFavorites((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /**
   * Reorder favorites (for drag-and-drop).
   */
  const reorderFavorites = useCallback((fromIndex: number, toIndex: number) => {
    setFavorites((prev) => {
      const updated = [...prev];
      const [removed] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, removed);
      return updated;
    });
  }, []);

  /**
   * Check if an address is a favorite.
   */
  const isFavorite = useCallback(
    (memoryType: string, address: number): boolean => {
      return favorites.some(
        (item) => item.memoryType === memoryType && item.address === address
      );
    },
    [favorites]
  );

  /**
   * Get favorite by address (if exists).
   */
  const getFavoriteByAddress = useCallback(
    (memoryType: string, address: number): FavoriteItem | undefined => {
      return favorites.find(
        (item) => item.memoryType === memoryType && item.address === address
      );
    },
    [favorites]
  );

  return {
    favorites,
    addFavorite,
    updateFavorite,
    removeFavorite,
    reorderFavorites,
    isFavorite,
    getFavoriteByAddress,
    isLoaded,
  };
}

export default useFavorites;
