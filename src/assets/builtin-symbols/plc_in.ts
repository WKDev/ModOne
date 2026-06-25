import type { SymbolDefinition } from '@/types/symbol';

export const plcInSymbol: SymbolDefinition = {
  id: 'builtin:plc_in',
  name: 'PLC Input',
  version: '1.0.0',
  description: 'PLC digital input channel',
  category: 'plc',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 40,
  height: 20,
  graphics: [
    { kind: 'polyline', points: [{ x: 0, y: 10 }, { x: 5, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { kind: 'rect', x: 5, y: 3, width: 30, height: 14, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'text', x: 20, y: 12, text: 'I', fontSize: 7, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
    { kind: 'polyline', points: [{ x: 35, y: 10 }, { x: 40, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'input', electricalType: 'input', functionalRole: 'plc_input', shape: 'line', position: { x: 0, y: 10 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'output', electricalType: 'output', functionalRole: 'plc_output', shape: 'line', position: { x: 40, y: 10 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'address', value: 'DI:0x0000', type: 'string', visible: true, editorType: 'text' },
    { key: 'thresholdVoltage', value: 12, type: 'number', visible: true, editorType: 'number' },
    { key: 'inverted', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
