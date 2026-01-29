/**
 * useElementMonitoring Hook
 *
 * React hook for connecting ladder elements to monitoring state.
 * Provides element-specific monitoring data based on device address.
 */

import { useMemo } from 'react';
import {
  useLadderStore,
  selectMode,
  selectMonitoringState,
} from '../stores/ladderStore';
import type {
  LadderElement,
  TimerState,
  CounterState,
} from '../types/ladder';
import type { MonitoringState } from '../components/LadderEditor/elements/LadderElementRenderer';

// ============================================================================
// Types
// ============================================================================

export interface UseElementMonitoringResult {
  /** Whether in monitoring mode */
  isMonitoring: boolean;
  /** MonitoringState for LadderElementRenderer */
  monitoring: MonitoringState | undefined;
  /** Raw device value (boolean for contacts/coils, number for timers/counters) */
  deviceValue: boolean | number | undefined;
  /** Whether device is forced */
  isForced: boolean;
  /** Timer state (for timer elements) */
  timerState: TimerState | undefined;
  /** Counter state (for counter elements) */
  counterState: CounterState | undefined;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine if element is "energized" based on type and state
 */
function calculateEnergized(
  element: LadderElement,
  deviceValue: boolean | number | undefined,
  timerState: TimerState | undefined,
  counterState: CounterState | undefined
): boolean {
  // Handle undefined device value
  if (deviceValue === undefined) return false;

  const { type } = element;

  // Contact elements - energized based on boolean state and contact type
  if (type.startsWith('contact_')) {
    const boolValue = typeof deviceValue === 'boolean' ? deviceValue : Boolean(deviceValue);

    // For NC contacts, energized when input is FALSE
    if (type === 'contact_nc') {
      return !boolValue;
    }
    // For NO, P, N contacts, energized when input is TRUE
    return boolValue;
  }

  // Coil elements - energized when output is ON
  if (type.startsWith('coil')) {
    return typeof deviceValue === 'boolean' ? deviceValue : Boolean(deviceValue);
  }

  // Timer elements - energized when timer is done
  if (type.startsWith('timer_')) {
    return timerState?.done ?? false;
  }

  // Counter elements - energized when counter is done
  if (type.startsWith('counter_')) {
    return counterState?.done ?? false;
  }

  // Comparison elements - energized when result is true
  if (type.startsWith('compare_')) {
    return typeof deviceValue === 'boolean' ? deviceValue : false;
  }

  // Default: not energized
  return false;
}

/**
 * Get comparison result for comparison elements
 */
function getComparisonResult(
  element: LadderElement,
  deviceStates: Map<string, boolean | number>
): boolean | undefined {
  if (!element.type.startsWith('compare_')) return undefined;

  // Get element properties
  const address = 'address' in element ? element.address : '';
  if (!address) return undefined;

  // For comparison elements, the "energized" state represents the comparison result
  const value = deviceStates.get(address);
  return typeof value === 'boolean' ? value : undefined;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for getting monitoring state for a specific ladder element
 *
 * @param element - The ladder element to get monitoring state for
 * @returns Monitoring state for the element
 */
export function useElementMonitoring(element: LadderElement): UseElementMonitoringResult {
  // Get store state
  const mode = useLadderStore(selectMode);
  const monitoringState = useLadderStore(selectMonitoringState);

  const isMonitoring = mode === 'monitor';

  // Get element address
  const address = 'address' in element ? element.address : undefined;

  // Compute element-specific monitoring state
  const result = useMemo<UseElementMonitoringResult>(() => {
    // Not in monitoring mode - return defaults
    if (!isMonitoring || !monitoringState || !address) {
      return {
        isMonitoring,
        monitoring: undefined,
        deviceValue: undefined,
        isForced: false,
        timerState: undefined,
        counterState: undefined,
      };
    }

    // Get device value
    const deviceValue = monitoringState.deviceStates.get(address);
    const isForced = monitoringState.forcedDevices.has(address);

    // Get timer/counter state
    const timerState = monitoringState.timerStates.get(address);
    const counterState = monitoringState.counterStates.get(address);

    // Calculate energized state
    const isEnergized = calculateEnergized(element, deviceValue, timerState, counterState);

    // Get comparison result
    const comparisonResult = getComparisonResult(element, monitoringState.deviceStates);

    // Build MonitoringState for LadderElementRenderer
    const monitoring: MonitoringState = {
      isEnergized,
      isForced,
      timerState,
      counterState,
      comparisonResult,
    };

    return {
      isMonitoring,
      monitoring,
      deviceValue,
      isForced,
      timerState,
      counterState,
    };
  }, [isMonitoring, monitoringState, address, element]);

  return result;
}

/**
 * Hook for checking if a wire is energized
 *
 * @param wireId - The wire ID to check
 * @returns Whether the wire is energized
 */
export function useWireMonitoring(wireId: string): {
  isMonitoring: boolean;
  isEnergized: boolean;
} {
  const mode = useLadderStore(selectMode);
  const monitoringState = useLadderStore(selectMonitoringState);

  const isMonitoring = mode === 'monitor';

  const isEnergized = useMemo(() => {
    if (!isMonitoring || !monitoringState) return false;
    return monitoringState.energizedWires.has(wireId);
  }, [isMonitoring, monitoringState, wireId]);

  return {
    isMonitoring,
    isEnergized,
  };
}

export default useElementMonitoring;
