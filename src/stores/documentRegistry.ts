/**
 * Document Registry Store
 *
 * Central store for managing multiple independent documents.
 * Each document maintains its own state, history, and dirty flag.
 *
 * Action implementations live in focused factory modules
 * (documentLifecycleActions / documentDataActions / documentHistoryActions)
 * and are spread together into the single create() closure below. Pure helpers
 * are in documentRegistryHelpers; shared types/initial state in
 * documentRegistryTypes.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

// Enable Immer's MapSet plugin for Map and Set support
enableMapSet();

import { getSyncWindowId, listenDocumentSync } from '../utils/documentSync';
import { initialState, type DocumentRegistryStore } from './documentRegistryTypes';
import { createLifecycleActions } from './documentLifecycleActions';
import { createDataActions } from './documentDataActions';
import { createHistoryActions } from './documentHistoryActions';

export type {
  DocumentRegistryState,
  DocumentRegistryActions,
  DocumentRegistryStore,
} from './documentRegistryTypes';

// ============================================================================
// Store
// ============================================================================

export const useDocumentRegistry = create<DocumentRegistryStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      ...initialState,

      // Action groups (factories share the same set/get from this closure)
      ...createLifecycleActions(set, get),
      ...createDataActions(set, get),
      ...createHistoryActions(set, get),

      // ======================================================================
      // Reset
      // ======================================================================

      reset: () => {
        set(
          () => ({
            ...initialState,
            documents: new Map(),
          }),
          false,
          'reset'
        );
      },
    })),
    { name: 'document-registry' }
  )
);

let hasInitializedDocumentSyncListener = false;

function initializeDocumentSyncListener(): void {
  if (hasInitializedDocumentSyncListener) {
    return;
  }

  hasInitializedDocumentSyncListener = true;

  void listenDocumentSync((payload) => {
    if (payload.sourceWindowId === getSyncWindowId()) {
      return;
    }

    useDocumentRegistry.getState().applyRemoteCanvasUpdate(payload);
  }).catch((error) => {
    hasInitializedDocumentSyncListener = false;
    console.warn('Failed to initialize document sync listener:', error);
  });
}

if (typeof window !== 'undefined') {
  initializeDocumentSyncListener();
}

// ============================================================================
// Selectors
// ============================================================================

/** Select all documents */
export const selectDocuments = (state: DocumentRegistryStore) => state.documents;

/** Select a specific document */
export const selectDocument = (documentId: string) => (state: DocumentRegistryStore) =>
  state.documents.get(documentId);

/** Select dirty document count */
export const selectDirtyCount = (state: DocumentRegistryStore) => {
  let count = 0;
  state.documents.forEach((doc) => {
    if (doc.isDirty) count++;
  });
  return count;
};

/** Select if a specific document is dirty */
export const selectIsDocumentDirty = (documentId: string) => (state: DocumentRegistryStore) => {
  const doc = state.documents.get(documentId);
  return doc?.isDirty ?? false;
};

export default useDocumentRegistry;
