// 심볼 에디터의 멀티유닛(유닛 추가/삭제/전환) 관리 핸들러들을 제공하는 훅
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { SymbolUnit } from '../../../types/symbol';
import type { EditorAction, LocalSymbol } from '../editorModel';
import { MAX_UNITS } from '../editorModel';
import { HistoryManager } from '../history';

export interface SymbolMultiUnitParams {
  localSymbol: LocalSymbol;
  setLocalSymbol: Dispatch<SetStateAction<LocalSymbol>>;
  setActiveUnit: Dispatch<SetStateAction<number | null>>;
  historyRef: RefObject<HistoryManager>;
  bumpHistory: () => void;
  dispatch: Dispatch<EditorAction>;
}

/**
 * Multi-unit lifecycle: promote a single-unit symbol to multi-unit, add a unit,
 * and remove a unit (keeping the active-unit index valid).
 */
export function useSymbolMultiUnit({
  localSymbol,
  setLocalSymbol,
  setActiveUnit,
  historyRef,
  bumpHistory,
  dispatch,
}: SymbolMultiUnitParams) {
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

  return { handleEnableMultiUnit, handleAddUnit, handleRemoveUnit };
}
