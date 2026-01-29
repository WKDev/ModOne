/**
 * useDebugger Hook
 *
 * React hook for managing debugger state including breakpoints and watch variables.
 * Provides Tauri command integration for debugger operations.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import type {
  Breakpoint,
  BreakpointType,
  WatchVariable,
  BreakpointHit,
  BreakpointHitPayload,
  DebuggerState,
} from '../../types/onesim';

// ============================================================================
// Types
// ============================================================================

/** Parameters for creating a new breakpoint */
export interface CreateBreakpointParams {
  /** Breakpoint type */
  breakpointType: BreakpointType;
  /** Network ID (for network breakpoints) */
  networkId?: number;
  /** Device address (for device breakpoints) */
  deviceAddress?: string;
  /** Condition expression (for condition breakpoints) */
  condition?: string;
  /** Target scan count (for scan count breakpoints) */
  scanCount?: number;
  /** Whether breakpoint is enabled (default: true) */
  enabled?: boolean;
}

/** Hook return type */
export interface UseDebuggerResult {
  // State
  /** All registered breakpoints */
  breakpoints: Breakpoint[];
  /** All watch variables */
  watches: WatchVariable[];
  /** Whether debugger is paused */
  isPaused: boolean;
  /** Current pause reason (if paused) */
  pauseReason: BreakpointHit | null;
  /** Whether loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;

  // Breakpoint management
  /** Add a new breakpoint */
  addBreakpoint: (params: CreateBreakpointParams) => Promise<string | null>;
  /** Remove a breakpoint by ID */
  removeBreakpoint: (id: string) => Promise<void>;
  /** Toggle breakpoint enabled state */
  toggleBreakpoint: (id: string) => Promise<void>;
  /** Clear all breakpoints */
  clearBreakpoints: () => Promise<void>;
  /** Refresh breakpoints from backend */
  refreshBreakpoints: () => Promise<void>;

  // Watch management
  /** Add a watch variable */
  addWatch: (address: string) => Promise<void>;
  /** Remove a watch variable */
  removeWatch: (address: string) => Promise<void>;
  /** Clear all watches */
  clearWatches: () => Promise<void>;
  /** Refresh watch values from backend */
  refreshWatches: () => Promise<void>;

  // Debugger state
  /** Get full debugger state */
  getDebuggerState: () => Promise<DebuggerState | null>;
  /** Continue execution after pause */
  continueExecution: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const BREAKPOINT_HIT_EVENT = 'sim:breakpoint-hit';

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing debugger breakpoints and watch variables
 */
export function useDebugger(): UseDebuggerResult {
  // State
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [watches, setWatches] = useState<WatchVariable[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<BreakpointHit | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const mountedRef = useRef(true);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // ============================================================================
  // Breakpoint Management
  // ============================================================================

  const addBreakpoint = useCallback(
    async (params: CreateBreakpointParams): Promise<string | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const breakpoint: Omit<Breakpoint, 'id' | 'hitCount'> = {
          breakpointType: params.breakpointType,
          enabled: params.enabled ?? true,
          networkId: params.networkId,
          deviceAddress: params.deviceAddress,
          condition: params.condition,
          scanCount: params.scanCount,
        };

        const id = await invoke<string>('sim_add_breakpoint', { breakpoint });

        // Add to local state
        if (mountedRef.current) {
          setBreakpoints((prev) => [
            ...prev,
            { ...breakpoint, id, hitCount: 0 } as Breakpoint,
          ]);
        }

        return id;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (mountedRef.current) {
          setError(message);
        }
        console.error('Failed to add breakpoint:', message);
        return null;
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  const removeBreakpoint = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await invoke('sim_remove_breakpoint', { id });

      if (mountedRef.current) {
        setBreakpoints((prev) => prev.filter((bp) => bp.id !== id));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (mountedRef.current) {
        setError(message);
      }
      console.error('Failed to remove breakpoint:', message);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const toggleBreakpoint = useCallback(async (id: string): Promise<void> => {
    // Toggle locally first for immediate feedback
    setBreakpoints((prev) =>
      prev.map((bp) => (bp.id === id ? { ...bp, enabled: !bp.enabled } : bp))
    );

    // Note: If backend support is added for toggling, add invoke here
  }, []);

  const clearBreakpoints = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Remove all breakpoints from backend
      const currentBreakpoints = [...breakpoints];
      for (const bp of currentBreakpoints) {
        await invoke('sim_remove_breakpoint', { id: bp.id });
      }

      if (mountedRef.current) {
        setBreakpoints([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (mountedRef.current) {
        setError(message);
      }
      console.error('Failed to clear breakpoints:', message);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [breakpoints]);

  const refreshBreakpoints = useCallback(async (): Promise<void> => {
    try {
      const result = await invoke<Breakpoint[]>('sim_get_breakpoints');
      if (mountedRef.current) {
        setBreakpoints(result);
      }
    } catch (err) {
      console.error('Failed to refresh breakpoints:', err);
    }
  }, []);

  // ============================================================================
  // Watch Management
  // ============================================================================

  const addWatch = useCallback(async (address: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await invoke('sim_add_watch', { address });

      // Refresh watches to get the current value
      const result = await invoke<WatchVariable[]>('sim_get_watches');
      if (mountedRef.current) {
        setWatches(result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (mountedRef.current) {
        setError(message);
      }
      console.error('Failed to add watch:', message);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const removeWatch = useCallback(async (address: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await invoke('sim_remove_watch', { address });

      if (mountedRef.current) {
        setWatches((prev) => prev.filter((w) => w.address !== address));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (mountedRef.current) {
        setError(message);
      }
      console.error('Failed to remove watch:', message);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const clearWatches = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const currentWatches = [...watches];
      for (const w of currentWatches) {
        await invoke('sim_remove_watch', { address: w.address });
      }

      if (mountedRef.current) {
        setWatches([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (mountedRef.current) {
        setError(message);
      }
      console.error('Failed to clear watches:', message);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [watches]);

  const refreshWatches = useCallback(async (): Promise<void> => {
    try {
      const result = await invoke<WatchVariable[]>('sim_get_watches');
      if (mountedRef.current) {
        setWatches(result);
      }
    } catch (err) {
      console.error('Failed to refresh watches:', err);
    }
  }, []);

  // ============================================================================
  // Debugger State
  // ============================================================================

  const getDebuggerState = useCallback(async (): Promise<DebuggerState | null> => {
    try {
      const result = await invoke<DebuggerState>('sim_get_debugger_state');
      return result;
    } catch (err) {
      console.error('Failed to get debugger state:', err);
      return null;
    }
  }, []);

  const continueExecution = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await invoke('sim_continue');

      if (mountedRef.current) {
        setIsPaused(false);
        setPauseReason(null);
      }

      // Refresh watches after continuing
      await refreshWatches();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (mountedRef.current) {
        setError(message);
      }
      console.error('Failed to continue execution:', message);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [refreshWatches]);

  // ============================================================================
  // Event Listeners
  // ============================================================================

  useEffect(() => {
    mountedRef.current = true;

    const setupListeners = async () => {
      // Listen for breakpoint hits
      unlistenRef.current = await listen<BreakpointHitPayload>(
        BREAKPOINT_HIT_EVENT,
        (event) => {
          if (mountedRef.current) {
            setIsPaused(true);
            setPauseReason(event.payload.hit);

            // Refresh watches when paused at breakpoint
            refreshWatches();
          }
        }
      );

      // Initial data load
      refreshBreakpoints();
      refreshWatches();
    };

    setupListeners();

    return () => {
      mountedRef.current = false;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [refreshBreakpoints, refreshWatches]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    breakpoints,
    watches,
    isPaused,
    pauseReason,
    isLoading,
    error,

    // Breakpoint management
    addBreakpoint,
    removeBreakpoint,
    toggleBreakpoint,
    clearBreakpoints,
    refreshBreakpoints,

    // Watch management
    addWatch,
    removeWatch,
    clearWatches,
    refreshWatches,

    // Debugger state
    getDebuggerState,
    continueExecution,
  };
}

export default useDebugger;
