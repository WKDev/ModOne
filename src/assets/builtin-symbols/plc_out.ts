import type { SymbolDefinition } from '@/types/symbol';

export const plcOutSymbol: SymbolDefinition = {
  id: 'builtin:plc_out',
  name: 'PLC Output',
  version: '1.0.0',
  description: 'PLC digital output channel',
  category: 'plc',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 40,
  height: 20,
  graphics: [
    { kind: 'polyline', points: [{ x: 0, y: 10 }, { x: 5, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { kind: 'rect', x: 5, y: 3, width: 30, height: 14, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'text', x: 20, y: 12, text: 'Q', fontSize: 7, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
    { kind: 'polyline', points: [{ x: 35, y: 10 }, { x: 40, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'input', electricalType: 'input', functionalRole: 'plc_input', shape: 'line', position: { x: 0, y: 10 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'output', electricalType: 'output', functionalRole: 'plc_output', shape: 'line', position: { x: 40, y: 10 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  behavior: {
    templateId: 'archetype:switch',
    archetype: 'switch',
    interactionMode: 'maintained',
    deviceScoped: false,
    terminalRoles: { in: 'IN', out: 'OUT' },
  },
  properties: [
    { key: 'address', value: 'C:0x0000', type: 'string', visible: true, editorType: 'text' },
    { key: 'normallyOpen', value: true, type: 'boolean', visible: true, editorType: 'checkbox' },
    { key: 'inverted', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};

