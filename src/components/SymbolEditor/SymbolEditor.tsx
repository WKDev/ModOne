import { useReducer, useState } from 'react';
import { Save, X } from 'lucide-react';
import type { GraphicPrimitive, SymbolDefinition, SymbolPin } from '../../types/symbol';
import { EditorCanvas } from './EditorCanvas';
import { EditorToolbar } from './EditorToolbar';

export type EditorTool = 'select' | 'rect' | 'circle' | 'polyline' | 'arc' | 'text' | 'pin';

export interface EditorState {
  currentTool: EditorTool;
  zoom: number;
  pan: { x: number; y: number };
  selectedIds: Set<string>;
  isDirty: boolean;
}

export type EditorAction =
  | { type: 'SET_TOOL'; tool: EditorTool }
  | { type: 'SET_ZOOM'; zoom: number; pivot?: { x: number; y: number } }
  | { type: 'SET_PAN'; pan: { x: number; y: number } }
  | { type: 'PAN_BY'; dx: number; dy: number }
  | { type: 'SELECT'; ids: string[] }
  | { type: 'DESELECT_ALL' }
  | { type: 'MARK_DIRTY' }
  | { type: 'MARK_CLEAN' };

export interface SymbolEditorProps {
  symbol?: SymbolDefinition | null;
  projectDir: string;
  onClose: () => void;
  onSave?: (symbol: SymbolDefinition) => void;
}

interface LocalSymbol extends SymbolDefinition {
  metadata?: Record<string, unknown>;
}

function createBlankSymbol(): LocalSymbol {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: 'New Symbol',
    version: '1.0.0',
    category: 'Custom',
    description: '',
    pins: [],
    graphics: [],
    width: 80,
    height: 60,
    properties: [],
    author: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {},
  };
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_TOOL':
      return { ...state, currentTool: action.tool };
    case 'SET_ZOOM':
      return { ...state, zoom: action.zoom };
    case 'SET_PAN':
      return { ...state, pan: action.pan };
    case 'PAN_BY':
      return { ...state, pan: { x: state.pan.x + action.dx, y: state.pan.y + action.dy } };
    case 'SELECT':
      return { ...state, selectedIds: new Set(action.ids) };
    case 'DESELECT_ALL':
      return { ...state, selectedIds: new Set() };
    case 'MARK_DIRTY':
      return { ...state, isDirty: true };
    case 'MARK_CLEAN':
      return { ...state, isDirty: false };
    default:
      return state;
  }
}

const INITIAL_STATE: EditorState = {
  currentTool: 'select',
  zoom: 1,
  pan: { x: 200, y: 200 },
  selectedIds: new Set(),
  isDirty: false,
};

export function SymbolEditor({ symbol, projectDir, onClose, onSave }: SymbolEditorProps) {
  const [state, dispatch] = useReducer(editorReducer, INITIAL_STATE);
  const [localSymbol, setLocalSymbol] = useState<LocalSymbol>(() => symbol ?? createBlankSymbol());

  const handleAddPrimitive = (prim: GraphicPrimitive) => {
    setLocalSymbol((prev) => ({
      ...prev,
      graphics: [...prev.graphics, prim],
      updatedAt: new Date().toISOString(),
    }));
    dispatch({ type: 'MARK_DIRTY' });
  };

  const handleAddPin = (pin: SymbolPin) => {
    setLocalSymbol((prev) => ({
      ...prev,
      pins: [...prev.pins, pin],
      updatedAt: new Date().toISOString(),
    }));
    dispatch({ type: 'MARK_DIRTY' });
  };

  const handleDeleteSelected = () => {
    if (state.selectedIds.size === 0) {
      return;
    }

    setLocalSymbol((prev) => ({
      ...prev,
      graphics: prev.graphics.filter((_, index) => !state.selectedIds.has(`g-${index}`)),
      pins: prev.pins.filter((pin) => !state.selectedIds.has(pin.id)),
      updatedAt: new Date().toISOString(),
    }));
    dispatch({ type: 'DESELECT_ALL' });
    dispatch({ type: 'MARK_DIRTY' });
  };

  const handleSave = () => {
    onSave?.(localSymbol);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-900">
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 bg-neutral-800">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white">Symbol Editor</h2>
          <span className="text-sm text-neutral-400">{symbol?.name ?? 'New Symbol'}</span>
          {state.isDirty && <span className="text-xs text-amber-400">Unsaved</span>}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500"
            title="Save (T15)"
          >
            <Save size={14} />
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-700"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <EditorToolbar
          currentTool={state.currentTool}
          onToolChange={(tool) => dispatch({ type: 'SET_TOOL', tool })}
        />

        <div className="flex-1">
          <EditorCanvas
            symbol={localSymbol}
            state={state}
            dispatch={dispatch}
            onAddPrimitive={handleAddPrimitive}
            onAddPin={handleAddPin}
            onDeleteSelected={handleDeleteSelected}
          />
        </div>

        <aside className="w-[240px] shrink-0 border-l border-neutral-700 bg-neutral-800 p-4 text-sm text-neutral-300">
          <div className="font-medium text-neutral-100">Properties (T15)</div>
          <div className="mt-2 text-neutral-400">Project: {projectDir}</div>
        </aside>
      </div>
    </div>
  );
}

export default SymbolEditor;
