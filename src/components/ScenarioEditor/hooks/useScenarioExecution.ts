/**
 * Scenario Execution Hook
 *
 * Manages scenario execution with precise timing using requestAnimationFrame,
 * event scheduling, Modbus writes, and loop handling.
 */

import { useRef, useCallback, useEffect } from 'react';
import { useScenarioStore, selectEnabledEvents, selectSettings, selectExecutionState } from '../../../stores/scenarioStore';
import { modbusService } from '../../../services/modbusService';
import { parseAddress } from '../utils/addressParser';
import type { ScenarioEvent, ScenarioStatus } from '../../../types/scenario';

// ============================================================================
// Types
// ============================================================================

/**
 * Event emitted when a scenario event executes.
 */
export interface ScenarioEventExecuted {
  type: 'scenario:event-executed';
  eventId: string;
  address: string;
  value: number;
  time: number;
}

/**
 * Event emitted when status changes.
 */
export interface ScenarioStatusChanged {
  type: 'scenario:status-changed';
  status: ScenarioStatus;
  currentTime: number;
  iteration: number;
}

/**
 * Union type for all scenario events.
 */
export type ScenarioEmittedEvent = ScenarioEventExecuted | ScenarioStatusChanged;

/**
 * Callback for scenario event subscription.
 */
export type ScenarioEventCallback = (event: ScenarioEmittedEvent) => void;

/**
 * Return type for useScenarioExecution hook.
 */
export interface UseScenarioExecutionReturn {
  /** Start scenario execution */
  run: () => void;
  /** Pause scenario execution */
  pause: () => void;
  /** Resume from pause */
  resume: () => void;
  /** Stop execution and reset time */
  stop: () => void;
  /** Reset execution state */
  reset: () => void;
  /** Subscribe to execution events */
  subscribe: (callback: ScenarioEventCallback) => () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Minimum time between UI updates (ms) */
const UI_UPDATE_THROTTLE = 50; // ~20fps

// ============================================================================
// Hook Implementation
// ============================================================================

export function useScenarioExecution(): UseScenarioExecutionReturn {
  // Store access
  const events = useScenarioStore(selectEnabledEvents);
  const settings = useScenarioStore(selectSettings);
  const executionState = useScenarioStore(selectExecutionState);
  const setExecutionState = useScenarioStore((state) => state.setExecutionState);
  const resetExecution = useScenarioStore((state) => state.resetExecution);

  // Timing refs
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const lastUIUpdateRef = useRef<number>(0);

  // Execution state refs
  const executedEventsRef = useRef<Set<string>>(new Set());
  const iterationRef = useRef<number>(1);
  const isRunningRef = useRef<boolean>(false);

  // Auto-release scheduling refs
  const scheduledReleasesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Event subscribers
  const subscribersRef = useRef<Set<ScenarioEventCallback>>(new Set());

  // ============================================================================
  // Event Emission
  // ============================================================================

  const emit = useCallback((event: ScenarioEmittedEvent) => {
    subscribersRef.current.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in scenario event callback:', error);
      }
    });
  }, []);

  const subscribe = useCallback((callback: ScenarioEventCallback): (() => void) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  // ============================================================================
  // Modbus Write Execution
  // ============================================================================

  const executeModbusWrite = useCallback(async (address: string, value: number) => {
    const parsed = parseAddress(address);
    if (!parsed) {
      console.error(`Invalid Modbus address: ${address}`);
      return;
    }

    try {
      switch (parsed.type) {
        case 'coil':
          await modbusService.writeCoil(parsed.address, value !== 0);
          break;
        case 'discrete':
          await modbusService.writeDiscreteInput(parsed.address, value !== 0);
          break;
        case 'holding':
          await modbusService.writeHoldingRegister(parsed.address, value);
          break;
        case 'input':
          await modbusService.writeInputRegister(parsed.address, value);
          break;
      }
    } catch (error) {
      console.error(`Failed to write Modbus ${address}:`, error);
    }
  }, []);

  // ============================================================================
  // Event Execution
  // ============================================================================

  const executeEvent = useCallback(async (event: ScenarioEvent, currentTime: number) => {
    // Execute Modbus write
    await executeModbusWrite(event.address, event.value);

    // Mark as executed
    executedEventsRef.current.add(event.id);

    // Emit event
    emit({
      type: 'scenario:event-executed',
      eventId: event.id,
      address: event.address,
      value: event.value,
      time: currentTime,
    });

    // Schedule auto-release if persist=false
    if (!event.persist && event.persistDuration && event.persistDuration > 0) {
      // Cancel any existing release for this address
      const existingRelease = scheduledReleasesRef.current.get(event.id);
      if (existingRelease) {
        clearTimeout(existingRelease);
      }

      const releaseTimeout = setTimeout(async () => {
        // Release value (write 0)
        await executeModbusWrite(event.address, 0);
        scheduledReleasesRef.current.delete(event.id);
      }, event.persistDuration);

      scheduledReleasesRef.current.set(event.id, releaseTimeout);
    }
  }, [executeModbusWrite, emit]);

  // ============================================================================
  // Clear Scheduled Releases
  // ============================================================================

  const clearScheduledReleases = useCallback(() => {
    scheduledReleasesRef.current.forEach((timeout) => {
      clearTimeout(timeout);
    });
    scheduledReleasesRef.current.clear();
  }, []);

  // ============================================================================
  // Tick Function
  // ============================================================================

  const tick = useCallback(() => {
    if (!isRunningRef.current) return;

    const now = performance.now();
    const elapsed = (now - startTimeRef.current) / 1000 + pausedTimeRef.current;

    // Find pending events to execute
    const pendingEvents = events.filter(
      (event) =>
        event.time <= elapsed &&
        !executedEventsRef.current.has(event.id)
    );

    // Sort by time and execute
    pendingEvents.sort((a, b) => a.time - b.time);
    pendingEvents.forEach((event) => {
      executeEvent(event, elapsed);
    });

    // Update UI (throttled)
    if (now - lastUIUpdateRef.current >= UI_UPDATE_THROTTLE) {
      setExecutionState({
        currentTime: elapsed,
        currentEventIndex: executedEventsRef.current.size,
        completedEvents: Array.from(executedEventsRef.current),
      });
      lastUIUpdateRef.current = now;
    }

    // Check for scenario completion
    const allEventsExecuted = executedEventsRef.current.size >= events.length;
    const lastEventTime = events.length > 0
      ? Math.max(...events.map((e) => e.time))
      : 0;
    const scenarioComplete = elapsed > lastEventTime && allEventsExecuted;

    if (scenarioComplete && settings) {
      // Handle looping
      if (settings.loop) {
        const { loopCount, loopDelay } = settings;

        // Check if we should continue looping
        const shouldContinue = loopCount === 0 || iterationRef.current < loopCount;

        if (shouldContinue) {
          // Wait for loopDelay then restart
          setTimeout(() => {
            if (!isRunningRef.current) return;

            iterationRef.current += 1;
            executedEventsRef.current.clear();
            clearScheduledReleases();
            startTimeRef.current = performance.now();
            pausedTimeRef.current = 0;

            setExecutionState({
              currentTime: 0,
              currentEventIndex: 0,
              completedEvents: [],
              currentLoopIteration: iterationRef.current,
            });

            emit({
              type: 'scenario:status-changed',
              status: 'running',
              currentTime: 0,
              iteration: iterationRef.current,
            });

            // Continue ticking
            animationFrameRef.current = requestAnimationFrame(tick);
          }, loopDelay);

          return;
        } else {
          // Reached loop count limit, stop
          isRunningRef.current = false;
          setExecutionState({
            status: 'stopped',
            currentTime: elapsed,
          });

          emit({
            type: 'scenario:status-changed',
            status: 'stopped',
            currentTime: elapsed,
            iteration: iterationRef.current,
          });

          return;
        }
      } else {
        // No looping, just stop
        isRunningRef.current = false;
        setExecutionState({
          status: 'stopped',
          currentTime: elapsed,
        });

        emit({
          type: 'scenario:status-changed',
          status: 'stopped',
          currentTime: elapsed,
          iteration: iterationRef.current,
        });

        return;
      }
    }

    // Schedule next tick
    animationFrameRef.current = requestAnimationFrame(tick);
  }, [events, settings, executeEvent, setExecutionState, emit, clearScheduledReleases]);

  // ============================================================================
  // Control Functions
  // ============================================================================

  const run = useCallback(() => {
    if (isRunningRef.current) return;

    isRunningRef.current = true;
    executedEventsRef.current.clear();
    clearScheduledReleases();
    iterationRef.current = 1;
    startTimeRef.current = performance.now();
    pausedTimeRef.current = 0;
    lastUIUpdateRef.current = 0;

    setExecutionState({
      status: 'running',
      currentTime: 0,
      currentEventIndex: 0,
      completedEvents: [],
      currentLoopIteration: 1,
    });

    emit({
      type: 'scenario:status-changed',
      status: 'running',
      currentTime: 0,
      iteration: 1,
    });

    animationFrameRef.current = requestAnimationFrame(tick);
  }, [setExecutionState, emit, tick, clearScheduledReleases]);

  const pause = useCallback(() => {
    if (!isRunningRef.current) return;

    isRunningRef.current = false;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Calculate paused time
    const elapsed = (performance.now() - startTimeRef.current) / 1000 + pausedTimeRef.current;
    pausedTimeRef.current = elapsed;

    setExecutionState({
      status: 'paused',
      currentTime: elapsed,
    });

    emit({
      type: 'scenario:status-changed',
      status: 'paused',
      currentTime: elapsed,
      iteration: iterationRef.current,
    });
  }, [setExecutionState, emit]);

  const resume = useCallback(() => {
    if (isRunningRef.current) return;
    if (executionState.status !== 'paused') return;

    isRunningRef.current = true;
    startTimeRef.current = performance.now();
    lastUIUpdateRef.current = 0;

    setExecutionState({
      status: 'running',
    });

    emit({
      type: 'scenario:status-changed',
      status: 'running',
      currentTime: pausedTimeRef.current,
      iteration: iterationRef.current,
    });

    animationFrameRef.current = requestAnimationFrame(tick);
  }, [executionState.status, setExecutionState, emit, tick]);

  const stop = useCallback(() => {
    isRunningRef.current = false;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    clearScheduledReleases();
    executedEventsRef.current.clear();
    iterationRef.current = 1;
    pausedTimeRef.current = 0;

    setExecutionState({
      status: 'stopped',
      currentTime: 0,
      currentEventIndex: 0,
      completedEvents: [],
      currentLoopIteration: 1,
    });

    emit({
      type: 'scenario:status-changed',
      status: 'stopped',
      currentTime: 0,
      iteration: 1,
    });
  }, [setExecutionState, emit, clearScheduledReleases]);

  const reset = useCallback(() => {
    stop();
    resetExecution();
  }, [stop, resetExecution]);

  // ============================================================================
  // Cleanup on Unmount
  // ============================================================================

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      clearScheduledReleases();
      subscribersRef.current.clear();
    };
  }, [clearScheduledReleases]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    run,
    pause,
    resume,
    stop,
    reset,
    subscribe,
  };
}

export default useScenarioExecution;
