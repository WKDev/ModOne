/**
 * useMonitoring Hook
 *
 * React hook for ladder diagram monitoring mode.
 * Subscribes to Tauri events for real-time PLC state updates
 * and provides controls for monitoring operations.
 */

import { useCallback, useEffect, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import {
  useLadderUIStore,
  selectMode,
  selectMonitoringState,
} from '../stores/ladderUIStore';
import type {
  LadderMonitoringState,
  TimerState,
  CounterState,
} from '../types/ladder';
import type { ResolvedBinding, RuntimeBinding } from '../types/onesim';

// ============================================================================
// Types
// ============================================================================

/** Device state update from backend */
export interface DeviceStateUpdate {
  /** Device address (e.g., 'X0', 'Y0', 'D0') */
  address: string;
  /** Canonical/tag binding */
  binding?: RuntimeBinding;
  /** Current value (boolean for bits, number for words) */
  value: boolean | number;
}

/** Timer state update from backend */
export interface TimerStateUpdate {
  /** Timer address (e.g., 'T0') */
  address: string;
  /** Canonical/tag binding */
  binding?: RuntimeBinding;
  /** Timer state */
  state: TimerState;
}

/** Counter state update from backend */
export interface CounterStateUpdate {
  /** Counter address (e.g., 'C0') */
  address: string;
  /** Canonical/tag binding */
  binding?: RuntimeBinding;
  /** Counter state */
  state: CounterState;
}

/** Forced device update from backend */
export interface ForcedDeviceUpdate {
  /** Device address */
  address: string;
  /** Canonical/tag binding */
  binding?: RuntimeBinding;
  /** Forced value */
  value: boolean | number;
}

/** Batch monitoring update event payload */
export interface MonitoringUpdatePayload {
  /** Device state updates */
  devices?: DeviceStateUpdate[];
  /** Timer state updates */
  timers?: TimerStateUpdate[];
  /** Counter state updates */
  counters?: CounterStateUpdate[];
  /** Forced device updates */
  forcedDevices?: ForcedDeviceUpdate[];
  /** Energized wire IDs */
  energizedWires?: string[];
}

/** Monitoring connection status */
export type MonitoringConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Hook return type */
export interface UseMonitoringResult {
  /** Whether in monitoring mode */
  isMonitoring: boolean;
  /** Current monitoring state (null if not monitoring) */
  monitoringState: LadderMonitoringState | null;
  /** Connection status */
  connectionStatus: MonitoringConnectionStatus;
  /** Error message if any */
  error: string | null;
  /** Start monitoring mode */
  startMonitoring: () => Promise<void>;
  /** Stop monitoring mode */
  stopMonitoring: () => Promise<void>;
  /** Force a device to a specific value */
  forceDevice: (address: string, value: boolean | number) => Promise<void>;
  /** Release force on a device */
  releaseForce: (address: string) => Promise<void>;
  /** Get device state by address */
  getDeviceState: (address: string) => boolean | number | undefined;
  /** Check if a device is forced */
  isDeviceForced: (address: string) => boolean;
  /** Get timer state by address */
  getTimerState: (address: string) => TimerState | undefined;
  /** Get counter state by address */
  getCounterState: (address: string) => CounterState | undefined;
  /** Check if a wire is energized */
  isWireEnergized: (wireId: string) => boolean;
}

// ============================================================================
// Event Names
// ============================================================================

const MONITORING_UPDATE_EVENT = 'ladder:monitoring-update';
const MONITORING_ERROR_EVENT = 'ladder:monitoring-error';

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for ladder diagram monitoring mode
 *
 * Provides real-time monitoring of PLC state with:
 * - Device state tracking (X, Y, M, D, etc.)
 * - Timer/counter state tracking
 * - Wire energization visualization
 * - Force/release device capabilities
 */
export function useMonitoring(): UseMonitoringResult {
  // Get store state using selectors
  const mode = useLadderUIStore(selectMode);
  const monitoringState = useLadderUIStore(selectMonitoringState);

  // Get store actions
  const storeStartMonitoring = useLadderUIStore((state) => state.startMonitoring);
  const storeStopMonitoring = useLadderUIStore((state) => state.stopMonitoring);
  const updateMonitoringState = useLadderUIStore((state) => state.updateMonitoringState);
  const storeForceDevice = useLadderUIStore((state) => state.forceDevice);
  const storeReleaseForce = useLadderUIStore((state) => state.releaseForce);

  // Local state refs
  const mountedRef = useRef(true);
  const unlistenUpdateRef = useRef<UnlistenFn | null>(null);
  const unlistenErrorRef = useRef<UnlistenFn | null>(null);
  const connectionStatusRef = useRef<MonitoringConnectionStatus>('disconnected');
  const errorRef = useRef<string | null>(null);

  // Derived state
  const isMonitoring = mode === 'monitor';

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle monitoring update event from backend
   */
  const handleMonitoringUpdate = useCallback(
    (payload: MonitoringUpdatePayload) => {
      if (!mountedRef.current) return;

      // Build partial state update
      const stateUpdate: Partial<LadderMonitoringState> = {};

      // Process device states
      if (payload.devices) {
        const deviceStates = new Map<string, boolean | number>();
        const deviceBindings = new Map<string, RuntimeBinding>();
        for (const update of payload.devices) {
          deviceStates.set(update.address, update.value);
          if (update.binding) {
            deviceBindings.set(update.address, update.binding);
          }
        }
        stateUpdate.deviceStates = deviceStates;
        stateUpdate.deviceBindings = deviceBindings;
      }

      // Process timer states
      if (payload.timers) {
        const timerStates = new Map<string, TimerState>();
        const timerBindings = new Map<string, RuntimeBinding>();
        for (const update of payload.timers) {
          timerStates.set(update.address, update.state);
          if (update.binding) {
            timerBindings.set(update.address, update.binding);
          }
        }
        stateUpdate.timerStates = timerStates;
        stateUpdate.timerBindings = timerBindings;
      }

      // Process counter states
      if (payload.counters) {
        const counterStates = new Map<string, CounterState>();
        const counterBindings = new Map<string, RuntimeBinding>();
        for (const update of payload.counters) {
          counterStates.set(update.address, update.state);
          if (update.binding) {
            counterBindings.set(update.address, update.binding);
          }
        }
        stateUpdate.counterStates = counterStates;
        stateUpdate.counterBindings = counterBindings;
      }

      // Process forced devices
      if (payload.forcedDevices) {
        const forcedDevices = new Set<string>();
        const forcedDeviceBindings = new Map<string, RuntimeBinding>();
        for (const update of payload.forcedDevices) {
          forcedDevices.add(update.address);
          if (update.binding) {
            forcedDeviceBindings.set(update.address, update.binding);
          }
        }
        stateUpdate.forcedDevices = forcedDevices;
        stateUpdate.forcedDeviceBindings = forcedDeviceBindings;
      }

      // Process energized wires
      if (payload.energizedWires) {
        stateUpdate.energizedWires = new Set(payload.energizedWires);
      }

      // Update store
      updateMonitoringState(stateUpdate);
    },
    [updateMonitoringState]
  );

  /**
   * Handle monitoring error event from backend
   */
  const handleMonitoringError = useCallback((errorMessage: string) => {
    if (!mountedRef.current) return;
    console.error('Monitoring error:', errorMessage);
    errorRef.current = errorMessage;
    connectionStatusRef.current = 'error';
  }, []);

  // ============================================================================
  // Control Functions
  // ============================================================================

  /**
   * Start monitoring mode
   */
  const startMonitoring = useCallback(async (): Promise<void> => {
    if (isMonitoring) return;

    connectionStatusRef.current = 'connecting';
    errorRef.current = null;

    try {
      // Setup event listeners first
      unlistenUpdateRef.current = await listen<MonitoringUpdatePayload>(
        MONITORING_UPDATE_EVENT,
        (event) => {
          if (mountedRef.current) {
            handleMonitoringUpdate(event.payload);
          }
        }
      );

      unlistenErrorRef.current = await listen<string>(
        MONITORING_ERROR_EVENT,
        (event) => {
          if (mountedRef.current) {
            handleMonitoringError(event.payload);
          }
        }
      );

      // Start monitoring in backend
      await invoke('ladder_start_monitoring');

      // Update store
      storeStartMonitoring();
      connectionStatusRef.current = 'connected';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start monitoring';
      console.error('Failed to start monitoring:', message);
      errorRef.current = message;
      connectionStatusRef.current = 'error';

      // Cleanup listeners on error
      if (unlistenUpdateRef.current) {
        unlistenUpdateRef.current();
        unlistenUpdateRef.current = null;
      }
      if (unlistenErrorRef.current) {
        unlistenErrorRef.current();
        unlistenErrorRef.current = null;
      }
    }
  }, [isMonitoring, storeStartMonitoring, handleMonitoringUpdate, handleMonitoringError]);

  /**
   * Stop monitoring mode
   */
  const stopMonitoring = useCallback(async (): Promise<void> => {
    if (!isMonitoring) return;

    try {
      // Stop monitoring in backend
      await invoke('ladder_stop_monitoring');
    } catch (err) {
      console.error('Failed to stop monitoring:', err);
    }

    // Cleanup event listeners
    if (unlistenUpdateRef.current) {
      unlistenUpdateRef.current();
      unlistenUpdateRef.current = null;
    }
    if (unlistenErrorRef.current) {
      unlistenErrorRef.current();
      unlistenErrorRef.current = null;
    }

    // Update store
    storeStopMonitoring();
    connectionStatusRef.current = 'disconnected';
    errorRef.current = null;
  }, [isMonitoring, storeStopMonitoring]);

  /**
   * Force a device to a specific value
   */
  const forceDevice = useCallback(
    async (address: string, value: boolean | number): Promise<void> => {
      if (!isMonitoring) return;

      try {
        const resolved = await invoke<ResolvedBinding>('sim_resolve_binding', { address });
        // Send to backend
        await invoke('ladder_force_device', {
          request: {
            binding: resolved.binding,
            address,
            displayAddress: resolved.displayAddress,
          },
          value,
        });
        // Update local state
        storeForceDevice(address, value, resolved.binding);
      } catch (err) {
        console.error(`Failed to force device ${address}:`, err);
        throw err;
      }
    },
    [isMonitoring, storeForceDevice]
  );

  /**
   * Release force on a device
   */
  const releaseForce = useCallback(
    async (address: string): Promise<void> => {
      if (!isMonitoring) return;

      try {
        const resolved = await invoke<ResolvedBinding>('sim_resolve_binding', { address });
        // Send to backend
        await invoke('ladder_release_force', {
          request: {
            binding: resolved.binding,
            address,
            displayAddress: resolved.displayAddress,
          },
        });
        // Update local state
        storeReleaseForce(address);
      } catch (err) {
        console.error(`Failed to release force on ${address}:`, err);
        throw err;
      }
    },
    [isMonitoring, storeReleaseForce]
  );

  // ============================================================================
  // State Accessor Functions
  // ============================================================================

  /**
   * Get device state by address
   */
  const getDeviceState = useCallback(
    (address: string): boolean | number | undefined => {
      return monitoringState?.deviceStates.get(address);
    },
    [monitoringState]
  );

  /**
   * Check if a device is forced
   */
  const isDeviceForced = useCallback(
    (address: string): boolean => {
      return monitoringState?.forcedDevices.has(address) ?? false;
    },
    [monitoringState]
  );

  /**
   * Get timer state by address
   */
  const getTimerState = useCallback(
    (address: string): TimerState | undefined => {
      return monitoringState?.timerStates.get(address);
    },
    [monitoringState]
  );

  /**
   * Get counter state by address
   */
  const getCounterState = useCallback(
    (address: string): CounterState | undefined => {
      return monitoringState?.counterStates.get(address);
    },
    [monitoringState]
  );

  /**
   * Check if a wire is energized
   */
  const isWireEnergized = useCallback(
    (wireId: string): boolean => {
      return monitoringState?.energizedWires.has(wireId) ?? false;
    },
    [monitoringState]
  );

  // ============================================================================
  // Effect: Cleanup on unmount
  // ============================================================================

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      // Cleanup event listeners
      if (unlistenUpdateRef.current) {
        unlistenUpdateRef.current();
        unlistenUpdateRef.current = null;
      }
      if (unlistenErrorRef.current) {
        unlistenErrorRef.current();
        unlistenErrorRef.current = null;
      }
    };
  }, []);

  // ============================================================================
  // Return Hook Interface
  // ============================================================================

  return {
    isMonitoring,
    monitoringState,
    connectionStatus: connectionStatusRef.current,
    error: errorRef.current,
    startMonitoring,
    stopMonitoring,
    forceDevice,
    releaseForce,
    getDeviceState,
    isDeviceForced,
    getTimerState,
    getCounterState,
    isWireEnergized,
  };
}

export default useMonitoring;
