/**
 * useTabClose Hook
 *
 * Handles safe tab closing with unsaved changes detection.
 * Shows a confirmation dialog when closing tabs with dirty documents.
 */

import { useState, useCallback } from 'react';
import { usePanelStore } from '../stores/panelStore';
import { useDocumentRegistry } from '../stores/documentRegistry';
import type { TabState } from '../types/tab';

// ============================================================================
// Types
// ============================================================================

export interface PendingTabClose {
  /** Panel ID */
  panelId: string;
  /** Tab being closed */
  tab: TabState;
  /** Document ID if tab has a document */
  documentId: string | null;
}

export interface UseTabCloseResult {
  /** Pending tab close operation (null if no dialog open) */
  pendingClose: PendingTabClose | null;
  /** Whether the unsaved changes dialog is open */
  isDialogOpen: boolean;
  /** Request to close a tab (may show dialog if dirty) */
  requestClose: (panelId: string, tab: TabState) => void;
  /** Request to close a tab by ID (looks up tab from panel store) */
  requestCloseById: (panelId: string, tabId: string) => void;
  /** Save and close the pending tab */
  handleSave: () => Promise<void>;
  /** Close without saving */
  handleDontSave: () => void;
  /** Cancel the close operation */
  handleCancel: () => void;
  /** Force close a tab without checking dirty state */
  forceClose: (panelId: string, tabId: string) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useTabClose(): UseTabCloseResult {
  const [pendingClose, setPendingClose] = useState<PendingTabClose | null>(null);

  // Panel store state & actions
  const panels = usePanelStore((state) => state.panels);
  const removeTab = usePanelStore((state) => state.removeTab);

  // Document registry state & actions
  const getDocument = useDocumentRegistry((state) => state.getDocument);
  const closeDocument = useDocumentRegistry((state) => state.closeDocument);
  const markClean = useDocumentRegistry((state) => state.markClean);

  /**
   * Find a tab by ID in a specific panel.
   */
  const findTab = useCallback(
    (panelId: string, tabId: string): TabState | undefined => {
      const panel = panels.find((p) => p.id === panelId);
      return panel?.tabs?.find((t) => t.id === tabId);
    },
    [panels]
  );

  /**
   * Request to close a tab.
   * If the tab has a dirty document, shows the unsaved changes dialog.
   * Otherwise, closes the tab immediately.
   */
  const requestClose = useCallback(
    (panelId: string, tab: TabState) => {
      const documentId = tab.data?.documentId as string | undefined;

      // Check if document is dirty
      if (documentId) {
        const doc = getDocument(documentId);
        if (doc?.isDirty) {
          // Show dialog
          setPendingClose({
            panelId,
            tab,
            documentId,
          });
          return;
        }
      }

      // Not dirty or no document - close immediately
      removeTab(panelId, tab.id);

      // Clean up document if exists
      if (documentId) {
        closeDocument(documentId);
      }
    },
    [getDocument, removeTab, closeDocument]
  );

  /**
   * Request to close a tab by ID.
   * Looks up the tab from panel store first.
   */
  const requestCloseById = useCallback(
    (panelId: string, tabId: string) => {
      const tab = findTab(panelId, tabId);
      if (tab) {
        requestClose(panelId, tab);
      }
    },
    [findTab, requestClose]
  );

  /**
   * Force close a tab without checking dirty state.
   */
  const forceClose = useCallback(
    (panelId: string, tabId: string) => {
      removeTab(panelId, tabId);
    },
    [removeTab]
  );

  /**
   * Save and close the pending tab.
   */
  const handleSave = useCallback(async () => {
    if (!pendingClose) return;

    const { panelId, tab, documentId } = pendingClose;

    if (documentId) {
      // TODO: Implement actual save logic when file save service is ready
      // For now, just mark as clean and close
      markClean(documentId);
      closeDocument(documentId);
    }

    removeTab(panelId, tab.id);
    setPendingClose(null);
  }, [pendingClose, removeTab, closeDocument, markClean]);

  /**
   * Close without saving.
   */
  const handleDontSave = useCallback(() => {
    if (!pendingClose) return;

    const { panelId, tab, documentId } = pendingClose;

    // Close document without saving
    if (documentId) {
      closeDocument(documentId);
    }

    removeTab(panelId, tab.id);
    setPendingClose(null);
  }, [pendingClose, removeTab, closeDocument]);

  /**
   * Cancel the close operation.
   */
  const handleCancel = useCallback(() => {
    setPendingClose(null);
  }, []);

  return {
    pendingClose,
    isDialogOpen: pendingClose !== null,
    requestClose,
    requestCloseById,
    handleSave,
    handleDontSave,
    handleCancel,
    forceClose,
  };
}

export default useTabClose;
