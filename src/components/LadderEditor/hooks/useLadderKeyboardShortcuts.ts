/**
 * useLadderKeyboardShortcuts Hook
 *
 * Handles keyboard shortcuts for the ladder editor.
 * Most editor actions are now delegated to the global commandRegistry.
 * Local navigation and cell-specific logic are maintained here.
 */

import { useEffect, useCallback } from 'react';
import { useDocumentContext } from '../../../contexts/DocumentContext';
import { useLadderUIStore } from '../../../stores/ladderUIStore';
import { useDocumentRegistry } from '../../../stores/documentRegistry';
import { isLadderDocument } from '../../../types/document';
import { ladderActions } from '../utils/ladderActions';
import { useLadderDocument } from '../../../stores/hooks/useLadderDocument';
import { handlePlacement } from '../utils/ladderPlacement';
import { useSettingsStore } from '../../../stores/settingsStore';
import type { LadderShortcutProfile } from '../../../types/settings';
import type { LadderElementType } from '../../../types/ladder';

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
 * Get element type for a key based on the profile
 */
function getToolForShortcut(
  key: string,
  shiftKey: boolean,
  profile: LadderShortcutProfile
): LadderElementType | null {
  if (profile === 'gxworks') {
    if (key === 'F5') return 'contact_no';
    if (key === 'F6') return 'contact_nc';
    if (key === 'F7') return 'coil';
    if (key === 'F8') return 'timer_ton'; // or function
    if (key === 'F9' && !shiftKey) return 'wire_h';
    if (key === 'F9' && shiftKey) return 'wire_v';
  } else {
    // Default / XG5000 style
    if (key === 'F3') return 'contact_no';
    if (key === 'F4') return 'contact_nc';
    if (key === 'F5') return 'wire_h';
    if (key === 'F6') return 'wire_v';
    if (key === 'F9') return 'coil';
    // Add F-keys for consistency if profile is generic
    if (key === 'F7') return 'coil';
    if (key === 'F8') return 'timer_ton';
  }
  return null;
}

/**
 * Hook for ladder editor keyboard shortcuts
 */
export function useLadderKeyboardShortcuts(
  options: UseLadderKeyboardShortcutsOptions = {}
) {
  const { enabled = true, onEditElement } = options;
  const { documentId } = useDocumentContext();
  const ladderDoc = useLadderDocument(documentId);
  const profile = useSettingsStore((state) => state.getMergedSettings().ladderShortcutProfile);

  const selectedElementIds = useLadderUIStore((state) => state.selectedElementIds);
  const mode = useLadderUIStore((state) => state.mode);

  // Handle escape — clear active tool first, then selection
  const handleEscape = useCallback(() => {
    const store = useLadderUIStore.getState();
    if (store.activeTool !== null) {
      store.clearActiveTool();
    } else {
      store.clearSelection();
    }
  }, []);

  // Handle enter (edit element or move cursor down like Excel)
  const handleEnter = useCallback(() => {
    if (selectedElementIds.size === 1 && onEditElement) {
      const [elementId] = Array.from(selectedElementIds);
      onEditElement(elementId);
      return;
    }
    // Enter with no editor: move cursor down (Excel style)
    if (!documentId) return;
    const registry = useDocumentRegistry.getState();
    const doc = registry.getDocument(documentId);
    if (!doc || !isLadderDocument(doc)) return;
    const uiStore = useLadderUIStore.getState();
    const cursor = uiStore.cursorCell;
    if (!cursor) return;
    const newRow = cursor.row + 1;
    const newCursor = { row: newRow, col: cursor.col };
    uiStore.setCursorCell(newCursor);
    uiStore.setSelectionAnchor(newCursor);
    uiStore.clearSelection();
  }, [selectedElementIds, onEditElement, documentId]);

  // Handle arrow key navigation — moves cursor, Shift+Arrow extends selection range
  const handleArrowKey = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right', shiftKey: boolean) => {
      if (!documentId) return;
      const registry = useDocumentRegistry.getState();
      const doc = registry.getDocument(documentId);
      if (!doc || !isLadderDocument(doc)) return;

      const uiStore = useLadderUIStore.getState();
      const cursor = uiStore.cursorCell;
      if (!cursor) return;

      const { columns } = doc.data.gridConfig;
      const delta = {
        up: { dRow: -1, dCol: 0 },
        down: { dRow: 1, dCol: 0 },
        left: { dRow: 0, dCol: -1 },
        right: { dRow: 0, dCol: 1 },
      }[direction];

      const newRow = Math.max(0, cursor.row + delta.dRow);
      const newCol = Math.max(0, Math.min(columns - 1, cursor.col + delta.dCol));
      const newCursor = { row: newRow, col: newCol };

      uiStore.setCursorCell(newCursor);

      if (shiftKey) {
        // Extend selection range from anchor to new cursor
        const anchor = uiStore.selectionAnchor ?? cursor;
        const minRow = Math.min(anchor.row, newRow);
        const maxRow = Math.max(anchor.row, newRow);
        const minCol = Math.min(anchor.col, newCol);
        const maxCol = Math.max(anchor.col, newCol);

        const rangeIds: string[] = [];
        for (const el of doc.data.elements.values()) {
          if (
            el.position.row >= minRow && el.position.row <= maxRow &&
            el.position.col >= minCol && el.position.col <= maxCol
          ) {
            rangeIds.push(el.id);
          }
        }
        uiStore.setSelection(rangeIds);
      } else {
        // Plain arrow: clear selection, reset anchor to new cursor
        uiStore.clearSelection();
        uiStore.setSelectionAnchor(newCursor);
      }
    },
    [documentId]
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
        if (documentId) ladderActions.deleteSelected(documentId);
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
        handleArrowKey('up', shiftKey);
        return;
      }
      if (key === 'ArrowDown') {
        event.preventDefault();
        handleArrowKey('down', shiftKey);
        return;
      }
      if (key === 'ArrowLeft') {
        event.preventDefault();
        handleArrowKey('left', shiftKey);
        return;
      }
      if (key === 'ArrowRight') {
        event.preventDefault();
        handleArrowKey('right', shiftKey);
        return;
      }

      // --- Ladder Element Shortcuts (F-keys) ---
      if (ladderDoc && mode === 'edit' && !isModifierPressed) {
        const toolToPlace = getToolForShortcut(key, shiftKey, profile);
        if (toolToPlace) {
          event.preventDefault();
          event.stopPropagation(); // Stop from hitting global commands

          const uiStore = useLadderUIStore.getState();
          const cursor = uiStore.cursorCell;

          if (cursor) {
            // Immediate placement
            handlePlacement(ladderDoc, toolToPlace, cursor.row, cursor.col, shiftKey);
            // Also set as active tool for consistency
            uiStore.setActiveTool(toolToPlace);
          }
          return;
        }
      }
    },
    [
      enabled,
      handleEscape,
      handleEnter,
      handleArrowKey,
      documentId,
      ladderDoc,
      mode,
      profile,
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
