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
  width: 40,
  height: 40,
  graphics: [
    { kind: 'polyline', points: [{ x: 8, y: 16 }, { x: 32, y: 16 }], stroke: '#ef4444', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 14, y: 24 }, { x: 26, y: 24 }], stroke: '#888', fill: 'none', strokeWidth: 4 },
    { kind: 'polyline', points: [{ x: 20, y: 16 }, { x: 20, y: 4 }], stroke: '#ef4444', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 20, y: 24 }, { x: 20, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'out', name: '+', number: '1', type: 'output', electricalType: 'power_out', functionalRole: 'general', shape: 'line', position: { x: 20, y: 40 }, orientation: 'down', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'voltage', value: 24, type: 'number', visible: true, editorType: 'number' },
    { key: 'polarity', value: 'positive', type: 'string', visible: true, editorType: 'text' },
    { key: 'maxCurrent', value: 1000, type: 'number', visible: true, editorType: 'number' },
  ],
};
