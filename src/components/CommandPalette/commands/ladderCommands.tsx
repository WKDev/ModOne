/**
 * Ladder Editor Commands
 *
 * Commands for ladder diagram editing operations.
 */

import { Copy, Clipboard } from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import { useLadderStore } from '../../../stores/ladderStore';
import type { Command } from '../types';

/**
 * Register all ladder editor commands.
 */
export function registerLadderCommands(): void {
  const commands: Command[] = [
    {
      id: 'ladder.cutSelection',
      category: 'ladder',
      label: 'Cut Selection',
      description: 'Cut selected elements to clipboard',
      icon: <Copy size={16} />,
      shortcut: 'Ctrl+X',
      keywords: ['cut', 'clipboard', 'remove'],
      when: () => useLadderStore.getState().selectedElementIds.size > 0,
      execute: () => {
        useLadderStore.getState().cutSelection();
      },
    },
    {
      id: 'ladder.pasteFromClipboard',
      category: 'ladder',
      label: 'Paste',
      description: 'Paste elements from clipboard',
      icon: <Clipboard size={16} />,
      shortcut: 'Ctrl+V',
      keywords: ['paste', 'clipboard', 'insert'],
      when: () => useLadderStore.getState().clipboard.length > 0,
      execute: () => {
        useLadderStore.getState().pasteFromClipboard();
      },
    },
    {
      id: 'ladder.selectAll',
      category: 'ladder',
      label: 'Select All',
      description: 'Select all elements',
      icon: <Copy size={16} />,
      shortcut: 'Ctrl+A',
      keywords: ['select', 'all', 'elements'],
      execute: () => {
        useLadderStore.getState().selectAll();
      },
    },
    {
      id: 'ladder.clearSelection',
      category: 'ladder',
      label: 'Clear Selection',
      description: 'Clear the current selection',
      shortcut: 'Escape',
      keywords: ['selection', 'clear', 'deselect'],
      when: () => useLadderStore.getState().selectedElementIds.size > 0,
      execute: () => {
        useLadderStore.getState().clearSelection();
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
