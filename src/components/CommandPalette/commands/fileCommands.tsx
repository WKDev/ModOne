/**
 * File Commands
 *
 * Commands for file operations: new, open, save, save as, close.
 * Uses projectService for Tauri backend integration and projectStore for state.
 */

import { FileText, FolderOpen, Save, SaveAll, X } from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import { projectDialogService } from '../../../services/projectDialogService';
import { projectService } from '../../../services/projectService';
import {
  saveActiveDocument,
  saveAllDocuments,
} from '../../../services/documentSaveService';
import { useProjectStore } from '../../../stores/projectStore';
import { useDocumentRegistry } from '../../../stores/documentRegistry';
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
        projectDialogService.requestNewProject();
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
        projectDialogService.requestOpenProject();
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
        const { currentProjectPath, setLoading, setError, setModified } =
          useProjectStore.getState();

        try {
          setLoading(true, 'save');

          // 1. Save the active document's data (canvas / schematic / etc.) to disk
          await saveActiveDocument();

          // 2. If a project is open, also update the project manifest
          if (currentProjectPath) {
            await projectService.saveProject();
            setModified(false);
          }

          setLoading(false);
        } catch (error) {
          console.error('Failed to save:', error);
          setError(error instanceof Error ? error.message : 'Failed to save');
          setLoading(false);
        }
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
        projectDialogService.requestSaveAs();
      },
    },
    {
      id: 'file.saveAll',
      category: 'file',
      label: 'Save All',
      description: 'Save all open documents with unsaved changes',
      icon: <SaveAll size={16} />,
      shortcut: 'Ctrl+Alt+S',
      keywords: ['save', 'all', 'documents'],
      when: () => useDocumentRegistry.getState().hasUnsavedChanges(),
      execute: async () => {
        const { currentProjectPath, setModified } = useProjectStore.getState();

        try {
          // Save all dirty documents to disk
          const savedCount = await saveAllDocuments();

          // Also update the project manifest if a project is open
          if (currentProjectPath) {
            await projectService.saveProject();
            setModified(false);
          }

          console.log(`[file.saveAll] Saved ${savedCount} document(s)`);
        } catch (error) {
          console.error('[file.saveAll] Failed to save all documents:', error);
        }
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
      when: () => useProjectStore.getState().currentProject !== null,
      execute: async () => {
        const { isModified, setLoading, setError, setProject } = useProjectStore.getState();

        try {
          setLoading(true, 'close');

          if (isModified) {
            // For now, force close. In a full implementation,
            // this would show a "Save changes?" dialog
            await projectService.closeProjectForce();
          } else {
            await projectService.closeProject();
          }

          setProject(null, null);
          setLoading(false);
        } catch (error) {
          console.error('Failed to close project:', error);
          setError(error instanceof Error ? error.message : 'Failed to close project');
        }
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
