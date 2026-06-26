import type { SymbolDefinition } from '../../types/symbol';

export const PREDEFINED_VISUAL_STATES = [
  'idle', 'energized', 'deenergized', 'lit', 'dark',
  'running', 'stopped', 'open', 'closed', 'pressed', 'released',
] as const;

export type PredefinedVisualState = typeof PREDEFINED_VISUAL_STATES[number];

// ============================================================================
// Editor tool type — extended with 'line'
// ============================================================================

export type EditorTool =
  | 'select'
  | 'rect'
  | 'circle'
  | 'line'
  | 'polyline'
  | 'arc'
  | 'text'
  | 'pin';

// ============================================================================
// Editor state & reducer
// ============================================================================

export interface EditorState {
  currentTool: EditorTool;
  zoom: number;
  pan: { x: number; y: number };
  selectedIds: Set<string>;
  isDirty: boolean;
  /**
   * The currently active VisualState context for editing/preview.
   * null = editing the base/default appearance.
   * string = viewing/editing overrides for that named visual state.
   */
  activeVisualState: string | null;
  /**
   * Index of the polyline primitive currently in point-edit mode.
   * null = not editing any polyline's points.
   */
  editingPolylineIndex: number | null;
}

export type EditorAction =
  | { type: 'SET_TOOL'; tool: EditorTool }
  | { type: 'SET_ZOOM'; zoom: number; pivot?: { x: number; y: number } }
  | { type: 'SET_PAN'; pan: { x: number; y: number } }
  | { type: 'PAN_BY'; dx: number; dy: number }
  | { type: 'SELECT'; ids: string[] }
  | { type: 'DESELECT_ALL' }
  | { type: 'MARK_DIRTY' }
  | { type: 'MARK_CLEAN' }
  /** Set the active VisualState context (null = base/default) */
  | { type: 'SET_VISUAL_STATE'; state: string | null }
  /** Enter polyline point-edit mode */
  | { type: 'ENTER_POINT_EDIT'; index: number }
  /** Exit polyline point-edit mode */
  | { type: 'EXIT_POINT_EDIT' };

export interface SymbolEditorProps {
  symbol?: SymbolDefinition | null;
  projectDir: string;
  onClose: () => void;
  onSave?: (symbol: SymbolDefinition) => void;
}

export interface LocalSymbol extends SymbolDefinition {
  metadata?: Record<string, unknown>;
}

export const MAX_UNITS = 4;
