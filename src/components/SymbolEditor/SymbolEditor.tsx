import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Save, X, Layers, Eye, ChevronDown, Plus, FileDown, Play, Pencil } from 'lucide-react';
import type { GraphicPrimitive, GraphicPrimitiveOverride, SymbolDefinition, SymbolPin, SymbolUnit, SymbolVisualVariant } from '../../types/symbol';
import { EditorToolbar } from './EditorToolbar';
import { PinConfigPopover } from './PinConfigPopover';
import { PropertiesPanel } from './PropertiesPanel';
import { VisualStateBar } from './VisualStateBar';
import { symbolToXml } from '../../services/symbolXmlParser';
import {
  HistoryManager,
  AddPrimitiveCommand,
  RemovePrimitivesCommand,
  AddPinCommand,
  RemovePinsCommand,
  MovePrimitivesCommand,
  TranslatePinsCommand,
  translatePrimitive,
} from './history';
import { SvgSymbolCanvas } from './svg/SvgSymbolCanvas';

// ============================================================================
// Predefined visual states (expandable via free-text)
// ============================================================================

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
   * The currently active VisualState context for editing.
   * null = editing the base/default appearance.
   * string = editing overrides for that named visual state.
   */
  activeVisualState: string | null;
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
  | { type: 'SET_VISUAL_STATE'; state: string | null };

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
    case 'SET_VISUAL_STATE':
      return { ...state, activeVisualState: action.state };
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
  activeVisualState: null,
};

// ============================================================================
// VisualStateContextBar sub-component
// ============================================================================

interface VisualStateContextBarProps {
  /** Currently active visual state name (null = base/default appearance) */
  activeVisualState: string | null;
  /** All visual state names defined on the symbol */
  visualStateList: string[];
  /** Controlled input value for adding a new custom state */
  newStateName: string;
  /** Called when the user selects a visual state tab */
  onSetActive: (state: string | null) => void;
  /** Called when the user confirms adding a new state */
  onAddState: (name: string) => void;
  /** Called when the custom state input changes */
  onNewStateNameChange: (name: string) => void;
}

/**
 * Tab bar for switching the active visual state context.
 *
 * Displays a "Base" tab (null state) plus one tab per defined visual state.
 * A "+" popover allows adding new states (predefined presets or free-text).
 */
function VisualStateContextBar({
  activeVisualState,
  visualStateList,
  newStateName,
  onSetActive,
  onAddState,
  onNewStateNameChange,
}: VisualStateContextBarProps) {
  const [addOpen, setAddOpen] = useState(false);

  const handlePreset = (name: string) => {
    onAddState(name);
    setAddOpen(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newStateName.trim()) {
      onAddState(newStateName.trim());
      setAddOpen(false);
    }
  };

  // Presets not yet in the list
  const unusedPresets = PREDEFINED_VISUAL_STATES.filter((p) => !visualStateList.includes(p));

  return (
    <div
      data-testid="visual-state-context-bar"
      className="flex items-center gap-1 px-4 py-1 border-b border-neutral-700 bg-neutral-850 overflow-x-auto shrink-0"
    >
      {/* Icon label */}
      <Eye size={12} className="text-neutral-500 shrink-0 mr-1" />
      <span className="text-[10px] text-neutral-500 uppercase tracking-wider mr-2 shrink-0">State:</span>

      {/* Base tab */}
      <button
        type="button"
        data-testid="visual-state-tab-base"
        onClick={() => onSetActive(null)}
        className={`px-2.5 py-0.5 text-xs rounded transition-colors shrink-0 ${
          activeVisualState === null
            ? 'bg-neutral-600 text-white'
            : 'bg-neutral-750 text-neutral-400 hover:text-white hover:bg-neutral-700'
        }`}
      >
        Base
      </button>

      {/* One tab per defined visual state */}
      {visualStateList.map((stateName) => (
        <button
          key={stateName}
          type="button"
          data-testid={`visual-state-tab-${stateName}`}
          onClick={() => onSetActive(stateName)}
          className={`px-2.5 py-0.5 text-xs rounded transition-colors shrink-0 ${
            activeVisualState === stateName
              ? 'bg-purple-600 text-white'
              : 'bg-neutral-750 text-neutral-400 hover:text-white hover:bg-neutral-700'
          }`}
        >
          {stateName}
        </button>
      ))}

      {/* Add state button */}
      <div className="relative shrink-0">
        <button
          type="button"
          data-testid="visual-state-add-btn"
          onClick={() => setAddOpen((v) => !v)}
          className="flex items-center gap-0.5 px-2 py-0.5 text-xs rounded bg-neutral-750 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-700 transition-colors"
          title="Add visual state"
        >
          <Plus size={10} />
          <ChevronDown size={10} />
        </button>

        {addOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 w-52 bg-neutral-800 border border-neutral-600 rounded shadow-xl">
            {/* Predefined presets */}
            {unusedPresets.length > 0 && (
              <div className="p-1 border-b border-neutral-700">
                <p className="px-2 py-1 text-[10px] text-neutral-500 uppercase tracking-wider">Presets</p>
                {unusedPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePreset(preset)}
                    className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 rounded"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}

            {/* Custom name input */}
            <form onSubmit={handleCustomSubmit} className="p-2 flex gap-1">
              <input
                type="text"
                value={newStateName}
                onChange={(e) => onNewStateNameChange(e.target.value)}
                placeholder="Custom state…"
                className="flex-1 px-2 py-1 bg-neutral-900 border border-neutral-600 rounded text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                autoFocus
                data-testid="visual-state-custom-input"
              />
              <button
                type="submit"
                className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded"
              >
                Add
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

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

  // ── Add primitive ──────────────────────────────────────────────────────────

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

  // ── Move primitives (SelectTool drag) ──────────────────────────────────────

  const handleMovePrimitives = useCallback(
    (indices: number[], dx: number, dy: number) => {
      const history = historyRef.current;
      if (isMultiUnit && activeUnit !== null) {
        setLocalSymbol((prev) => {
          const units = [...(prev.units ?? [])];
          const unit = units[activeUnit];
          const graphics = unit.graphics.map((prim, i) =>
            indices.includes(i) ? translatePrimitive(prim, dx, dy) : prim,
          );
          units[activeUnit] = { ...unit, graphics };
          return { ...prev, units, updatedAt: new Date().toISOString() };
        });
      } else {
        history.execute(new MovePrimitivesCommand(
          (fn) => setLocalSymbol((prev) => fn(prev) as LocalSymbol),
          indices,
          dx,
          dy,
        ));
        bumpHistory();
      }
      dispatch({ type: 'MARK_DIRTY' });
    },
    [isMultiUnit, activeUnit, bumpHistory],
  );

  // ── Move pins (SelectTool drag) ────────────────────────────────────────────

  const handleMovePins = useCallback(
    (pinIds: string[], dx: number, dy: number) => {
      const history = historyRef.current;
      if (isMultiUnit && activeUnit !== null) {
        setLocalSymbol((prev) => {
          const units = [...(prev.units ?? [])];
          const unit = units[activeUnit];
          const pins = unit.pins.map((p) =>
            pinIds.includes(p.id)
              ? { ...p, position: { x: p.position.x + dx, y: p.position.y + dy } }
              : p,
          );
          units[activeUnit] = { ...unit, pins };
          return { ...prev, units, updatedAt: new Date().toISOString() };
        });
      } else {
        history.execute(new TranslatePinsCommand(
          (fn) => setLocalSymbol((prev) => fn(prev) as LocalSymbol),
          pinIds,
          dx,
          dy,
        ));
        bumpHistory();
      }
      dispatch({ type: 'MARK_DIRTY' });
    },
    [isMultiUnit, activeUnit, bumpHistory],
  );

  // ── Add pin ────────────────────────────────────────────────────────────────

  const handleAddPin = useCallback((pin: SymbolPin) => {
    const history = historyRef.current;
    if (isMultiUnit && activeUnit !== null) {
      setLocalSymbol((prev) => {
        const units = [...(prev.units ?? [])];
        const currentUnit = units[activeUnit];
        const enrichedPin: SymbolPin = { ...pin, sortOrder: pin.sortOrder ?? currentUnit.pins.length };
        const unit = { ...currentUnit, pins: [...currentUnit.pins, enrichedPin] };
        units[activeUnit] = unit;
        return { ...prev, units, updatedAt: new Date().toISOString() };
      });
    } else {
      const enrichedPin: SymbolPin = { ...pin, sortOrder: pin.sortOrder ?? localSymbol.pins.length };
      history.execute(new AddPinCommand(
        (fn) => setLocalSymbol((prev) => fn(prev) as LocalSymbol),
        enrichedPin,
      ));
      bumpHistory();
    }
    dispatch({ type: 'MARK_DIRTY' });
  }, [isMultiUnit, activeUnit, bumpHistory, localSymbol]);

  // ── Delete selected ────────────────────────────────────────────────────────

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

  // ── Undo / Redo ────────────────────────────────────────────────────────────

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

  // ── Multi-unit management ──────────────────────────────────────────────────

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

  // ── Canvas symbol (current unit or full symbol) ────────────────────────────

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

  // ── VisualState management ─────────────────────────────────────────────────

  const visualStateNames = useMemo(
    () => Object.keys(localSymbol.visualStates ?? {}),
    [localSymbol.visualStates],
  );

  const handleAddVisualState = useCallback((name: string) => {
    setLocalSymbol((prev) => ({
      ...prev,
      visualStates: {
        ...prev.visualStates,
        [name]: { primitiveOverrides: {} },
      },
      updatedAt: new Date().toISOString(),
    }));
    dispatch({ type: 'MARK_DIRTY' });
  }, []);

  const handleRemoveVisualState = useCallback((name: string) => {
    setLocalSymbol((prev) => {
      const vs = { ...prev.visualStates };
      delete vs[name];
      return { ...prev, visualStates: vs, updatedAt: new Date().toISOString() };
    });
    dispatch({ type: 'MARK_DIRTY' });
  }, []);

  // ── XML Export ─────────────────────────────────────────────────────────────

  const handleExportXml = useCallback(() => {
    const xml = symbolToXml(localSymbol);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${localSymbol.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.symbol.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [localSymbol]);

  // ── Preview mode ──────────────────────────────────────────────────────────

  const [previewMode, setPreviewMode] = useState(false);
  const [previewPoweredPorts, setPreviewPoweredPorts] = useState<Set<string>>(new Set());

  const handleTogglePreviewPort = useCallback((portId: string) => {
    setPreviewPoweredPorts((prev) => {
      const next = new Set(prev);
      if (next.has(portId)) next.delete(portId);
      else next.add(portId);
      return next;
    });
  }, []);

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = () => {
    onSave?.(localSymbol);
  };

  // ── Visual State overrides ─────────────────────────────────────────────────

  /**
   * Update (or create) a visual state override for a specific primitive.
   *
   * @param primitiveId - The `id` field of the GraphicPrimitive to override
   * @param override    - Partial override object to merge into the existing override
   */
  const handleUpdateVisualStateOverride = useCallback(
    (primitiveId: string, override: Partial<GraphicPrimitiveOverride>) => {
      const stateName = state.activeVisualState;
      if (!stateName) return;
      setLocalSymbol((prev) => {
        const visualStates = {
          ...(prev.visualStates as Record<string, SymbolVisualVariant> | undefined),
        } as Record<string, SymbolVisualVariant>;
        const currentVariant = { ...(visualStates[stateName] ?? {}) };
        const primitiveOverrides = { ...(currentVariant.primitiveOverrides ?? {}) };
        const existing = primitiveOverrides[primitiveId] ?? {};
        primitiveOverrides[primitiveId] = { ...existing, ...override };
        currentVariant.primitiveOverrides = primitiveOverrides;
        visualStates[stateName] = currentVariant;
        return { ...prev, visualStates, updatedAt: new Date().toISOString() };
      });
      dispatch({ type: 'MARK_DIRTY' });
    },
    [state.activeVisualState],
  );

  /**
   * Clear the visual state override for a specific primitive.
   */
  const handleClearVisualStateOverride = useCallback(
    (primitiveId: string) => {
      const stateName = state.activeVisualState;
      if (!stateName) return;
      setLocalSymbol((prev) => {
        const visualStates = {
          ...(prev.visualStates as Record<string, SymbolVisualVariant> | undefined),
        } as Record<string, SymbolVisualVariant>;
        const currentVariant = { ...(visualStates[stateName] ?? {}) };
        const primitiveOverrides = { ...(currentVariant.primitiveOverrides ?? {}) };
        delete primitiveOverrides[primitiveId];
        currentVariant.primitiveOverrides = primitiveOverrides;
        visualStates[stateName] = currentVariant;
        return { ...prev, visualStates, updatedAt: new Date().toISOString() };
      });
      dispatch({ type: 'MARK_DIRTY' });
    },
    [state.activeVisualState],
  );

  const canUndo = historyRef.current.canUndo;
  const canRedo = historyRef.current.canRedo;
  void historyVersion;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div data-testid="symbol-editor" className="flex flex-col w-full h-full bg-neutral-900 overflow-hidden">
      {/* ─ Header ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 bg-neutral-800">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white">Symbol Editor</h2>
          <span className="text-sm text-neutral-400">{localSymbol.name}</span>
          {state.isDirty && <span className="text-xs text-amber-400">Unsaved</span>}
        </div>

        <div className="flex items-center gap-2">
          {/* Edit / Preview toggle */}
          <button
            type="button"
            onClick={() => {
              setPreviewMode(!previewMode);
              if (!previewMode) setPreviewPoweredPorts(new Set());
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors ${
              previewMode
                ? 'bg-amber-600 text-white hover:bg-amber-500'
                : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
            }`}
            title={previewMode ? 'Switch to Edit mode' : 'Switch to Preview mode'}
          >
            {previewMode ? <><Pencil size={14} /> Edit</> : <><Play size={14} /> Preview</>}
          </button>

          {!isMultiUnit && !previewMode && (
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

          {/* XML Export */}
          <button
            type="button"
            onClick={handleExportXml}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
            title="Export as XML"
          >
            <FileDown size={14} />
            XML
          </button>

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

      {/* ─ Multi-unit tab bar ──────────────────────────────────────────────── */}
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

      {/* ─ VisualState tab bar ─────────────────────────────────────────────── */}
      <VisualStateBar
        stateNames={visualStateNames}
        activeState={state.activeVisualState}
        onStateChange={(s) => dispatch({ type: 'SET_VISUAL_STATE', state: s })}
        onAddState={handleAddVisualState}
        onRemoveState={handleRemoveVisualState}
        previewMode={previewMode}
      />

      {/* ─ Main body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbar */}
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

        {/* SVG drawing canvas */}
        <div data-testid="symbol-editor-canvas" className="flex-1 overflow-hidden">
          <SvgSymbolCanvas
            symbol={canvasSymbol}
            currentTool={state.currentTool}
            selectedIds={state.selectedIds}
            dispatch={dispatch}
            onAddPrimitive={handleAddPrimitive}
            onMovePrimitives={handleMovePrimitives}
            onMovePins={handleMovePins}
            onDeleteSelected={handleDeleteSelected}
            onOpenPinPopover={(screenX, screenY, canvasX, canvasY) => {
              setPinPopover({ screenX, screenY, canvasX, canvasY });
            }}
            activeVisualState={state.activeVisualState}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* Right properties panel */}
        <PropertiesPanel
          symbol={localSymbol}
          onChange={setLocalSymbol}
          projectDir={projectDir}
          isDirty={state.isDirty}
          onSaveSuccess={() => dispatch({ type: 'MARK_CLEAN' })}
          selectedIds={state.selectedIds}
          activeUnit={activeUnit}
          activeVisualState={state.activeVisualState}
          onUpdateVisualStateOverride={handleUpdateVisualStateOverride}
          onClearVisualStateOverride={handleClearVisualStateOverride}
        />
      </div>

      {/* ─ Pin config popover ──────────────────────────────────────────────── */}
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
