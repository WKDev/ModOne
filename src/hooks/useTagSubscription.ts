/**
 * Tag Subscription Hook
 *
 * Manages the lifecycle of tag subscriptions for a component.
 * Adds tags to the watched set on mount, removes on unmount,
 * and returns live values from the store.
 */

import { useEffect, useRef } from 'react';
import { useTagStore } from '../stores/tagStore';
import type { TagTypedValue } from '../types/tags';

export function useTagSubscription(tagIds: string[]): {
  values: Map<string, TagTypedValue>;
  isLoading: boolean;
  error: string | null;
} {
  const addWatchedTags = useTagStore((s) => s.addWatchedTags);
  const removeWatchedTags = useTagStore((s) => s.removeWatchedTags);
  const values = useTagStore((s) => s.tagValues);
  const isLoading = useTagStore((s) => s.isLoadingRegistry);
  const error = useTagStore((s) => s.error);

  const prevIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const prev = prevIdsRef.current;
    const added = tagIds.filter((id) => !prev.includes(id));
    const removed = prev.filter((id) => !tagIds.includes(id));

    if (added.length > 0) addWatchedTags(added);
    if (removed.length > 0) removeWatchedTags(removed);

    prevIdsRef.current = tagIds;
  }, [tagIds, addWatchedTags, removeWatchedTags]);

  useEffect(() => {
    return () => {
      if (prevIdsRef.current.length > 0) {
        removeWatchedTags(prevIdsRef.current);
      }
    };
  }, [removeWatchedTags]);

  return { values, isLoading, error };
}
