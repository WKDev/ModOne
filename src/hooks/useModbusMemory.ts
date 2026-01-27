/**
 * useModbusMemory Hook
 *
 * React hook for subscribing to Modbus memory changes in a specific address range.
 * Provides initial data loading and real-time updates via Tauri events.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { modbusService } from '../services/modbusService';
import { useModbusStore } from '../stores/modbusStore';
import type { MemoryType, MemoryChangeEvent, MemoryBatchChangeEvent } from '../types/modbus';

// ============================================================================
// Types
// ============================================================================

interface UseModbusMemoryOptions {
  /** Whether to auto-refresh on mount (default: true) */
  autoLoad?: boolean;
  /** Polling interval in milliseconds (0 = disabled, default: 0) */
  pollInterval?: number;
  /** Whether to use cache from store (default: true) */
  useCache?: boolean;
}

interface UseModbusMemoryResult<T extends boolean | number> {
  /** Current memory values */
  values: T[];
  /** Whether data is being loaded */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Manually refresh data from backend */
  refresh: () => Promise<void>;
  /** Clear error state */
  clearError: () => void;
}

// ============================================================================
// Event Names
// ============================================================================

const MEMORY_CHANGED_EVENT = 'modbus:memory-changed';
const MEMORY_BATCH_CHANGED_EVENT = 'modbus:memory-batch-changed';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format error message from various error types
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

/**
 * Check if an address falls within a range
 */
function isInRange(address: number, start: number, count: number): boolean {
  return address >= start && address < start + count;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for monitoring coil memory (boolean values)
 */
export function useModbusCoils(
  start: number,
  count: number,
  options: UseModbusMemoryOptions = {}
): UseModbusMemoryResult<boolean> {
  return useModbusMemoryInternal<boolean>('coil', start, count, options);
}

/**
 * Hook for monitoring discrete input memory (boolean values)
 */
export function useModbusDiscreteInputs(
  start: number,
  count: number,
  options: UseModbusMemoryOptions = {}
): UseModbusMemoryResult<boolean> {
  return useModbusMemoryInternal<boolean>('discrete', start, count, options);
}

/**
 * Hook for monitoring holding register memory (number values)
 */
export function useModbusHoldingRegisters(
  start: number,
  count: number,
  options: UseModbusMemoryOptions = {}
): UseModbusMemoryResult<number> {
  return useModbusMemoryInternal<number>('holding', start, count, options);
}

/**
 * Hook for monitoring input register memory (number values)
 */
export function useModbusInputRegisters(
  start: number,
  count: number,
  options: UseModbusMemoryOptions = {}
): UseModbusMemoryResult<number> {
  return useModbusMemoryInternal<number>('input', start, count, options);
}

/**
 * Generic hook for any memory type
 */
export function useModbusMemory(
  type: MemoryType,
  start: number,
  count: number,
  options: UseModbusMemoryOptions = {}
): UseModbusMemoryResult<boolean | number> {
  return useModbusMemoryInternal(type, start, count, options);
}

/**
 * Internal implementation of the memory monitoring hook
 */
function useModbusMemoryInternal<T extends boolean | number>(
  type: MemoryType,
  start: number,
  count: number,
  options: UseModbusMemoryOptions = {}
): UseModbusMemoryResult<T> {
  const { autoLoad = true, pollInterval = 0, useCache = true } = options;

  // State
  const [values, setValues] = useState<T[]>(() => new Array(count).fill(isBooleanType(type) ? false : 0) as T[]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup and stable references
  const mountedRef = useRef(true);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const batchUnlistenRef = useRef<UnlistenFn | null>(null);

  // Store actions for cache updates
  const updateCoilCache = useModbusStore((state) => state.updateCoilCache);
  const updateDiscreteCache = useModbusStore((state) => state.updateDiscreteCache);
  const updateHoldingRegisterCache = useModbusStore((state) => state.updateHoldingRegisterCache);
  const updateInputRegisterCache = useModbusStore((state) => state.updateInputRegisterCache);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Refresh data from backend
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await modbusService.readMemory(type, start, count);

      if (!mountedRef.current) return;

      setValues(data as T[]);

      // Update cache if enabled
      if (useCache) {
        data.forEach((value, index) => {
          const address = start + index;
          switch (type) {
            case 'coil':
              updateCoilCache(address, value as boolean);
              break;
            case 'discrete':
              updateDiscreteCache(address, value as boolean);
              break;
            case 'holding':
              updateHoldingRegisterCache(address, value as number);
              break;
            case 'input':
              updateInputRegisterCache(address, value as number);
              break;
          }
        });
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const message = `Failed to read ${type} memory: ${formatError(err)}`;
      setError(message);
      console.error(message);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [type, start, count, useCache, updateCoilCache, updateDiscreteCache, updateHoldingRegisterCache, updateInputRegisterCache]);

  /**
   * Handle single memory change event
   */
  const handleMemoryChange = useCallback(
    (event: MemoryChangeEvent) => {
      // Check if the change is for our register type and within our range
      if (event.register_type !== type) return;
      if (!isInRange(event.address, start, count)) return;

      const index = event.address - start;
      setValues((prev) => {
        const updated = [...prev];
        updated[index] = event.new_value as T;
        return updated;
      });

      // Update cache if enabled
      if (useCache) {
        switch (type) {
          case 'coil':
            updateCoilCache(event.address, event.new_value as boolean);
            break;
          case 'discrete':
            updateDiscreteCache(event.address, event.new_value as boolean);
            break;
          case 'holding':
            updateHoldingRegisterCache(event.address, event.new_value as number);
            break;
          case 'input':
            updateInputRegisterCache(event.address, event.new_value as number);
            break;
        }
      }
    },
    [type, start, count, useCache, updateCoilCache, updateDiscreteCache, updateHoldingRegisterCache, updateInputRegisterCache]
  );

  /**
   * Handle batch memory change event
   */
  const handleBatchChange = useCallback(
    (event: MemoryBatchChangeEvent) => {
      // Filter changes that are relevant to us
      const relevantChanges = event.changes.filter(
        (change) => change.register_type === type && isInRange(change.address, start, count)
      );

      if (relevantChanges.length === 0) return;

      setValues((prev) => {
        const updated = [...prev];
        for (const change of relevantChanges) {
          const index = change.address - start;
          updated[index] = change.new_value as T;
        }
        return updated;
      });

      // Update cache if enabled
      if (useCache) {
        for (const change of relevantChanges) {
          switch (type) {
            case 'coil':
              updateCoilCache(change.address, change.new_value as boolean);
              break;
            case 'discrete':
              updateDiscreteCache(change.address, change.new_value as boolean);
              break;
            case 'holding':
              updateHoldingRegisterCache(change.address, change.new_value as number);
              break;
            case 'input':
              updateInputRegisterCache(change.address, change.new_value as number);
              break;
          }
        }
      }
    },
    [type, start, count, useCache, updateCoilCache, updateDiscreteCache, updateHoldingRegisterCache, updateInputRegisterCache]
  );

  // Setup effect: initial load and event subscription
  useEffect(() => {
    mountedRef.current = true;

    // Initial load
    if (autoLoad) {
      refresh();
    }

    // Subscribe to memory change events
    const setupListeners = async () => {
      try {
        // Single change events
        unlistenRef.current = await listen<MemoryChangeEvent>(
          MEMORY_CHANGED_EVENT,
          (event) => {
            if (mountedRef.current) {
              handleMemoryChange(event.payload);
            }
          }
        );

        // Batch change events
        batchUnlistenRef.current = await listen<MemoryBatchChangeEvent>(
          MEMORY_BATCH_CHANGED_EVENT,
          (event) => {
            if (mountedRef.current) {
              handleBatchChange(event.payload);
            }
          }
        );
      } catch (err) {
        console.error('Failed to setup Modbus event listeners:', err);
      }
    };

    setupListeners();

    // Cleanup
    return () => {
      mountedRef.current = false;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      if (batchUnlistenRef.current) {
        batchUnlistenRef.current();
        batchUnlistenRef.current = null;
      }
    };
  }, [type, start, count, autoLoad, refresh, handleMemoryChange, handleBatchChange]);

  // Polling effect
  useEffect(() => {
    if (pollInterval <= 0) return;

    const intervalId = setInterval(() => {
      if (mountedRef.current && !isLoading) {
        refresh();
      }
    }, pollInterval);

    return () => clearInterval(intervalId);
  }, [pollInterval, refresh, isLoading]);

  // Reset values when parameters change
  useEffect(() => {
    setValues(new Array(count).fill(isBooleanType(type) ? false : 0) as T[]);
  }, [type, count]);

  return {
    values,
    isLoading,
    error,
    refresh,
    clearError,
  };
}

/**
 * Helper to determine if a memory type uses boolean values
 */
function isBooleanType(type: MemoryType): boolean {
  return type === 'coil' || type === 'discrete';
}

export default useModbusMemory;
