// documentRegistry: 문서 타입별(canvas/ladder/scenario/schematic) 데이터 갱신 액션 그룹
import {
  isCanvasDocument,
  isLadderDocument,
  isScenarioDocument,
  isSchematicDocument,
} from '../types/document';
import {
  broadcastDocumentSync,
  getSyncWindowId,
  mergeCanvasDocumentData,
  shouldAcceptRemoteUpdate,
  type DocumentSyncPayload,
} from '../utils/documentSync';
import {
  canvasDataToSerializable,
  applySerializableToCanvasData,
} from './documentRegistryHelpers';
import type {
  DocumentRegistryActions,
  DocRegistrySet,
  DocRegistryGet,
} from './documentRegistryTypes';

type DataActions = Pick<
  DocumentRegistryActions,
  | 'updateCanvasData'
  | 'loadCanvasCircuit'
  | 'getCanvasCircuitData'
  | 'applyRemoteCanvasUpdate'
  | 'updateLadderData'
  | 'updateScenarioData'
  | 'updateScenarioExecution'
  | 'updateSchematicData'
  | 'getSchematicData'
>;

export function createDataActions(set: DocRegistrySet, get: DocRegistryGet): DataActions {
  return {
    // ========================================================================
    // Canvas-specific Operations
    // ========================================================================

    updateCanvasData: (documentId, updater) => {
      let payloadToBroadcast: DocumentSyncPayload | null = null;

      set(
        (state) => {
          const doc = state.documents.get(documentId);
          if (doc && isCanvasDocument(doc)) {
            updater(doc.data);
            doc.revision += 1;
            doc.isDirty = true;
            doc.lastModified = Date.now();

            payloadToBroadcast = JSON.parse(
              JSON.stringify({
                documentId,
                revision: doc.revision,
                data: canvasDataToSerializable(doc.data),
                sourceWindowId: getSyncWindowId(),
                timestamp: doc.lastModified,
              })
            );
          }
        },
        false,
        `updateCanvasData/${documentId}`
      );


      if (payloadToBroadcast) {
        void broadcastDocumentSync(payloadToBroadcast).catch((error) => {
          console.warn('Failed to broadcast canvas document sync update:', error);
        });
      }
    },

    loadCanvasCircuit: (documentId, circuit) => {
      set(
        (state) => {
          const doc = state.documents.get(documentId);
          if (doc && isCanvasDocument(doc)) {
            applySerializableToCanvasData(doc, circuit);
            doc.history = [];
            doc.historyIndex = -1;
            doc.isDirty = false;
            doc.status = 'loaded';
            doc.revision = 0;
            doc.lastModified = Date.now();
          }
        },
        false,
        `loadCanvasCircuit/${documentId}`
      );
    },

    getCanvasCircuitData: (documentId) => {
      const doc = get().documents.get(documentId);
      if (doc && isCanvasDocument(doc)) {
        return canvasDataToSerializable(doc.data);
      }
      return null;
    },

    applyRemoteCanvasUpdate: (payload) => {
      set(
        (state) => {
          const doc = state.documents.get(payload.documentId);
          if (!doc || !isCanvasDocument(doc)) {
            return;
          }

          if (
            !shouldAcceptRemoteUpdate(
              doc.revision,
              doc.lastModified,
              payload.revision,
              payload.timestamp,
            )
          ) {
            return;
          }

          const local = canvasDataToSerializable(doc.data);
          const merged = mergeCanvasDocumentData(local, payload.data);

          applySerializableToCanvasData(doc, merged);
          doc.revision = payload.revision;
          doc.lastModified = payload.timestamp;
          doc.status = 'loaded';
        },
        false,
        `applyRemoteCanvasUpdate/${payload.documentId}`,
      );
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
    // Schematic-specific Operations
    // ========================================================================

    updateSchematicData: (documentId, updater) => {
      set(
        (state) => {
          const doc = state.documents.get(documentId);
          if (doc && isSchematicDocument(doc)) {
            updater(doc.data);
            doc.isDirty = true;
            doc.lastModified = Date.now();
          }
        },
        false,
        `updateSchematicData/${documentId}`
      );
    },

    getSchematicData: (documentId) => {
      const doc = get().documents.get(documentId);
      if (doc && isSchematicDocument(doc)) {
        return doc.data.schematic;
      }
      return null;
    },
  };
}
