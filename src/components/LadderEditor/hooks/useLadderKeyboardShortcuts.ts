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
 * - Ctrl+D: Duplicate
 * - Ctrl+A: Select all
 * - Escape: Clear selection
 * - Arrow keys: Navigate cells
 * - Enter: Open element editor
 */

import { useEffect, useCallback } from 'react';
import { useDocumentContext } from '../../../contexts/DocumentContext';
import { useLadderUIStore } from '../../../stores/ladderUIStore';
import { useDocumentRegistry } from '../../../stores/documentRegistry';
import { isLadderDocument } from '../../../types/document';
import type { LadderElement, LadderElementType, LadderGridConfig, GridPosition, WireProperties } from '../../../types/ladder';
import { isWireType } from '../../../types/ladder';
import { updateAdjacentWires } from '../utils/wireGenerator';

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

function cloneElementDeep(element: LadderElement): LadderElement {
  return JSON.parse(JSON.stringify(element)) as LadderElement;
}

function generateElementId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function isValidPosition(
  elements: Map<string, LadderElement>,
  position: GridPosition,
  gridConfig: LadderGridConfig
): boolean {
  if (position.col < 0 || position.col >= gridConfig.columns) {
    return false;
  }
  if (position.row < 0) {
    return false;
  }

  for (const element of elements.values()) {
    if (element.position.row === position.row && element.position.col === position.col) {
      return false;
    }
  }

  return true;
}

/**
 * Hook for ladder editor keyboard shortcuts
 */
export function useLadderKeyboardShortcuts(
  options: UseLadderKeyboardShortcutsOptions = {}
) {
  const { enabled = true, onEditElement, onNavigate } = options;
  const { documentId } = useDocumentContext();

  const selectedElementIds = useLadderUIStore((state) => state.selectedElementIds);
  const mode = useLadderUIStore((state) => state.mode);

  // Handle delete key
  const handleDelete = useCallback(() => {
    if (mode !== 'edit' || !documentId) return;

    const idsToDelete = Array.from(selectedElementIds);
    if (idsToDelete.length === 0) {
      return;
    }

    const registry = useDocumentRegistry.getState();
    const doc = registry.getDocument(documentId);
    if (!doc || !isLadderDocument(doc)) {
      return;
    }

    // Record positions before deletion for adjacent wire updates
    const deletedPositions: GridPosition[] = [];
    idsToDelete.forEach((id) => {
      const el = doc.data.elements.get(id);
      if (el) {
        deletedPositions.push({ ...el.position });
      }
    });

    registry.pushHistory(documentId, `Delete ${idsToDelete.length} element(s)`);
    registry.updateLadderData(documentId, (data) => {
      idsToDelete.forEach((id) => {
        data.elements.delete(id);
      });
      data.wires = data.wires.filter(
        (wire) => !idsToDelete.includes(wire.from.elementId) && !idsToDelete.includes(wire.to.elementId)
      );

      // Auto-update adjacent wire elements after deletion
      for (const pos of deletedPositions) {
        const adjacentUpdates = updateAdjacentWires(pos, data.elements, data.gridConfig);
        for (const update of adjacentUpdates) {
          const adjElement = data.elements.get(update.elementId);
          if (adjElement && isWireType(adjElement.type)) {
            (adjElement as { type: LadderElementType }).type = update.newType;
            if (update.newDirection) {
              (adjElement.properties as WireProperties).direction = update.newDirection as WireProperties['direction'];
            } else {
              delete (adjElement.properties as WireProperties).direction;
            }
          }
        }
      }
    });
    useLadderUIStore.getState().clearSelection();
  }, [documentId, selectedElementIds, mode]);

  // Handle copy
  const handleCopy = useCallback(() => {
    if (!documentId) return;

    const registry = useDocumentRegistry.getState();
    const doc = registry.getDocument(documentId);
    if (!doc || !isLadderDocument(doc)) {
      return;
    }

    const selectedElements: LadderElement[] = [];
    selectedElementIds.forEach((id) => {
      const element = doc.data.elements.get(id);
      if (element) {
        const cloned = cloneElementDeep(element);
        cloned.selected = false;
        selectedElements.push(cloned);
      }
    });

    useLadderUIStore.getState().setClipboard(selectedElements);
  }, [documentId, selectedElementIds]);

  // Handle cut
  const handleCut = useCallback(() => {
    if (mode !== 'edit') return;
    handleCopy();
    handleDelete();
  }, [mode, handleCopy, handleDelete]);

  // Handle paste
  const handlePaste = useCallback(() => {
    if (mode !== 'edit' || !documentId) return;

    const uiStore = useLadderUIStore.getState();
    const clipboard = uiStore.clipboard;
    if (clipboard.length === 0) {
      return;
    }

    const registry = useDocumentRegistry.getState();
    const doc = registry.getDocument(documentId);
    if (!doc || !isLadderDocument(doc)) {
      return;
    }

    const firstElement = clipboard[0];
    const baseRow = firstElement.position.row;
    const baseCol = firstElement.position.col;

    // Search downward for first available row (starting at row+1)
    let offsetRow = 1;
    const offsetCol = 0;
    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const testRow = baseRow + offsetRow;
      const testCol = baseCol + offsetCol;
      const occupied = [...doc.data.elements.values()].some(
        (el) => el.position.row === testRow && el.position.col === testCol
      );
      if (!occupied) break;
      offsetRow++;
    }

    const newIds: string[] = [];

    registry.pushHistory(documentId, `Paste ${clipboard.length} element(s)`);
    registry.updateLadderData(documentId, (data) => {
      const pastedPositions: GridPosition[] = [];

      clipboard.forEach((element) => {
        const newPosition = {
          row: element.position.row + offsetRow,
          col: element.position.col + offsetCol,
        };
        if (!isValidPosition(data.elements, newPosition, data.gridConfig)) {
          return;
        }

        const newId = generateElementId(element.type);
        const cloned = cloneElementDeep(element);
        cloned.id = newId;
        cloned.position = newPosition;
        cloned.selected = false;
        data.elements.set(newId, cloned);
        newIds.push(newId);
        pastedPositions.push(newPosition);
      });

      // Auto-update adjacent wire elements after paste
      for (const pos of pastedPositions) {
        const adjacentUpdates = updateAdjacentWires(pos, data.elements, data.gridConfig);
        for (const update of adjacentUpdates) {
          const adjElement = data.elements.get(update.elementId);
          if (adjElement && isWireType(adjElement.type)) {
            (adjElement as { type: LadderElementType }).type = update.newType;
            if (update.newDirection) {
              (adjElement.properties as WireProperties).direction = update.newDirection as WireProperties['direction'];
            } else {
              delete (adjElement.properties as WireProperties).direction;
            }
          }
        }
      }
    });

    uiStore.setSelection(newIds);
  }, [documentId, mode]);

  // Handle duplicate
  const handleDuplicate = useCallback(() => {
    if (mode !== 'edit' || !documentId) return;

    const ids = Array.from(selectedElementIds);
    const registry = useDocumentRegistry.getState();
    ids.forEach((id) => {
      const doc = registry.getDocument(documentId);
      if (!doc || !isLadderDocument(doc)) {
        return;
      }

      const element = doc.data.elements.get(id);
      if (!element) {
        return;
      }

      const candidatePositions: GridPosition[] = [
        { row: element.position.row, col: element.position.col + 1 },
        { row: element.position.row + 1, col: element.position.col },
        { row: element.position.row, col: element.position.col - 1 },
        { row: element.position.row - 1, col: element.position.col },
      ];

      const availablePosition = candidatePositions.find((position) =>
        isValidPosition(doc.data.elements, position, doc.data.gridConfig)
      );
      if (!availablePosition) {
        return;
      }

      const newId = generateElementId(element.type);
      const cloned = cloneElementDeep(element);
      cloned.id = newId;
      cloned.position = availablePosition;
      cloned.selected = false;

      registry.pushHistory(documentId, `Duplicate ${element.type}`);
      registry.updateLadderData(documentId, (data) => {
        data.elements.set(newId, cloned);

        // Auto-update adjacent wire elements after duplication
        const adjacentUpdates = updateAdjacentWires(availablePosition, data.elements, data.gridConfig);
        for (const update of adjacentUpdates) {
          const adjElement = data.elements.get(update.elementId);
          if (adjElement && isWireType(adjElement.type)) {
            (adjElement as { type: LadderElementType }).type = update.newType;
            if (update.newDirection) {
              (adjElement.properties as WireProperties).direction = update.newDirection as WireProperties['direction'];
            } else {
              delete (adjElement.properties as WireProperties).direction;
            }
          }
        }
      });
    });
  }, [documentId, selectedElementIds, mode]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (!documentId) return;

    const registry = useDocumentRegistry.getState();
    const doc = registry.getDocument(documentId);
    if (!doc || !isLadderDocument(doc)) {
      return;
    }

    useLadderUIStore.getState().selectAll(Array.from(doc.data.elements.keys()));
  }, [documentId]);

  // Handle escape — clear active tool first, then selection
  const handleEscape = useCallback(() => {
    const store = useLadderUIStore.getState();
    if (store.activeTool !== null) {
      store.clearActiveTool();
    } else {
      store.clearSelection();
    }
  }, []);

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
            if (shiftKey) {
              if (!documentId) break;
              const registry = useDocumentRegistry.getState();
              if (registry.canRedo(documentId)) {
                event.preventDefault();
                registry.redo(documentId);
              }
            } else {
              if (!documentId) break;
              const registry = useDocumentRegistry.getState();
              if (registry.canUndo(documentId)) {
                event.preventDefault();
                registry.undo(documentId);
              }
            }
            break;

          case 'y':
            if (!documentId) break;
            {
              const registry = useDocumentRegistry.getState();
              if (registry.canRedo(documentId)) {
                event.preventDefault();
                registry.redo(documentId);
              }
            }
            break;

          case 'c':
            event.preventDefault();
            handleCopy();
            break;

          case 'x':
            event.preventDefault();
            handleCut();
            break;

          case 'v':
            event.preventDefault();
            handlePaste();
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
      handleDuplicate,
      handleSelectAll,
      documentId,
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
