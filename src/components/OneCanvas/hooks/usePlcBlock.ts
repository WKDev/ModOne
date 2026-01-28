/**
 * PLC Block Hooks
 *
 * Hooks for integrating PLC blocks with Modbus store.
 */

import { useEffect, useCallback } from 'react';
import { useModbusStore, selectCoil, selectDiscreteInput } from '../../../stores/modbusStore';
import { modbusService } from '../../../services/modbusService';

// ============================================================================
// Types
// ============================================================================

interface UsePlcOutBlockOptions {
  /** Modbus coil address */
  address: number;
  /** Whether contact is normally open (true) or normally closed (false) */
  normallyOpen: boolean;
  /** Whether the logic is inverted */
  inverted: boolean;
}

interface UsePlcOutBlockReturn {
  /** Current coil value from Modbus */
  coilValue: boolean | undefined;
  /** Whether the circuit path is connected (closed) */
  isConnected: boolean;
  /** Manually set the coil value */
  setCoilValue: (value: boolean) => Promise<void>;
}

interface UsePlcInBlockOptions {
  /** Modbus discrete input address */
  address: number;
  /** Voltage threshold to trigger input */
  thresholdVoltage: number;
  /** Whether the logic is inverted */
  inverted: boolean;
  /** Current voltage at the input */
  voltage: number;
}

interface UsePlcInBlockReturn {
  /** Current input state (high/low) */
  inputState: boolean;
  /** Current discrete input value in Modbus */
  discreteValue: boolean | undefined;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for PLC Output (Coil) blocks.
 * Reads coil value from Modbus and determines connection state.
 */
export function usePlcOutBlock({
  address,
  normallyOpen,
  inverted,
}: UsePlcOutBlockOptions): UsePlcOutBlockReturn {
  // Read coil value from store
  const coilValue = useModbusStore(selectCoil(address));

  // Calculate connection state
  // For NO: connected when coil is ON (XOR with inverted)
  // For NC: connected when coil is OFF (XOR with inverted)
  const rawState = coilValue ?? false;
  const effectiveState = inverted ? !rawState : rawState;
  const isConnected = normallyOpen ? effectiveState : !effectiveState;

  // Function to manually set coil value
  const setCoilValue = useCallback(
    async (value: boolean) => {
      await modbusService.writeCoil(address, value);
    },
    [address]
  );

  return {
    coilValue,
    isConnected,
    setCoilValue,
  };
}

/**
 * Hook for PLC Input (Discrete Input) blocks.
 * Writes to discrete input based on voltage threshold.
 */
export function usePlcInBlock({
  address,
  thresholdVoltage,
  inverted,
  voltage,
}: UsePlcInBlockOptions): UsePlcInBlockReturn {
  // Read current discrete input value
  const discreteValue = useModbusStore(selectDiscreteInput(address));

  // Calculate input state based on voltage threshold
  const isHigh = voltage >= thresholdVoltage;
  const inputState = inverted ? !isHigh : isHigh;

  // Write to discrete input when state changes
  useEffect(() => {
    // Use updateDiscreteCache from store since discrete inputs are typically read-only
    // In simulation mode, we allow writing for testing purposes
    const updateDiscrete = useModbusStore.getState().updateDiscreteCache;
    updateDiscrete(address, inputState);
  }, [address, inputState]);

  return {
    inputState,
    discreteValue,
  };
}

/**
 * Hook to subscribe to coil value changes for a specific address.
 */
export function useCoilSubscription(
  address: number,
  onChange?: (value: boolean) => void
): boolean | undefined {
  const coilValue = useModbusStore(selectCoil(address));

  useEffect(() => {
    if (coilValue !== undefined && onChange) {
      onChange(coilValue);
    }
  }, [coilValue, onChange]);

  return coilValue;
}

/**
 * Hook to subscribe to discrete input value changes for a specific address.
 */
export function useDiscreteSubscription(
  address: number,
  onChange?: (value: boolean) => void
): boolean | undefined {
  const discreteValue = useModbusStore(selectDiscreteInput(address));

  useEffect(() => {
    if (discreteValue !== undefined && onChange) {
      onChange(discreteValue);
    }
  }, [discreteValue, onChange]);

  return discreteValue;
}

export default {
  usePlcOutBlock,
  usePlcInBlock,
  useCoilSubscription,
  useDiscreteSubscription,
};
