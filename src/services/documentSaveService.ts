/**
 * Document Save Service
 *
 * Handles persisting individual documents (canvas, schematic, etc.) to disk.
 * Routes to the appropriate service based on document type, then marks the
 * document clean in the registry.
 *
 * This is the missing link between the in-memory DocumentRegistry and the
 * Tauri backend file I/O commands.
 */

import { useDocumentRegistry } from '../stores/documentRegistry';
import { usePanelStore } from '../stores/panelStore';
import { projectDialogService } from './projectDialogService';
import { canvasService } from './canvasService';
import { schematicService } from './schematicService';
import { isCanvasDocument, isSchematicDocument } from '../types/document';
import { serializableToCircuitState } from '../components/OneCanvas/types';
import type { DocumentState } from '../types/document';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the documentId of the currently active tab across all panels.
 * Looks at the activePanel → activeTabId → tab.data.documentId chain.
 */
function getActiveDocumentId(): string | null {
    const { panels, activePanel } = usePanelStore.getState();

    // Prefer the focused (active) panel
    const targetPanel = activePanel
        ? panels.find((p) => p.id === activePanel)
        : null;

    // Walk all panels in priority order (active first)
    const ordered = targetPanel
        ? [targetPanel, ...panels.filter((p) => p.id !== activePanel)]
        : panels;

    for (const panel of ordered) {
        const activeTabId = panel.activeTabId;
        if (!activeTabId || !panel.tabs) continue;

        const activeTab = panel.tabs.find((t) => t.id === activeTabId);
        const docId = activeTab?.data?.documentId;
        if (docId && typeof docId === 'string') {
            return docId;
        }
    }

    return null;
}

// ============================================================================
// Core save logic
// ============================================================================

/**
 * Persist a single document to disk, then mark it clean.
 * If the document has no filePath, delegate to Save As dialog.
 *
 * @returns true if saved successfully, false if Save As was requested
 */
export async function saveDocument(doc: DocumentState): Promise<boolean> {
    const { markClean } = useDocumentRegistry.getState();

    if (!doc.filePath) {
        // No path yet → delegate to Save As
        projectDialogService.requestSaveAs();
        return false;
    }

    if (isCanvasDocument(doc)) {
        const { getCanvasCircuitData } = useDocumentRegistry.getState();
        const circuitData = getCanvasCircuitData(doc.id);
        if (!circuitData) {
            console.warn(`[documentSaveService] No canvas data for document ${doc.id}`);
            return false;
        }

        // Convert SerializableCircuitState → CircuitState using the shared helper
        const circuitState = serializableToCircuitState(circuitData);

        await canvasService.saveCircuit(doc.filePath, circuitState);
        markClean(doc.id);
        return true;
    }

    if (isSchematicDocument(doc)) {
        const { getSchematicData } = useDocumentRegistry.getState();
        const schematicData = getSchematicData(doc.id);
        if (!schematicData) {
            console.warn(`[documentSaveService] No schematic data for document ${doc.id}`);
            return false;
        }

        await schematicService.saveSchematic(doc.filePath, schematicData);
        markClean(doc.id);
        return true;
    }

    console.warn(
        `[documentSaveService] Unsupported document type "${doc.type}" for document ${doc.id}`
    );
    return false;
}

/**
 * Save a document by its ID.
 */
export async function saveDocumentById(documentId: string): Promise<boolean> {
    const doc = useDocumentRegistry.getState().documents.get(documentId);
    if (!doc) {
        console.warn(`[documentSaveService] Document not found: ${documentId}`);
        return false;
    }
    return saveDocument(doc);
}

/**
 * Save the document in the currently active tab.
 * If no active document is found, delegates to Save As.
 */
export async function saveActiveDocument(): Promise<boolean> {
    const activeDocId = getActiveDocumentId();

    if (!activeDocId) {
        // No document context — treat as Save As
        projectDialogService.requestSaveAs();
        return false;
    }

    return saveDocumentById(activeDocId);
}

/**
 * Save all dirty documents.
 *
 * @returns number of documents actually saved
 */
export async function saveAllDocuments(): Promise<number> {
    const { getDirtyDocuments } = useDocumentRegistry.getState();
    const dirtyDocs = getDirtyDocuments();

    let savedCount = 0;
    for (const doc of dirtyDocs) {
        const ok = await saveDocument(doc);
        if (ok) savedCount++;
    }

    return savedCount;
}
