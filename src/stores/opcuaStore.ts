/**
 * OPC UA Store - Zustand State Management for OPC UA Operations
 *
 * Manages OPC UA server status, lifecycle state, and error handling.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { opcuaService } from '../services/opcuaService';
import { useLayoutStore } from './layoutStore';
import type { OpcUaStatus } from '../types/project';

// ============================================================================
// Types
// ============================================================================

interface OpcUaState {
  /** Current OPC UA server status */
  status: OpcUaStatus | null;
  /** Whether a start operation is in progress */
  isStarting: boolean;
  /** Whether a stop operation is in progress */
  isStopping: boolean;
  /** Last error message */
  error: string | null;
}

interface OpcUaActions {
  /** Fetch status from backend and update store */
  fetchStatus: () => Promise<void>;
  /** Directly set status (for event-based updates) */
  setStatus: (status: OpcUaStatus) => void;
  /** Start the OPC UA server with project settings */
  startServer: (config?: {
    port?: number;
    server_name?: string;
    username?: string | null;
    password?: string | null;
  }) => Promise<void>;
  /** Stop the OPC UA server */
  stopServer: () => Promise<void>;
  /** Set error message */
  setError: (error: string | null) => void;
  /** Reset store to initial state */
  reset: () => void;
}

type OpcUaStore = OpcUaState & OpcUaActions;

// ============================================================================
// Helpers
// ============================================================================

/** Sync layoutStore with OPC UA status */
function syncLayoutStore(status: OpcUaStatus) {
  const { setOpcuaRunning, setOpcuaPort } = useLayoutStore.getState();
  setOpcuaRunning(status.running);
  setOpcuaPort(status.port);
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: OpcUaState = {
  status: null,
  isStarting: false,
  isStopping: false,
  error: null,
};

// ============================================================================
// Store
// ============================================================================

export const useOpcUaStore = create<OpcUaStore>()(
  devtools(
    immer((set) => ({
      // Initial state
      ...initialState,

      // Actions
      fetchStatus: async () => {
        set((state) => {
          state.error = null;
        }, false, 'fetchStatus/start');

        try {
          const status = await opcuaService.getStatus();
          set((state) => {
            state.status = status;
          }, false, 'fetchStatus/success');
          syncLayoutStore(status);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Failed to fetch OPC UA status:', errorMessage);
          set((state) => {
            state.error = errorMessage;
          }, false, 'fetchStatus/error');
        }
      },

      setStatus: (status) => {
        set((state) => {
          state.status = status;
        }, false, 'setStatus');
        syncLayoutStore(status);
      },

      startServer: async (config) => {
        set((state) => {
          state.isStarting = true;
          state.error = null;
        }, false, 'startServer/start');

        try {
          const status = await opcuaService.startServer({
            port: config?.port ?? 4840,
            server_name: config?.server_name ?? 'ModOne PLC Simulator',
            username: config?.username,
            password: config?.password,
          });
          set((state) => {
            state.status = status;
            state.isStarting = false;
          }, false, 'startServer/success');
          syncLayoutStore(status);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          set((state) => {
            state.isStarting = false;
            state.error = errorMessage;
          }, false, 'startServer/error');
        }
      },

      stopServer: async () => {
        set((state) => {
          state.isStopping = true;
          state.error = null;
        }, false, 'stopServer/start');

        try {
          await opcuaService.stopServer();
          set((state) => {
            state.status = null;
            state.isStopping = false;
          }, false, 'stopServer/success');
          const { setOpcuaRunning } = useLayoutStore.getState();
          setOpcuaRunning(false);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          set((state) => {
            state.isStopping = false;
            state.error = errorMessage;
          }, false, 'stopServer/error');
        }
      },

      setError: (error) => {
        set((state) => {
          state.error = error;
        }, false, 'setError');
      },

      reset: () => {
        set(() => ({ ...initialState }), false, 'reset');
      },
    })),
    { name: 'opcua-store' }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/** Select the current OPC UA status */
export const selectStatus = (state: OpcUaStore) => state.status;

/** Select whether the server is running */
export const selectRunning = (state: OpcUaStore) => state.status?.running ?? false;

/** Select the full endpoint URL */
export const selectEndpoint = (state: OpcUaStore) => state.status?.endpoint ?? '';

/** Select the session count */
export const selectSessionCount = (state: OpcUaStore) => state.status?.sessionCount ?? 0;

/** Select whether session counting is supported */
export const selectSessionCountSupported = (state: OpcUaStore) =>
  state.status?.sessionCountSupported ?? false;

/** Select the certificate fingerprint */
export const selectCertificateFingerprint = (state: OpcUaStore) =>
  state.status?.certificateFingerprint ?? null;

/** Select the certificate valid-to date */
export const selectCertificateValidTo = (state: OpcUaStore) =>
  state.status?.certificateValidTo ?? null;

/** Select whether the OPC UA feature is enabled */
export const selectFeatureEnabled = (state: OpcUaStore) =>
  state.status?.featureEnabled ?? true;

/** Select whether a start operation is in progress */
export const selectIsStarting = (state: OpcUaStore) => state.isStarting;

/** Select whether a stop operation is in progress */
export const selectIsStopping = (state: OpcUaStore) => state.isStopping;

/** Select the current error message */
export const selectError = (state: OpcUaStore) => state.error;

export default useOpcUaStore;
