/**
 * Document Types - Multi-Document Editing Support
 *
 * Types for managing multiple independent documents in a tabbed interface.
 * Each document maintains its own state, history, and dirty flag.
 */

import type {
  Block,
  Wire,
  CircuitMetadata,
} from '../components/OneCanvas/types';
import type {
  LadderNetwork,
  LadderGridConfig,
  LadderElement,
} from './ladder';
import type {
  Scenario,
  ScenarioExecutionState,
} from './scenario';

// ============================================================================
// Document Core Types
// ============================================================================

/** Supported document types */
export type DocumentType = 'canvas' | 'ladder' | 'scenario';

/** Document lifecycle status */
export type DocumentStatus = 'empty' | 'loading' | 'loaded' | 'error' | 'saving';

/**
 * Base metadata for all document types
 */
export interface DocumentMeta {
  /** Unique document identifier */
  id: string;
  /** Document type discriminator */
  type: DocumentType;
  /** Display name (file name without extension) */
  name: string;
  /** Full file path (null for new/unsaved documents) */
  filePath: string | null;
  /** Whether document has unsaved changes */
  isDirty: boolean;
  /** Current document status */
  status: DocumentStatus;
  /** Error message if status is 'error' */
  errorMessage?: string;
  /** Last modified timestamp */
  lastModified: number;
  /** Associated tab ID */
  tabId: string | null;
}

// ============================================================================
// History Types
// ============================================================================

/**
 * History snapshot for undo/redo (generic)
 * Each document type will have its own data structure.
 */
export interface HistorySnapshot<T = unknown> {
  /** Timestamp when snapshot was created */
  timestamp: number;
  /** Snapshot data (type-specific) */
  data: T;
}

// ============================================================================
// Canvas Document State
// ============================================================================

/** Snapshot data for canvas history */
export interface CanvasHistoryData {
  components: Array<[string, Block]>;
  wires: Wire[];
}

/** Canvas document data */
export interface CanvasDocumentData {
  /** Components by ID */
  components: Map<string, Block>;
  /** Wire connections */
  wires: Wire[];
  /** Circuit metadata */
  metadata: CircuitMetadata;
  /** Zoom level */
  zoom: number;
  /** Pan offset */
  pan: { x: number; y: number };
  /** Grid size */
  gridSize: number;
  /** Snap to grid */
  snapToGrid: boolean;
  /** Show grid */
  showGrid: boolean;
}

/** Complete canvas document state */
export interface CanvasDocumentState extends DocumentMeta {
  type: 'canvas';
  data: CanvasDocumentData;
  history: HistorySnapshot<CanvasHistoryData>[];
  historyIndex: number;
}

// ============================================================================
// Ladder Document State
// ============================================================================

/** Serializable network for ladder history */
export interface SerializableLadderNetwork {
  id: string;
  label?: string;
  comment?: string;
  elements: Array<[string, LadderElement]>;
  wires: LadderNetwork['wires'];
  enabled: boolean;
}

/** Snapshot data for ladder history */
export interface LadderHistoryData {
  networks: Array<[string, SerializableLadderNetwork]>;
  currentNetworkId: string | null;
}

/** Ladder document data */
export interface LadderDocumentData {
  /** Networks by ID */
  networks: Map<string, LadderNetwork>;
  /** Current network ID */
  currentNetworkId: string | null;
  /** Grid configuration */
  gridConfig: LadderGridConfig;
}

/** Complete ladder document state */
export interface LadderDocumentState extends DocumentMeta {
  type: 'ladder';
  data: LadderDocumentData;
  history: HistorySnapshot<LadderHistoryData>[];
  historyIndex: number;
}

// ============================================================================
// Scenario Document State
// ============================================================================

/** Snapshot data for scenario history */
export interface ScenarioHistoryData {
  scenario: Scenario;
}

/** Scenario document data */
export interface ScenarioDocumentData {
  /** Scenario content */
  scenario: Scenario | null;
}

/** Complete scenario document state */
export interface ScenarioDocumentState extends DocumentMeta {
  type: 'scenario';
  data: ScenarioDocumentData;
  executionState: ScenarioExecutionState;
  history: HistorySnapshot<ScenarioHistoryData>[];
  historyIndex: number;
}

// ============================================================================
// Discriminated Union
// ============================================================================

/**
 * Discriminated union of all document state types
 */
export type DocumentState =
  | CanvasDocumentState
  | LadderDocumentState
  | ScenarioDocumentState;

// ============================================================================
// Type Guards
// ============================================================================

/** Check if document is a canvas document */
export function isCanvasDocument(doc: DocumentState): doc is CanvasDocumentState {
  return doc.type === 'canvas';
}

/** Check if document is a ladder document */
export function isLadderDocument(doc: DocumentState): doc is LadderDocumentState {
  return doc.type === 'ladder';
}

/** Check if document is a scenario document */
export function isScenarioDocument(doc: DocumentState): doc is ScenarioDocumentState {
  return doc.type === 'scenario';
}

// ============================================================================
// Default Values
// ============================================================================

/** Default canvas document data */
export const DEFAULT_CANVAS_DATA: CanvasDocumentData = {
  components: new Map(),
  wires: [],
  metadata: {
    name: 'Untitled Circuit',
    description: '',
    tags: [],
  },
  zoom: 1.0,
  pan: { x: 0, y: 0 },
  gridSize: 20,
  snapToGrid: true,
  showGrid: true,
};

/** Default ladder document data */
export const DEFAULT_LADDER_DATA: LadderDocumentData = {
  networks: new Map(),
  currentNetworkId: null,
  gridConfig: {
    columns: 10,
    cellWidth: 80,
    cellHeight: 60,
    showGridLines: true,
    snapToGrid: true,
  },
};

/** Default scenario document data */
export const DEFAULT_SCENARIO_DATA: ScenarioDocumentData = {
  scenario: null,
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Generate a unique document ID
 */
export function generateDocumentId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create base document meta
 */
export function createDocumentMeta(
  type: DocumentType,
  name: string,
  filePath: string | null = null
): DocumentMeta {
  return {
    id: generateDocumentId(),
    type,
    name,
    filePath,
    isDirty: false,
    status: 'empty',
    lastModified: Date.now(),
    tabId: null,
  };
}

/**
 * Create an empty canvas document
 */
export function createEmptyCanvasDocument(
  name: string = 'Untitled Circuit',
  filePath: string | null = null
): CanvasDocumentState {
  return {
    ...createDocumentMeta('canvas', name, filePath),
    type: 'canvas',
    data: {
      ...DEFAULT_CANVAS_DATA,
      components: new Map(),
      wires: [],
    },
    history: [],
    historyIndex: -1,
  };
}

/**
 * Create an empty ladder document
 */
export function createEmptyLadderDocument(
  name: string = 'Untitled Ladder',
  filePath: string | null = null
): LadderDocumentState {
  return {
    ...createDocumentMeta('ladder', name, filePath),
    type: 'ladder',
    data: {
      ...DEFAULT_LADDER_DATA,
      networks: new Map(),
    },
    history: [],
    historyIndex: -1,
  };
}

/**
 * Create an empty scenario document
 */
export function createEmptyScenarioDocument(
  name: string = 'Untitled Scenario',
  filePath: string | null = null
): ScenarioDocumentState {
  return {
    ...createDocumentMeta('scenario', name, filePath),
    type: 'scenario',
    data: {
      scenario: null,
    },
    executionState: {
      status: 'idle',
      currentTime: 0,
      currentEventIndex: 0,
      completedEvents: [],
      currentLoopIteration: 1,
    },
    history: [],
    historyIndex: -1,
  };
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Actions available for all document types
 */
export interface DocumentActions {
  /** Mark document as dirty */
  markDirty: () => void;
  /** Mark document as clean (saved) */
  markClean: () => void;
  /** Undo last action */
  undo: () => void;
  /** Redo last undone action */
  redo: () => void;
  /** Check if undo is available */
  canUndo: () => boolean;
  /** Check if redo is available */
  canRedo: () => boolean;
}

/**
 * Document info for tab display
 */
export interface DocumentInfo {
  id: string;
  type: DocumentType;
  name: string;
  filePath: string | null;
  isDirty: boolean;
  status: DocumentStatus;
}

/**
 * Extract document info from document state
 */
export function getDocumentInfo(doc: DocumentState): DocumentInfo {
  return {
    id: doc.id,
    type: doc.type,
    name: doc.name,
    filePath: doc.filePath,
    isDirty: doc.isDirty,
    status: doc.status,
  };
}
