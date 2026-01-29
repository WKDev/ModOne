/**
 * useCanvasSync Hook
 *
 * React hook for synchronizing OneSim DeviceMemory with OneCanvas circuit simulation.
 * Handles PLC block mappings and provides controls for sync operations.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// Types
// ============================================================================

/** PLC block type */
export type PlcBlockType = 'plcOut' | 'plcIn';

/** PLC block mapping configuration */
export interface PlcBlockMapping {
  /** Canvas block unique ID */
  blockId: string;
  /** Type of PLC block */
  blockType: PlcBlockType;
  /** Device type (M, P, K, etc.) */
  deviceType: string;
  /** Device address number */
  address: number;
  /** For contacts: normally open (true) or normally closed (false) */
  normallyOpen?: boolean;
  /** Whether to invert the output state */
  inverted?: boolean;
  /** Optional label for display */
  label?: string;
}

/** Single PLC output update from backend */
export interface PlcOutputUpdate {
  /** Canvas block ID */
  blockId: string;
  /** Current state (true = ON/closed, false = OFF/open) */
  state: boolean;
  /** Optional current value for display */
  value?: string;
}

/** Batch PLC output updates event payload */
export interface PlcOutputsEvent {
  /** List of output updates */
  updates: PlcOutputUpdate[];
  /** Timestamp (epoch ms) */
  timestamp: number;
}

/** PLC input change to send to backend */
export interface PlcInputChange {
  /** Canvas block ID */
  blockId: string;
  /** Circuit state (true = energized, false = not energized) */
  state: boolean;
}

/** Canvas sync status */
export interface CanvasSyncStatus {
  /** Whether sync is enabled */
  enabled: boolean;
  /** Number of registered mappings */
  mappingCount: number;
  /** Number of PlcOut mappings */
  plcOutCount: number;
  /** Number of PlcIn mappings */
  plcInCount: number;
  /** Number of output updates sent */
  outputUpdateCount: number;
  /** Number of input changes processed */
  inputChangeCount: number;
}

/** Mapping summary from backend */
export interface MappingSummary {
  /** Canvas block ID */
  blockId: string;
  /** Block type: "plcOut" or "plcIn" */
  blockType: string;
  /** Device address string (e.g., "M0", "P100") */
  deviceAddress: string;
  /** Optional label */
  label?: string;
}

/** Hook options */
export interface UseCanvasSyncOptions {
  /** Whether to auto-initialize on mount */
  autoInit?: boolean;
  /** Callback when output updates are received */
  onOutputUpdate?: (updates: PlcOutputUpdate[]) => void;
}

/** Hook return type */
export interface UseCanvasSyncResult {
  /** Whether canvas sync is enabled */
  isEnabled: boolean;
  /** Current status */
  status: CanvasSyncStatus | null;
  /** Current mappings */
  mappings: MappingSummary[];
  /** Most recent output updates */
  outputUpdates: PlcOutputUpdate[];
  /** Error message if any */
  error: string | null;
  /** Initialize canvas sync */
  init: () => Promise<void>;
  /** Shutdown canvas sync */
  shutdown: () => Promise<void>;
  /** Register a single mapping */
  registerMapping: (mapping: PlcBlockMapping) => Promise<void>;
  /** Register multiple mappings */
  registerMappings: (mappings: PlcBlockMapping[]) => Promise<number>;
  /** Remove a mapping */
  removeMapping: (blockId: string) => Promise<void>;
  /** Clear all mappings */
  clearMappings: () => Promise<void>;
  /** Get current mappings from backend */
  refreshMappings: () => Promise<void>;
  /** Get current status from backend */
  refreshStatus: () => Promise<void>;
  /** Handle PLC input change (circuit state to device memory) */
  handleInputChange: (blockId: string, state: boolean) => Promise<void>;
  /** Handle multiple PLC input changes */
  handleInputChanges: (changes: PlcInputChange[]) => Promise<number>;
  /** Force update all outputs */
  forceUpdateOutputs: () => Promise<number>;
  /** Reset statistics */
  resetStats: () => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for OneCanvas ↔ OneSim synchronization
 */
export function useCanvasSync(options: UseCanvasSyncOptions = {}): UseCanvasSyncResult {
  const { autoInit = false, onOutputUpdate } = options;

  // State
  const [isEnabled, setIsEnabled] = useState(false);
  const [status, setStatus] = useState<CanvasSyncStatus | null>(null);
  const [mappings, setMappings] = useState<MappingSummary[]>([]);
  const [outputUpdates, setOutputUpdates] = useState<PlcOutputUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const onOutputUpdateRef = useRef(onOutputUpdate);

  // Keep callback ref updated
  useEffect(() => {
    onOutputUpdateRef.current = onOutputUpdate;
  }, [onOutputUpdate]);

  // Initialize canvas sync
  const init = useCallback(async () => {
    try {
      setError(null);
      await invoke('canvas_sync_init');
      setIsEnabled(true);

      // Subscribe to PLC outputs event
      if (unlistenRef.current) {
        unlistenRef.current();
      }
      unlistenRef.current = await listen<PlcOutputsEvent>('sim:plc-outputs', (event) => {
        const { updates } = event.payload;
        setOutputUpdates(updates);
        onOutputUpdateRef.current?.(updates);
      });

      // Refresh status and mappings
      await refreshStatus();
      await refreshMappings();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, []);

  // Shutdown canvas sync
  const shutdown = useCallback(async () => {
    try {
      // Unsubscribe from events
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }

      await invoke('canvas_sync_shutdown');
      setIsEnabled(false);
      setStatus(null);
      setMappings([]);
      setOutputUpdates([]);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, []);

  // Register a single mapping
  const registerMapping = useCallback(async (mapping: PlcBlockMapping) => {
    try {
      setError(null);
      await invoke('canvas_sync_register_mapping', {
        mapping: {
          blockId: mapping.blockId,
          blockType: mapping.blockType,
          deviceType: mapping.deviceType,
          address: mapping.address,
          normallyOpen: mapping.normallyOpen ?? true,
          inverted: mapping.inverted ?? false,
          label: mapping.label,
        },
      });
      await refreshMappings();
      await refreshStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, []);

  // Register multiple mappings
  const registerMappings = useCallback(async (mappingsList: PlcBlockMapping[]): Promise<number> => {
    try {
      setError(null);
      const mappingsData = mappingsList.map((m) => ({
        blockId: m.blockId,
        blockType: m.blockType,
        deviceType: m.deviceType,
        address: m.address,
        normallyOpen: m.normallyOpen ?? true,
        inverted: m.inverted ?? false,
        label: m.label,
      }));
      const count = await invoke<number>('canvas_sync_register_mappings', {
        mappings: mappingsData,
      });
      await refreshMappings();
      await refreshStatus();
      return count;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, []);

  // Remove a mapping
  const removeMapping = useCallback(async (blockId: string) => {
    try {
      setError(null);
      await invoke('canvas_sync_remove_mapping', { blockId });
      await refreshMappings();
      await refreshStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, []);

  // Clear all mappings
  const clearMappings = useCallback(async () => {
    try {
      setError(null);
      await invoke('canvas_sync_clear_mappings');
      setMappings([]);
      await refreshStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, []);

  // Refresh mappings from backend
  const refreshMappings = useCallback(async () => {
    try {
      const result = await invoke<MappingSummary[]>('canvas_sync_get_mappings');
      setMappings(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, []);

  // Refresh status from backend
  const refreshStatus = useCallback(async () => {
    try {
      const result = await invoke<CanvasSyncStatus>('canvas_sync_get_status');
      setStatus(result);
      setIsEnabled(result.enabled);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, []);

  // Handle single PLC input change
  const handleInputChange = useCallback(async (blockId: string, state: boolean) => {
    try {
      setError(null);
      await invoke('canvas_sync_handle_input', { blockId, stateValue: state });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, []);

  // Handle multiple PLC input changes
  const handleInputChanges = useCallback(async (changes: PlcInputChange[]): Promise<number> => {
    try {
      setError(null);
      const count = await invoke<number>('canvas_sync_handle_inputs', { changes });
      return count;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, []);

  // Force update all outputs
  const forceUpdateOutputs = useCallback(async (): Promise<number> => {
    try {
      setError(null);
      const count = await invoke<number>('canvas_sync_force_update_outputs');
      return count;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, []);

  // Reset statistics
  const resetStats = useCallback(async () => {
    try {
      await invoke('canvas_sync_reset_stats');
      await refreshStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, []);

  // Auto-init on mount if enabled
  useEffect(() => {
    if (autoInit) {
      init().catch(console.error);
    }

    // Cleanup on unmount
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [autoInit, init]);

  return {
    isEnabled,
    status,
    mappings,
    outputUpdates,
    error,
    init,
    shutdown,
    registerMapping,
    registerMappings,
    removeMapping,
    clearMappings,
    refreshMappings,
    refreshStatus,
    handleInputChange,
    handleInputChanges,
    forceUpdateOutputs,
    resetStats,
  };
}

export default useCanvasSync;
