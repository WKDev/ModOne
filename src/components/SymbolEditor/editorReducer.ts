import type { EditorState, EditorAction } from './editorModel';

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_TOOL':
      return { ...state, currentTool: action.tool, editingPolylineIndex: null };
    case 'SET_ZOOM':
      return { ...state, zoom: action.zoom };
    case 'SET_PAN':
      return { ...state, pan: action.pan };
    case 'PAN_BY':
      return { ...state, pan: { x: state.pan.x + action.dx, y: state.pan.y + action.dy } };
    case 'SELECT':
      return { ...state, selectedIds: new Set(action.ids) };
    case 'DESELECT_ALL':
      return { ...state, selectedIds: new Set(), editingPolylineIndex: null };
    case 'MARK_DIRTY':
      return { ...state, isDirty: true };
    case 'MARK_CLEAN':
      return { ...state, isDirty: false };
    case 'SET_VISUAL_STATE':
      return { ...state, activeVisualState: action.state };
    case 'ENTER_POINT_EDIT':
      return { ...state, editingPolylineIndex: action.index };
    case 'EXIT_POINT_EDIT':
      return { ...state, editingPolylineIndex: null };
    default:
      return state;
  }
}

export const INITIAL_EDITOR_STATE: EditorState = {
  currentTool: 'select',
  zoom: 1,
  pan: { x: 200, y: 200 },
  selectedIds: new Set(),
  isDirty: false,
  activeVisualState: null,
  editingPolylineIndex: null,
};

/** @internal kept for backwards-compat inside the module */
export const INITIAL_STATE = INITIAL_EDITOR_STATE;
