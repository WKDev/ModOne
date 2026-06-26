// 심볼 에디터의 비주얼 스테이트(상태별 프리미티브 오버라이드) 관리 핸들러들을 제공하는 훅
import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GraphicPrimitiveOverride, SymbolVisualVariant } from '../../../types/symbol';
import type { EditorAction, LocalSymbol } from '../editorModel';

export interface SymbolVisualStateParams {
  localSymbol: LocalSymbol;
  setLocalSymbol: Dispatch<SetStateAction<LocalSymbol>>;
  activeVisualState: string | null;
  dispatch: Dispatch<EditorAction>;
}

/**
 * Visual-state lifecycle: add/remove named states and update/clear per-primitive
 * overrides for the currently active state.
 */
export function useSymbolVisualState({
  localSymbol,
  setLocalSymbol,
  activeVisualState,
  dispatch,
}: SymbolVisualStateParams) {
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
      const stateName = activeVisualState;
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
    [activeVisualState],
  );

  /** Clear the visual state override for a specific primitive. */
  const handleClearVisualStateOverride = useCallback(
    (primitiveId: string) => {
      const stateName = activeVisualState;
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
    [activeVisualState],
  );

  return {
    visualStateNames,
    handleAddVisualState,
    handleRemoveVisualState,
    handleUpdateVisualStateOverride,
    handleClearVisualStateOverride,
  };
}
