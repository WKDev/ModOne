/**
 * State Synchronization Utility
 *
 * Enables Zustand store state synchronization between main window and floating windows.
 * Each Tauri window has its own JavaScript context, so this uses Tauri events for cross-window communication.
 */

import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';

const STATE_SYNC_EVENT = 'modone:state-sync';

/**
 * Payload for state synchronization events
 */
interface StateSyncPayload<T = unknown> {
  /** Name of the store being synchronized */
  storeName: string;
  /** The state to synchronize */
  state: T;
  /** Window ID of the source window */
  sourceWindowId: string;
  /** Timestamp to handle ordering */
  timestamp: number;
}

/**
 * Get the current window ID from URL parameters or default to 'main'
 */
function getWindowId(): string {
  if (typeof window === 'undefined') return 'main';
  const params = new URLSearchParams(window.location.search);
  return params.get('windowId') || 'main';
}

/**
 * State sync controller for a specific store
 */
export interface StateSyncController<T> {
  /** Broadcast the current state to other windows */
  broadcastState: (state: T) => void;
  /** Cleanup listeners */
  cleanup: () => Promise<void>;
  /** Whether sync is active */
  isActive: boolean;
}

/**
 * Set up state synchronization for a Zustand store
 *
 * @param storeName - Unique name for the store
 * @param setState - Function to update the store state
 * @param options - Optional configuration
 * @returns State sync controller
 */
export function setupStateSync<T>(
  storeName: string,
  setState: (state: T) => void,
  options: {
    /** Filter which state changes to broadcast */
    shouldBroadcast?: (state: T) => boolean;
    /** Transform state before broadcasting */
    transformForBroadcast?: (state: T) => Partial<T>;
    /** Merge received state with current state */
    mergeState?: (current: T, received: Partial<T>) => T;
  } = {}
): StateSyncController<T> {
  const windowId = getWindowId();
  let unlistenFn: UnlistenFn | null = null;
  let isActive = false;

  const { shouldBroadcast, transformForBroadcast, mergeState } = options;

  /**
   * Broadcast state to other windows
   */
  const broadcastState = (state: T): void => {
    if (!isActive) return;

    // Check if we should broadcast this state
    if (shouldBroadcast && !shouldBroadcast(state)) {
      return;
    }

    // Transform state if needed
    const stateToSend = transformForBroadcast ? transformForBroadcast(state) : state;

    const payload: StateSyncPayload<T | Partial<T>> = {
      storeName,
      state: stateToSend,
      sourceWindowId: windowId,
      timestamp: Date.now(),
    };

    emit(STATE_SYNC_EVENT, payload).catch((error) => {
      console.warn(`Failed to broadcast state for ${storeName}:`, error);
    });
  };

  /**
   * Handle incoming state from other windows
   */
  const handleStateReceived = (event: { payload: StateSyncPayload<T> }): void => {
    const { storeName: receivedStoreName, state, sourceWindowId } = event.payload;

    // Ignore our own broadcasts and messages for other stores
    if (receivedStoreName !== storeName || sourceWindowId === windowId) {
      return;
    }

    try {
      // Apply received state
      if (mergeState) {
        // If we have a merge function, use it (requires getting current state externally)
        setState(state as T);
      } else {
        setState(state);
      }
    } catch (error) {
      console.error(`Failed to apply synced state for ${storeName}:`, error);
    }
  };

  /**
   * Initialize the listener
   */
  const initialize = async (): Promise<void> => {
    try {
      unlistenFn = await listen<StateSyncPayload<T>>(STATE_SYNC_EVENT, handleStateReceived);
      isActive = true;
    } catch (error) {
      console.warn(`Failed to setup state sync for ${storeName}:`, error);
    }
  };

  /**
   * Cleanup the listener
   */
  const cleanup = async (): Promise<void> => {
    isActive = false;
    if (unlistenFn) {
      unlistenFn();
      unlistenFn = null;
    }
  };

  // Initialize immediately
  initialize();

  return {
    broadcastState,
    cleanup,
    get isActive() {
      return isActive;
    },
  };
}

/**
 * Create a Zustand middleware for automatic state sync
 *
 * Usage:
 * ```typescript
 * const useStore = create(
 *   withStateSync('my-store')(
 *     (set) => ({ ... })
 *   )
 * );
 * ```
 */
export function withStateSync<T extends object>(
  storeName: string,
  options: {
    /** Keys to sync (default: all) */
    syncKeys?: (keyof T)[];
    /** Keys to exclude from sync */
    excludeKeys?: (keyof T)[];
    /** Debounce broadcasts (ms) */
    debounceMs?: number;
  } = {}
) {
  return (config: (set: (state: Partial<T>) => void, get: () => T) => T) => {
    return (set: (state: Partial<T>) => void, get: () => T): T => {
      let syncController: StateSyncController<Partial<T>> | null = null;
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;

      const { syncKeys, excludeKeys, debounceMs = 50 } = options;

      // Filter state based on sync/exclude keys
      const filterState = (state: T): Partial<T> => {
        if (syncKeys) {
          const filtered: Partial<T> = {};
          for (const key of syncKeys) {
            filtered[key] = state[key];
          }
          return filtered;
        }
        if (excludeKeys) {
          const filtered = { ...state };
          for (const key of excludeKeys) {
            delete filtered[key];
          }
          return filtered;
        }
        return state;
      };

      // Wrapped set function that broadcasts changes
      const syncedSet = (partial: Partial<T>): void => {
        set(partial);

        // Debounce broadcasts
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          const currentState = get();
          const filteredState = filterState(currentState);
          syncController?.broadcastState(filteredState);
        }, debounceMs);
      };

      // Initialize sync controller
      if (typeof window !== 'undefined') {
        syncController = setupStateSync<Partial<T>>(storeName, (receivedState) => {
          // Apply received state without triggering broadcast
          set(receivedState);
        });
      }

      return config(syncedSet, get);
    };
  };
}

/**
 * Request current state from main window (useful for floating windows on init)
 */
export async function requestStateFromMain(storeName: string): Promise<void> {
  const windowId = getWindowId();
  if (windowId === 'main') return;

  await emit('modone:state-request', {
    storeName,
    requestingWindowId: windowId,
    timestamp: Date.now(),
  });
}

/**
 * Listen for state requests and respond (for main window)
 */
export function setupStateRequestHandler<T>(
  storeName: string,
  getState: () => T
): () => Promise<void> {
  const windowId = getWindowId();
  if (windowId !== 'main') {
    return async () => {};
  }

  let unlistenFn: UnlistenFn | null = null;

  const setup = async (): Promise<void> => {
    unlistenFn = await listen<{ storeName: string; requestingWindowId: string }>(
      'modone:state-request',
      (event) => {
        if (event.payload.storeName !== storeName) return;

        // Send current state
        emit(STATE_SYNC_EVENT, {
          storeName,
          state: getState(),
          sourceWindowId: windowId,
          timestamp: Date.now(),
        });
      }
    );
  };

  setup();

  return async () => {
    if (unlistenFn) {
      unlistenFn();
    }
  };
}
