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
import { useLayoutPersistenceStore } from '../stores/layoutPersistenceStore';
import { canvasService } from '../services/canvasService';
import type { CircuitState, SerializableCircuitState } from '../components/OneCanvas/types';

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
  const getCanvasCircuitData = useDocumentRegistry((state) => state.getCanvasCircuitData);
  const markClean = useDocumentRegistry((state) => state.markClean);

  // Layout persistence for saving session before close
  const saveLastSession = useLayoutPersistenceStore((state) => state.saveLastSession);

  /**
   * Perform the actual window close.
   * Saves layout session first, then adds a grace period for pending IPC
   * responses to complete before destroying the WebView2 window.
   * This prevents HRESULT 0x8007139F (ERROR_INVALID_STATE) on Windows.
   */
  const performClose = useCallback(async () => {
    try {
      // Save layout session while WebView2 is still fully alive
      await saveLastSession();
    } catch (error) {
      console.error('Failed to save last session:', error);
    }

    try {
      // Grace period for any in-flight IPC responses to complete
      // Prevents WebView2 ERROR_INVALID_STATE (0x8007139F)
      await new Promise((resolve) => setTimeout(resolve, 150));

      const currentWindow = Window.getCurrent();
      await currentWindow.destroy();
    } catch (error) {
      console.error('Failed to close window:', error);
      // Fallback for non-Tauri environment
      window.close();
    }
  }, [saveLastSession]);

  /**
   * Save all dirty documents and close.
   */
  const handleSaveAll = useCallback(async () => {
    const dirtyDocs = getDirtyDocuments();

    for (const doc of dirtyDocs) {
      if (doc.type === 'canvas') {
        if (doc.filePath) {
          const circuitData = getCanvasCircuitData(doc.id);

          if (circuitData) {
            const serializableData: SerializableCircuitState = circuitData;
            const circuitState: CircuitState = {
              components: new Map(Object.entries(serializableData.components)),
              junctions: serializableData.junctions
                ? new Map(Object.entries(serializableData.junctions))
                : new Map(),
              wires: serializableData.wires,
              metadata: serializableData.metadata,
              viewport: serializableData.viewport,
            };

            try {
              await canvasService.saveCircuit(doc.filePath, circuitState);
              markClean(doc.id);
            } catch (error) {
              console.error(`Failed to save canvas document ${doc.id}:`, error);
            }
          }
        } else {
          // Save As flow is not implemented yet.
          markClean(doc.id);
        }
      } else {
        // Save logic for non-canvas document types is not implemented yet.
        markClean(doc.id);
      }
    }

    setIsDialogOpen(false);
    setPendingClose(false);
    await performClose();
  }, [getDirtyDocuments, getCanvasCircuitData, markClean, performClose]);

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

  // Set up Tauri window close event listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupCloseHandler = async () => {
      try {
        const currentWindow = Window.getCurrent();

        // Listen for close request
        unlisten = await currentWindow.onCloseRequested(async (event) => {
          // Always prevent default close to control the lifecycle ourselves.
          // This ensures saveLastSession() completes via IPC before WebView2
          // is destroyed, preventing HRESULT 0x8007139F on Windows.
          event.preventDefault();

          if (pendingClose) {
            // Already showing dialog, do nothing
            return;
          }

          if (hasUnsavedChanges()) {
            // Show unsaved changes dialog
            setIsDialogOpen(true);
            setPendingClose(true);
          } else {
            // No unsaved changes — save session and close gracefully
            await performClose();
          }
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
  }, [hasUnsavedChanges, pendingClose, performClose]);

  return {
    isDialogOpen,
    handleSaveAll,
    handleDontSave,
    handleCancel,
  };
}

export default useWindowClose;
