/**
 * Interaction Store — Centralized Canvas Interaction State Machine
 *
 * Single source of truth for "what interaction mode is the canvas in".
 * Replaces scattered boolean flags across useCanvasInteraction, useBlockDrag,
 * and useSelectionHandler with a discriminated union state machine.
 *
 * Modes are mutually exclusive: only one can be active at a time.
 * Transitions are guarded — entering a mode when not IDLE logs a warning.
 *
 * @see Wave 2 of OneCanvas mouse interaction architecture fix
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Position } from '../components/OneCanvas/types';

// ============================================================================
// Mode-Specific State Types
// ============================================================================

/** State for space+drag or middle-click panning */
export interface PanningState {
  /** Screen position at drag start */
  startScreenPos: Position;
  /** Pan value when drag started */
  startPan: Position;
}

/** State for dragging selected blocks/junctions on the canvas */
export interface DraggingItemsState {
  /** The primary block/junction being dragged */
  primaryBlockId: string;
  /** Starting mouse position in canvas coordinates */
  startCanvasPos: Position;
  /** Original positions of all items being dragged (for delta calculation) */
  originalPositions: Map<string, Position>;
  /** IDs that are junctions (use moveJunction instead of moveComponent) */
  junctionIds: Set<string>;
  /** Whether this is the first move in the drag (for history push) */
  isFirstMove: boolean;
  /** Cached container bounding rect (avoids repeated getBoundingClientRect) */
  containerRect: DOMRect | null;
  /** Whether the drag has passed the pixel threshold */
  hasPassedThreshold: boolean;
  /** Mouse position at mousedown in screen coordinates (for threshold check) */
  mouseDownScreenPos: Position;
}

/** State for drag-to-select (selection box) */
export interface BoxSelectingState {
  /** Canvas position at mousedown */
  mouseDownPos: Position;
  /** Current selection box coordinates (null until threshold is passed) */
  selectionBox: { start: Position; end: Position } | null;
  /** Whether drag has passed the pixel threshold */
  hasPassedThreshold: boolean;
}

// ============================================================================
// Interaction Mode (Discriminated Union)
// ============================================================================

/** All possible interaction modes — only one active at a time */
export type InteractionMode =
  | { type: 'IDLE' }
  | { type: 'PANNING'; data: PanningState }
  | { type: 'DRAGGING_ITEMS'; data: DraggingItemsState }
  | { type: 'BOX_SELECTING'; data: BoxSelectingState }
  | { type: 'WIRE_DRAWING' };

// ============================================================================
// Store Types
// ============================================================================

interface InteractionState {
  /** Current interaction mode */
  mode: InteractionMode;
  /** Whether space key is held (enables pan-ready cursor regardless of mode) */
  isSpaceHeld: boolean;
}

interface InteractionActions {
  // ── Mode Transitions ──────────────────────────────────────────────────

  /** Enter panning mode (space+drag or middle-click). Only from IDLE. */
  enterPanning: (startScreenPos: Position, startPan: Position) => void;
  /** Exit panning mode → IDLE */
  exitPanning: () => void;

  /** Enter item dragging mode (block/junction drag). Only from IDLE. */
  enterDraggingItems: (data: DraggingItemsState) => void;
  /** Update dragging state (e.g., threshold passed, first move consumed) */
  updateDraggingItems: (updates: Partial<DraggingItemsState>) => void;
  /** Exit item dragging mode → IDLE */
  exitDraggingItems: () => void;

  /** Enter box-selecting mode (drag on empty canvas). Only from IDLE. */
  enterBoxSelecting: (mouseDownPos: Position) => void;
  /** Update box-selecting state (e.g., box coordinates, threshold) */
  updateBoxSelecting: (updates: Partial<BoxSelectingState>) => void;
  /** Exit box-selecting mode → IDLE */
  exitBoxSelecting: () => void;

  /** Enter wire drawing mode (port click starts wire). Only from IDLE. */
  enterWireDrawing: () => void;
  /** Exit wire drawing mode → IDLE */
  exitWireDrawing: () => void;

  // ── Global Flags ──────────────────────────────────────────────────────

  /** Set space key held state (affects cursor display) */
  setSpaceHeld: (held: boolean) => void;

  // ── Emergency Reset ───────────────────────────────────────────────────

  /** Force reset to IDLE (e.g., Escape key, error recovery). Always allowed. */
  resetToIdle: () => void;
}

type InteractionStore = InteractionState & InteractionActions;

// ============================================================================
// Initial State
// ============================================================================

const initialState: InteractionState = {
  mode: { type: 'IDLE' },
  isSpaceHeld: false,
};

// ============================================================================
// Store
// ============================================================================

export const useInteractionStore = create<InteractionStore>()(
  devtools(
    immer((set) => ({
      ...initialState,

      // ====================================================================
      // Panning
      // ====================================================================

      enterPanning: (startScreenPos, startPan) => {
        set(
          (state) => {
            if (state.mode.type !== 'IDLE') {
              console.warn(
                `[interactionStore] Cannot enter PANNING from ${state.mode.type}`
              );
              return;
            }
            state.mode = {
              type: 'PANNING',
              data: { startScreenPos, startPan },
            };
          },
          false,
          'enterPanning'
        );
      },

      exitPanning: () => {
        set(
          (state) => {
            if (state.mode.type !== 'PANNING') return;
            state.mode = { type: 'IDLE' };
          },
          false,
          'exitPanning'
        );
      },

      // ====================================================================
      // Dragging Items
      // ====================================================================

      enterDraggingItems: (data) => {
        set(
          (state) => {
            if (state.mode.type !== 'IDLE') {
              console.warn(
                `[interactionStore] Cannot enter DRAGGING_ITEMS from ${state.mode.type}`
              );
              return;
            }
            state.mode = { type: 'DRAGGING_ITEMS', data };
          },
          false,
          'enterDraggingItems'
        );
      },

      updateDraggingItems: (updates) => {
        set(
          (state) => {
            if (state.mode.type !== 'DRAGGING_ITEMS') return;
            Object.assign(state.mode.data, updates);
          },
          false,
          'updateDraggingItems'
        );
      },

      exitDraggingItems: () => {
        set(
          (state) => {
            if (state.mode.type !== 'DRAGGING_ITEMS') return;
            state.mode = { type: 'IDLE' };
          },
          false,
          'exitDraggingItems'
        );
      },

      // ====================================================================
      // Box Selecting
      // ====================================================================

      enterBoxSelecting: (mouseDownPos) => {
        set(
          (state) => {
            if (state.mode.type !== 'IDLE') {
              console.warn(
                `[interactionStore] Cannot enter BOX_SELECTING from ${state.mode.type}`
              );
              return;
            }
            state.mode = {
              type: 'BOX_SELECTING',
              data: {
                mouseDownPos,
                selectionBox: null,
                hasPassedThreshold: false,
              },
            };
          },
          false,
          'enterBoxSelecting'
        );
      },

      updateBoxSelecting: (updates) => {
        set(
          (state) => {
            if (state.mode.type !== 'BOX_SELECTING') return;
            Object.assign(state.mode.data, updates);
          },
          false,
          'updateBoxSelecting'
        );
      },

      exitBoxSelecting: () => {
        set(
          (state) => {
            if (state.mode.type !== 'BOX_SELECTING') return;
            state.mode = { type: 'IDLE' };
          },
          false,
          'exitBoxSelecting'
        );
      },

      // ====================================================================
      // Wire Drawing
      // ====================================================================

      enterWireDrawing: () => {
        set(
          (state) => {
            if (state.mode.type !== 'IDLE') {
              console.warn(
                `[interactionStore] Cannot enter WIRE_DRAWING from ${state.mode.type}`
              );
              return;
            }
            state.mode = { type: 'WIRE_DRAWING' };
          },
          false,
          'enterWireDrawing'
        );
      },

      exitWireDrawing: () => {
        set(
          (state) => {
            if (state.mode.type !== 'WIRE_DRAWING') return;
            state.mode = { type: 'IDLE' };
          },
          false,
          'exitWireDrawing'
        );
      },

      // ====================================================================
      // Global Flags
      // ====================================================================

      setSpaceHeld: (held) => {
        set(
          (state) => {
            state.isSpaceHeld = held;
          },
          false,
          `setSpaceHeld/${held}`
        );
      },

      // ====================================================================
      // Emergency Reset
      // ====================================================================

      resetToIdle: () => {
        set(
          (state) => {
            state.mode = { type: 'IDLE' };
            state.isSpaceHeld = false;
          },
          false,
          'resetToIdle'
        );
      },
    })),
    { name: 'interaction-store' }
  )
);

// ============================================================================
// Selectors — Mode Checks
// ============================================================================

/** Check if canvas is in idle mode (no active interaction) */
export const selectIsIdle = (state: InteractionStore) =>
  state.mode.type === 'IDLE';

/** Check if canvas is currently panning */
export const selectIsPanning = (state: InteractionStore) =>
  state.mode.type === 'PANNING';

/** Check if items are being dragged */
export const selectIsDraggingItems = (state: InteractionStore) =>
  state.mode.type === 'DRAGGING_ITEMS';

/** Check if box-selection is in progress */
export const selectIsBoxSelecting = (state: InteractionStore) =>
  state.mode.type === 'BOX_SELECTING';

/** Check if wire drawing is in progress */
export const selectIsWireDrawing = (state: InteractionStore) =>
  state.mode.type === 'WIRE_DRAWING';

// ============================================================================
// Selectors — Mode Data Accessors
// ============================================================================

/** Get panning state data (null if not panning) */
export const selectPanningData = (state: InteractionStore): PanningState | null =>
  state.mode.type === 'PANNING' ? state.mode.data : null;

/** Get dragging items state data (null if not dragging) */
export const selectDraggingData = (state: InteractionStore): DraggingItemsState | null =>
  state.mode.type === 'DRAGGING_ITEMS' ? state.mode.data : null;

/** Get box-selecting state data (null if not selecting) */
export const selectBoxSelectingData = (state: InteractionStore): BoxSelectingState | null =>
  state.mode.type === 'BOX_SELECTING' ? state.mode.data : null;

// ============================================================================
// Selectors — Derived State
// ============================================================================

/** Get current interaction mode type */
export const selectModeType = (state: InteractionStore) =>
  state.mode.type;

/** Get cursor style based on current mode */
export const selectCursor = (state: InteractionStore): string => {
  if (state.mode.type === 'PANNING') return 'grabbing';
  if (state.isSpaceHeld) return 'grab';
  return 'default';
};

/** Whether any interaction is active (not idle) */
export const selectIsInteracting = (state: InteractionStore) =>
  state.mode.type !== 'IDLE';

/** Whether space is held (for UI cursor display) */
export const selectIsSpaceHeld = (state: InteractionStore) =>
  state.isSpaceHeld;
