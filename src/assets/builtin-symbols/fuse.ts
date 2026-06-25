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
  width: 20,
  height: 30,
  graphics: [
    { kind: 'polyline', points: [{ x: 10, y: 0 }, { x: 10, y: 30 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'rect', x: 6, y: 7.5, width: 8, height: 15, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
  ],
  pins: [
    { id: 'in', name: 'LINE', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 10, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'LOAD', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 10, y: 30 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'F1', type: 'string', visible: true, editorType: 'text' },
    { key: 'fuseType', value: 'fuse', type: 'enum', visible: true, editorType: 'select', options: ['fuse', 'mcb', 'mpcb'] },
    { key: 'ratingAmps', value: 10, type: 'number', visible: true, editorType: 'number' },
    { key: 'tripped', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
