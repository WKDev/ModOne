/**
 * Modbus Commands
 *
 * Commands for Modbus server control: start/stop TCP and RTU servers.
 * Uses the project manifest defaults and the shared modbusStore status.
 */

import { Wifi, WifiOff, Usb, Info } from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import { useModbusStore } from '../../../stores/modbusStore';
import { useProjectStore } from '../../../stores/projectStore';
import type { Command } from '../types';

function getTcpDefaults() {
  const project = useProjectStore.getState().currentProject;
  const simulation = project?.config.modbus.simulation;
  const fallbackAddress = simulation?.address?.trim() || '127.0.0.1:502';
  const match = fallbackAddress.match(/^(.*):(\d+)$/);
  const bindAddress = match?.[1]?.trim() || '127.0.0.1';
  const parsedPort = match ? Number.parseInt(match[2], 10) : Number.NaN;

  return {
    bind_address: bindAddress,
    port: Number.isFinite(parsedPort) ? parsedPort : 502,
    unit_id: simulation?.unit_id ?? 1,
  };
}

function getRtuDefaults() {
  const project = useProjectStore.getState().currentProject;
  const simulation = project?.config.modbus.simulation;

  return {
    com_port: simulation?.com_port?.trim() || 'COM1',
    baud_rate: simulation?.baud_rate ?? 9600,
    data_bits: 'Eight' as const,
    stop_bits: (simulation?.stop_bits ?? 1) === 2 ? ('Two' as const) : ('One' as const),
    parity: simulation?.parity ?? 'None',
    unit_id: simulation?.unit_id ?? 1,
  };
}

/**
 * Register all modbus-related commands.
 */
export function registerModbusCommands(): void {
  const commands: Command[] = [
    {
      id: 'modbus.startTcp',
      category: 'modbus',
      label: 'Start Modbus TCP Server',
      description: 'Start the Modbus TCP server with default settings',
      icon: <Wifi size={16} />,
      keywords: ['modbus', 'tcp', 'start', 'server', 'network'],
      when: () => !useModbusStore.getState().status?.tcp_running,
      execute: async () => {
        try {
          await useModbusStore.getState().startTcp(getTcpDefaults());
        } catch (error) {
          console.error('Failed to start Modbus TCP server:', error);
        }
      },
    },
    {
      id: 'modbus.stopTcp',
      category: 'modbus',
      label: 'Stop Modbus TCP Server',
      description: 'Stop the Modbus TCP server',
      icon: <WifiOff size={16} />,
      keywords: ['modbus', 'tcp', 'stop', 'server', 'network'],
      when: () => useModbusStore.getState().status?.tcp_running ?? false,
      execute: async () => {
        try {
          await useModbusStore.getState().stopTcp();
        } catch (error) {
          console.error('Failed to stop Modbus TCP server:', error);
        }
      },
    },
    {
      id: 'modbus.startRtu',
      category: 'modbus',
      label: 'Start Modbus RTU Server',
      description: 'Start the Modbus RTU server (requires serial port configuration)',
      icon: <Usb size={16} />,
      keywords: ['modbus', 'rtu', 'start', 'serial', 'port'],
      execute: async () => {
        try {
          await useModbusStore.getState().startRtu(getRtuDefaults());
        } catch (error) {
          console.error('Failed to start Modbus RTU server:', error);
        }
      },
    },
    {
      id: 'modbus.stopRtu',
      category: 'modbus',
      label: 'Stop Modbus RTU Server',
      description: 'Stop the Modbus RTU server',
      icon: <Usb size={16} />,
      keywords: ['modbus', 'rtu', 'stop', 'serial', 'port'],
      execute: async () => {
        try {
          await useModbusStore.getState().stopRtu();
        } catch (error) {
          console.error('Failed to stop Modbus RTU server:', error);
        }
      },
    },
    {
      id: 'modbus.status',
      category: 'modbus',
      label: 'Modbus Status',
      description: 'Show the current status of Modbus servers',
      icon: <Info size={16} />,
      keywords: ['modbus', 'status', 'info', 'connection'],
      execute: async () => {
        try {
          const status = await useModbusStore.getState().fetchStatus().then(() => useModbusStore.getState().status);
          console.log('Modbus Status:', status);
          // In a full implementation, this would show a status dialog or notification
        } catch (error) {
          console.error('Failed to get Modbus status:', error);
        }
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
