/**
 * OPC UA Commands
 *
 * Commands for OPC UA server control: start/stop server, copy endpoint, show panel.
 */

import { Radio, Square, Copy, PanelLeft } from 'lucide-react';
import { toast } from 'sonner';
import { commandRegistry } from '../commandRegistry';
import { useOpcUaStore } from '../../../stores/opcuaStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { useSidebarStore } from '../../../stores/sidebarStore';
import type { Command } from '../types';

/**
 * Register all OPC UA-related commands.
 */
export function registerOpcUaCommands(): void {
  const commands: Command[] = [
    {
      id: 'opcua.startServer',
      category: 'opcua',
      label: 'Start OPC UA Server',
      description: 'Start the OPC UA server with project settings',
      icon: <Radio size={16} />,
      keywords: ['opcua', 'opc', 'ua', 'start', 'server'],
      when: () => !useLayoutStore.getState().opcuaRunning,
      execute: async () => {
        try {
          await useOpcUaStore.getState().startServer();
        } catch (error) {
          console.error('Failed to start OPC UA server:', error);
        }
      },
    },
    {
      id: 'opcua.stopServer',
      category: 'opcua',
      label: 'Stop OPC UA Server',
      description: 'Stop the OPC UA server',
      icon: <Square size={16} />,
      keywords: ['opcua', 'opc', 'ua', 'stop', 'server'],
      when: () => useLayoutStore.getState().opcuaRunning,
      execute: async () => {
        try {
          await useOpcUaStore.getState().stopServer();
        } catch (error) {
          console.error('Failed to stop OPC UA server:', error);
        }
      },
    },
    {
      id: 'opcua.copyEndpoint',
      category: 'opcua',
      label: 'Copy OPC UA Endpoint',
      description: 'Copy the OPC UA endpoint URL to clipboard',
      icon: <Copy size={16} />,
      keywords: ['opcua', 'opc', 'ua', 'endpoint', 'url', 'copy', 'clipboard'],
      when: () => useLayoutStore.getState().opcuaRunning,
      execute: async () => {
        const status = useOpcUaStore.getState().status;
        if (status?.endpoint) {
          await navigator.clipboard.writeText(status.endpoint);
          toast.success('OPC UA Endpoint URL 복사됨');
        }
      },
    },
    {
      id: 'opcua.showPanel',
      category: 'opcua',
      label: 'Show OPC UA Panel',
      description: 'Open the OPC UA sidebar panel',
      icon: <PanelLeft size={16} />,
      keywords: ['opcua', 'opc', 'ua', 'panel', 'sidebar', 'show'],
      execute: async () => {
        useSidebarStore.getState().showPanel('opcua');
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
