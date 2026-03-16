import { useEffect } from 'react';
import { modbusService } from '../services/modbusService';
import { useModbusStore } from '../stores/modbusStore';

/**
 * Centralizes Modbus status fetch + connection event subscription.
 */
export function useModbusInit() {
  const { fetchStatus, handleConnectionEvent } = useModbusStore();

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    fetchStatus();

    modbusService.onConnectionEvent((event) => {
      handleConnectionEvent(event);
      void fetchStatus();
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [fetchStatus, handleConnectionEvent]);
}

export default useModbusInit;
