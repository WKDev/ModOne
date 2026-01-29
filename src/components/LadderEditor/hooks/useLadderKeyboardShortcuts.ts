/**
 * useLadderKeyboardShortcuts Hook
 *
 * Handles keyboard shortcuts for the ladder editor including:
 * - Delete/Backspace: Remove selected elements
 * - Ctrl+Z: Undo
 * - Ctrl+Y / Ctrl+Shift+Z: Redo
 * - Ctrl+C: Copy elements
 * - Ctrl+X: Cut elements
 * - Ctrl+V: Paste elements
 * - Ctrl+Shift+C: Copy entire network
 * - Ctrl+Shift+V: Paste network
 * - Ctrl+D: Duplicate
 * - Ctrl+A: Select all
 * - Escape: Clear selection
 * - Arrow keys: Navigate cells
 * - Enter: Open element editor
 */

import { useEffect, useCallback } from 'react';
import { useLadderStore } from '../../../stores/ladderStore';

export interface UseLadderKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled */
  enabled?: boolean;
  /** Callback when Enter is pressed on a selected element */
  onEditElement?: (elementId: string) => void;
  /** Callback when navigating cells */
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

/**
 * Check if the event target is an input field
 */
function isInputTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  const element = target as HTMLElement;
  const tagName = element.tagName?.toLowerCase();

  // Don't handle shortcuts when typing in inputs
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  // Check for contenteditable
  if (element.isContentEditable) {
    return true;
  }

  return false;
}

/**
 * Hook for ladder editor keyboard shortcuts
 */
export function useLadderKeyboardShortcuts(
  options: UseLadderKeyboardShortcutsOptions = {}
) {
  const { enabled = true, onEditElement, onNavigate } = options;

  // Get store actions
  const {
    selectedElementIds,
    mode,
    removeElement,
    copyToClipboard,
    cutSelection,
    pasteFromClipboard,
    selectAll,
    clearSelection,
    undo,
    redo,
    duplicateElement,
    copyNetwork,
    pasteNetwork,
  } = useLadderStore();

  // Handle delete key
  const handleDelete = useCallback(() => {
    if (mode !== 'edit') return;

    const idsToDelete = Array.from(selectedElementIds);
    idsToDelete.forEach((id) => {
      removeElement(id);
    });
  }, [selectedElementIds, mode, removeElement]);

  // Handle copy
  const handleCopy = useCallback(() => {
    copyToClipboard();
  }, [copyToClipboard]);

  // Handle cut
  const handleCut = useCallback(() => {
    if (mode !== 'edit') return;
    cutSelection();
  }, [mode, cutSelection]);

  // Handle paste
  const handlePaste = useCallback(() => {
    if (mode !== 'edit') return;
    pasteFromClipboard();
  }, [mode, pasteFromClipboard]);

  // Handle duplicate
  const handleDuplicate = useCallback(() => {
    if (mode !== 'edit') return;

    const ids = Array.from(selectedElementIds);
    ids.forEach((id) => {
      duplicateElement(id);
    });
  }, [selectedElementIds, mode, duplicateElement]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    selectAll();
  }, [selectAll]);

  // Handle network copy
  const handleCopyNetwork = useCallback(() => {
    copyNetwork();
  }, [copyNetwork]);

  // Handle network paste
  const handlePasteNetwork = useCallback(() => {
    if (mode !== 'edit') return;
    pasteNetwork();
  }, [mode, pasteNetwork]);

  // Handle escape
  const handleEscape = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Handle enter (edit element)
  const handleEnter = useCallback(() => {
    if (selectedElementIds.size === 1 && onEditElement) {
      const [elementId] = Array.from(selectedElementIds);
      onEditElement(elementId);
    }
  }, [selectedElementIds, onEditElement]);

  // Handle arrow key navigation
  const handleArrowKey = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (onNavigate) {
        onNavigate(direction);
      }
    },
    [onNavigate]
  );

  // Main keyboard event handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Skip if disabled
      if (!enabled) return;

      // Skip if typing in input field
      if (isInputTarget(event.target)) return;

      const { key, ctrlKey, metaKey, shiftKey } = event;
      const isModifierPressed = ctrlKey || metaKey;

      // Delete / Backspace - remove selected elements
      if (key === 'Delete' || key === 'Backspace') {
        event.preventDefault();
        handleDelete();
        return;
      }

      // Escape - clear selection
      if (key === 'Escape') {
        event.preventDefault();
        handleEscape();
        return;
      }

      // Enter - open element editor
      if (key === 'Enter' && !isModifierPressed) {
        event.preventDefault();
        handleEnter();
        return;
      }

      // Arrow keys - navigate cells
      if (key === 'ArrowUp') {
        event.preventDefault();
        handleArrowKey('up');
        return;
      }
      if (key === 'ArrowDown') {
        event.preventDefault();
        handleArrowKey('down');
        return;
      }
      if (key === 'ArrowLeft') {
        event.preventDefault();
        handleArrowKey('left');
        return;
      }
      if (key === 'ArrowRight') {
        event.preventDefault();
        handleArrowKey('right');
        return;
      }

      // Modifier key combinations
      if (isModifierPressed) {
        switch (key.toLowerCase()) {
          case 'z':
            event.preventDefault();
            if (shiftKey) {
              redo();
            } else {
              undo();
            }
            break;

          case 'y':
            event.preventDefault();
            redo();
            break;

          case 'c':
            event.preventDefault();
            if (shiftKey) {
              handleCopyNetwork();
            } else {
              handleCopy();
            }
            break;

          case 'x':
            event.preventDefault();
            handleCut();
            break;

          case 'v':
            event.preventDefault();
            if (shiftKey) {
              handlePasteNetwork();
            } else {
              handlePaste();
            }
            break;

          case 'd':
            event.preventDefault();
            handleDuplicate();
            break;

          case 'a':
            event.preventDefault();
            handleSelectAll();
            break;
        }
      }
    },
    [
      enabled,
      handleDelete,
      handleEscape,
      handleEnter,
      handleArrowKey,
      handleCopy,
      handleCut,
      handlePaste,
      handleCopyNetwork,
      handlePasteNetwork,
      handleDuplicate,
      handleSelectAll,
      undo,
      redo,
    ]
  );

  // Set up event listener
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  // Return handler for manual use if needed
  return { handleKeyDown };
}

export default useLadderKeyboardShortcuts;
