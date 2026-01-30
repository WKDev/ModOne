/**
 * useWindowClose Hook
 *
 * Handles window close with unsaved changes detection.
 * Intercepts the window close request and shows a confirmation dialog
 * if there are any dirty documents.
 */

import { useEffect, useState, useCallback } from 'react';
import { Window } from '@tauri-apps/api/window';
import { useDocumentRegistry } from '../stores/documentRegistry';

// ============================================================================
// Types
// ============================================================================

export interface UseWindowCloseResult {
  /** Whether the unsaved changes dialog is open */
  isDialogOpen: boolean;
  /** Save all dirty documents and close */
  handleSaveAll: () => Promise<void>;
  /** Close without saving */
  handleDontSave: () => void;
  /** Cancel the close operation */
  handleCancel: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useWindowClose(): UseWindowCloseResult {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);

  // Document registry state & actions
  const hasUnsavedChanges = useDocumentRegistry((state) => state.hasUnsavedChanges);
  const getDirtyDocuments = useDocumentRegistry((state) => state.getDirtyDocuments);
  const markClean = useDocumentRegistry((state) => state.markClean);

  /**
   * Perform the actual window close.
   */
  const performClose = useCallback(async () => {
    try {
      const currentWindow = Window.getCurrent();
      await currentWindow.destroy();
    } catch (error) {
      console.error('Failed to close window:', error);
      // Fallback for non-Tauri environment
      window.close();
    }
  }, []);

  /**
   * Save all dirty documents and close.
   */
  const handleSaveAll = useCallback(async () => {
    const dirtyDocs = getDirtyDocuments();

    // TODO: Implement actual save logic when file save service is ready
    // For now, just mark all as clean and close
    for (const doc of dirtyDocs) {
      markClean(doc.id);
    }

    setIsDialogOpen(false);
    setPendingClose(false);
    await performClose();
  }, [getDirtyDocuments, markClean, performClose]);

  /**
   * Close without saving.
   */
  const handleDontSave = useCallback(async () => {
    setIsDialogOpen(false);
    setPendingClose(false);
    await performClose();
  }, [performClose]);

  /**
   * Cancel the close operation.
   */
  const handleCancel = useCallback(() => {
    setIsDialogOpen(false);
    setPendingClose(false);
  }, []);

  /**
   * Handle the close request - check for dirty documents first.
   */
  const handleCloseRequest = useCallback(() => {
    if (hasUnsavedChanges()) {
      // Show dialog
      setIsDialogOpen(true);
      setPendingClose(true);
      return false; // Prevent close
    }
    return true; // Allow close
  }, [hasUnsavedChanges]);

  // Set up Tauri window close event listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupCloseHandler = async () => {
      try {
        const currentWindow = Window.getCurrent();

        // Listen for close request
        unlisten = await currentWindow.onCloseRequested(async (event) => {
          if (pendingClose) {
            // Already showing dialog, prevent close
            event.preventDefault();
            return;
          }

          if (hasUnsavedChanges()) {
            // Prevent close and show dialog
            event.preventDefault();
            setIsDialogOpen(true);
            setPendingClose(true);
          }
          // Otherwise, allow normal close
        });
      } catch (error) {
        // Not in Tauri environment, use browser's beforeunload
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
          if (hasUnsavedChanges()) {
            e.preventDefault();
            // Modern browsers ignore custom messages
            e.returnValue = '';
            return '';
          }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        unlisten = () => window.removeEventListener('beforeunload', handleBeforeUnload);
      }
    };

    setupCloseHandler();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [hasUnsavedChanges, pendingClose, handleCloseRequest]);

  return {
    isDialogOpen,
    handleSaveAll,
    handleDontSave,
    handleCancel,
  };
}

export default useWindowClose;
