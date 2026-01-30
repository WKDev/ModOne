/**
 * useFileOpen Hook
 *
 * Handles the file opening pipeline:
 * 1. Resolves file type from path
 * 2. Checks if file is already open in a tab (or document registry)
 * 3. Creates document in registry for document-based files
 * 4. Opens file in appropriate panel or activates existing tab
 */

import { useCallback } from 'react';
import { usePanelStore } from '../stores/panelStore';
import { useDocumentRegistry } from '../stores/documentRegistry';
import type { PanelType } from '../types/panel';
import type { ProjectFileNode } from '../types/fileTypes';
import {
  resolveFileType,
  canOpenInEditor,
  isProjectFile,
  getTabTitle,
} from '../utils/fileTypeResolver';
import {
  getDocumentTypeFromPath,
  shouldUseDocumentMode,
  getFileNameWithoutExtension,
} from '../utils/documentFactory';

interface UseFileOpenResult {
  /** Open a file by its path */
  openFile: (absolutePath: string, relativePath?: string) => void;
  /** Open a file node from the explorer */
  openFileNode: (node: ProjectFileNode) => void;
  /** Check if a file can be opened in an editor */
  canOpen: (path: string) => boolean;
}

/**
 * Hook for opening files in the appropriate editor panel.
 */
export function useFileOpen(): UseFileOpenResult {
  const panels = usePanelStore((state) => state.panels);
  const addPanel = usePanelStore((state) => state.addPanel);
  const addTab = usePanelStore((state) => state.addTab);
  const setActiveTab = usePanelStore((state) => state.setActiveTab);
  const setActivePanel = usePanelStore((state) => state.setActivePanel);

  // Document registry for multi-document editing
  const createDocument = useDocumentRegistry((state) => state.createDocument);
  const getDocumentByFilePath = useDocumentRegistry((state) => state.getDocumentByFilePath);
  const setDocumentTab = useDocumentRegistry((state) => state.setDocumentTab);

  /**
   * Find a tab that has the given file path open.
   */
  const findTabByFilePath = useCallback(
    (filePath: string): { panelId: string; tabId: string } | null => {
      for (const panel of panels) {
        if (panel.tabs) {
          for (const tab of panel.tabs) {
            if (tab.data?.filePath === filePath) {
              return { panelId: panel.id, tabId: tab.id };
            }
          }
        }
      }
      return null;
    },
    [panels]
  );

  /**
   * Find or create an editor panel for a given panel type.
   */
  const getOrCreateEditorPanel = useCallback(
    (panelType: PanelType): string => {
      // First, try to find an existing panel of the same type
      const existingPanel = panels.find((p) => p.type === panelType);
      if (existingPanel) {
        return existingPanel.id;
      }

      // Try to find any panel that can host tabs (editor panels)
      const editorTypes: PanelType[] = [
        'ladder-editor',
        'one-canvas',
        'scenario-editor',
        'csv-viewer',
      ];
      const editorPanel = panels.find((p) => editorTypes.includes(p.type));
      if (editorPanel) {
        return editorPanel.id;
      }

      // Create a new panel if none exists
      // Default to top-left grid area
      return addPanel(panelType, '1 / 1 / 2 / 2');
    },
    [panels, addPanel]
  );

  /**
   * Open a file in the appropriate editor.
   */
  const openFile = useCallback(
    (absolutePath: string, relativePath?: string) => {
      const fileInfo = resolveFileType(relativePath || absolutePath);

      // Handle project files specially (open project instead of tab)
      if (isProjectFile(fileInfo)) {
        // Project files should be handled by the project opener
        console.log('Opening project file:', absolutePath);
        // TODO: Integrate with useProject hook for opening .mop files
        return;
      }

      // Check if file can be opened in an editor
      if (!canOpenInEditor(fileInfo)) {
        console.log('File type cannot be opened in editor:', fileInfo);
        return;
      }

      const panelType = fileInfo.panelType as PanelType;

      // Check if the file is already open
      const existingTab = findTabByFilePath(absolutePath);
      if (existingTab) {
        // Activate the existing tab
        setActivePanel(existingTab.panelId);
        setActiveTab(existingTab.panelId, existingTab.tabId);
        return;
      }

      // Find or create an appropriate panel
      const panelId = getOrCreateEditorPanel(panelType);

      // Create a new tab for the file
      const title = getTabTitle(relativePath || absolutePath);

      // Check if this file type supports document-based editing
      const documentType = getDocumentTypeFromPath(absolutePath);
      const useDocumentMode = shouldUseDocumentMode(absolutePath);

      let documentId: string | undefined;

      if (useDocumentMode && documentType) {
        // Check if document already exists in registry
        const existingDoc = getDocumentByFilePath(absolutePath);
        if (existingDoc) {
          documentId = existingDoc.id;
        } else {
          // Create a new document in the registry
          const docName = getFileNameWithoutExtension(absolutePath);
          documentId = createDocument(documentType, docName);
          // TODO: Load actual file content into document
          // This will be handled when we implement file loading service
        }
      }

      // Create tab with document reference
      const tabId = addTab(panelId, panelType, title, {
        filePath: absolutePath,
        relativePath: relativePath,
        fileCategory: fileInfo.category,
        documentId: documentId,
        documentType: documentType || undefined,
      });

      // Link document to tab if document was created
      if (documentId && tabId) {
        setDocumentTab(documentId, tabId);
      }

      // Ensure the panel is active
      setActivePanel(panelId);
    },
    [
      findTabByFilePath,
      getOrCreateEditorPanel,
      addTab,
      setActiveTab,
      setActivePanel,
      createDocument,
      getDocumentByFilePath,
      setDocumentTab,
    ]
  );

  /**
   * Open a file node from the explorer tree.
   */
  const openFileNode = useCallback(
    (node: ProjectFileNode) => {
      if (node.type === 'folder') {
        return; // Don't open folders
      }

      openFile(node.absolutePath, node.path);
    },
    [openFile]
  );

  /**
   * Check if a file can be opened in an editor.
   */
  const canOpen = useCallback((path: string): boolean => {
    const fileInfo = resolveFileType(path);
    return canOpenInEditor(fileInfo) || isProjectFile(fileInfo);
  }, []);

  return {
    openFile,
    openFileNode,
    canOpen,
  };
}

export default useFileOpen;
