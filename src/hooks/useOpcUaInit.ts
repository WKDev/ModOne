/**
 * OPC UA Initialization Hook
 *
 * Centralizes OPC UA status event subscription.
 * Call once in App.tsx to keep opcuaStore in sync with backend events.
 */

import { useEffect } from 'react';
import { useOpcUaStore } from '../stores/opcuaStore';
import { opcuaService } from '../services/opcuaService';

export function useOpcUaInit() {
  const { fetchStatus, setStatus } = useOpcUaStore();

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    // Initial status fetch
    fetchStatus();

    // Subscribe to status update events
    opcuaService.onStatusUpdate((status) => {
      setStatus(status);
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [fetchStatus, setStatus]);
}
