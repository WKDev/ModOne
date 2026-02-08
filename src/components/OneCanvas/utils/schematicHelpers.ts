/**
 * Schematic Helpers - Document Registry Integration
 *
 * Pure function module that wraps multiPageSchematic.ts functions
 * with documentRegistry operations. NOT a Zustand store (AD-1).
 */

import { useDocumentRegistry } from '../../../stores/documentRegistry';
import {
  addPage,
  removePage,
  updatePage,
  updatePageCircuit,
  reorderPages,
  setActivePage,
  getActivePage,
  getPageById,
  getNavigationInfo,
  addPageReference,
  removePageReference,
  getPageReferences,
} from './multiPageSchematic';
import type { SchematicPage, MultiPageSchematic } from './multiPageSchematic';
import type { SerializableCircuitState } from '../types';

// ============================================================================
// Page Management
// ============================================================================

/** Add a new page to a schematic document */
export function addPageToDocument(documentId: string, name?: string, description?: string): void {
  useDocumentRegistry.getState().updateSchematicData(documentId, (data) => {
    data.schematic = addPage(data.schematic, name, description);
  });
}

/** Remove a page from a schematic document */
export function removePageFromDocument(documentId: string, pageId: string): void {
  useDocumentRegistry.getState().updateSchematicData(documentId, (data) => {
    data.schematic = removePage(data.schematic, pageId);
  });
}

/** Update page properties */
export function updatePageInDocument(
  documentId: string,
  pageId: string,
  updates: Partial<Pick<SchematicPage, 'name' | 'description' | 'pageSize' | 'orientation'>>
): void {
  useDocumentRegistry.getState().updateSchematicData(documentId, (data) => {
    data.schematic = updatePage(data.schematic, pageId, updates);
  });
}

/** Update a page's circuit data (used during page switching) */
export function updatePageCircuitInDocument(
  documentId: string,
  pageId: string,
  circuit: SerializableCircuitState
): void {
  useDocumentRegistry.getState().updateSchematicData(documentId, (data) => {
    data.schematic = updatePageCircuit(data.schematic, pageId, circuit);
  });
}

/** Reorder pages in a schematic document */
export function reorderPagesInDocument(documentId: string, fromIndex: number, toIndex: number): void {
  useDocumentRegistry.getState().updateSchematicData(documentId, (data) => {
    data.schematic = reorderPages(data.schematic, fromIndex, toIndex);
  });
}

/** Set the active page */
export function setActivePageInDocument(documentId: string, pageId: string): void {
  useDocumentRegistry.getState().updateSchematicData(documentId, (data) => {
    data.schematic = setActivePage(data.schematic, pageId);
  });
}

/** Duplicate a page */
export function duplicatePageInDocument(documentId: string, pageId: string): void {
  const schematic = useDocumentRegistry.getState().getSchematicData(documentId);
  if (!schematic) return;

  const sourcePage = getPageById(schematic, pageId);
  if (!sourcePage) return;

  useDocumentRegistry.getState().updateSchematicData(documentId, (data) => {
    data.schematic = addPage(data.schematic, `${sourcePage.name} (Copy)`);

    const newPage = data.schematic.pages[data.schematic.pages.length - 1];
    newPage.circuit = JSON.parse(JSON.stringify(sourcePage.circuit)) as SerializableCircuitState;
    newPage.pageSize = sourcePage.pageSize;
    newPage.orientation = sourcePage.orientation;
    newPage.description = sourcePage.description;
  });
}

// ============================================================================
// Cross-Page References
// ============================================================================

/** Add a cross-page reference */
export function addPageReferenceInDocument(
  documentId: string,
  sourcePageId: string,
  targetPageId: string,
  localId: string,
  remoteId: string
): void {
  useDocumentRegistry.getState().updateSchematicData(documentId, (data) => {
    data.schematic = addPageReference(data.schematic, sourcePageId, targetPageId, localId, remoteId);
  });
}

/** Remove a cross-page reference */
export function removePageReferenceInDocument(documentId: string, sourcePageId: string, localId: string): void {
  useDocumentRegistry.getState().updateSchematicData(documentId, (data) => {
    data.schematic = removePageReference(data.schematic, sourcePageId, localId);
  });
}

// ============================================================================
// Read-Only Accessors
// ============================================================================

/** Get schematic data from documentRegistry */
export function getSchematicFromDocument(documentId: string): MultiPageSchematic | null {
  return useDocumentRegistry.getState().getSchematicData(documentId);
}

/** Get the active page for a schematic document */
export function getActivePageFromDocument(documentId: string): SchematicPage | null {
  const schematic = getSchematicFromDocument(documentId);
  if (!schematic) return null;

  try {
    return getActivePage(schematic);
  } catch {
    return schematic.pages[0] ?? null;
  }
}

/** Get navigation info for a schematic document */
export function getNavigationInfoFromDocument(documentId: string) {
  const schematic = getSchematicFromDocument(documentId);
  if (!schematic) return null;
  return getNavigationInfo(schematic);
}

/** Get cross-references for a page */
export function getPageReferencesFromDocument(documentId: string, pageId: string) {
  const schematic = getSchematicFromDocument(documentId);
  if (!schematic) return { outgoing: [], incoming: [] };
  return getPageReferences(schematic, pageId);
}

/** Get all cross-references across all pages */
export function getAllCrossReferences(documentId: string) {
  const schematic = getSchematicFromDocument(documentId);
  if (!schematic) return [];

  const refs: Array<{
    fromPage: { id: string; number: number; name: string };
    toPage: { id: string; number: number; name: string };
    localId: string;
    remoteId: string;
    label: string;
  }> = [];

  for (const page of schematic.pages) {
    for (const ref of page.references) {
      if (ref.type === 'outgoing') {
        refs.push({
          fromPage: { id: page.id, number: page.number, name: page.name },
          toPage: { id: ref.pageId, number: ref.pageNumber, name: ref.pageName },
          localId: ref.localId,
          remoteId: ref.remoteId,
          label: ref.label,
        });
      }
    }
  }

  return refs;
}
