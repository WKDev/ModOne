/**
 * Document Registry Store
 *
 * Central store for managing multiple independent documents.
 * Each document maintains its own state, history, and dirty flag.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

// Enable Immer's MapSet plugin for Map and Set support
enableMapSet();

import type {
  DocumentType,
  DocumentState,
  CanvasDocumentState,
  ScenarioDocumentState,
  CanvasHistoryData,
  LadderHistoryData,
  ScenarioHistoryData,
  HistorySnapshot,
  CanvasDocumentData,
  LadderDocumentData,
} from '../types/document';
import {
  createEmptyCanvasDocument,
  createEmptyLadderDocument,
  createEmptyScenarioDocument,
  isCanvasDocument,
  isLadderDocument,
  isScenarioDocument,
} from '../types/document';
import type { SerializableCircuitState } from '../components/OneCanvas/types';
import type { LadderNetwork, LadderElement } from '../types/ladder';
import type { Scenario, ScenarioExecutionState } from '../types/scenario';

// ============================================================================
// Types
// ============================================================================

/** Maximum number of history snapshots per document */
const MAX_HISTORY_SIZE = 50;

interface DocumentRegistryState {
  /** All open documents by ID */
  documents: Map<string, DocumentState>;
}

interface DocumentRegistryActions {
  // Document lifecycle
  /** Create a new empty document */
  createDocument: (type: DocumentType, name?: string, tabId?: string) => string;
  /** Load a document from data */
  loadDocument: (
    type: DocumentType,
    filePath: string,
    data: unknown,
    tabId?: string
  ) => string;
  /** Close and remove a document */
  closeDocument: (documentId: string) => void;
  /** Associate document with a tab */
  setDocumentTab: (documentId: string, tabId: string | null) => void;

  // Document state
  /** Get a document by ID */
  getDocument: (documentId: string) => DocumentState | undefined;
  /** Get document by file path */
  getDocumentByFilePath: (filePath: string) => DocumentState | undefined;
  /** Get all dirty documents */
  getDirtyDocuments: () => DocumentState[];
  /** Check if any documents are dirty */
  hasUnsavedChanges: () => boolean;

  // Status management
  /** Mark document as dirty */
  markDirty: (documentId: string) => void;
  /** Mark document as clean (saved) */
  markClean: (documentId: string) => void;
  /** Update document status */
  setDocumentStatus: (
    documentId: string,
    status: DocumentState['status'],
    errorMessage?: string
  ) => void;
  /** Update document file path (after Save As) */
  setDocumentFilePath: (documentId: string, filePath: string, name?: string) => void;

  // Canvas-specific data updates
  /** Update canvas document data */
  updateCanvasData: (
    documentId: string,
    updater: (data: CanvasDocumentData) => void
  ) => void;
  /** Load circuit data into canvas document */
  loadCanvasCircuit: (documentId: string, circuit: SerializableCircuitState) => void;
  /** Get canvas circuit data for saving */
  getCanvasCircuitData: (documentId: string) => SerializableCircuitState | null;

  // Ladder-specific data updates
  /** Update ladder document data */
  updateLadderData: (
    documentId: string,
    updater: (data: LadderDocumentData) => void
  ) => void;

  // Scenario-specific data updates
  /** Update scenario document data */
  updateScenarioData: (
    documentId: string,
    scenario: Scenario | null
  ) => void;
  /** Update scenario execution state */
  updateScenarioExecution: (
    documentId: string,
    executionState: Partial<ScenarioExecutionState>
  ) => void;

  // History operations
  /** Push current state to history */
  pushHistory: (documentId: string) => void;
  /** Undo last action */
  undo: (documentId: string) => void;
  /** Redo last undone action */
  redo: (documentId: string) => void;
  /** Check if undo is available */
  canUndo: (documentId: string) => boolean;
  /** Check if redo is available */
  canRedo: (documentId: string) => boolean;

  // Reset
  /** Reset store to initial state */
  reset: () => void;
}

type DocumentRegistryStore = DocumentRegistryState & DocumentRegistryActions;

// ============================================================================
// Initial State
// ============================================================================

const initialState: DocumentRegistryState = {
  documents: new Map(),
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Create canvas history snapshot */
function createCanvasHistorySnapshot(data: CanvasDocumentData): CanvasHistoryData {
  return {
    components: Array.from(data.components.entries()).map(([id, block]) => [
      id,
      { ...block, ports: [...block.ports] },
    ]),
    junctions: Array.from(data.junctions.entries()).map(([id, junction]) => [
      id,
      { ...junction, position: { ...junction.position } },
    ]),
    wires: data.wires.map((wire) => ({
      ...wire,
      from: { ...wire.from },
      to: { ...wire.to },
      handles: wire.handles ? wire.handles.map((h) => ({ ...h, position: { ...h.position } })) : undefined,
    })),
  };
}

/** Restore canvas data from history snapshot */
function restoreCanvasFromHistory(snapshot: CanvasHistoryData): Pick<CanvasDocumentData, 'components' | 'junctions' | 'wires'> {
  return {
    components: new Map(
      snapshot.components.map(([id, block]) => [id, { ...block, ports: [...block.ports] }])
    ),
    junctions: new Map(
      (snapshot.junctions ?? []).map(([id, junction]) => [id, { ...junction, position: { ...junction.position } }])
    ),
    wires: snapshot.wires.map((wire) => ({
      ...wire,
      from: { ...wire.from },
      to: { ...wire.to },
      handles: wire.handles ? wire.handles.map((h) => ({ ...h, position: { ...h.position } })) : undefined,
    })),
  };
}

/** Serialize ladder network for history */
function serializeLadderNetwork(network: LadderNetwork) {
  const elements: Array<[string, LadderElement]> = [];
  network.elements.forEach((element, id) => {
    elements.push([id, JSON.parse(JSON.stringify(element))]);
  });

  return {
    id: network.id,
    label: network.label,
    comment: network.comment,
    elements,
    wires: network.wires.map((wire) => ({
      ...wire,
      from: { ...wire.from },
      to: { ...wire.to },
    })),
    enabled: network.enabled,
  };
}

/** Create ladder history snapshot */
function createLadderHistorySnapshot(data: LadderDocumentData): LadderHistoryData {
  return {
    networks: Array.from(data.networks.entries()).map(([id, network]) => [
      id,
      serializeLadderNetwork(network),
    ]),
    currentNetworkId: data.currentNetworkId,
  };
}

/** Restore ladder data from history snapshot */
function restoreLadderFromHistory(snapshot: LadderHistoryData): Pick<LadderDocumentData, 'networks' | 'currentNetworkId'> {
  return {
    networks: new Map(
      snapshot.networks.map(([id, data]) => {
        const elements = new Map<string, LadderElement>();
        data.elements.forEach(([elemId, element]) => {
          elements.set(elemId, JSON.parse(JSON.stringify(element)));
        });

        const network: LadderNetwork = {
          id: data.id,
          label: data.label,
          comment: data.comment,
          elements,
          wires: data.wires.map((wire) => ({
            ...wire,
            from: { ...wire.from },
            to: { ...wire.to },
          })),
          enabled: data.enabled,
        };

        return [id, network];
      })
    ),
    currentNetworkId: snapshot.currentNetworkId,
  };
}

/** Create scenario history snapshot */
function createScenarioHistorySnapshot(scenario: Scenario): ScenarioHistoryData {
  return {
    scenario: JSON.parse(JSON.stringify(scenario)),
  };
}

/** Get file name from path */
function getFileNameFromPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const fileName = parts[parts.length - 1];
  // Remove extension
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
}

// ============================================================================
// Store
// ============================================================================

export const useDocumentRegistry = create<DocumentRegistryStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      ...initialState,

      // ========================================================================
      // Document Lifecycle
      // ========================================================================

      createDocument: (type, name, tabId) => {
        let doc: DocumentState;

        switch (type) {
          case 'canvas':
            doc = createEmptyCanvasDocument(name);
            break;
          case 'ladder':
            doc = createEmptyLadderDocument(name);
            break;
          case 'scenario':
            doc = createEmptyScenarioDocument(name);
            break;
          default:
            throw new Error(`Unknown document type: ${type}`);
        }

        doc.tabId = tabId ?? null;
        doc.status = 'loaded';

        set(
          (state) => {
            state.documents.set(doc.id, doc);
          },
          false,
          `createDocument/${type}/${doc.id}`
        );

        return doc.id;
      },

      loadDocument: (type, filePath, data, tabId) => {
        const name = getFileNameFromPath(filePath);
        let doc: DocumentState;

        switch (type) {
          case 'canvas': {
            doc = createEmptyCanvasDocument(name, filePath);
            const canvasDoc = doc as CanvasDocumentState;
            const circuitData = data as SerializableCircuitState;
            canvasDoc.data.components = new Map(Object.entries(circuitData.components));
            canvasDoc.data.junctions = circuitData.junctions
              ? new Map(Object.entries(circuitData.junctions))
              : new Map();
            canvasDoc.data.wires = circuitData.wires.map((wire) => ({
              ...wire,
              from: { ...wire.from },
              to: { ...wire.to },
            }));
            canvasDoc.data.metadata = { ...circuitData.metadata };
            if (circuitData.viewport) {
              canvasDoc.data.zoom = circuitData.viewport.zoom;
              canvasDoc.data.pan = {
                x: circuitData.viewport.panX,
                y: circuitData.viewport.panY,
              };
            }
            break;
          }
          case 'ladder':
            doc = createEmptyLadderDocument(name, filePath);
            // TODO: Load ladder data from serialized format
            break;
          case 'scenario': {
            doc = createEmptyScenarioDocument(name, filePath);
            const scenarioDoc = doc as ScenarioDocumentState;
            scenarioDoc.data.scenario = data as Scenario;
            break;
          }
          default:
            throw new Error(`Unknown document type: ${type}`);
        }

        doc.tabId = tabId ?? null;
        doc.status = 'loaded';
        doc.isDirty = false;

        set(
          (state) => {
            state.documents.set(doc.id, doc);
          },
          false,
          `loadDocument/${type}/${doc.id}`
        );

        return doc.id;
      },

      closeDocument: (documentId) => {
        set(
          (state) => {
            state.documents.delete(documentId);
          },
          false,
          `closeDocument/${documentId}`
        );
      },

      setDocumentTab: (documentId, tabId) => {
        set(
          (state) => {
            const doc = state.documents.get(documentId);
            if (doc) {
              doc.tabId = tabId;
            }
          },
          false,
          `setDocumentTab/${documentId}`
        );
      },

      // ========================================================================
      // Document State Queries
      // ========================================================================

      getDocument: (documentId) => {
        return get().documents.get(documentId);
      },

      getDocumentByFilePath: (filePath) => {
        for (const doc of get().documents.values()) {
          if (doc.filePath === filePath) {
            return doc;
          }
        }
        return undefined;
      },

      getDirtyDocuments: () => {
        return Array.from(get().documents.values()).filter((doc) => doc.isDirty);
      },

      hasUnsavedChanges: () => {
        for (const doc of get().documents.values()) {
          if (doc.isDirty) return true;
        }
        return false;
      },

      // ========================================================================
      // Status Management
      // ========================================================================

      markDirty: (documentId) => {
        set(
          (state) => {
            const doc = state.documents.get(documentId);
            if (doc && !doc.isDirty) {
              doc.isDirty = true;
              doc.lastModified = Date.now();
            }
          },
          false,
          `markDirty/${documentId}`
        );
      },

      markClean: (documentId) => {
        set(
          (state) => {
            const doc = state.documents.get(documentId);
            if (doc && doc.isDirty) {
              doc.isDirty = false;
              doc.lastModified = Date.now();
            }
          },
          false,
          `markClean/${documentId}`
        );
      },

      setDocumentStatus: (documentId, status, errorMessage) => {
        set(
          (state) => {
            const doc = state.documents.get(documentId);
            if (doc) {
              doc.status = status;
              doc.errorMessage = errorMessage;
            }
          },
          false,
          `setDocumentStatus/${documentId}/${status}`
        );
      },

      setDocumentFilePath: (documentId, filePath, name) => {
        set(
          (state) => {
            const doc = state.documents.get(documentId);
            if (doc) {
              doc.filePath = filePath;
              doc.name = name ?? getFileNameFromPath(filePath);
            }
          },
          false,
          `setDocumentFilePath/${documentId}`
        );
      },

      // ========================================================================
      // Canvas-specific Operations
      // ========================================================================

      updateCanvasData: (documentId, updater) => {
        set(
          (state) => {
            const doc = state.documents.get(documentId);
            if (doc && isCanvasDocument(doc)) {
              updater(doc.data);
              doc.isDirty = true;
              doc.lastModified = Date.now();
            }
          },
          false,
          `updateCanvasData/${documentId}`
        );
      },

      loadCanvasCircuit: (documentId, circuit) => {
        set(
          (state) => {
            const doc = state.documents.get(documentId);
            if (doc && isCanvasDocument(doc)) {
              doc.data.components = new Map(Object.entries(circuit.components));
              doc.data.junctions = circuit.junctions
                ? new Map(Object.entries(circuit.junctions))
                : new Map();
              doc.data.wires = circuit.wires.map((wire) => ({
                ...wire,
                from: { ...wire.from },
                to: { ...wire.to },
              }));
              doc.data.metadata = { ...circuit.metadata };
              if (circuit.viewport) {
                doc.data.zoom = circuit.viewport.zoom;
                doc.data.pan = {
                  x: circuit.viewport.panX,
                  y: circuit.viewport.panY,
                };
              }
              doc.history = [];
              doc.historyIndex = -1;
              doc.isDirty = false;
              doc.status = 'loaded';
            }
          },
          false,
          `loadCanvasCircuit/${documentId}`
        );
      },

      getCanvasCircuitData: (documentId) => {
        const doc = get().documents.get(documentId);
        if (doc && isCanvasDocument(doc)) {
          return {
            components: Object.fromEntries(doc.data.components),
            junctions: doc.data.junctions.size > 0
              ? Object.fromEntries(doc.data.junctions)
              : undefined,
            wires: doc.data.wires,
            metadata: doc.data.metadata,
            viewport: {
              zoom: doc.data.zoom,
              panX: doc.data.pan.x,
              panY: doc.data.pan.y,
            },
          };
        }
        return null;
      },

      // ========================================================================
      // Ladder-specific Operations
      // ========================================================================

      updateLadderData: (documentId, updater) => {
        set(
          (state) => {
            const doc = state.documents.get(documentId);
            if (doc && isLadderDocument(doc)) {
              updater(doc.data);
              doc.isDirty = true;
              doc.lastModified = Date.now();
            }
          },
          false,
          `updateLadderData/${documentId}`
        );
      },

      // ========================================================================
      // Scenario-specific Operations
      // ========================================================================

      updateScenarioData: (documentId, scenario) => {
        set(
          (state) => {
            const doc = state.documents.get(documentId);
            if (doc && isScenarioDocument(doc)) {
              doc.data.scenario = scenario;
              doc.isDirty = true;
              doc.lastModified = Date.now();
            }
          },
          false,
          `updateScenarioData/${documentId}`
        );
      },

      updateScenarioExecution: (documentId, executionState) => {
        set(
          (state) => {
            const doc = state.documents.get(documentId);
            if (doc && isScenarioDocument(doc)) {
              doc.executionState = {
                ...doc.executionState,
                ...executionState,
              };
            }
          },
          false,
          `updateScenarioExecution/${documentId}`
        );
      },

      // ========================================================================
      // History Operations
      // ========================================================================

      pushHistory: (documentId) => {
        set(
          (state) => {
            const doc = state.documents.get(documentId);
            if (!doc) return;

            let snapshot: HistorySnapshot<unknown>;

            if (isCanvasDocument(doc)) {
              snapshot = {
                timestamp: Date.now(),
                data: createCanvasHistorySnapshot(doc.data),
              };
              // Clear redo history
              doc.history = doc.history.slice(0, doc.historyIndex + 1);
              doc.history.push(snapshot as HistorySnapshot<CanvasHistoryData>);
              // Enforce max size
              if (doc.history.length > MAX_HISTORY_SIZE) {
                doc.history.shift();
              } else {
                doc.historyIndex++;
              }
            } else if (isLadderDocument(doc)) {
              snapshot = {
                timestamp: Date.now(),
                data: createLadderHistorySnapshot(doc.data),
              };
              doc.history = doc.history.slice(0, doc.historyIndex + 1);
              doc.history.push(snapshot as HistorySnapshot<LadderHistoryData>);
              if (doc.history.length > MAX_HISTORY_SIZE) {
                doc.history.shift();
              } else {
                doc.historyIndex++;
              }
            } else if (isScenarioDocument(doc) && doc.data.scenario) {
              snapshot = {
                timestamp: Date.now(),
                data: createScenarioHistorySnapshot(doc.data.scenario),
              };
              doc.history = doc.history.slice(0, doc.historyIndex + 1);
              doc.history.push(snapshot as HistorySnapshot<ScenarioHistoryData>);
              if (doc.history.length > MAX_HISTORY_SIZE) {
                doc.history.shift();
              } else {
                doc.historyIndex++;
              }
            }
          },
          false,
          `pushHistory/${documentId}`
        );
      },

      undo: (documentId) => {
        set(
          (state) => {
            const doc = state.documents.get(documentId);
            if (!doc || doc.historyIndex < 0) return;

            if (isCanvasDocument(doc)) {
              // Save current state for redo if at the end
              if (doc.historyIndex === doc.history.length - 1) {
                const snapshot: HistorySnapshot<CanvasHistoryData> = {
                  timestamp: Date.now(),
                  data: createCanvasHistorySnapshot(doc.data),
                };
                doc.history.push(snapshot);
              }

              const snapshot = doc.history[doc.historyIndex];
              const restored = restoreCanvasFromHistory(snapshot.data);
              doc.data.components = restored.components;
              doc.data.junctions = restored.junctions;
              doc.data.wires = restored.wires;
              doc.historyIndex--;
              doc.isDirty = true;
            } else if (isLadderDocument(doc)) {
              if (doc.historyIndex === doc.history.length - 1) {
                const snapshot: HistorySnapshot<LadderHistoryData> = {
                  timestamp: Date.now(),
                  data: createLadderHistorySnapshot(doc.data),
                };
                doc.history.push(snapshot);
              }

              const snapshot = doc.history[doc.historyIndex];
              const restored = restoreLadderFromHistory(snapshot.data);
              doc.data.networks = restored.networks;
              doc.data.currentNetworkId = restored.currentNetworkId;
              doc.historyIndex--;
              doc.isDirty = true;
            } else if (isScenarioDocument(doc)) {
              if (doc.historyIndex === doc.history.length - 1 && doc.data.scenario) {
                const snapshot: HistorySnapshot<ScenarioHistoryData> = {
                  timestamp: Date.now(),
                  data: createScenarioHistorySnapshot(doc.data.scenario),
                };
                doc.history.push(snapshot);
              }

              const snapshot = doc.history[doc.historyIndex];
              doc.data.scenario = JSON.parse(JSON.stringify(snapshot.data.scenario));
              doc.historyIndex--;
              doc.isDirty = true;
            }
          },
          false,
          `undo/${documentId}`
        );
      },

      redo: (documentId) => {
        set(
          (state) => {
            const doc = state.documents.get(documentId);
            if (!doc) return;

            if (isCanvasDocument(doc)) {
              if (doc.historyIndex >= doc.history.length - 1) return;

              doc.historyIndex++;
              const snapshot = doc.history[doc.historyIndex + 1];
              if (snapshot) {
                const restored = restoreCanvasFromHistory(snapshot.data);
                doc.data.components = restored.components;
                doc.data.junctions = restored.junctions;
                doc.data.wires = restored.wires;
                doc.isDirty = true;
              }
            } else if (isLadderDocument(doc)) {
              if (doc.historyIndex >= doc.history.length - 1) return;

              doc.historyIndex++;
              const snapshot = doc.history[doc.historyIndex + 1];
              if (snapshot) {
                const restored = restoreLadderFromHistory(snapshot.data);
                doc.data.networks = restored.networks;
                doc.data.currentNetworkId = restored.currentNetworkId;
                doc.isDirty = true;
              }
            } else if (isScenarioDocument(doc)) {
              if (doc.historyIndex >= doc.history.length - 1) return;

              doc.historyIndex++;
              const snapshot = doc.history[doc.historyIndex + 1];
              if (snapshot) {
                doc.data.scenario = JSON.parse(JSON.stringify(snapshot.data.scenario));
                doc.isDirty = true;
              }
            }
          },
          false,
          `redo/${documentId}`
        );
      },

      canUndo: (documentId) => {
        const doc = get().documents.get(documentId);
        return doc ? doc.historyIndex >= 0 : false;
      },

      canRedo: (documentId) => {
        const doc = get().documents.get(documentId);
        if (!doc) return false;

        if (isCanvasDocument(doc) || isLadderDocument(doc) || isScenarioDocument(doc)) {
          return doc.historyIndex < doc.history.length - 1;
        }
        return false;
      },

      // ========================================================================
      // Reset
      // ========================================================================

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
