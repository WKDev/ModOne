// documentRegistry 스토어의 공유 타입·초기상태·액션 팩토리용 set/get 시그니처
import type { Draft } from 'immer';
import type {
  DocumentType,
  DocumentState,
  CanvasDocumentData,
  LadderDocumentData,
  SchematicDocumentData,
} from '../types/document';
import type { SerializableCircuitState } from '../components/OneCanvas/types';
import type { MultiPageSchematic } from '../components/OneCanvas/utils/multiPageSchematic';
import type { Scenario, ScenarioExecutionState } from '../types/scenario';
import type { DocumentSyncPayload } from '../utils/documentSync';

/** Maximum number of history snapshots per document */
export const MAX_HISTORY_SIZE = 50;

export interface DocumentRegistryState {
  /** All open documents by ID */
  documents: Map<string, DocumentState>;
}

export interface DocumentRegistryActions {
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
  /** Apply remote canvas sync payload without rebroadcasting */
  applyRemoteCanvasUpdate: (payload: DocumentSyncPayload) => void;

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

  // Schematic-specific data updates
  /** Update schematic document data */
  updateSchematicData: (
    documentId: string,
    updater: (data: SchematicDocumentData) => void
  ) => void;
  /** Get schematic data for saving */
  getSchematicData: (documentId: string) => MultiPageSchematic | null;

  // History operations
  /** Push current state to history */
  pushHistory: (documentId: string, description?: string) => void;
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

export type DocumentRegistryStore = DocumentRegistryState & DocumentRegistryActions;

export const initialState: DocumentRegistryState = {
  documents: new Map(),
};

/**
 * The immer+devtools `set` available inside the store. Action factories receive
 * this so their bodies are byte-identical to the original inline closure:
 * `set(recipe, false, 'actionName')`.
 */
export type DocRegistrySet = (
  recipe: (state: Draft<DocumentRegistryStore>) => void,
  replace?: false,
  action?: string,
) => void;

export type DocRegistryGet = () => DocumentRegistryStore;
