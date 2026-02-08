/**
 * Edit Commands
 *
 * Commands for edit operations: undo, redo, cut, copy, paste.
 */

import { Undo2, Redo2, Scissors, Copy, Clipboard, CheckSquare } from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import {
  useLadderStore,
  selectCanUndo,
  selectCanRedo,
  selectUndoDescription,
  selectRedoDescription,
} from '../../../stores/ladderStore';
import type { Command } from '../types';

/**
 * Get the current undo description for display.
 */
function getUndoLabel(): string {
  const desc = selectUndoDescription(useLadderStore.getState());
  return desc ? `Undo '${desc}'` : 'Undo';
}

/**
 * Get the current redo description for display.
 */
function getRedoLabel(): string {
  const desc = selectRedoDescription(useLadderStore.getState());
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
      when: () => selectCanUndo(useLadderStore.getState()),
      execute: () => {
        useLadderStore.getState().undo();
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
      when: () => selectCanRedo(useLadderStore.getState()),
      execute: () => {
        useLadderStore.getState().redo();
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
