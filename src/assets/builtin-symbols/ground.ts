import type { SymbolDefinition } from '@/types/symbol';

export const groundSymbol: SymbolDefinition = {
  id: 'builtin:ground',
  name: 'Ground',
  version: '1.0.0',
  description: 'Reference ground node',
  category: 'power',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 20,
  height: 20,
  graphics: [
    { kind: 'polyline', points: [{ x: 10, y: 2 }, { x: 10, y: 6 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 4, y: 8 }, { x: 16, y: 8 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 6, y: 11 }, { x: 14, y: 11 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 8, y: 14 }, { x: 12, y: 14 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'in', name: 'GND', number: '1', type: 'power', electricalType: 'power_in', functionalRole: 'general', shape: 'line', position: { x: 10, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'GND1', type: 'string', visible: true, editorType: 'text' },
    { key: 'netName', value: '0V', type: 'string', visible: true, editorType: 'text' },
  ],
};
