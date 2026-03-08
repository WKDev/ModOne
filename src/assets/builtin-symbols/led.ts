import type { SymbolDefinition } from '@/types/symbol';

export const ledSymbol: SymbolDefinition = {
  id: 'builtin:led',
  name: 'LED',
  version: '1.0.0',
  description: 'Light emitting diode',
  category: 'indicator',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 40,
  height: 60,
  graphics: [
    { kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 10, y: 20 }, { x: 30, y: 20 }, { x: 20, y: 34 }, { x: 10, y: 20 }], stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 10, y: 38 }, { x: 30, y: 38 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 24, y: 15 }, { x: 30, y: 9 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 28, y: 19 }, { x: 34, y: 13 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 20, y: 38 }, { x: 20, y: 60 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'anode', name: '+', number: 'A', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'cathode', name: '-', number: 'K', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 60 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'color', value: 'red', type: 'string', visible: true, editorType: 'text' },
    { key: 'forwardVoltage', value: 2, type: 'number', visible: true, editorType: 'number' },
    { key: 'lit', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
