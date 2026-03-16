/**
 * Tag Store - Zustand State Management for Tag System
 *
 * Manages tag registry, watched tags, live tag values, and error handling.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { tagService } from '../services/tagService';
import type {
  TagDefinition,
  TagTypedValue,
  TagValueChangedEvent,
} from '../types/tags';

// ============================================================================
// Types
// ============================================================================

interface TagState {
  /** Cached full tag list */
  registry: TagDefinition[];
  /** Aggregate set of tag IDs being watched */
  watchedTagIds: Set<string>;
  /** Live tag values keyed by tag ID */
  tagValues: Map<string, TagTypedValue>;
  /** Whether registry is loading */
  isLoadingRegistry: boolean;
  /** Last error message */
  error: string | null;
}

interface TagActions {
  /** Fetch full tag registry from backend */
  fetchRegistry: () => Promise<void>;
  /** Add tags to the watched set */
  addWatchedTags: (tagIds: string[]) => void;
  /** Remove tags from the watched set */
  removeWatchedTags: (tagIds: string[]) => void;
  /** Read current values for specific tags */
  readTagValues: (tagIds: string[]) => Promise<void>;
  /** Write a value to a tag */
  writeTag: (tagId: string, value: TagTypedValue) => Promise<void>;
  /** Handle a value-changed event from the backend */
  handleValueChanged: (event: TagValueChangedEvent) => void;
  /** Set error message */
  setError: (error: string | null) => void;
  /** Reset store to initial state */
  reset: () => void;
}

type TagStore = TagState & TagActions;

// ============================================================================
// Initial State
// ============================================================================

const initialState: TagState = {
  registry: [],
  watchedTagIds: new Set(),
  tagValues: new Map(),
  isLoadingRegistry: false,
  error: null,
};

// ============================================================================
// Store
// ============================================================================

export const useTagStore = create<TagStore>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      fetchRegistry: async () => {
        set(
          (state) => {
            state.isLoadingRegistry = true;
            state.error = null;
          },
          false,
          'fetchRegistry/start',
        );

        try {
          const tags = await tagService.listTags();
          set(
            (state) => {
              state.registry = tags;
              state.isLoadingRegistry = false;
            },
            false,
            'fetchRegistry/success',
          );
        } catch (error) {
          const msg =
            error instanceof Error ? error.message : String(error);
          console.error('Failed to fetch tag registry:', msg);
          set(
            (state) => {
              state.isLoadingRegistry = false;
              state.error = msg;
            },
            false,
            'fetchRegistry/error',
          );
        }
      },

      addWatchedTags: (tagIds) => {
        const current = get().watchedTagIds;
        const newIds = tagIds.filter((id) => !current.has(id));
        if (newIds.length === 0) return;

        set(
          (state) => {
            for (const id of newIds) {
              state.watchedTagIds.add(id);
            }
          },
          false,
          'addWatchedTags',
        );

        const updated = get().watchedTagIds;
        tagService.setWatchedTags([...updated]).catch(() => {});
        tagService
          .readTags(newIds)
          .then((values) => {
            set(
              (state) => {
                for (const tv of values) {
                  state.tagValues.set(tv.tagId, tv.value);
                }
              },
              false,
              'addWatchedTags/initialValues',
            );
          })
          .catch(() => {});
      },

      removeWatchedTags: (tagIds) => {
        set(
          (state) => {
            for (const id of tagIds) {
              state.watchedTagIds.delete(id);
              state.tagValues.delete(id);
            }
          },
          false,
          'removeWatchedTags',
        );

        const updated = get().watchedTagIds;
        tagService.setWatchedTags([...updated]).catch(() => {});
      },

      readTagValues: async (tagIds) => {
        try {
          const values = await tagService.readTags(tagIds);
          set(
            (state) => {
              for (const tv of values) {
                state.tagValues.set(tv.tagId, tv.value);
              }
            },
            false,
            'readTagValues',
          );
        } catch {
          // Error already toasted by service
        }
      },

      writeTag: async (tagId, value) => {
        try {
          await tagService.writeTag(tagId, value);
        } catch {
          // Error already toasted by service
        }
      },

      handleValueChanged: (event) => {
        set(
          (state) => {
            state.tagValues.set(event.tagId, event.value);
          },
          false,
          'handleValueChanged',
        );
      },

      setError: (error) => {
        set((state) => {
          state.error = error;
        }, false, 'setError');
      },

      reset: () => {
        set(() => ({ ...initialState }), false, 'reset');
      },
    })),
    { name: 'tag-store' },
  ),
);

// ============================================================================
// Selectors
// ============================================================================

export const selectTagRegistry = (state: TagStore) => state.registry;
export const selectTagValues = (state: TagStore) => state.tagValues;
export const selectWatchedTagIds = (state: TagStore) => state.watchedTagIds;
export const selectIsLoadingRegistry = (state: TagStore) =>
  state.isLoadingRegistry;
export const selectTagError = (state: TagStore) => state.error;

export default useTagStore;
