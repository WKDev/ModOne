import type { SymbolDefinition } from '@/types/symbol';

export const powersourceSymbol: SymbolDefinition = {
  id: 'builtin:powersource',
  name: 'Power Source',
  version: '1.0.0',
  description: 'DC power source',
  category: 'power',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 20,
  height: 20,
  graphics: [
    { kind: 'polyline', points: [{ x: 4, y: 8 }, { x: 16, y: 8 }], stroke: '#ef4444', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 7, y: 12 }, { x: 13, y: 12 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 10, y: 8 }, { x: 10, y: 2 }], stroke: '#ef4444', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 10, y: 12 }, { x: 10, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'out', name: '+', number: '1', type: 'output', electricalType: 'power_out', functionalRole: 'general', shape: 'line', position: { x: 10, y: 20 }, orientation: 'down', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'voltage', value: 24, type: 'number', visible: true, editorType: 'number' },
    { key: 'polarity', value: 'positive', type: 'string', visible: true, editorType: 'text' },
    { key: 'maxCurrent', value: 1000, type: 'number', visible: true, editorType: 'number' },
  ],
};
