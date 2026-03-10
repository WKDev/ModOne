/**
 * useFileOpen Hook
 *
 * Handles the file opening pipeline for VSCode-style layout:
 * 1. Resolves file type from path
 * 2. Determines target zone (editor area vs tool panel)
 * 3. Checks if file is already open in a tab (or document registry)
 * 4. Creates document in registry for document-based files
 * 5. Opens file in appropriate area or activates existing tab
 */

import { useCallback } from 'react';
import { useEditorAreaStore } from '../stores/editorAreaStore';
import { useToolPanelStore } from '../stores/toolPanelStore';
import { useDocumentRegistry } from '../stores/documentRegistry';
import { canvasService } from '../services/canvasService';
import type { CircuitState, SerializableCircuitState } from '../components/OneCanvas/types';
import type { PanelType } from '../types/panel';
import { getPanelZone } from '../types/panel';
import type { ProjectFileNode } from '../types/fileTypes';
import {
  resolveFileType,
  canOpenInEditor,
  isProjectFile,
  getTabTitle,
} from '../utils/fileTypeResolver';
import { useProject } from './useProject';
import {
  getDocumentTypeFromPath,
  shouldUseDocumentMode,
  getFileNameWithoutExtension,
} from '../utils/documentFactory';

interface UseFileOpenResult {
  /** Open a file by its path */
  openFile: (absolutePath: string, relativePath?: string) => Promise<void>;
  /** Open a file node from the explorer */
  openFileNode: (node: ProjectFileNode) => void;
  /** Check if a file can be opened in an editor */
  canOpen: (path: string) => boolean;
}

function circuitStateToSerializable(state: CircuitState): SerializableCircuitState {
  return {
    components: Object.fromEntries(state.components),
    junctions: state.junctions.size > 0 ? Object.fromEntries(state.junctions) : undefined,
    wires: state.wires,
    metadata: state.metadata,
    viewport: state.viewport,
  };
}

/**
 * Hook for opening files in the appropriate editor panel.
 * Uses VSCode-style layout with editor area and tool panel.
 */
export function useFileOpen(): UseFileOpenResult {
  // Editor area store for main editor tabs
  const addEditorTab = useEditorAreaStore((state) => state.addTab);
  const setActiveEditorTab = useEditorAreaStore((state) => state.setActiveTab);
  const findEditorTabByFilePath = useEditorAreaStore((state) => state.findTabByFilePath);

  // Tool panel store for tool tabs
  const showAndActivateTool = useToolPanelStore((state) => state.showAndActivate);

  // Document registry for multi-document editing
  const createDocument = useDocumentRegistry((state) => state.createDocument);
  const loadCanvasCircuit = useDocumentRegistry((state) => state.loadCanvasCircuit);
  const getDocumentByFilePath = useDocumentRegistry((state) => state.getDocumentByFilePath);
  const setDocumentFilePath = useDocumentRegistry((state) => state.setDocumentFilePath);
  const setDocumentStatus = useDocumentRegistry((state) => state.setDocumentStatus);
  const setDocumentTab = useDocumentRegistry((state) => state.setDocumentTab);

  // Project management
  const { openProject } = useProject();

  /**
   * Open a file in the appropriate editor.
   */
  const openFile = useCallback(
    async (absolutePath: string, relativePath?: string) => {
      const fileInfo = resolveFileType(relativePath || absolutePath);

      // Handle project files specially
      if (isProjectFile(fileInfo)) {
        console.log('Opening project manifest:', absolutePath);
        
        try {
          // 1. Actually open the project if it's not the current one
          await openProject(absolutePath);
          
          // 2. Open the project settings panel as a tab
          const panelType = fileInfo.panelType as PanelType;
          const title = getTabTitle(relativePath || absolutePath);
          
          const existingTab = findEditorTabByFilePath(absolutePath);
          if (existingTab) {
            setActiveEditorTab(existingTab.id);
            return;
          }

          addEditorTab(panelType, title, {
            filePath: absolutePath,
            relativePath: relativePath,
            fileCategory: fileInfo.category,
          });
        } catch (error) {
          console.error('Failed to open project file:', error);
        }
        return;
      }

      // Check if file can be opened in an editor
      if (!canOpenInEditor(fileInfo)) {
        console.log('File type cannot be opened in editor:', fileInfo);
        return;
      }

      const panelType = fileInfo.panelType as PanelType;
      const zone = getPanelZone(panelType);

      // Handle tool panel types (console, memory-visualizer, properties)
      if (zone === 'tool') {
        showAndActivateTool(panelType);
        return;
      }

      // Handle editor panel types (ladder-editor, one-canvas, scenario-editor, csv-viewer)
      // Check if the file is already open in editor area
      const existingTab = findEditorTabByFilePath(absolutePath);
      if (existingTab) {
        // Activate the existing tab
        setActiveEditorTab(existingTab.id);
        return;
      }

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
          const docName = getFileNameWithoutExtension(absolutePath);
          documentId = createDocument(documentType, docName);
          setDocumentFilePath(documentId, absolutePath);

          if (documentType === 'canvas') {
            try {
              setDocumentStatus(documentId, 'loading');
              const circuitState = await canvasService.loadCircuit(absolutePath);
              const serializableData = circuitStateToSerializable(circuitState);
              loadCanvasCircuit(documentId, serializableData);
            } catch (error) {
              console.error('Failed to load canvas file:', error);
              setDocumentStatus(documentId, 'error');
            }
          }
        }
      }

      // Create tab in editor area with document reference
      const tabId = addEditorTab(panelType, title, {
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
    },
    [
      findEditorTabByFilePath,
      addEditorTab,
      setActiveEditorTab,
      showAndActivateTool,
      createDocument,
      loadCanvasCircuit,
      getDocumentByFilePath,
      setDocumentFilePath,
      setDocumentStatus,
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

      void openFile(node.absolutePath, node.path);
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
