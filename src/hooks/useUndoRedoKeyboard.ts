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
import { useDocumentContext } from '../contexts/DocumentContext';
import { useDocumentRegistry } from '../stores/documentRegistry';

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
  const { documentId } = useDocumentContext();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if typing in an input field
    if (isInputElement(e.target)) {
      return;
    }

    if (!documentId) {
      return;
    }

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if (!isCtrlOrCmd) return;

    const key = e.key.toLowerCase();
    const registry = useDocumentRegistry.getState();

    // Ctrl+Z: Undo (without Shift)
    if (key === 'z' && !e.shiftKey) {
      if (registry.canUndo(documentId)) {
        e.preventDefault();
        registry.undo(documentId);
      }
      return;
    }

    // Ctrl+Shift+Z or Ctrl+Y: Redo
    if ((key === 'z' && e.shiftKey) || key === 'y') {
      if (registry.canRedo(documentId)) {
        e.preventDefault();
        registry.redo(documentId);
      }
      return;
    }
  }, [documentId]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useUndoRedoKeyboard;
