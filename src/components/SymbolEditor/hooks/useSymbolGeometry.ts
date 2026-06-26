// 심볼 에디터의 프리미티브/핀 지오메트리 변경 핸들러들을 제공하는 훅
import { useCallback } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { GraphicPrimitive, SymbolPin } from '../../../types/symbol';
import type { EditorAction, LocalSymbol, PinUpdate } from '../editorModel';
import {
  HistoryManager,
  AddPrimitiveCommand,
  RemovePrimitivesCommand,
  AddPinCommand,
  RemovePinsCommand,
  MovePrimitivesCommand,
  translatePrimitive,
} from '../history';
import { snapPinToEdge, applyResizeToPrimitive } from '../editorHelpers';

export interface SymbolGeometryParams {
  localSymbol: LocalSymbol;
  setLocalSymbol: Dispatch<SetStateAction<LocalSymbol>>;
  isMultiUnit: boolean;
  activeUnit: number | null;
  historyRef: RefObject<HistoryManager>;
  bumpHistory: () => void;
  dispatch: Dispatch<EditorAction>;
  selectedIds: Set<string>;
}

/**
 * All primitive/pin mutation handlers for the editor surface (active unit or
 * the symbol root in single-unit mode). Threads the shared localSymbol state,
 * undo/redo history, and reducer dispatch passed in from SymbolEditor.
 */
export function useSymbolGeometry({
  localSymbol,
  setLocalSymbol,
  isMultiUnit,
  activeUnit,
  historyRef,
  bumpHistory,
  dispatch,
  selectedIds,
}: SymbolGeometryParams) {
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
        bumpHistory();
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

  // ── Rotate primitive (SelectTool rotation handle) ─────────────────────────

  const handleRotatePrimitive = useCallback(
    (index: number, angle: number) => {
      if (isMultiUnit && activeUnit !== null) {
        setLocalSymbol((prev) => {
          const units = [...(prev.units ?? [])];
          const unit = units[activeUnit];
          const graphics = unit.graphics.map((prim, i) =>
            i === index ? { ...prim, rotation: angle } : prim,
          );
          units[activeUnit] = { ...unit, graphics };
          return { ...prev, units, updatedAt: new Date().toISOString() };
        });
      } else {
        setLocalSymbol((prev) => {
          const graphics = prev.graphics.map((prim, i) =>
            i === index ? { ...prim, rotation: angle } : prim,
          );
          return { ...prev, graphics, updatedAt: new Date().toISOString() };
        });
      }
      dispatch({ type: 'MARK_DIRTY' });
      bumpHistory();
    },
    [isMultiUnit, activeUnit, bumpHistory],
  );

  // ── Update primitive (polyline point editing) ──────────────────────────────

  const handleUpdatePrimitive = useCallback(
    (index: number, prim: GraphicPrimitive) => {
      if (isMultiUnit && activeUnit !== null) {
        setLocalSymbol((prev) => {
          const units = [...(prev.units ?? [])];
          const unit = units[activeUnit];
          const graphics = unit.graphics.map((g, i) => (i === index ? prim : g));
          units[activeUnit] = { ...unit, graphics };
          return { ...prev, units, updatedAt: new Date().toISOString() };
        });
      } else {
        setLocalSymbol((prev) => {
          const graphics = prev.graphics.map((g, i) => (i === index ? prim : g));
          return { ...prev, graphics, updatedAt: new Date().toISOString() };
        });
      }
      bumpHistory();
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
    if (selectedIds.size === 0) return;

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
          graphics: unit.graphics.filter((_, i) => !selectedIds.has(`g-${i}`)),
          pins: unit.pins.filter((p) => !selectedIds.has(p.id) || lockedPinIds.has(p.id)),
        };
        return { ...prev, units, updatedAt: new Date().toISOString() };
      });
    } else {
      const graphicIndices = Array.from(selectedIds)
        .filter((id) => id.startsWith('g-'))
        .map((id) => parseInt(id.slice(2), 10));
      const pinIds = Array.from(selectedIds).filter((id) => !id.startsWith('g-') && !lockedPinIds.has(id));

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
  }, [selectedIds, isMultiUnit, activeUnit, localSymbol, bumpHistory]);

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
    (pinId: string, updates: PinUpdate) => {
      setLocalSymbol((prev) => {
        // If position is being updated, apply edge-snap
        let finalUpdates = updates;
        if (updates.position) {
          const snap = snapPinToEdge(updates.position, prev.width, prev.height);
          if (snap) {
            finalUpdates = { ...updates, position: snap.position, orientation: snap.orientation };
          }
        }

        if (isMultiUnit && activeUnit !== null) {
          const units = [...(prev.units ?? [])];
          const unit = units[activeUnit];
          const pins = unit.pins.map((p) => (p.id === pinId ? { ...p, ...finalUpdates } : p));
          units[activeUnit] = { ...unit, pins };
          return { ...prev, units, updatedAt: new Date().toISOString() };
        }
        const pins = prev.pins.map((p) => (p.id === pinId ? { ...p, ...finalUpdates } : p));
        return { ...prev, pins, updatedAt: new Date().toISOString() };
      });
      dispatch({ type: 'MARK_DIRTY' });
    },
    [isMultiUnit, activeUnit],
  );

  // ── Active geometry (active unit, or the symbol root in single-unit mode) ──

  /** Graphics + pins of the surface currently being edited. */
  const getActiveGeometry = useCallback((): {
    graphics: GraphicPrimitive[];
    pins: SymbolPin[];
  } => {
    if (isMultiUnit && activeUnit !== null) {
      const unit = localSymbol.units?.[activeUnit];
      return { graphics: unit?.graphics ?? [], pins: unit?.pins ?? [] };
    }
    return { graphics: localSymbol.graphics ?? [], pins: localSymbol.pins ?? [] };
  }, [isMultiUnit, activeUnit, localSymbol]);

  return {
    handleAddPrimitive,
    handleMovePrimitives,
    handleResizePrimitive,
    handleRotatePrimitive,
    handleUpdatePrimitive,
    handleMovePins,
    handleAddPin,
    handleDeleteSelected,
    handleEnsurePrimitiveId,
    handleUpdatePrimitiveLabel,
    handleUpdatePrimitiveText,
    handleUpdatePin,
    getActiveGeometry,
  };
}
