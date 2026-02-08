/**
 * useSchematicDocument Hook
 *
 * Provides schematic-specific operations for a document in the registry.
 * Wraps documentRegistry operations for multi-page schematic management.
 */

import { useCallback, useMemo } from 'react';
import { useDocumentRegistry } from '../documentRegistry';
import { isSchematicDocument } from '../../types/document';
import type { MultiPageSchematic, SchematicPage, PageNavigationInfo } from '../../components/OneCanvas/utils/multiPageSchematic';
import {
  addPage,
  removePage,
  updatePage,
  reorderPages,
  setActivePage,
  getActivePage,
  getNavigationInfo,
  goToNextPage,
  goToPreviousPage,
} from '../../components/OneCanvas/utils/multiPageSchematic';

// ============================================================================
// Types
// ============================================================================

/** Return type for useSchematicDocument hook */
export interface UseSchematicDocumentReturn {
  // Data
  schematic: MultiPageSchematic;
  activePage: SchematicPage;
  navigationInfo: PageNavigationInfo;
  isDirty: boolean;

  // Page management
  addPage: (name?: string, description?: string) => void;
  removePage: (pageId: string) => void;
  updatePage: (pageId: string, updates: Partial<Pick<SchematicPage, 'name' | 'description' | 'pageSize' | 'orientation'>>) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  duplicatePage: (pageId: string) => void;

  // Navigation
  setActivePage: (pageId: string) => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;

  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Status
  markSaved: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for accessing and manipulating schematic document state.
 *
 * @param documentId - The document ID to operate on
 * @returns Schematic document state and operations, or null if document not found
 */
export function useSchematicDocument(documentId: string | null): UseSchematicDocumentReturn | null {
  const document = useDocumentRegistry((state) =>
    documentId ? state.documents.get(documentId) : undefined
  );
  const updateSchematicData = useDocumentRegistry((state) => state.updateSchematicData);
  const pushHistory = useDocumentRegistry((state) => state.pushHistory);
  const undoAction = useDocumentRegistry((state) => state.undo);
  const redoAction = useDocumentRegistry((state) => state.redo);
  const canUndoCheck = useDocumentRegistry((state) => state.canUndo);
  const canRedoCheck = useDocumentRegistry((state) => state.canRedo);
  const markClean = useDocumentRegistry((state) => state.markClean);

  const schematicDoc = document && isSchematicDocument(document) ? document : null;
  const schematic = schematicDoc?.data.schematic;

  // Page management operations
  const addPageCallback = useCallback(
    (name?: string, description?: string) => {
      if (!documentId || !schematic) return;

      pushHistory(documentId);
      updateSchematicData(documentId, (data) => {
        data.schematic = addPage(data.schematic, name, description);
      });
    },
    [documentId, schematic, pushHistory, updateSchematicData]
  );

  const removePageCallback = useCallback(
    (pageId: string) => {
      if (!documentId || !schematic) return;

      pushHistory(documentId);
      updateSchematicData(documentId, (data) => {
        data.schematic = removePage(data.schematic, pageId);
      });
    },
    [documentId, schematic, pushHistory, updateSchematicData]
  );

  const updatePageCallback = useCallback(
    (pageId: string, updates: Partial<Pick<SchematicPage, 'name' | 'description' | 'pageSize' | 'orientation'>>) => {
      if (!documentId || !schematic) return;

      pushHistory(documentId);
      updateSchematicData(documentId, (data) => {
        data.schematic = updatePage(data.schematic, pageId, updates);
      });
    },
    [documentId, schematic, pushHistory, updateSchematicData]
  );

  const reorderPagesCallback = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!documentId || !schematic) return;

      pushHistory(documentId);
      updateSchematicData(documentId, (data) => {
        data.schematic = reorderPages(data.schematic, fromIndex, toIndex);
      });
    },
    [documentId, schematic, pushHistory, updateSchematicData]
  );

  const duplicatePageCallback = useCallback(
    (pageId: string) => {
      if (!documentId || !schematic) return;

      const sourcePage = schematic.pages.find(p => p.id === pageId);
      if (!sourcePage) return;

      pushHistory(documentId);
      updateSchematicData(documentId, (data) => {
        // Add a new page then copy the circuit from source
        data.schematic = addPage(data.schematic, `${sourcePage.name} (Copy)`);
        const newPage = data.schematic.pages[data.schematic.pages.length - 1];
        newPage.circuit = JSON.parse(JSON.stringify(sourcePage.circuit));
        newPage.pageSize = sourcePage.pageSize;
        newPage.orientation = sourcePage.orientation;
      });
    },
    [documentId, schematic, pushHistory, updateSchematicData]
  );

  // Navigation operations
  const setActivePageCallback = useCallback(
    (pageId: string) => {
      if (!documentId || !schematic) return;

      updateSchematicData(documentId, (data) => {
        data.schematic = setActivePage(data.schematic, pageId);
      });
    },
    [documentId, schematic, updateSchematicData]
  );

  const goToNextPageCallback = useCallback(() => {
    if (!documentId || !schematic) return;

    updateSchematicData(documentId, (data) => {
      data.schematic = goToNextPage(data.schematic);
    });
  }, [documentId, schematic, updateSchematicData]);

  const goToPreviousPageCallback = useCallback(() => {
    if (!documentId || !schematic) return;

    updateSchematicData(documentId, (data) => {
      data.schematic = goToPreviousPage(data.schematic);
    });
  }, [documentId, schematic, updateSchematicData]);

  // History operations
  const undo = useCallback(() => {
    if (documentId) undoAction(documentId);
  }, [documentId, undoAction]);

  const redo = useCallback(() => {
    if (documentId) redoAction(documentId);
  }, [documentId, redoAction]);

  const canUndo = documentId ? canUndoCheck(documentId) : false;
  const canRedo = documentId ? canRedoCheck(documentId) : false;

  const markSavedCallback = useCallback(() => {
    if (documentId) markClean(documentId);
  }, [documentId, markClean]);

  return useMemo(() => {
    if (!schematicDoc || !schematic) return null;

    let activePage: SchematicPage;
    try {
      activePage = getActivePage(schematic);
    } catch {
      // Fallback if active page not found
      activePage = schematic.pages[0];
    }

    return {
      schematic,
      activePage,
      navigationInfo: getNavigationInfo(schematic),
      isDirty: schematicDoc.isDirty,

      addPage: addPageCallback,
      removePage: removePageCallback,
      updatePage: updatePageCallback,
      reorderPages: reorderPagesCallback,
      duplicatePage: duplicatePageCallback,

      setActivePage: setActivePageCallback,
      goToNextPage: goToNextPageCallback,
      goToPreviousPage: goToPreviousPageCallback,

      undo,
      redo,
      canUndo,
      canRedo,

      markSaved: markSavedCallback,
    };
  }, [
    schematicDoc,
    schematic,
    addPageCallback,
    removePageCallback,
    updatePageCallback,
    reorderPagesCallback,
    duplicatePageCallback,
    setActivePageCallback,
    goToNextPageCallback,
    goToPreviousPageCallback,
    undo,
    redo,
    canUndo,
    canRedo,
    markSavedCallback,
  ]);
}

export default useSchematicDocument;
