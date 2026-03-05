import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Save, X, Layers } from 'lucide-react';
import type { GraphicPrimitive, SymbolDefinition, SymbolPin, SymbolUnit } from '../../types/symbol';
import { EditorCanvas } from './EditorCanvas';
import { EditorToolbar } from './EditorToolbar';
import { PinConfigPopover } from './PinConfigPopover';
import { PropertiesPanel } from './PropertiesPanel';
import { HistoryManager, AddPrimitiveCommand, RemovePrimitivesCommand, AddPinCommand, RemovePinsCommand } from './history';

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

const MAX_UNITS = 4;

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
  const [activeUnit, setActiveUnit] = useState<number | null>(
    () => (symbol?.units && symbol.units.length > 0) ? 0 : null,
  );
  const [pinPopover, setPinPopover] = useState<{
    screenX: number;
    screenY: number;
    canvasX: number;
    canvasY: number;
  } | null>(null);

  const historyRef = useRef(new HistoryManager());
  const [historyVersion, setHistoryVersion] = useState(0);
  const bumpHistory = useCallback(() => setHistoryVersion((v) => v + 1), []);

  const isMultiUnit = localSymbol.units !== undefined && localSymbol.units.length > 0;

  const handleAddPrimitive = useCallback((prim: GraphicPrimitive) => {
    const history = historyRef.current;
    if (isMultiUnit && activeUnit !== null) {
      setLocalSymbol((prev) => {
        const units = [...(prev.units ?? [])];
        const unit = { ...units[activeUnit], graphics: [...units[activeUnit].graphics, prim] };
        units[activeUnit] = unit;
        return { ...prev, units, updatedAt: new Date().toISOString() };
      });
    } else {
      history.execute(new AddPrimitiveCommand(
        (fn) => setLocalSymbol((prev) => fn(prev) as LocalSymbol),
        prim,
      ));
      bumpHistory();
    }
    dispatch({ type: 'MARK_DIRTY' });
  }, [isMultiUnit, activeUnit, bumpHistory]);

  const handleAddPin = useCallback((pin: SymbolPin) => {
    const history = historyRef.current;
    if (isMultiUnit && activeUnit !== null) {
      setLocalSymbol((prev) => {
        const units = [...(prev.units ?? [])];
        const unit = { ...units[activeUnit], pins: [...units[activeUnit].pins, pin] };
        units[activeUnit] = unit;
        return { ...prev, units, updatedAt: new Date().toISOString() };
      });
    } else {
      history.execute(new AddPinCommand(
        (fn) => setLocalSymbol((prev) => fn(prev) as LocalSymbol),
        pin,
      ));
      bumpHistory();
    }
    dispatch({ type: 'MARK_DIRTY' });
  }, [isMultiUnit, activeUnit, bumpHistory]);

  const handleDeleteSelected = useCallback(() => {
    if (state.selectedIds.size === 0) return;

    const history = historyRef.current;

    if (isMultiUnit && activeUnit !== null) {
      setLocalSymbol((prev) => {
        const units = [...(prev.units ?? [])];
        const unit = units[activeUnit];
        units[activeUnit] = {
          ...unit,
          graphics: unit.graphics.filter((_, i) => !state.selectedIds.has(`g-${i}`)),
          pins: unit.pins.filter((p) => !state.selectedIds.has(p.id)),
        };
        return { ...prev, units, updatedAt: new Date().toISOString() };
      });
    } else {
      const graphicIndices = Array.from(state.selectedIds)
        .filter((id) => id.startsWith('g-'))
        .map((id) => parseInt(id.slice(2), 10));
      const pinIds = Array.from(state.selectedIds).filter((id) => !id.startsWith('g-'));

      if (graphicIndices.length > 0) {
        history.execute(new RemovePrimitivesCommand(
          (fn) => setLocalSymbol((prev) => fn(prev) as LocalSymbol),
          graphicIndices,
        ));
      }
      if (pinIds.length > 0) {
        history.execute(new RemovePinsCommand(
          (fn) => setLocalSymbol((prev) => fn(prev) as LocalSymbol),
          pinIds,
        ));
      }
      bumpHistory();
    }

    dispatch({ type: 'DESELECT_ALL' });
    dispatch({ type: 'MARK_DIRTY' });
  }, [state.selectedIds, isMultiUnit, activeUnit, bumpHistory]);

  const handleUndo = useCallback(() => {
    historyRef.current.undo();
    bumpHistory();
    dispatch({ type: 'MARK_DIRTY' });
  }, [bumpHistory]);

  const handleRedo = useCallback(() => {
    historyRef.current.redo();
    bumpHistory();
    dispatch({ type: 'MARK_DIRTY' });
  }, [bumpHistory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleEnableMultiUnit = () => {
    setLocalSymbol((prev) => {
      const firstUnit: SymbolUnit = {
        unitId: 1,
        name: 'Unit 1',
        graphics: [...prev.graphics],
        pins: [...prev.pins],
      };
      return {
        ...prev,
        units: [firstUnit],
        graphics: [],
        pins: [],
        updatedAt: new Date().toISOString(),
      };
    });
    setActiveUnit(0);
    historyRef.current.clear();
    bumpHistory();
    dispatch({ type: 'MARK_DIRTY' });
  };

  const handleAddUnit = () => {
    setLocalSymbol((prev) => {
      const units = prev.units ?? [];
      if (units.length >= MAX_UNITS) return prev;
      const newUnit: SymbolUnit = {
        unitId: units.length + 1,
        name: `Unit ${units.length + 1}`,
        graphics: [],
        pins: [],
      };
      return { ...prev, units: [...units, newUnit], updatedAt: new Date().toISOString() };
    });
    dispatch({ type: 'MARK_DIRTY' });
  };

  const handleRemoveUnit = (index: number) => {
    setLocalSymbol((prev) => {
      const units = [...(prev.units ?? [])];
      if (units.length <= 1) return prev;
      units.splice(index, 1);
      return { ...prev, units, updatedAt: new Date().toISOString() };
    });
    setActiveUnit((prev) => {
      if (prev === null) return null;
      if (prev >= (localSymbol.units?.length ?? 1) - 1) return Math.max(0, prev - 1);
      return prev;
    });
    dispatch({ type: 'MARK_DIRTY' });
  };

  const canvasSymbol: SymbolDefinition | null = (() => {
    if (!isMultiUnit || activeUnit === null) return localSymbol;
    const unit = localSymbol.units?.[activeUnit];
    if (!unit) return localSymbol;
    return {
      ...localSymbol,
      graphics: unit.graphics,
      pins: unit.pins,
    };
  })();

  const handleSave = () => {
    onSave?.(localSymbol);
  };

  const canUndo = historyRef.current.canUndo;
  const canRedo = historyRef.current.canRedo;
  void historyVersion;

  return (
    <div data-testid="symbol-editor" className="fixed inset-0 z-50 flex flex-col bg-neutral-900">
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 bg-neutral-800">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white">Symbol Editor</h2>
          <span className="text-sm text-neutral-400">{localSymbol.name}</span>
          {state.isDirty && <span className="text-xs text-amber-400">Unsaved</span>}
        </div>

        <div className="flex items-center gap-2">
          {!isMultiUnit && (
            <button
              type="button"
              onClick={handleEnableMultiUnit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
              title="Enable multi-unit mode"
            >
              <Layers size={14} />
              Multi-Unit
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500"
            title="Save"
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

      {isMultiUnit && localSymbol.units && (
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-neutral-700 bg-neutral-800/80">
          {localSymbol.units.map((unit, i) => (
            <button
              key={unit.unitId}
              type="button"
              onClick={() => setActiveUnit(i)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                activeUnit === i
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-600'
              }`}
            >
              {unit.name}
              {localSymbol.units!.length > 1 && (
                <span
                  role="button"
                  tabIndex={0}
                  className="ml-1.5 text-[10px] opacity-60 hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); handleRemoveUnit(i); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleRemoveUnit(i); } }}
                >
                  &times;
                </span>
              )}
            </button>
          ))}
          {localSymbol.units.length < MAX_UNITS && (
            <button
              type="button"
              onClick={handleAddUnit}
              className="px-2 py-1 text-xs rounded bg-neutral-700 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-600"
            >
              +
            </button>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div data-testid="symbol-editor-toolbar">
          <EditorToolbar
            currentTool={state.currentTool}
            onToolChange={(tool) => dispatch({ type: 'SET_TOOL', tool })}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />
        </div>

        <div data-testid="symbol-editor-canvas" className="flex-1">
          <EditorCanvas
            symbol={canvasSymbol}
            state={state}
            dispatch={dispatch}
            onAddPrimitive={handleAddPrimitive}
            onAddPin={handleAddPin}
            onDeleteSelected={handleDeleteSelected}
            onOpenPinPopover={(screenX, screenY, canvasX, canvasY) => {
              setPinPopover({ screenX, screenY, canvasX, canvasY });
            }}
          />
        </div>

        <PropertiesPanel
          symbol={localSymbol}
          onChange={setLocalSymbol}
          projectDir={projectDir}
          isDirty={state.isDirty}
          onSaveSuccess={() => dispatch({ type: 'MARK_CLEAN' })}
        />
      </div>

      {pinPopover && (
        <PinConfigPopover
          screenX={pinPopover.screenX}
          screenY={pinPopover.screenY}
          canvasX={pinPopover.canvasX}
          canvasY={pinPopover.canvasY}
          onConfirm={(pin) => {
            handleAddPin(pin);
            setPinPopover(null);
          }}
          onCancel={() => setPinPopover(null)}
        />
      )}
    </div>
  );
}

export default SymbolEditor;
