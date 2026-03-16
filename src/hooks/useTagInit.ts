/**
 * Tag Initialization Hook
 *
 * Centralizes tag event subscription.
 * Call once in App.tsx to keep tagStore in sync with backend events.
 */

import { useEffect } from 'react';
import { useTagStore } from '../stores/tagStore';
import { tagService } from '../services/tagService';

export function useTagInit() {
  const { fetchRegistry, handleValueChanged } = useTagStore();

  useEffect(() => {
    let unlistenValue: (() => void) | undefined;
    let unlistenRegistry: (() => void) | undefined;

    // Initial registry fetch
    fetchRegistry();

    // Subscribe to tag value changes
    tagService
      .onValueChanged((event) => {
        handleValueChanged(event);
      })
      .then((dispose) => {
        unlistenValue = dispose;
      });

    // Subscribe to registry changes (auto re-fetch)
    tagService
      .onRegistryChanged(() => {
        fetchRegistry();
      })
      .then((dispose) => {
        unlistenRegistry = dispose;
      });

    return () => {
      unlistenValue?.();
      unlistenRegistry?.();
    };
  }, [fetchRegistry, handleValueChanged]);
}
