// documentRegistry: 문서별 히스토리 push/undo/redo 액션 그룹 (타입별 스냅샷 처리)
import type {
  CanvasHistoryData,
  LadderHistoryData,
  ScenarioHistoryData,
  SchematicHistoryData,
  HistorySnapshot,
} from '../types/document';
import {
  isCanvasDocument,
  isLadderDocument,
  isScenarioDocument,
  isSchematicDocument,
} from '../types/document';
import {
  createCanvasHistorySnapshot,
  restoreCanvasFromHistory,
  createLadderHistorySnapshot,
  restoreLadderFromHistory,
  createScenarioHistorySnapshot,
} from './documentRegistryHelpers';
import {
  MAX_HISTORY_SIZE,
  type DocumentRegistryActions,
  type DocRegistrySet,
  type DocRegistryGet,
} from './documentRegistryTypes';

type HistoryActions = Pick<
  DocumentRegistryActions,
  'pushHistory' | 'undo' | 'redo' | 'canUndo' | 'canRedo'
>;

export function createHistoryActions(set: DocRegistrySet, get: DocRegistryGet): HistoryActions {
  return {
    pushHistory: (documentId, description) => {
      set(
        (state) => {
          const doc = state.documents.get(documentId);
          if (!doc) return;

          let snapshot: HistorySnapshot<unknown>;

          if (isCanvasDocument(doc)) {
            snapshot = {
              timestamp: Date.now(),
              data: createCanvasHistorySnapshot(doc.data),
              description,
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
              description,
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
              description,
            };
            doc.history = doc.history.slice(0, doc.historyIndex + 1);
            doc.history.push(snapshot as HistorySnapshot<ScenarioHistoryData>);
            if (doc.history.length > MAX_HISTORY_SIZE) {
              doc.history.shift();
            } else {
              doc.historyIndex++;
            }
          } else if (isSchematicDocument(doc)) {
            snapshot = {
              timestamp: Date.now(),
              data: {
                snapshot: JSON.stringify(doc.data.schematic),
              } as SchematicHistoryData,
              description,
            };
            doc.history = doc.history.slice(0, doc.historyIndex + 1);
            doc.history.push(snapshot as HistorySnapshot<SchematicHistoryData>);
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
            doc.data.elements = restored.elements;
            doc.data.horizontalEdges = restored.horizontalEdges;
            doc.data.verticalEdges = restored.verticalEdges;
            doc.data.comment = restored.comment;
            doc.data.rungLabels = restored.rungLabels;
            doc.data.topologyCache = restored.topologyCache;
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
          } else if (isSchematicDocument(doc)) {
            if (doc.historyIndex === doc.history.length - 1) {
              const snapshot: HistorySnapshot<SchematicHistoryData> = {
                timestamp: Date.now(),
                data: {
                  snapshot: JSON.stringify(doc.data.schematic),
                },
              };
              doc.history.push(snapshot);
            }

            const snapshot = doc.history[doc.historyIndex];
            doc.data.schematic = JSON.parse(snapshot.data.snapshot);
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
            if (doc.historyIndex + 2 >= doc.history.length) return;

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
            if (doc.historyIndex + 2 >= doc.history.length) return;

            doc.historyIndex++;
            const snapshot = doc.history[doc.historyIndex + 1];
            if (snapshot) {
              const restored = restoreLadderFromHistory(snapshot.data);
              doc.data.elements = restored.elements;
              doc.data.horizontalEdges = restored.horizontalEdges;
              doc.data.verticalEdges = restored.verticalEdges;
              doc.data.comment = restored.comment;
              doc.data.rungLabels = restored.rungLabels;
              doc.data.topologyCache = restored.topologyCache;
              doc.isDirty = true;
            }
          } else if (isScenarioDocument(doc)) {
            if (doc.historyIndex + 2 >= doc.history.length) return;

            doc.historyIndex++;
            const snapshot = doc.history[doc.historyIndex + 1];
            if (snapshot) {
              doc.data.scenario = JSON.parse(JSON.stringify(snapshot.data.scenario));
              doc.isDirty = true;
            }
          } else if (isSchematicDocument(doc)) {
            if (doc.historyIndex + 2 >= doc.history.length) return;

            doc.historyIndex++;
            const snapshot = doc.history[doc.historyIndex + 1];
            if (snapshot) {
              doc.data.schematic = JSON.parse(snapshot.data.snapshot);
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

      if (isCanvasDocument(doc) || isLadderDocument(doc) || isScenarioDocument(doc) || isSchematicDocument(doc)) {
        return doc.historyIndex + 2 < doc.history.length;
      }
      return false;
    },
  };
}
