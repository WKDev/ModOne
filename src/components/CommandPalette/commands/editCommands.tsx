/**
 * Edit Commands
 *
 * Commands for edit operations: undo, redo, cut, copy, paste.
 */

import { Undo2, Redo2, Scissors, Copy, Clipboard, CheckSquare } from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import { useDocumentRegistry } from '../../../stores/documentRegistry';
import { useEditorAreaStore } from '../../../stores/editorAreaStore';
import { isLadderDocument } from '../../../types/document';
import type { Command } from '../types';

function getActiveLadderDocumentId(): string | null {
  const { tabs, activeTabId } = useEditorAreaStore.getState();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const documentId = activeTab?.data?.documentId;
  if (typeof documentId !== 'string') {
    return null;
  }

  const document = useDocumentRegistry.getState().getDocument(documentId);
  return document && isLadderDocument(document) ? documentId : null;
}

/**
 * Get the current undo description for display.
 */
function getUndoLabel(): string {
  const documentId = getActiveLadderDocumentId();
  if (!documentId) {
    return 'Undo';
  }

  const document = useDocumentRegistry.getState().getDocument(documentId);
  if (!document || !isLadderDocument(document)) {
    return 'Undo';
  }

  const desc = document.history[document.historyIndex]?.description;
  return desc ? `Undo '${desc}'` : 'Undo';
}

/**
 * Get the current redo description for display.
 */
function getRedoLabel(): string {
  const documentId = getActiveLadderDocumentId();
  if (!documentId) {
    return 'Redo';
  }

  const document = useDocumentRegistry.getState().getDocument(documentId);
  if (!document || !isLadderDocument(document)) {
    return 'Redo';
  }

  const nextHistoryIndex = document.historyIndex + 2;
  const desc =
    nextHistoryIndex < document.history.length
      ? document.history[nextHistoryIndex]?.description
      : undefined;
  return desc ? `Redo '${desc}'` : 'Redo';
}

/**
 * Register all edit-related commands.
 */
export function registerEditCommands(): void {
  const commands: Command[] = [
    {
      id: 'edit.undo',
      category: 'edit',
      label: 'Undo',
      getLabel: getUndoLabel,
      description: 'Undo the last action',
      icon: <Undo2 size={16} />,
      shortcut: 'Ctrl+Z',
      keywords: ['undo', 'revert', 'back'],
      when: () => {
        const documentId = getActiveLadderDocumentId();
        return documentId ? useDocumentRegistry.getState().canUndo(documentId) : false;
      },
      execute: () => {
        const documentId = getActiveLadderDocumentId();
        if (documentId) {
          useDocumentRegistry.getState().undo(documentId);
        }
      },
    },
    {
      id: 'edit.redo',
      category: 'edit',
      label: 'Redo',
      getLabel: getRedoLabel,
      description: 'Redo the last undone action',
      icon: <Redo2 size={16} />,
      shortcut: 'Ctrl+Y',
      keywords: ['redo', 'forward'],
      when: () => {
        const documentId = getActiveLadderDocumentId();
        return documentId ? useDocumentRegistry.getState().canRedo(documentId) : false;
      },
      execute: () => {
        const documentId = getActiveLadderDocumentId();
        if (documentId) {
          useDocumentRegistry.getState().redo(documentId);
        }
      },
    },
    {
      id: 'edit.cut',
      category: 'edit',
      label: 'Cut',
      description: 'Cut selected elements',
      icon: <Scissors size={16} />,
      shortcut: 'Ctrl+X',
      keywords: ['cut', 'remove'],
      execute: () => {
        // Clipboard operations handled by browser/OS
        document.execCommand('cut');
      },
    },
    {
      id: 'edit.copy',
      category: 'edit',
      label: 'Copy',
      description: 'Copy selected elements',
      icon: <Copy size={16} />,
      shortcut: 'Ctrl+C',
      keywords: ['copy', 'duplicate'],
      execute: () => {
        document.execCommand('copy');
      },
    },
    {
      id: 'edit.paste',
      category: 'edit',
      label: 'Paste',
      description: 'Paste from clipboard',
      icon: <Clipboard size={16} />,
      shortcut: 'Ctrl+V',
      keywords: ['paste', 'insert'],
      execute: () => {
        document.execCommand('paste');
      },
    },
    {
      id: 'edit.selectAll',
      category: 'edit',
      label: 'Select All',
      description: 'Select all elements',
      icon: <CheckSquare size={16} />,
      shortcut: 'Ctrl+A',
      keywords: ['select', 'all'],
      execute: () => {
        document.execCommand('selectAll');
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
