/**
 * Tag Store - Zustand State Management for Tag System
 *
 * Manages tag registry, watched tags, live tag values, and error handling.
 */

import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { tagService } from '../services/tagService';
import type {
  CreateTagRequest,
  TagDefinition,
  TagTypedValue,
  TagValueChangedEvent,
  UpdateTagRequest,
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
  /** Initialise the watched set from persisted project data (e.g. on project open) */
  initWatchedTags: (tagIds: string[]) => void;
  /** Add tags to the watched set */
  addWatchedTags: (tagIds: string[]) => void;
  /** Remove tags from the watched set */
  removeWatchedTags: (tagIds: string[]) => void;
  /** Read current values for specific tags */
  readTagValues: (tagIds: string[]) => Promise<void>;
  /** Write a value to a tag */
  writeTag: (tagId: string, value: TagTypedValue) => Promise<void>;
  /** Create a new tag */
  createTag: (request: CreateTagRequest) => Promise<TagDefinition | null>;
  /** Delete a tag */
  deleteTag: (tagId: string) => Promise<boolean>;
  /** Bulk-delete multiple tags. Returns the IDs that were successfully deleted. */
  deleteTags: (tagIds: string[]) => Promise<string[]>;
  /** Update a tag definition (metadata fields) and sync to registry */
  updateTagDefinition: (request: UpdateTagRequest) => Promise<void>;
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

/**
 * Persist the current watched tag IDs to the project config on the backend.
 * Fire-and-forget – errors are silently ignored since the next project save
 * will pick up the in-memory state anyway.
 */
function syncWatchedTagsToProject(watchedTagIds: Set<string>): void {
  invoke('set_project_watched_tags', {
    tagIds: [...watchedTagIds],
  }).catch(() => {});
}

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

      initWatchedTags: (tagIds) => {
        if (tagIds.length === 0) return;

        set(
          (state) => {
            state.watchedTagIds = new Set(tagIds);
          },
          false,
          'initWatchedTags',
        );

        // Sync to runtime tag event bridge and read initial values
        tagService.setWatchedTags(tagIds).catch(() => {});
        tagService
          .readTags(tagIds)
          .then((values) => {
            set(
              (state) => {
                for (const tv of values) {
                  state.tagValues.set(tv.tagId, tv.value);
                }
              },
              false,
              'initWatchedTags/initialValues',
            );
          })
          .catch(() => {});
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
        syncWatchedTagsToProject(updated);
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
        syncWatchedTagsToProject(updated);
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

      createTag: async (request) => {
        try {
          const created = await tagService.createTag(request);
          set(
            (state) => {
              state.registry.push(created);
            },
            false,
            'createTag',
          );
          return created;
        } catch {
          return null;
        }
      },

      deleteTag: async (tagId) => {
        try {
          await tagService.deleteTag(tagId);
          const wasWatched = get().watchedTagIds.has(tagId);
          set(
            (state) => {
              state.registry = state.registry.filter((t) => t.tagId !== tagId);
              state.watchedTagIds.delete(tagId);
              state.tagValues.delete(tagId);
            },
            false,
            'deleteTag',
          );
          if (wasWatched) {
            syncWatchedTagsToProject(get().watchedTagIds);
          }
          return true;
        } catch {
          return false;
        }
      },

      deleteTags: async (tagIds) => {
        try {
          const deleted = await tagService.deleteTags(tagIds);
          if (deleted.length > 0) {
            const watchedBefore = get().watchedTagIds;
            const hadWatched = deleted.some((id) => watchedBefore.has(id));
            const deletedSet = new Set(deleted);
            set(
              (state) => {
                state.registry = state.registry.filter(
                  (t) => !deletedSet.has(t.tagId),
                );
                for (const id of deleted) {
                  state.watchedTagIds.delete(id);
                  state.tagValues.delete(id);
                }
              },
              false,
              'deleteTags',
            );
            if (hadWatched) {
              syncWatchedTagsToProject(get().watchedTagIds);
            }
          }
          return deleted;
        } catch {
          return [];
        }
      },

      updateTagDefinition: async (request) => {
        try {
          const updated = await tagService.updateTagDefinition(request);
          set(
            (state) => {
              const idx = state.registry.findIndex(
                (t) => t.tagId === request.tagId,
              );
              if (idx !== -1) {
                state.registry[idx] = updated;
              }
            },
            false,
            'updateTagDefinition',
          );
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
