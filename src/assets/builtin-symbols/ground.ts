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
  width: 40,
  height: 40,
  graphics: [
    { kind: 'polyline', points: [{ x: 20, y: 4 }, { x: 20, y: 12 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 8, y: 16 }, { x: 32, y: 16 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 12, y: 22 }, { x: 28, y: 22 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 16, y: 28 }, { x: 24, y: 28 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'in', name: 'GND', number: '1', type: 'power', electricalType: 'power_in', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'GND1', type: 'string', visible: true, editorType: 'text' },
    { key: 'netName', value: '0V', type: 'string', visible: true, editorType: 'text' },
  ],
};
