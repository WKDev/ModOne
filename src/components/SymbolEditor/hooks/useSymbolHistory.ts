// 심볼 에디터의 실행취소/다시실행 히스토리 상태를 관리하는 훅
import { useCallback, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import { HistoryManager } from '../history';
import type { EditorAction } from '../editorModel';

/**
 * Owns the undo/redo HistoryManager and a version counter used to force a
 * re-render after an in-place history mutation. Extracted from SymbolEditor
 * (CLAUDE.md → Code Organization).
 */
export function useSymbolHistory(dispatch: Dispatch<EditorAction>) {
  const historyRef = useRef(new HistoryManager());
  const [historyVersion, setHistoryVersion] = useState(0);
  const bumpHistory = useCallback(() => setHistoryVersion((v) => v + 1), []);

  const handleUndo = useCallback(() => {
    historyRef.current.undo();
    bumpHistory();
    dispatch({ type: 'MARK_DIRTY' });
  }, [bumpHistory, dispatch]);

  const handleRedo = useCallback(() => {
    historyRef.current.redo();
    bumpHistory();
    dispatch({ type: 'MARK_DIRTY' });
  }, [bumpHistory, dispatch]);

  void historyVersion; // referenced only to trigger re-render on bump

  return {
    historyRef,
    bumpHistory,
    handleUndo,
    handleRedo,
    canUndo: historyRef.current.canUndo,
    canRedo: historyRef.current.canRedo,
  };
}
