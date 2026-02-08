/**
 * useUndoRedoKeyboard Hook
 *
 * Provides global keyboard shortcuts for undo/redo operations.
 * - Ctrl+Z: Undo
 * - Ctrl+Y or Ctrl+Shift+Z: Redo
 *
 * Works with the ladder editor's undo/redo functionality.
 */

import { useEffect, useCallback } from 'react';
import { useLadderStore, selectCanUndo, selectCanRedo } from '../stores/ladderStore';

/**
 * Check if the event target is an input element where we should not intercept shortcuts
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target) return false;
  const element = target as HTMLElement;
  const tagName = element.tagName?.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.isContentEditable
  );
}

/**
 * Hook for handling global undo/redo keyboard shortcuts
 */
export function useUndoRedoKeyboard(): void {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if typing in an input field
    if (isInputElement(e.target)) {
      return;
    }

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if (!isCtrlOrCmd) return;

    const key = e.key.toLowerCase();

    // Ctrl+Z: Undo (without Shift)
    if (key === 'z' && !e.shiftKey) {
      const state = useLadderStore.getState();
      if (selectCanUndo(state)) {
        e.preventDefault();
        state.undo();
      }
      return;
    }

    // Ctrl+Shift+Z or Ctrl+Y: Redo
    if ((key === 'z' && e.shiftKey) || key === 'y') {
      const state = useLadderStore.getState();
      if (selectCanRedo(state)) {
        e.preventDefault();
        state.redo();
      }
      return;
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useUndoRedoKeyboard;
