/**
 * useModbus Hook
 *
 * Custom React hook for Modbus server control operations with loading states,
 * error handling, and automatic status updates.
 */

import { useCallback, useEffect } from 'react';
import {
  useModbusStore,
  selectStatus,
  selectIsConnecting,
  selectError,
  selectTcpRunning,
  selectRtuRunning,
  selectTcpConnectionCount,
  selectConnections,
} from '../stores/modbusStore';
import { modbusService } from '../services/modbusService';
import type { TcpServerConfig, RtuConfig, PortInfo } from '../types/modbus';

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
 * Modbus server control hook
 *
 * Provides methods for controlling TCP and RTU Modbus servers,
 * with automatic status tracking and error handling.
 */
export function useModbus() {
  // Get store state using selectors for optimal re-render behavior
  const status = useModbusStore(selectStatus);
  const isConnecting = useModbusStore(selectIsConnecting);
  const error = useModbusStore(selectError);
  const tcpRunning = useModbusStore(selectTcpRunning);
  const rtuRunning = useModbusStore(selectRtuRunning);
  const connectionCount = useModbusStore(selectTcpConnectionCount);
  const connections = useModbusStore(selectConnections);

  // Get store actions
  const fetchStatus = useModbusStore((state) => state.fetchStatus);
  const setConnecting = useModbusStore((state) => state.setConnecting);
  const setError = useModbusStore((state) => state.setError);
  const clearCache = useModbusStore((state) => state.clearCache);

  // ============================================================================
  // Status Management
  // ============================================================================

  /**
   * Refresh the Modbus server status
   */
  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      await fetchStatus();
    } catch (err) {
      console.error('Failed to refresh Modbus status:', err);
    }
  }, [fetchStatus]);

  /**
   * Clear current error
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, [setError]);

  // ============================================================================
  // TCP Server Control
  // ============================================================================

  /**
   * Start the Modbus TCP server
   * @param config - Optional TCP server configuration
   * @returns true if started successfully, false on error
   */
  const startTcp = useCallback(
    async (config?: TcpServerConfig): Promise<boolean> => {
      setConnecting(true);
      setError(null);

      try {
        await modbusService.startTcp(config);
        await fetchStatus();
        return true;
      } catch (err) {
        const message = `Failed to start TCP server: ${formatError(err)}`;
        setError(message);
        console.error(message);
        return false;
      } finally {
        setConnecting(false);
      }
    },
    [setConnecting, setError, fetchStatus]
  );

  /**
   * Stop the Modbus TCP server
   * @returns true if stopped successfully, false on error
   */
  const stopTcp = useCallback(async (): Promise<boolean> => {
    setConnecting(true);
    setError(null);

    try {
      await modbusService.stopTcp();
      await fetchStatus();
      return true;
    } catch (err) {
      const message = `Failed to stop TCP server: ${formatError(err)}`;
      setError(message);
      console.error(message);
      return false;
    } finally {
      setConnecting(false);
    }
  }, [setConnecting, setError, fetchStatus]);

  // ============================================================================
  // RTU Server Control
  // ============================================================================

  /**
   * Start the Modbus RTU server
   * @param config - RTU server configuration
   * @returns true if started successfully, false on error
   */
  const startRtu = useCallback(
    async (config: RtuConfig): Promise<boolean> => {
      setConnecting(true);
      setError(null);

      try {
        await modbusService.startRtu(config);
        await fetchStatus();
        return true;
      } catch (err) {
        const message = `Failed to start RTU server: ${formatError(err)}`;
        setError(message);
        console.error(message);
        return false;
      } finally {
        setConnecting(false);
      }
    },
    [setConnecting, setError, fetchStatus]
  );

  /**
   * Stop the Modbus RTU server
   * @returns true if stopped successfully, false on error
   */
  const stopRtu = useCallback(async (): Promise<boolean> => {
    setConnecting(true);
    setError(null);

    try {
      await modbusService.stopRtu();
      await fetchStatus();
      return true;
    } catch (err) {
      const message = `Failed to stop RTU server: ${formatError(err)}`;
      setError(message);
      console.error(message);
      return false;
    } finally {
      setConnecting(false);
    }
  }, [setConnecting, setError, fetchStatus]);

  // ============================================================================
  // Serial Port Discovery
  // ============================================================================

  /**
   * List available serial ports
   * @returns Array of available port information
   */
  const listSerialPorts = useCallback(async (): Promise<PortInfo[]> => {
    try {
      return await modbusService.listSerialPorts();
    } catch (err) {
      const message = `Failed to list serial ports: ${formatError(err)}`;
      console.error(message);
      setError(message);
      return [];
    }
  }, [setError]);

  // ============================================================================
  // Memory Snapshots
  // ============================================================================

  /**
   * Save memory snapshot to CSV file
   * @param path - File path to save to
   * @returns true if saved successfully, false on error
   */
  const saveMemorySnapshot = useCallback(
    async (path: string): Promise<boolean> => {
      try {
        await modbusService.saveMemoryCsv(path);
        return true;
      } catch (err) {
        const message = `Failed to save memory snapshot: ${formatError(err)}`;
        setError(message);
        console.error(message);
        return false;
      }
    },
    [setError]
  );

  /**
   * Load memory snapshot from CSV file
   * @param path - File path to load from
   * @returns true if loaded successfully, false on error
   */
  const loadMemorySnapshot = useCallback(
    async (path: string): Promise<boolean> => {
      try {
        await modbusService.loadMemoryCsv(path);
        // Clear cache after loading new data
        clearCache();
        return true;
      } catch (err) {
        const message = `Failed to load memory snapshot: ${formatError(err)}`;
        setError(message);
        console.error(message);
        return false;
      }
    },
    [setError, clearCache]
  );

  // ============================================================================
  // Initial Status Fetch
  // ============================================================================

  // Fetch status on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // ============================================================================
  // Return Hook Interface
  // ============================================================================

  return {
    // State
    status,
    isConnecting,
    error,
    tcpRunning,
    rtuRunning,
    connectionCount,
    connections,

    // TCP Control
    startTcp,
    stopTcp,

    // RTU Control
    startRtu,
    stopRtu,

    // Serial Port Discovery
    listSerialPorts,

    // Status Management
    refreshStatus,
    clearError,

    // Memory Snapshots
    saveMemorySnapshot,
    loadMemorySnapshot,
  };
}

export default useModbus;
