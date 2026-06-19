import type { RibbonTabConfig } from '../types';

export const integrationRibbonTab: RibbonTabConfig = {
  id: 'integration',
  label: 'Integration (Modbus / OPC UA)',
  groups: [
    {
      id: 'integration-modbus',
      title: 'Modbus',
      actions: [
        { id: 'modbus-tcp-start', label: 'TCP Start', commandId: 'modbus.startTcp', icon: 'play', disabled: (ctx) => ctx.modbusTcpRunning },
        { id: 'modbus-tcp-stop', label: 'TCP Stop', commandId: 'modbus.stopTcp', icon: 'square', disabled: (ctx) => !ctx.modbusTcpRunning },
        { id: 'modbus-rtu-start', label: 'RTU Start', commandId: 'modbus.startRtu', icon: 'usb' },
        { id: 'modbus-rtu-stop', label: 'RTU Stop', commandId: 'modbus.stopRtu', icon: 'usb' },
      ],
    },
    {
      id: 'integration-opcua',
      title: 'OPC UA',
      actions: [
        { id: 'opcua-start', label: 'Start', commandId: 'opcua.startServer', icon: 'play', disabled: (ctx) => ctx.opcuaRunning },
        { id: 'opcua-stop', label: 'Stop', commandId: 'opcua.stopServer', icon: 'square', disabled: (ctx) => !ctx.opcuaRunning },
        { id: 'opcua-endpoint', label: 'Endpoint', commandId: 'opcua.copyEndpoint', icon: 'database', disabled: (ctx) => !ctx.opcuaRunning },
        { id: 'opcua-panel', label: 'Panel', commandId: 'opcua.showPanel', icon: 'panelLeft' },
      ],
    },
  ],
};
