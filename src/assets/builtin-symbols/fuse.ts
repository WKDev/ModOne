import type { SymbolDefinition } from '@/types/symbol';

export const fuseSymbol: SymbolDefinition = {
  id: 'builtin:fuse',
  name: 'Fuse',
  version: '1.0.0',
  description: 'Fuse / circuit breaker protection element',
  category: 'protection',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 40,
  height: 50,
  graphics: [
    { kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 15 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'rect', x: 8, y: 15, width: 24, height: 20, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 12, y: 25 }, { x: 28, y: 25 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 20, y: 35 }, { x: 20, y: 50 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'in', name: 'LINE', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'LOAD', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 50 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'F1', type: 'string', visible: true, editorType: 'text' },
    { key: 'fuseType', value: 'fuse', type: 'enum', visible: true, editorType: 'select', options: ['fuse', 'mcb', 'mpcb'] },
    { key: 'ratingAmps', value: 10, type: 'number', visible: true, editorType: 'number' },
    { key: 'tripped', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
