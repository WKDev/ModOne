/**
 * Scenario Execution Hook
 *
 * Manages scenario execution via Tauri backend with precise timing,
 * event scheduling, Modbus writes, and loop handling.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useScenarioStore, selectScenario, selectExecutionState } from '../../../stores/scenarioStore';
import type {
  BackendScenarioStatus,
  BackendScenarioState,
  EventExecutedPayload,
  LoopCompletedPayload,
  ExecutionErrorPayload,
} from '../../../types/scenario';
import { toBackendScenario } from '../../../types/scenario';

// ============================================================================
// Types
// ============================================================================

/**
 * Return type for useScenarioExecution hook.
 */
export interface UseScenarioExecutionReturn {
  /** Backend execution status */
  status: BackendScenarioStatus | null;
  /** Whether scenario is currently running */
  isRunning: boolean;
  /** Whether scenario is paused */
  isPaused: boolean;
  /** Whether scenario has completed */
  isCompleted: boolean;
  /** Whether scenario is idle */
  isIdle: boolean;
  /** Current error message (if any) */
  error: string | null;
  /** Start scenario execution */
  run: () => Promise<void>;
  /** Pause scenario execution */
  pause: () => Promise<void>;
  /** Resume from pause */
  resume: () => Promise<void>;
  /** Stop execution and reset time */
  stop: () => Promise<void>;
  /** Clear any error */
  clearError: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse backend state into a string state name
 */
function parseBackendState(state: BackendScenarioState): 'idle' | 'running' | 'paused' | 'completed' | 'error' {
  if (typeof state === 'string') {
    return state as 'idle' | 'running' | 'paused' | 'completed';
  }
  if (typeof state === 'object' && 'error' in state) {
    return 'error';
  }
  return 'idle';
}

/**
 * Extract error message from backend state
 */
function getErrorFromState(state: BackendScenarioState): string | null {
  if (typeof state === 'object' && 'error' in state) {
    return state.error;
  }
  return null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useScenarioExecution(): UseScenarioExecutionReturn {
  // Store access
  const scenario = useScenarioStore(selectScenario);
  const executionState = useScenarioStore(selectExecutionState);
  const setExecutionState = useScenarioStore((state) => state.setExecutionState);

  // Local state
  const [status, setStatus] = useState<BackendScenarioStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track mounted state
  const mountedRef = useRef(true);

  // ============================================================================
  // Event Listeners
  // ============================================================================

  useEffect(() => {
    mountedRef.current = true;
    const unlisteners: Promise<UnlistenFn>[] = [];

    // Listen for status changes
    unlisteners.push(
      listen<BackendScenarioStatus>('scenario:status-changed', (event) => {
        if (!mountedRef.current) return;
        setStatus(event.payload);

        // Sync with store
        const stateName = parseBackendState(event.payload.state);
        const storeStatus = stateName === 'completed' ? 'stopped' : stateName === 'error' ? 'stopped' : stateName;

        setExecutionState({
          status: storeStatus,
          currentTime: event.payload.elapsedTime,
          currentEventIndex: event.payload.executedEvents,
          currentLoopIteration: event.payload.currentLoop,
        });

        // Check for error in state
        const stateError = getErrorFromState(event.payload.state);
        if (stateError) {
          setError(stateError);
        }
      })
    );

    // Listen for event executed
    unlisteners.push(
      listen<EventExecutedPayload>('scenario:event-executed', (event) => {
        if (!mountedRef.current) return;

        // Update completed events in store
        setExecutionState({
          completedEvents: [...executionState.completedEvents, event.payload.eventId],
        });
      })
    );

    // Listen for scenario completion
    unlisteners.push(
      listen<BackendScenarioStatus>('scenario:completed', (event) => {
        if (!mountedRef.current) return;
        setStatus(event.payload);

        setExecutionState({
          status: 'stopped',
          currentTime: event.payload.elapsedTime,
        });
      })
    );

    // Listen for loop completed
    unlisteners.push(
      listen<LoopCompletedPayload>('scenario:loop-completed', (event) => {
        if (!mountedRef.current) return;

        // Reset completed events for new loop
        setExecutionState({
          completedEvents: [],
          currentLoopIteration: event.payload.loopNumber + 1,
        });
      })
    );

    // Listen for errors
    unlisteners.push(
      listen<ExecutionErrorPayload>('scenario:error', (event) => {
        if (!mountedRef.current) return;
        setError(event.payload.message);
      })
    );

    // Cleanup
    return () => {
      mountedRef.current = false;
      unlisteners.forEach((p) => p.then((fn) => fn()));
    };
  }, [setExecutionState, executionState.completedEvents]);

  // ============================================================================
  // Control Functions
  // ============================================================================

  const run = useCallback(async () => {
    if (!scenario) {
      setError('No scenario loaded');
      return;
    }

    setError(null);

    try {
      // Convert frontend scenario to backend format
      const backendScenario = toBackendScenario(scenario);

      // Reset store state
      setExecutionState({
        status: 'running',
        currentTime: 0,
        currentEventIndex: 0,
        completedEvents: [],
        currentLoopIteration: 1,
      });

      // Start execution on backend
      await invoke('scenario_run', { scenario: backendScenario });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setExecutionState({ status: 'stopped' });
    }
  }, [scenario, setExecutionState]);

  const pause = useCallback(async () => {
    try {
      await invoke('scenario_pause');
      setExecutionState({ status: 'paused' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, [setExecutionState]);

  const resume = useCallback(async () => {
    try {
      await invoke('scenario_resume');
      setExecutionState({ status: 'running' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, [setExecutionState]);

  const stop = useCallback(async () => {
    try {
      await invoke('scenario_stop');
      setExecutionState({
        status: 'stopped',
        currentTime: 0,
        currentEventIndex: 0,
        completedEvents: [],
        currentLoopIteration: 1,
      });
      setStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, [setExecutionState]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ============================================================================
  // Computed States
  // ============================================================================

  const stateName = status ? parseBackendState(status.state) : 'idle';
  const isRunning = stateName === 'running';
  const isPaused = stateName === 'paused';
  const isCompleted = stateName === 'completed';
  const isIdle = stateName === 'idle';

  // ============================================================================
  // Return
  // ============================================================================

  return {
    status,
    isRunning,
    isPaused,
    isCompleted,
    isIdle,
    error,
    run,
    pause,
    resume,
    stop,
    clearError,
  };
}

export default useScenarioExecution;
