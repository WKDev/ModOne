/**
 * useScopeData Hook
 *
 * Polls the Rust backend for scope display data at 20 FPS (50ms interval)
 * when simulation is running.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ScopeDisplayData } from '../../../types/onesim';

// ============================================================================
// Types
// ============================================================================

/**
 * Return type of useScopeData hook.
 */
export interface UseScopeDataReturn {
  /** Current display data (null if not available) */
  displayData: ScopeDisplayData | null;
  /** Whether data is being fetched */
  isLoading: boolean;
  /** Last error message (if any) */
  error: string | null;
  /** Clear any error */
  clearError: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Polling interval in milliseconds (20 FPS) */
const POLL_INTERVAL_MS = 50;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for polling scope display data from the Rust backend.
 *
 * @param scopeId - Unique identifier for the scope block
 * @param isSimulating - Whether simulation is currently running
 * @returns Scope data and status
 */
export function useScopeData(
  scopeId: string,
  isSimulating: boolean
): UseScopeDataReturn {
  const [displayData, setDisplayData] = useState<ScopeDisplayData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track mounted state to prevent updates after unmount
  const mountedRef = useRef(true);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // If not simulating, clear data and return
    if (!isSimulating) {
      setDisplayData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Polling function
    const fetchData = async () => {
      if (!mountedRef.current) return;

      try {
        const data = await invoke<ScopeDisplayData>('scope_get_data', {
          scopeId,
        });

        if (mountedRef.current) {
          setDisplayData(data);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        if (mountedRef.current) {
          const message = err instanceof Error ? err.message : String(err);
          // Only log error if scope exists but failed to get data
          // (Scope may not be created yet, which is normal during startup)
          if (!message.includes('not found')) {
            console.error('Failed to get scope data:', message);
            setError(message);
          }
          setIsLoading(false);
        }
      }
    };

    // Initial fetch
    fetchData();

    // Set up polling interval
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);

    // Cleanup
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [scopeId, isSimulating]);

  return {
    displayData,
    isLoading,
    error,
    clearError,
  };
}

export default useScopeData;
