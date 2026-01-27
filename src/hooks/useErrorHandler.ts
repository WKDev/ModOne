/**
 * useErrorHandler Hook
 *
 * Manages error state and provides a central error handling system.
 * Listens for Tauri error events and displays errors via ErrorDialog.
 */

import { useState, useCallback, useEffect } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ModOneError } from '../types/error';
import { parseError, isModOneError } from '../types/error';

// Event name for error events from backend
const ERROR_EVENT = 'modone-error';

/** Payload of error events from backend */
interface ErrorEventPayload {
  error: ModOneError;
  command?: string;
  timestamp?: string;
}

/** Return type of useErrorHandler hook */
interface UseErrorHandlerResult {
  /** Current error, or null if no error */
  currentError: ModOneError | null;
  /** Show an error in the dialog */
  showError: (error: unknown) => void;
  /** Clear the current error */
  clearError: () => void;
  /** Retry callback if set */
  retryCallback: (() => void) | null;
  /** Set a retry callback for the current operation */
  setRetryCallback: (callback: (() => void) | null) => void;
}

/**
 * Hook for centralized error handling
 *
 * Provides state management for errors and listens to Tauri error events.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { currentError, showError, clearError, setRetryCallback } = useErrorHandler();
 *
 *   const handleSave = async () => {
 *     setRetryCallback(() => handleSave);
 *     try {
 *       await saveProject();
 *     } catch (error) {
 *       showError(error);
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <ErrorDialog
 *         error={currentError}
 *         onClose={clearError}
 *         onRetry={retryCallback ?? undefined}
 *       />
 *       <button onClick={handleSave}>Save</button>
 *     </>
 *   );
 * }
 * ```
 */
export function useErrorHandler(): UseErrorHandlerResult {
  const [currentError, setCurrentError] = useState<ModOneError | null>(null);
  const [retryCallback, setRetryCallbackState] = useState<(() => void) | null>(
    null
  );

  /**
   * Show an error in the dialog
   */
  const showError = useCallback((error: unknown): void => {
    const parsedError = parseError(error);
    setCurrentError(parsedError);
    console.error('Error:', parsedError);
  }, []);

  /**
   * Clear the current error
   */
  const clearError = useCallback((): void => {
    setCurrentError(null);
    setRetryCallbackState(null);
  }, []);

  /**
   * Set a retry callback for the current operation
   */
  const setRetryCallback = useCallback(
    (callback: (() => void) | null): void => {
      setRetryCallbackState(() => callback);
    },
    []
  );

  // Listen for error events from the Tauri backend
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      try {
        unlisten = await listen<ErrorEventPayload>(ERROR_EVENT, (event) => {
          const payload = event.payload;

          if (payload && isModOneError(payload.error)) {
            setCurrentError(payload.error);
            console.error('Received error event:', payload);
          }
        });
      } catch (error) {
        console.error('Failed to setup error event listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  return {
    currentError,
    showError,
    clearError,
    retryCallback,
    setRetryCallback,
  };
}

export default useErrorHandler;
