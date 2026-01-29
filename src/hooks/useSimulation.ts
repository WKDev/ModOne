/**
 * useSimulation Hook
 *
 * React hook for controlling and monitoring PLC simulation.
 * Provides simulation lifecycle control, event subscriptions, and state management.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import type {
  SimStatus,
  SimStats,
  ScanTiming,
  BreakpointHit,
  SimStatusUpdatePayload,
  BreakpointHitPayload,
  ScanCompletePayload,
  StepType,
  StepResult,
} from '../types/onesim';

// ============================================================================
// Types
// ============================================================================

/** Device change event */
export interface DeviceChangeEvent {
  /** Device address */
  address: string;
  /** Old value */
  oldValue: unknown;
  /** New value */
  newValue: unknown;
}

/** Simulation configuration */
export interface SimulationConfig {
  /** Target scan interval in milliseconds */
  scanIntervalMs?: number;
  /** Watchdog timeout in milliseconds */
  watchdogMs?: number;
  /** Enable synchronization with modbus server */
  syncModbus?: boolean;
}

/** Hook return type */
export interface UseSimulationResult {
  // State
  /** Current simulation status */
  status: SimStatus;
  /** Simulation statistics */
  stats: SimStats;
  /** Whether simulation is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Current breakpoint hit (if paused at breakpoint) */
  breakpointHit: BreakpointHit | null;

  // Lifecycle control
  /** Start the simulation */
  start: (programId?: string, config?: SimulationConfig) => Promise<void>;
  /** Stop the simulation */
  stop: () => Promise<void>;
  /** Pause the simulation */
  pause: () => Promise<void>;
  /** Resume the simulation */
  resume: () => Promise<void>;
  /** Reset the simulation */
  reset: () => Promise<void>;

  // Step execution
  /** Step one network */
  stepNetwork: () => Promise<StepResult | null>;
  /** Step one scan cycle */
  stepScan: () => Promise<StepResult | null>;
  /** Continue after pause */
  continue: () => Promise<void>;

  // Status queries
  /** Refresh status from backend */
  refreshStatus: () => Promise<void>;

  // Convenience properties
  /** Whether simulation is running */
  isRunning: boolean;
  /** Whether simulation is paused */
  isPaused: boolean;
  /** Whether simulation is stopped */
  isStopped: boolean;
  /** Whether step execution is possible */
  canStep: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const SIM_STATUS_UPDATE_EVENT = 'sim:status-update';
const SIM_BREAKPOINT_HIT_EVENT = 'sim:breakpoint-hit';
const SIM_SCAN_COMPLETE_EVENT = 'sim:scan-complete';

const DEFAULT_TIMING: ScanTiming = {
  current: 0,
  average: 0,
  min: 0,
  max: 0,
};

const DEFAULT_STATS: SimStats = {
  scanCount: 0,
  currentNetworkId: null,
  timing: DEFAULT_TIMING,
  watchdogTriggered: false,
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for controlling and monitoring PLC simulation
 */
export function useSimulation(): UseSimulationResult {
  // State
  const [status, setStatus] = useState<SimStatus>('stopped');
  const [stats, setStats] = useState<SimStats>(DEFAULT_STATS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breakpointHit, setBreakpointHit] = useState<BreakpointHit | null>(null);

  // Refs for cleanup
  const mountedRef = useRef(true);
  const unlistenStatusRef = useRef<UnlistenFn | null>(null);
  const unlistenBreakpointRef = useRef<UnlistenFn | null>(null);
  const unlistenScanRef = useRef<UnlistenFn | null>(null);
  const unlistenDeviceRef = useRef<UnlistenFn | null>(null);

  // Derived state
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isStopped = status === 'stopped';
  const canStep = isPaused || isStopped;

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleStatusUpdate = useCallback((payload: SimStatusUpdatePayload) => {
    if (!mountedRef.current) return;
    setStatus(payload.status);
    setStats(payload.stats);

    // Clear breakpoint hit if running
    if (payload.status === 'running') {
      setBreakpointHit(null);
    }
  }, []);

  const handleBreakpointHit = useCallback((payload: BreakpointHitPayload) => {
    if (!mountedRef.current) return;
    setBreakpointHit(payload.hit);
    setStatus('paused');
  }, []);

  // ============================================================================
  // Lifecycle Control
  // ============================================================================

  const start = useCallback(
    async (programId?: string, config?: SimulationConfig): Promise<void> => {
      setIsLoading(true);
      setError(null);
      setBreakpointHit(null);

      try {
        await invoke('sim_run', {
          params: {
            programId: programId ?? null,
            config: config ?? null,
          },
        });
        setStatus('running');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setStatus('error');
        console.error('Failed to start simulation:', message);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const stop = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await invoke('sim_stop');
      setStatus('stopped');
      setStats(DEFAULT_STATS);
      setBreakpointHit(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('Failed to stop simulation:', message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const pause = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await invoke('sim_pause');
      setStatus('paused');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('Failed to pause simulation:', message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resume = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setBreakpointHit(null);

    try {
      await invoke('sim_resume');
      setStatus('running');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('Failed to resume simulation:', message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await invoke('sim_reset');
      setStatus('stopped');
      setStats(DEFAULT_STATS);
      setBreakpointHit(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('Failed to reset simulation:', message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================================
  // Step Execution
  // ============================================================================

  const stepNetwork = useCallback(async (): Promise<StepResult | null> => {
    if (!canStep) return null;

    setIsLoading(true);
    setError(null);
    setBreakpointHit(null);

    try {
      const stepType: StepType = 'network';
      const result = await invoke<StepResult>('sim_step', { stepType });

      // Update local state based on result
      if (result.breakpointHit) {
        setBreakpointHit(result.breakpointHit);
        setStatus('paused');
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('Failed to step network:', message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [canStep]);

  const stepScan = useCallback(async (): Promise<StepResult | null> => {
    if (!canStep) return null;

    setIsLoading(true);
    setError(null);
    setBreakpointHit(null);

    try {
      const stepType: StepType = 'scan';
      const result = await invoke<StepResult>('sim_step', { stepType });

      // Update local state based on result
      if (result.breakpointHit) {
        setBreakpointHit(result.breakpointHit);
        setStatus('paused');
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('Failed to step scan:', message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [canStep]);

  const continueExecution = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setBreakpointHit(null);

    try {
      await invoke('sim_continue');
      setStatus('running');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('Failed to continue execution:', message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================================
  // Status Queries
  // ============================================================================

  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      const response = await invoke<{
        state: SimStatus;
        scan_count: number;
        last_scan_time_us: number;
        avg_scan_time_us: number;
        max_scan_time_us: number;
        min_scan_time_us: number;
      }>('sim_get_status');

      if (mountedRef.current) {
        setStatus(response.state);
        setStats({
          scanCount: response.scan_count,
          currentNetworkId: null,
          timing: {
            current: response.last_scan_time_us / 1000,
            average: response.avg_scan_time_us / 1000,
            min: response.min_scan_time_us / 1000,
            max: response.max_scan_time_us / 1000,
          },
          watchdogTriggered: false,
        });
      }
    } catch (err) {
      console.error('Failed to refresh status:', err);
    }
  }, []);

  // ============================================================================
  // Event Listener Setup
  // ============================================================================

  useEffect(() => {
    mountedRef.current = true;

    const setupListeners = async () => {
      // Status update listener
      unlistenStatusRef.current = await listen<SimStatusUpdatePayload>(
        SIM_STATUS_UPDATE_EVENT,
        (event) => handleStatusUpdate(event.payload)
      );

      // Breakpoint hit listener
      unlistenBreakpointRef.current = await listen<BreakpointHitPayload>(
        SIM_BREAKPOINT_HIT_EVENT,
        (event) => handleBreakpointHit(event.payload)
      );

      // Scan complete listener (for scan-by-scan updates)
      unlistenScanRef.current = await listen<ScanCompletePayload>(
        SIM_SCAN_COMPLETE_EVENT,
        (event) => {
          if (mountedRef.current) {
            setStats((prev) => ({
              ...prev,
              scanCount: event.payload.scanCount,
              timing: {
                ...prev.timing,
                current: event.payload.duration,
              },
            }));
          }
        }
      );

      // Initial status refresh
      refreshStatus();
    };

    setupListeners();

    return () => {
      mountedRef.current = false;

      // Cleanup listeners
      if (unlistenStatusRef.current) {
        unlistenStatusRef.current();
        unlistenStatusRef.current = null;
      }
      if (unlistenBreakpointRef.current) {
        unlistenBreakpointRef.current();
        unlistenBreakpointRef.current = null;
      }
      if (unlistenScanRef.current) {
        unlistenScanRef.current();
        unlistenScanRef.current = null;
      }
      if (unlistenDeviceRef.current) {
        unlistenDeviceRef.current();
        unlistenDeviceRef.current = null;
      }
    };
  }, [handleStatusUpdate, handleBreakpointHit, refreshStatus]);

  // ============================================================================
  // Return Hook Interface
  // ============================================================================

  return {
    // State
    status,
    stats,
    isLoading,
    error,
    breakpointHit,

    // Lifecycle control
    start,
    stop,
    pause,
    resume,
    reset,

    // Step execution
    stepNetwork,
    stepScan,
    continue: continueExecution,

    // Status queries
    refreshStatus,

    // Convenience properties
    isRunning,
    isPaused,
    isStopped,
    canStep,
  };
}

export default useSimulation;
