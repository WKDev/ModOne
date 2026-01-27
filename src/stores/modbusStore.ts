/**
 * Modbus Store - Zustand State Management for Modbus Operations
 *
 * Manages Modbus server status, connection state, error handling,
 * and memory caches for coils and registers.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { modbusService } from '../services/modbusService';
import type { ModbusStatus, ConnectionEvent } from '../types/modbus';

// ============================================================================
// Types
// ============================================================================

/** Information about a connected client */
export interface ConnectionInfo {
  /** Client address (IP:port for TCP, port name for RTU) */
  clientAddr: string;
  /** ISO 8601 timestamp when connected */
  connectedAt: string;
  /** Protocol used */
  protocol: 'tcp' | 'rtu';
}

interface ModbusState {
  /** Current Modbus server status */
  status: ModbusStatus | null;
  /** Whether a connection operation is in progress */
  isConnecting: boolean;
  /** Last error message */
  error: string | null;
  /** Cache of coil values by address */
  coilCache: Map<number, boolean>;
  /** Cache of discrete input values by address */
  discreteCache: Map<number, boolean>;
  /** Cache of holding register values by address */
  holdingRegisterCache: Map<number, number>;
  /** Cache of input register values by address */
  inputRegisterCache: Map<number, number>;
  /** List of active connections */
  connections: ConnectionInfo[];
}

interface ModbusActions {
  /** Fetch status from backend and update store */
  fetchStatus: () => Promise<void>;
  /** Directly set status (for event-based updates) */
  setStatus: (status: ModbusStatus) => void;
  /** Set error message */
  setError: (error: string | null) => void;
  /** Set connecting state */
  setConnecting: (connecting: boolean) => void;
  /** Update a single coil in the cache */
  updateCoilCache: (address: number, value: boolean) => void;
  /** Update multiple coils in the cache */
  updateCoilCacheBatch: (updates: Array<{ address: number; value: boolean }>) => void;
  /** Update a single discrete input in the cache */
  updateDiscreteCache: (address: number, value: boolean) => void;
  /** Update a single holding register in the cache */
  updateHoldingRegisterCache: (address: number, value: number) => void;
  /** Update multiple holding registers in the cache */
  updateHoldingRegisterCacheBatch: (updates: Array<{ address: number; value: number }>) => void;
  /** Update a single input register in the cache */
  updateInputRegisterCache: (address: number, value: number) => void;
  /** Clear all memory caches */
  clearCache: () => void;
  /** Add a new connection */
  addConnection: (conn: ConnectionInfo) => void;
  /** Remove a connection by client address */
  removeConnection: (clientAddr: string) => void;
  /** Set all connections (replace entire list) */
  setConnections: (conns: ConnectionInfo[]) => void;
  /** Handle connection event from backend */
  handleConnectionEvent: (event: ConnectionEvent) => void;
  /** Reset store to initial state */
  reset: () => void;
}

type ModbusStore = ModbusState & ModbusActions;

// ============================================================================
// Initial State
// ============================================================================

const initialState: ModbusState = {
  status: null,
  isConnecting: false,
  error: null,
  coilCache: new Map(),
  discreteCache: new Map(),
  holdingRegisterCache: new Map(),
  inputRegisterCache: new Map(),
  connections: [],
};

// ============================================================================
// Store
// ============================================================================

export const useModbusStore = create<ModbusStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      fetchStatus: async () => {
        set((state) => {
          state.error = null;
        }, false, 'fetchStatus/start');

        try {
          const status = await modbusService.getStatus();
          set((state) => {
            state.status = status;
          }, false, 'fetchStatus/success');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Failed to fetch Modbus status:', errorMessage);
          set((state) => {
            state.error = errorMessage;
          }, false, 'fetchStatus/error');
        }
      },

      setStatus: (status) => {
        set((state) => {
          state.status = status;
        }, false, 'setStatus');
      },

      setError: (error) => {
        set((state) => {
          state.error = error;
        }, false, 'setError');
      },

      setConnecting: (connecting) => {
        set((state) => {
          state.isConnecting = connecting;
        }, false, 'setConnecting');
      },

      updateCoilCache: (address, value) => {
        set((state) => {
          state.coilCache.set(address, value);
        }, false, `updateCoilCache/${address}`);
      },

      updateCoilCacheBatch: (updates) => {
        set((state) => {
          for (const { address, value } of updates) {
            state.coilCache.set(address, value);
          }
        }, false, 'updateCoilCacheBatch');
      },

      updateDiscreteCache: (address, value) => {
        set((state) => {
          state.discreteCache.set(address, value);
        }, false, `updateDiscreteCache/${address}`);
      },

      updateHoldingRegisterCache: (address, value) => {
        set((state) => {
          state.holdingRegisterCache.set(address, value);
        }, false, `updateHoldingRegisterCache/${address}`);
      },

      updateHoldingRegisterCacheBatch: (updates) => {
        set((state) => {
          for (const { address, value } of updates) {
            state.holdingRegisterCache.set(address, value);
          }
        }, false, 'updateHoldingRegisterCacheBatch');
      },

      updateInputRegisterCache: (address, value) => {
        set((state) => {
          state.inputRegisterCache.set(address, value);
        }, false, `updateInputRegisterCache/${address}`);
      },

      clearCache: () => {
        set((state) => {
          state.coilCache.clear();
          state.discreteCache.clear();
          state.holdingRegisterCache.clear();
          state.inputRegisterCache.clear();
        }, false, 'clearCache');
      },

      addConnection: (conn) => {
        set((state) => {
          // Avoid duplicates
          const exists = state.connections.some((c) => c.clientAddr === conn.clientAddr);
          if (!exists) {
            state.connections.push(conn);
          }
        }, false, 'addConnection');
      },

      removeConnection: (clientAddr) => {
        set((state) => {
          const index = state.connections.findIndex((c) => c.clientAddr === clientAddr);
          if (index !== -1) {
            state.connections.splice(index, 1);
          }
        }, false, 'removeConnection');
      },

      setConnections: (conns) => {
        set((state) => {
          state.connections = conns;
        }, false, 'setConnections');
      },

      handleConnectionEvent: (event) => {
        if (event.event_type === 'connected') {
          get().addConnection({
            clientAddr: event.client_addr,
            connectedAt: event.timestamp,
            protocol: event.protocol,
          });
        } else if (event.event_type === 'disconnected') {
          get().removeConnection(event.client_addr);
        }
      },

      reset: () => {
        set(() => ({
          ...initialState,
          // Create new Map instances to avoid reference issues
          coilCache: new Map(),
          discreteCache: new Map(),
          holdingRegisterCache: new Map(),
          inputRegisterCache: new Map(),
          connections: [],
        }), false, 'reset');
      },
    })),
    { name: 'modbus-store' }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/** Select the current Modbus status */
export const selectStatus = (state: ModbusStore) => state.status;

/** Select whether a connection operation is in progress */
export const selectIsConnecting = (state: ModbusStore) => state.isConnecting;

/** Select the current error message */
export const selectError = (state: ModbusStore) => state.error;

/** Select whether TCP server is running */
export const selectTcpRunning = (state: ModbusStore) => state.status?.tcp_running ?? false;

/** Select whether RTU server is running */
export const selectRtuRunning = (state: ModbusStore) => state.status?.rtu_running ?? false;

/** Select the TCP port if server is running */
export const selectTcpPort = (state: ModbusStore) => state.status?.tcp_port;

/** Select the RTU port if server is running */
export const selectRtuPort = (state: ModbusStore) => state.status?.rtu_port;

/** Select the number of active TCP connections */
export const selectTcpConnectionCount = (state: ModbusStore) => state.status?.tcp_connections ?? 0;

/** Select all active connections */
export const selectConnections = (state: ModbusStore) => state.connections;

/** Select a coil value from cache */
export const selectCoil = (address: number) => (state: ModbusStore) =>
  state.coilCache.get(address);

/** Select a discrete input value from cache */
export const selectDiscreteInput = (address: number) => (state: ModbusStore) =>
  state.discreteCache.get(address);

/** Select a holding register value from cache */
export const selectHoldingRegister = (address: number) => (state: ModbusStore) =>
  state.holdingRegisterCache.get(address);

/** Select an input register value from cache */
export const selectInputRegister = (address: number) => (state: ModbusStore) =>
  state.inputRegisterCache.get(address);

export default useModbusStore;
