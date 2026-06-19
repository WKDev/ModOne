/**
 * Tag Commands
 *
 * Commands for tag browsing and management.
 */

import { Tags } from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import { useEditorAreaStore } from '../../../stores/editorAreaStore';
import type { Command } from '../types';

/**
 * Register all tag-related commands.
 */
export function registerTagCommands(): void {
  const commands: Command[] = [
    {
      id: 'view.openTagBrowser',
      category: 'view',
      label: 'Open Tag Browser',
      description: 'Browse, monitor, and manage PLC tags',
      icon: <Tags size={16} />,
      keywords: ['tag', 'tags', 'browser', 'plc', 'monitor', 'watch'],
      execute: () => {
        useEditorAreaStore.getState().openTagBrowserTab();
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
