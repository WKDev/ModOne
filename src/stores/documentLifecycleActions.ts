// documentRegistry: 문서 생애주기·조회·dirty/상태 관리 액션 그룹 (set/get 주입)
import type {
  DocumentState,
  CanvasDocumentState,
  ScenarioDocumentState,
  SchematicDocumentState,
} from '../types/document';
import {
  createEmptyCanvasDocument,
  createEmptyLadderDocument,
  createEmptyScenarioDocument,
  createEmptySchematicDocument,
} from '../types/document';
import type { SerializableCircuitState } from '../components/OneCanvas/types';
import type { MultiPageSchematic } from '../components/OneCanvas/utils/multiPageSchematic';
import type { Scenario } from '../types/scenario';
import { getFileNameFromPath, applySerializableToCanvasData } from './documentRegistryHelpers';
import type {
  DocumentRegistryActions,
  DocRegistrySet,
  DocRegistryGet,
} from './documentRegistryTypes';

type LifecycleActions = Pick<
  DocumentRegistryActions,
  | 'createDocument'
  | 'loadDocument'
  | 'closeDocument'
  | 'setDocumentTab'
  | 'getDocument'
  | 'getDocumentByFilePath'
  | 'getDirtyDocuments'
  | 'hasUnsavedChanges'
  | 'markDirty'
  | 'markClean'
  | 'setDocumentStatus'
  | 'setDocumentFilePath'
>;

export function createLifecycleActions(set: DocRegistrySet, get: DocRegistryGet): LifecycleActions {
  return {
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
        case 'schematic':
          doc = createEmptySchematicDocument(name);
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
          applySerializableToCanvasData(canvasDoc, circuitData);
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
        case 'schematic': {
          doc = createEmptySchematicDocument(name, filePath);
          // data is expected to be MultiPageSchematic
          const schematicDoc = doc as SchematicDocumentState;
          schematicDoc.data.schematic = data as MultiPageSchematic;
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
  };
}
