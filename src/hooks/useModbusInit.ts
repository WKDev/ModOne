import { useEffect } from 'react';
import { modbusService } from '../services/modbusService';
import { useModbusStore } from '../stores/modbusStore';
import { useModbusTrafficStore } from '../stores/modbusTrafficStore';

/**
 * Centralizes Modbus status fetch + connection/traffic event subscription.
 */
export function useModbusInit() {
  const { fetchStatus, handleConnectionEvent } = useModbusStore();

  useEffect(() => {
    let unlistenConnection: (() => void) | undefined;
    let unlistenTraffic: (() => void) | undefined;

    fetchStatus();

    modbusService.onConnectionEvent((event) => {
      handleConnectionEvent(event);
      void fetchStatus();
    }).then((dispose) => {
      unlistenConnection = dispose;
    });

    const appendTraffic = useModbusTrafficStore.getState().appendTraffic;
    modbusService.onTrafficEvent((event) => {
      appendTraffic(event);
    }).then((dispose) => {
      unlistenTraffic = dispose;
    });

    return () => {
      unlistenConnection?.();
      unlistenTraffic?.();
    };
  }, [fetchStatus, handleConnectionEvent]);
}

export default useModbusInit;
