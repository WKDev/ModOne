/**
 * useAsyncOperation Hook
 *
 * React hook for managing async operations with proper error state handling.
 * Provides a reusable pattern to replace bare try/catch blocks that silently swallow errors.
 * Handles component unmounting during async operations and provides callbacks for success/error.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * State of an async operation
 */
export interface AsyncOperationState<T = void> {
  /** Whether the operation is currently running */
  isLoading: boolean;
  /** Error from the last operation, null if successful */
  error: string | null;
  /** Result from the last successful operation */
  data: T | null;
}

/**
 * Result returned by useAsyncOperation hook
 */
export interface UseAsyncOperationResult<T = void> extends AsyncOperationState<T> {
  /** Execute the async operation */
  execute: (...args: unknown[]) => Promise<T | undefined>;
  /** Clear the error state */
  clearError: () => void;
  /** Reset all state to initial values */
  reset: () => void;
}

/**
 * Configuration options for useAsyncOperation
 */
export interface UseAsyncOperationOptions {
  /** Called when operation succeeds */
  onSuccess?: (data: unknown) => void;
  /** Called when operation fails */
  onError?: (error: Error) => void;
  /** If true, don't set loading state (for background operations) */
  silent?: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing async operations with proper error handling
 *
 * @template T - The type of data returned by the async operation
 * @param operation - The async function to execute
 * @param options - Configuration options for the hook
 * @returns Hook interface with state and control methods
 *
 * @example
 * ```typescript
 * const { execute, isLoading, error, data } = useAsyncOperation(
 *   async (id: string) => {
 *     const response = await fetch(`/api/users/${id}`);
 *     return response.json();
 *   },
 *   { onSuccess: (data) => console.log('User loaded:', data) }
 * );
 *
 * // In event handler:
 * await execute(userId);
 * ```
 */
export function useAsyncOperation<T = void>(
  operation: (...args: unknown[]) => Promise<T>,
  options?: UseAsyncOperationOptions
): UseAsyncOperationResult<T> {
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  // Refs for cleanup and avoiding stale closures
  const mountedRef = useRef(true);
  const operationRef = useRef(operation);

  // Update operation ref to avoid stale closures
  operationRef.current = operation;

  // Track mounted state for safe state updates after async operations
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ============================================================================
  // Handlers
  // ============================================================================

  const clearError = useCallback(() => {
    if (mountedRef.current) {
      setError(null);
    }
  }, []);

  const reset = useCallback(() => {
    if (mountedRef.current) {
      setIsLoading(false);
      setError(null);
      setData(null);
    }
  }, []);

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | undefined> => {
      // Only set loading if not silent mode
      if (!options?.silent && mountedRef.current) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await operationRef.current(...args);

        // Only update state if component is still mounted
        if (mountedRef.current) {
          setData(result);
          setIsLoading(false);

          // Call success callback if provided
          if (options?.onSuccess) {
            options.onSuccess(result);
          }
        }

        return result;
      } catch (err) {
        // Only update state if component is still mounted
        if (mountedRef.current) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          setIsLoading(false);

          // Call error callback if provided
          if (options?.onError) {
            const error = err instanceof Error ? err : new Error(String(err));
            options.onError(error);
          }

          // Log error for debugging
          console.error('Async operation failed:', message);
        }

        return undefined;
      }
    },
    [options]
  );

  // ============================================================================
  // Return Hook Interface
  // ============================================================================

  return {
    isLoading,
    error,
    data,
    execute,
    clearError,
    reset,
  };
}

export default useAsyncOperation;
