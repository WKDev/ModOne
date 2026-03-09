/**
 * Canvas Facade Types
 *
 * Single entry-point interface for all canvas state access.
 * UI components should use `useCanvasFacade(documentId)` instead of
 * directly importing canvasStore or useCanvasDocument.
 *
 * @see PRD_OneCanvas_Stabilization.md — Phase 1
 */

import type {
  Block,
  BlockType,
  Junction,
  Wire,
  WireEndpoint,
  Position,
  PortPosition,
  HandleConstraint,
  SerializableCircuitState,
} from '../components/OneCanvas/types';

// ============================================================================
// Wire Drawing State (shared between global & document mode)
// ============================================================================

/**
 * State for in-progress wire drawing.
 * Moved here from canvasStore.ts to avoid cross-layer imports.
 */
export interface WireDrawingState {
  /** Starting endpoint */
  from: WireEndpoint;
  /** Current mouse position for visual feedback */
  tempPosition: Position;
  /** Starting port position for direction detection */
  startPosition?: Position;
  /** Detected exit direction from initial drag */
  exitDirection?: PortPosition;
}

// ============================================================================
// Canvas Facade Return Interface
// ============================================================================

/**
 * Unified interface returned by `useCanvasFacade`.
 *
 * Shape is intentionally 1:1 compatible with the existing `useCanvasState`
 * return type so callers can swap with zero behavioral change.
 */
export interface CanvasFacadeReturn {
  // --------------------------------------------------------------------------
  // Selectors (read-only reactive state)
  // --------------------------------------------------------------------------

  /** All component blocks by ID */
  components: Map<string, Block>;
  /** All junction points by ID */
  junctions: Map<string, Junction>;
  /** All wire connections */
  wires: Wire[];
  /** Current zoom level */
  zoom: number;
  /** Current pan offset */
  pan: Position;

  // --------------------------------------------------------------------------
  // Component Commands
  // --------------------------------------------------------------------------

  /** Add a new component to the canvas */
  addComponent: (type: BlockType, position: Position, props?: Partial<Block>) => string;
  /** Move a component. skipHistory=true during continuous drag. */
  moveComponent: (id: string, position: Position, skipHistory?: boolean, skipWireRecalc?: boolean) => void;
  /** Update a component's properties */
  updateComponent: (id: string, updates: Partial<Block>) => void;

  // --------------------------------------------------------------------------
  // Junction Commands
  // --------------------------------------------------------------------------

  /** Move a junction. skipHistory=true during continuous drag. */
  moveJunction: (id: string, position: Position, skipHistory?: boolean, skipWireRecalc?: boolean) => void;

  // --------------------------------------------------------------------------
  // Wire Commands
  // --------------------------------------------------------------------------

  /** Add a wire connection between two endpoints */
  addWire: (
    from: WireEndpoint,
    to: WireEndpoint,
    options?: {
      fromExitDirection?: PortPosition;
      toExitDirection?: PortPosition;
      /** User-placed handles — when provided, skip auto bend point calculation */
      handles?: Array<{ position: Position; constraint: 'horizontal' | 'vertical' | 'free'; source?: 'auto' | 'user' }>;
    }
  ) => string | null;
  /** Remove a wire by ID */
  removeWire: (id: string) => void;
  /** Create a junction on an existing wire, splitting it */
  createJunctionOnWire: (wireId: string, position: Position) => string | null;
  /** Update handle position (constrained). isFirstMove pushes history for undo. */
  updateWireHandle: (wireId: string, handleIndex: number, position: Position, isFirstMove?: boolean) => void;
  /** Recalculate and simplify auto-routed handles for a single wire. */
  recalculateWireHandles: (wireId: string) => void;
  /** Remove handle from wire */
  removeWireHandle: (wireId: string, handleIndex: number) => void;
  /** Move a wire segment by delta */
  moveWireSegment: (
    wireId: string,
    handleIndexA: number,
    handleIndexB: number,
    delta: Position,
    isFirstMove?: boolean
  ) => void;
  /** Insert handles at the endpoint of a wire */
  insertEndpointHandle: (
    wireId: string,
    end: 'from' | 'to',
    newHandles: Array<{ position: Position; constraint: HandleConstraint }>
  ) => void;
  /** Remove adjacent overlapping handles */
  cleanupOverlappingHandles: (wireId: string) => void;
  commitWirePolyline: (
    wireId: string,
    poly: readonly Position[],
    routingMode: 'auto' | 'manual',
    skipHistory?: boolean
  ) => void;

  // --------------------------------------------------------------------------
  // Alignment / Distribution Commands
  // --------------------------------------------------------------------------

  /** Align selected blocks along a direction */
  alignSelected: (direction: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => void;
  /** Distribute selected blocks evenly */
  distributeSelected: (direction: 'horizontal' | 'vertical') => void;
  /** Flip (mirror) selected blocks */
  flipSelected: (axis: 'horizontal' | 'vertical') => void;

  // --------------------------------------------------------------------------
  // Circuit I/O
  // --------------------------------------------------------------------------

  /** Get current circuit data in serializable form */
  getCircuitData: () => SerializableCircuitState;
  /** Load circuit data (replaces current canvas state) */
  loadCircuit: (data: SerializableCircuitState) => void;

  // --------------------------------------------------------------------------
  // Wire Drawing Interaction
  // --------------------------------------------------------------------------

  /** In-progress wire drawing state (null = not drawing) */
  wireDrawing: WireDrawingState | null;
  /** Start drawing a wire from an endpoint */
  startWireDrawing: (
    from: WireEndpoint,
    options?: { skipValidation?: boolean; startPosition?: Position }
  ) => void;
  /** Update temporary wire position during drawing */
  updateWireDrawing: (position: Position) => void;
  /** Cancel wire drawing */
  cancelWireDrawing: () => void;

  // --------------------------------------------------------------------------
  // Selection
  // --------------------------------------------------------------------------

  /** Currently selected IDs (blocks, wires, junctions) */
  selectedIds: Set<string>;
  /** Replace selection with given IDs */
  setSelection: (ids: string[]) => void;
  /** Add an ID to current selection */
  addToSelection: (id: string) => void;
  /** Toggle selection of an ID */
  toggleSelection: (id: string) => void;
  /** Clear all selection */
  clearSelection: () => void;

  // --------------------------------------------------------------------------
  // Viewport
  // --------------------------------------------------------------------------

  /** Set pan offset */
  setPan: (pan: Position) => void;
  /** Set zoom level */
  setZoom: (zoom: number) => void;
  /** Current grid size in canvas units */
  gridSize: number;
  /** Whether snap-to-grid is enabled */
  snapToGrid: boolean;

  // --------------------------------------------------------------------------
  // History (Undo / Redo)
  // --------------------------------------------------------------------------

  /** Undo last action */
  undo: () => void;
  /** Redo previously undone action */
  redo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;

  // --------------------------------------------------------------------------
  // Metadata
  // --------------------------------------------------------------------------

  /** Whether this facade is backed by document registry (vs global store) */
  isDocumentMode: boolean;
  /** Active document ID (null if global mode) */
  documentId: string | null;
}
