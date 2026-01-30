/**
 * File Commands
 *
 * Commands for file operations: new, open, save, save as, close.
 */

import { FileText, FolderOpen, Save, X } from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import type { Command } from '../types';

/**
 * Register all file-related commands.
 */
export function registerFileCommands(): void {
  const commands: Command[] = [
    {
      id: 'file.new',
      category: 'file',
      label: 'New Project',
      description: 'Create a new project',
      icon: <FileText size={16} />,
      shortcut: 'Ctrl+N',
      keywords: ['create', 'project', 'new'],
      execute: async () => {
        // This will be wired up to projectService
        console.log('New Project command executed');
      },
    },
    {
      id: 'file.open',
      category: 'file',
      label: 'Open Project',
      description: 'Open an existing project',
      icon: <FolderOpen size={16} />,
      shortcut: 'Ctrl+O',
      keywords: ['load', 'open', 'project'],
      execute: async () => {
        console.log('Open Project command executed');
      },
    },
    {
      id: 'file.save',
      category: 'file',
      label: 'Save',
      description: 'Save the current project',
      icon: <Save size={16} />,
      shortcut: 'Ctrl+S',
      keywords: ['save', 'write'],
      execute: async () => {
        console.log('Save command executed');
      },
    },
    {
      id: 'file.saveAs',
      category: 'file',
      label: 'Save As...',
      description: 'Save the current project with a new name',
      icon: <Save size={16} />,
      shortcut: 'Ctrl+Shift+S',
      keywords: ['save', 'export', 'copy'],
      execute: async () => {
        console.log('Save As command executed');
      },
    },
    {
      id: 'file.close',
      category: 'file',
      label: 'Close Project',
      description: 'Close the current project',
      icon: <X size={16} />,
      shortcut: 'Ctrl+W',
      keywords: ['close', 'exit'],
      execute: async () => {
        console.log('Close Project command executed');
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
