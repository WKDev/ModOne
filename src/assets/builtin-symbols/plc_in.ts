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
  width: 80,
  height: 40,
  graphics: [
    { kind: 'polyline', points: [{ x: 0, y: 20 }, { x: 10, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'rect', x: 10, y: 6, width: 60, height: 28, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'text', x: 40, y: 24, text: 'I', fontSize: 14, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
    { kind: 'polyline', points: [{ x: 70, y: 20 }, { x: 80, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'input', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0 },
    { id: 'out', name: 'OUT', number: '2', type: 'output', shape: 'line', position: { x: 80, y: 20 }, orientation: 'right', length: 0 },
  ],
  properties: [
    { key: 'address', value: 'DI:0x0000', type: 'string', visible: true, editorType: 'text' },
    { key: 'thresholdVoltage', value: 12, type: 'number', visible: true, editorType: 'number' },
    { key: 'inverted', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
