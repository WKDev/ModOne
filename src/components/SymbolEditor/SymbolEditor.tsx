import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Save, X, Layers, FileDown, Play, Pencil } from 'lucide-react';
import type {
  GraphicPrimitive,
  GraphicPrimitiveOverride,
  SymbolDefinition,
  SymbolPin,
  SymbolUnit,
  SymbolVisualVariant,
} from '../../types/symbol';
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
  translatePrimitive,
} from './history';
import { SymbolEditorHost } from './SymbolEditorHost';

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
   * The currently active VisualState context for editing/preview.
   * null = editing the base/default appearance.
   * string = viewing/editing overrides for that named visual state.
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

// ============================================================================
// AC 7: Edge-snap helper — snaps a pin's body position to the nearest symbol edge
// ============================================================================

const EDGE_SNAP_THRESHOLD = 8; // distance in symbol-space units to trigger snap

/**
 * Snaps a pin position to the nearest edge of the symbol boundary (0,0)→(w,h).
 * Also updates orientation to point outward from the snapped edge.
 * Returns adjusted position + orientation, or original values if outside snap range.
 */
function snapPinToEdge(
  pos: { x: number; y: number },
  symbolWidth: number,
  symbolHeight: number,
): { position: { x: number; y: number }; orientation: 'left' | 'right' | 'up' | 'down' } | null {
  if (symbolWidth <= 0 || symbolHeight <= 0) return null;

  // Distances to each edge
  const distLeft = Math.abs(pos.x);
  const distRight = Math.abs(pos.x - symbolWidth);
  const distTop = Math.abs(pos.y);
  const distBottom = Math.abs(pos.y - symbolHeight);
  const minDist = Math.min(distLeft, distRight, distTop, distBottom);

  if (minDist > EDGE_SNAP_THRESHOLD) return null;

  // Clamp the other axis to stay within bounds
  const clampX = Math.max(0, Math.min(symbolWidth, pos.x));
  const clampY = Math.max(0, Math.min(symbolHeight, pos.y));

  if (minDist === distLeft) {
    return { position: { x: 0, y: clampY }, orientation: 'left' };
  }
  if (minDist === distRight) {
    return { position: { x: symbolWidth, y: clampY }, orientation: 'right' };
  }
  if (minDist === distTop) {
    return { position: { x: clampX, y: 0 }, orientation: 'up' };
  }
  // distBottom
  return { position: { x: clampX, y: symbolHeight }, orientation: 'down' };
}

/**
 * Apply resize bounds to a primitive, updating its geometry.
 * Only supports rect, circle, text (not polyline/pin).
 */
function applyResizeToPrimitive(
  prim: GraphicPrimitive,
  bounds: { x: number; y: number; width: number; height: number },
): GraphicPrimitive {
  switch (prim.kind) {
    case 'rect':
      return { ...prim, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    case 'circle': {
      // Use the smaller dimension as diameter to keep it circular
      const r = Math.min(bounds.width, bounds.height) / 2;
      return { ...prim, cx: bounds.x + bounds.width / 2, cy: bounds.y + bounds.height / 2, r };
    }
    case 'arc': {
      const r = Math.min(bounds.width, bounds.height) / 2;
      return { ...prim, cx: bounds.x + bounds.width / 2, cy: bounds.y + bounds.height / 2, r };
    }
    case 'text': {
      // Move position and scale fontSize proportionally based on height change
      const oldHeight = prim.fontSize * 1.2;
      const scale = bounds.height / oldHeight;
      const newFontSize = Math.max(4, prim.fontSize * scale);
      return { ...prim, x: bounds.x, y: bounds.y + newFontSize, fontSize: newFontSize };
    }
    default:
      return prim;
  }
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

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
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

export const INITIAL_EDITOR_STATE: EditorState = {
  currentTool: 'select',
  zoom: 1,
  pan: { x: 200, y: 200 },
  selectedIds: new Set(),
  isDirty: false,
  activeVisualState: null,
};

/** @internal kept for backwards-compat inside the module */
const INITIAL_STATE = INITIAL_EDITOR_STATE;

// ============================================================================
// Visual State override helpers (module-level, pure functions)
// ============================================================================

/**
 * Apply primitive overrides from a SymbolVisualVariant to a graphics array.
 *
 * Priority:
 *   1. variant.graphics — replaces base graphics entirely
 *   2. variant.primitiveOverrides — merged onto matching primitives by ID
 *   3. No override present — returns original graphics unchanged
 */
function applyVisualStateOverrides(
  graphics: GraphicPrimitive[],
  variant: SymbolVisualVariant | undefined,
): GraphicPrimitive[] {
  if (!variant) return graphics;

  // Full replacement takes priority
  if (variant.graphics && variant.graphics.length > 0) {
    return variant.graphics;
  }

  // Per-primitive overrides
  const overrides = variant.primitiveOverrides;
  if (!overrides || Object.keys(overrides).length === 0) return graphics;

  return graphics.map((prim) => {
    const key = prim.id;
    if (!key) return prim;
    const ov: GraphicPrimitiveOverride | undefined = overrides[key];
    if (!ov) return prim;
    // Merge override fields — only copy defined values
    const merged = { ...prim } as Record<string, unknown>;
    if (ov.stroke !== undefined) merged['stroke'] = ov.stroke;
    if (ov.fill !== undefined) merged['fill'] = ov.fill;
    if (ov.strokeWidth !== undefined) merged['strokeWidth'] = ov.strokeWidth;
    if (ov.opacity !== undefined) merged['opacity'] = ov.opacity;
    if (prim.kind === 'text') {
      if (ov.text !== undefined) merged['text'] = ov.text;
      if (ov.fontSize !== undefined) merged['fontSize'] = ov.fontSize;
    }
    return merged as unknown as GraphicPrimitive;
  });
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
    // Always ensure a stable id so visual-state overrides can reference the primitive
    const primWithId: GraphicPrimitive = prim.id ? prim : { ...prim, id: crypto.randomUUID() };
    const history = historyRef.current;
    if (isMultiUnit && activeUnit !== null) {
      setLocalSymbol((prev) => {
        const units = [...(prev.units ?? [])];
        const unit = { ...units[activeUnit], graphics: [...units[activeUnit].graphics, primWithId] };
        units[activeUnit] = unit;
        return { ...prev, units, updatedAt: new Date().toISOString() };
      });
    } else {
      history.execute(new AddPrimitiveCommand(
        (fn) => setLocalSymbol((prev) => fn(prev) as LocalSymbol),
        primWithId,
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

  // ── Resize primitive (SelectTool resize handles) ───────────────────────────

  const handleResizePrimitive = useCallback(
    (index: number, newBounds: { x: number; y: number; width: number; height: number }) => {
      if (isMultiUnit && activeUnit !== null) {
        setLocalSymbol((prev) => {
          const units = [...(prev.units ?? [])];
          const unit = units[activeUnit];
          const graphics = unit.graphics.map((prim, i) =>
            i === index ? applyResizeToPrimitive(prim, newBounds) : prim,
          );
          units[activeUnit] = { ...unit, graphics };
          return { ...prev, units, updatedAt: new Date().toISOString() };
        });
      } else {
        setLocalSymbol((prev) => {
          const graphics = prev.graphics.map((prim, i) =>
            i === index ? applyResizeToPrimitive(prim, newBounds) : prim,
          );
          return { ...prev, graphics, updatedAt: new Date().toISOString() };
        });
        bumpHistory();
      }
      dispatch({ type: 'MARK_DIRTY' });
    },
    [isMultiUnit, activeUnit, bumpHistory],
  );

  // ── Move pins (SelectTool drag) ────────────────────────────────────────────

  const handleMovePins = useCallback(
    (pinIds: string[], dx: number, dy: number) => {
      const symW = localSymbol.width;
      const symH = localSymbol.height;

      // AC 7: Apply edge-snap after translation
      const applySnapToPin = (p: SymbolPin): SymbolPin => {
        if (!pinIds.includes(p.id)) return p;
        const newPos = { x: p.position.x + dx, y: p.position.y + dy };
        const snap = snapPinToEdge(newPos, symW, symH);
        if (snap) {
          return { ...p, position: snap.position, orientation: snap.orientation };
        }
        return { ...p, position: newPos };
      };

      if (isMultiUnit && activeUnit !== null) {
        setLocalSymbol((prev) => {
          const units = [...(prev.units ?? [])];
          const unit = units[activeUnit];
          const pins = unit.pins.map(applySnapToPin);
          units[activeUnit] = { ...unit, pins };
          return { ...prev, units, updatedAt: new Date().toISOString() };
        });
      } else {
        // Use direct state update with snap (TranslatePinsCommand doesn't support snap)
        setLocalSymbol((prev) => {
          const pins = prev.pins.map(applySnapToPin);
          return { ...prev, pins, updatedAt: new Date().toISOString() };
        });
        bumpHistory();
      }
      dispatch({ type: 'MARK_DIRTY' });
    },
    [isMultiUnit, activeUnit, bumpHistory, localSymbol.width, localSymbol.height],
  );

  // ── Add pin ────────────────────────────────────────────────────────────────

  const handleAddPin = useCallback((pin: SymbolPin) => {
    const history = historyRef.current;

    // AC 7: Edge-snap new pins to nearest symbol edge
    const snap = snapPinToEdge(pin.position, localSymbol.width, localSymbol.height);
    const snappedPin: SymbolPin = snap
      ? { ...pin, position: snap.position, orientation: snap.orientation }
      : pin;

    if (isMultiUnit && activeUnit !== null) {
      setLocalSymbol((prev) => {
        const units = [...(prev.units ?? [])];
        const currentUnit = units[activeUnit];
        const enrichedPin: SymbolPin = { ...snappedPin, sortOrder: snappedPin.sortOrder ?? currentUnit.pins.length };
        const unit = { ...currentUnit, pins: [...currentUnit.pins, enrichedPin] };
        units[activeUnit] = unit;
        return { ...prev, units, updatedAt: new Date().toISOString() };
      });
    } else {
      const enrichedPin: SymbolPin = { ...snappedPin, sortOrder: snappedPin.sortOrder ?? localSymbol.pins.length };
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

    // AC 8: Filter out locked pins — they cannot be deleted
    const currentPins = isMultiUnit && activeUnit !== null
      ? (localSymbol.units?.[activeUnit]?.pins ?? [])
      : (localSymbol.pins ?? []);
    const lockedPinIds = new Set(currentPins.filter(p => p.locked).map(p => p.id));

    if (isMultiUnit && activeUnit !== null) {
      setLocalSymbol((prev) => {
        const units = [...(prev.units ?? [])];
        const unit = units[activeUnit];
        units[activeUnit] = {
          ...unit,
          graphics: unit.graphics.filter((_, i) => !state.selectedIds.has(`g-${i}`)),
          pins: unit.pins.filter((p) => !state.selectedIds.has(p.id) || lockedPinIds.has(p.id)),
        };
        return { ...prev, units, updatedAt: new Date().toISOString() };
      });
    } else {
      const graphicIndices = Array.from(state.selectedIds)
        .filter((id) => id.startsWith('g-'))
        .map((id) => parseInt(id.slice(2), 10));
      const pinIds = Array.from(state.selectedIds).filter((id) => !id.startsWith('g-') && !lockedPinIds.has(id));

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
  }, [state.selectedIds, isMultiUnit, activeUnit, localSymbol, bumpHistory]);

  // ── Ensure primitive has an id (required for visual-state overrides) ──────

  /**
   * If the primitive at `index` has no `id`, assign a stable UUID to it.
   * Triggers a state update so PropertiesPanel re-renders with the new id.
   */
  const handleEnsurePrimitiveId = useCallback(
    (index: number) => {
      setLocalSymbol((prev) => {
        const isInUnit = isMultiUnit && activeUnit !== null;
        const graphics = isInUnit
          ? (prev.units?.[activeUnit!]?.graphics ?? [])
          : prev.graphics;
        const prim = graphics[index];
        if (!prim || prim.id) return prev; // Already has id — no change

        const newId = crypto.randomUUID();
        if (isInUnit) {
          const units = [...(prev.units ?? [])];
          const unit = units[activeUnit!];
          const newGraphics = unit.graphics.map((g, i) =>
            i === index ? { ...g, id: newId } : g,
          );
          units[activeUnit!] = { ...unit, graphics: newGraphics };
          return { ...prev, units, updatedAt: new Date().toISOString() };
        } else {
          const newGraphics = prev.graphics.map((g, i) =>
            i === index ? { ...g, id: newId } : g,
          );
          return { ...prev, graphics: newGraphics, updatedAt: new Date().toISOString() };
        }
      });
      dispatch({ type: 'MARK_DIRTY' });
    },
    [isMultiUnit, activeUnit],
  );

  // ── Update primitive label / text ──────────────────────────────────────────

  const handleUpdatePrimitiveLabel = useCallback(
    (index: number, label: string) => {
      setLocalSymbol((prev) => {
        if (isMultiUnit && activeUnit !== null) {
          const units = [...(prev.units ?? [])];
          const unit = units[activeUnit];
          const graphics = unit.graphics.map((g, i) => (i === index ? { ...g, label } : g));
          units[activeUnit] = { ...unit, graphics };
          return { ...prev, units, updatedAt: new Date().toISOString() };
        }
        const graphics = prev.graphics.map((g, i) => (i === index ? { ...g, label } : g));
        return { ...prev, graphics, updatedAt: new Date().toISOString() };
      });
      dispatch({ type: 'MARK_DIRTY' });
    },
    [isMultiUnit, activeUnit],
  );

  const handleUpdatePrimitiveText = useCallback(
    (index: number, text: string) => {
      setLocalSymbol((prev) => {
        if (isMultiUnit && activeUnit !== null) {
          const units = [...(prev.units ?? [])];
          const unit = units[activeUnit];
          const graphics = unit.graphics.map((g, i) => {
            if (i !== index || g.kind !== 'text') return g;
            return { ...g, text };
          });
          units[activeUnit] = { ...unit, graphics };
          return { ...prev, units, updatedAt: new Date().toISOString() };
        }
        const graphics = prev.graphics.map((g, i) => {
          if (i !== index || g.kind !== 'text') return g;
          return { ...g, text };
        });
        return { ...prev, graphics, updatedAt: new Date().toISOString() };
      });
      dispatch({ type: 'MARK_DIRTY' });
    },
    [isMultiUnit, activeUnit],
  );

  // ── Update pin name / number ───────────────────────────────────────────────

  const handleUpdatePin = useCallback(
    (pinId: string, updates: Partial<Pick<SymbolPin, 'name' | 'number'>>) => {
      setLocalSymbol((prev) => {
        if (isMultiUnit && activeUnit !== null) {
          const units = [...(prev.units ?? [])];
          const unit = units[activeUnit];
          const pins = unit.pins.map((p) => (p.id === pinId ? { ...p, ...updates } : p));
          units[activeUnit] = { ...unit, pins };
          return { ...prev, units, updatedAt: new Date().toISOString() };
        }
        const pins = prev.pins.map((p) => (p.id === pinId ? { ...p, ...updates } : p));
        return { ...prev, pins, updatedAt: new Date().toISOString() };
      });
      dispatch({ type: 'MARK_DIRTY' });
    },
    [isMultiUnit, activeUnit],
  );

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

  // ── VisualState management ─────────────────────────────────────────────────

  /** Keys of currently defined visual states on the symbol */
  const visualStateNames = useMemo(
    () => Object.keys(localSymbol.visualStates ?? {}),
    [localSymbol.visualStates],
  );

  /**
   * Create (or ensure existence of) a named visual state entry.
   * After adding, automatically switches the active state to the new one.
   */
  const handleAddVisualState = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLocalSymbol((prev) => ({
      ...prev,
      visualStates: {
        ...prev.visualStates,
        // Initialize with empty overrides if the state does not exist yet
        [trimmed]: prev.visualStates?.[trimmed] ?? { primitiveOverrides: {} },
      },
      updatedAt: new Date().toISOString(),
    }));
    dispatch({ type: 'SET_VISUAL_STATE', state: trimmed });
    dispatch({ type: 'MARK_DIRTY' });
  }, []);

  /** Remove a visual state. If it was the active one, switch back to base. */
  const handleRemoveVisualState = useCallback((name: string) => {
    setLocalSymbol((prev) => {
      const vs = { ...(prev.visualStates ?? {}) };
      delete vs[name];
      return { ...prev, visualStates: vs, updatedAt: new Date().toISOString() };
    });
    // Switch back to base if the removed state was active
    dispatch({ type: 'SET_VISUAL_STATE', state: null });
    dispatch({ type: 'MARK_DIRTY' });
  }, []);

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
        const visualStates: Record<string, SymbolVisualVariant> = { ...(prev.visualStates ?? {}) };
        const currentVariant: SymbolVisualVariant = { ...(visualStates[stateName] ?? {}) };
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

  /** Clear the visual state override for a specific primitive. */
  const handleClearVisualStateOverride = useCallback(
    (primitiveId: string) => {
      const stateName = state.activeVisualState;
      if (!stateName) return;
      setLocalSymbol((prev) => {
        const visualStates: Record<string, SymbolVisualVariant> = { ...(prev.visualStates ?? {}) };
        const currentVariant: SymbolVisualVariant = { ...(visualStates[stateName] ?? {}) };
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

  // ── Canvas symbol (current unit + visual state overrides applied) ──────────

  const canvasSymbol: SymbolDefinition | null = useMemo(() => {
    // Step 1: resolve multi-unit
    let base: SymbolDefinition;
    if (!isMultiUnit || activeUnit === null) {
      base = localSymbol;
    } else {
      const unit = localSymbol.units?.[activeUnit];
      if (!unit) return localSymbol;
      base = {
        ...localSymbol,
        graphics: unit.graphics,
        pins: unit.pins,
      };
    }

    // Step 2: apply visual state overrides for preview/edit
    if (state.activeVisualState !== null) {
      const variant = localSymbol.visualStates?.[state.activeVisualState];
      if (variant) {
        return {
          ...base,
          graphics: applyVisualStateOverrides(base.graphics, variant),
        };
      }
    }

    return base;
  }, [localSymbol, isMultiUnit, activeUnit, state.activeVisualState]);

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

  // ── Preview mode ───────────────────────────────────────────────────────────

  const [previewMode, setPreviewMode] = useState(false);
  const [previewPoweredPorts, setPreviewPoweredPorts] = useState<Set<string>>(new Set());
  void previewPoweredPorts; // used by future Preview sub-AC

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = () => {
    onSave?.(localSymbol);
  };

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
          {/* Active visual state indicator */}
          {state.activeVisualState && (
            <span className="px-2 py-0.5 text-xs rounded bg-green-900/50 text-green-400 font-medium border border-green-800/60">
              State: {state.activeVisualState}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Edit / Preview toggle */}
          <button
            type="button"
            onClick={() => {
              setPreviewMode((v) => {
                if (!v) setPreviewPoweredPorts(new Set());
                return !v;
              });
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

        {/* PixiJS drawing canvas */}
        <div data-testid="symbol-editor-canvas" className="relative flex-1 overflow-hidden">
          <SymbolEditorHost
            symbol={canvasSymbol}
            currentTool={previewMode ? 'select' : state.currentTool}
            selectedIds={state.selectedIds}
            dispatch={dispatch}
            onAddPrimitive={previewMode ? undefined : handleAddPrimitive}
            onMovePrimitives={previewMode ? undefined : handleMovePrimitives}
            onMovePins={previewMode ? undefined : handleMovePins}
            onResizePrimitive={previewMode ? undefined : handleResizePrimitive}
            onDeleteSelected={previewMode ? undefined : handleDeleteSelected}
            onOpenPinPopover={previewMode ? undefined : (screenX, screenY, canvasX, canvasY) => {
              setPinPopover({ screenX, screenY, canvasX, canvasY });
            }}
            activeVisualState={state.activeVisualState}
            style={{ width: '100%', height: '100%' }}
          />

          {/* Visual state context overlay — shown when editing a non-base state */}
          {!previewMode && state.activeVisualState && (
            <div
              data-testid="visual-state-canvas-badge"
              className="pointer-events-none absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-900/75 px-3 py-0.5 text-xs font-medium text-purple-200 backdrop-blur-sm"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400" />
              Editing: <span className="font-bold">{state.activeVisualState}</span>
            </div>
          )}

          {/* Preview mode overlay */}
          {previewMode && (
            <div
              data-testid="preview-mode-overlay"
              className="pointer-events-none absolute inset-0 z-10 rounded border-2 border-amber-500/30"
            />
          )}
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
          onEnsurePrimitiveId={handleEnsurePrimitiveId}
          onUpdatePrimitiveLabel={handleUpdatePrimitiveLabel}
          onUpdatePrimitiveText={handleUpdatePrimitiveText}
          onUpdatePin={handleUpdatePin}
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
