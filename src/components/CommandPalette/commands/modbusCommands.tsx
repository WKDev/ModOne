/**
 * Modbus Commands
 *
 * Commands for Modbus server control: start/stop TCP and RTU servers.
 * Uses modbusService for Tauri backend integration and layoutStore for status.
 */

import { Wifi, WifiOff, Usb, Info } from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import { modbusService } from '../../../services/modbusService';
import { useLayoutStore } from '../../../stores/layoutStore';
import type { Command } from '../types';

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
      when: () => !useLayoutStore.getState().modbusConnected,
      execute: async () => {
        try {
          await modbusService.startTcp();
          useLayoutStore.getState().setModbusConnected(true);
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
      when: () => useLayoutStore.getState().modbusConnected,
      execute: async () => {
        try {
          await modbusService.stopTcp();
          useLayoutStore.getState().setModbusConnected(false);
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
          // RTU requires configuration - for now use defaults
          // In a full implementation, this would open a config dialog
          await modbusService.startRtu({
            com_port: 'COM1',
            baud_rate: 9600,
            data_bits: 'Eight',
            stop_bits: 'One',
            parity: 'None',
            unit_id: 1,
          });
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
          await modbusService.stopRtu();
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
          const status = await modbusService.getStatus();
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
