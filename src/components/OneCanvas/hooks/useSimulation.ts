/**
 * useSimulation Hook
 *
 * Manages circuit simulation state and runs the simulation at 20Hz
 * using requestAnimationFrame for smooth updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Block, Wire } from '../types';
import {
  simulateCircuit,
  type SimulationResult,
  type SimulationOptions,
} from '../utils/circuitSimulator';
import {
  createEmptyRuntimeState,
  setButtonState as updateButtonState,
  setPlcOutput as updatePlcOutput,
  setManualOverride as updateManualOverride,
  syncFromModbus,
  type RuntimeState,
} from '../utils/switchEvaluator';
import { useModbusStore } from '../../../stores/modbusStore';

// ============================================================================
// Types
// ============================================================================

/**
 * Return type of useSimulation hook.
 */
export interface UseSimulationReturn {
  /** Whether simulation is running */
  running: boolean;
  /** Current simulation result (null if not run yet) */
  result: SimulationResult | null;
  /** Start the simulation loop */
  start: () => void;
  /** Stop the simulation loop */
  stop: () => void;
  /** Toggle simulation running state */
  toggle: () => void;
  /** Reset simulation state */
  reset: () => void;
  /** Run single simulation step (useful for debugging) */
  step: () => void;
  /** Current runtime state */
  runtimeState: RuntimeState;
  /** Set a button press state */
  setButtonState: (componentId: string, pressed: boolean) => void;
  /** Set a PLC output state */
  setPlcOutput: (address: number, value: boolean) => void;
  /** Set a manual override for a switch */
  setManualOverride: (componentId: string, value: boolean | undefined) => void;
  /** Simulation update rate in Hz */
  updateRate: number;
  /** Actual measured update rate */
  measuredRate: number;
}

/**
 * Options for useSimulation hook.
 */
export interface UseSimulationOptions extends SimulationOptions {
  /** Update rate in Hz (default: 20) */
  updateRate?: number;
  /** Whether to auto-sync with Modbus store (default: true) */
  syncWithModbus?: boolean;
  /** Whether to start simulation automatically (default: false) */
  autoStart?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_UPDATE_RATE = 20; // 20Hz
const MIN_UPDATE_INTERVAL = 16; // ~60fps max

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for running circuit simulation.
 *
 * @param components - Array of circuit blocks
 * @param wires - Array of wire connections
 * @param options - Simulation options
 * @returns Simulation control interface
 */
export function useSimulation(
  components: Block[],
  wires: Wire[],
  options: UseSimulationOptions = {}
): UseSimulationReturn {
  const {
    updateRate = DEFAULT_UPDATE_RATE,
    syncWithModbus = true,
    autoStart = false,
    ...simulationOptions
  } = options;

  // State
  const [running, setRunning] = useState(autoStart);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [runtimeState, setRuntimeState] = useState<RuntimeState>(createEmptyRuntimeState);
  const [measuredRate, setMeasuredRate] = useState(0);

  // Refs for animation loop
  const lastUpdateRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastRateUpdateRef = useRef<number>(0);
  const frameIdRef = useRef<number | null>(null);

  // Calculate update interval in ms
  const updateInterval = Math.max(1000 / updateRate, MIN_UPDATE_INTERVAL);

  // Get coil values from Modbus store for sync
  const coilCache = useModbusStore((state) => state.coilCache);

  // Sync with Modbus store when coil values change
  useEffect(() => {
    if (syncWithModbus) {
      setRuntimeState((prev) => syncFromModbus(prev, coilCache));
    }
  }, [coilCache, syncWithModbus]);

  // Run simulation step
  const runSimulation = useCallback(() => {
    const newResult = simulateCircuit(
      components,
      wires,
      runtimeState,
      simulationOptions
    );
    setResult(newResult);
  }, [components, wires, runtimeState, simulationOptions]);

  // Animation loop
  useEffect(() => {
    if (!running) {
      return;
    }

    const tick = (timestamp: number) => {
      // Check if enough time has passed
      if (timestamp - lastUpdateRef.current >= updateInterval) {
        runSimulation();
        lastUpdateRef.current = timestamp;
        frameCountRef.current++;

        // Update measured rate every second
        if (timestamp - lastRateUpdateRef.current >= 1000) {
          setMeasuredRate(frameCountRef.current);
          frameCountRef.current = 0;
          lastRateUpdateRef.current = timestamp;
        }
      }

      frameIdRef.current = requestAnimationFrame(tick);
    };

    // Start the loop
    lastUpdateRef.current = performance.now();
    lastRateUpdateRef.current = performance.now();
    frameCountRef.current = 0;
    frameIdRef.current = requestAnimationFrame(tick);

    // Cleanup
    return () => {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
    };
  }, [running, runSimulation, updateInterval]);

  // Control functions
  const start = useCallback(() => {
    setRunning(true);
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
    setMeasuredRate(0);
  }, []);

  const toggle = useCallback(() => {
    setRunning((prev) => !prev);
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setResult(null);
    setRuntimeState(createEmptyRuntimeState());
    setMeasuredRate(0);
  }, []);

  const step = useCallback(() => {
    runSimulation();
  }, [runSimulation]);

  // State setters
  const setButtonState = useCallback((componentId: string, pressed: boolean) => {
    setRuntimeState((prev) => updateButtonState(prev, componentId, pressed));
  }, []);

  const setPlcOutput = useCallback((address: number, value: boolean) => {
    setRuntimeState((prev) => updatePlcOutput(prev, address, value));
  }, []);

  const setManualOverride = useCallback(
    (componentId: string, value: boolean | undefined) => {
      setRuntimeState((prev) => updateManualOverride(prev, componentId, value));
    },
    []
  );

  return {
    running,
    result,
    start,
    stop,
    toggle,
    reset,
    step,
    runtimeState,
    setButtonState,
    setPlcOutput,
    setManualOverride,
    updateRate,
    measuredRate,
  };
}

export default useSimulation;
