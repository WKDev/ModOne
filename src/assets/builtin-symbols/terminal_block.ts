import type { SymbolDefinition } from '@/types/symbol';

export const terminalBlockSymbol: SymbolDefinition = {
  id: 'builtin:terminal_block',
  name: 'Terminal Block',
  version: '1.0.0',
  description: 'Feed-through terminal block',
  category: 'connection',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 40,
  height: 60,
  graphics: [
    { kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 12 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'rect', x: 6, y: 12, width: 28, height: 36, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'circle', cx: 20, cy: 30, r: 4, stroke: '#888', fill: 'transparent', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 20, y: 48 }, { x: 20, y: 60 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 60 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'X1:1', type: 'string', visible: true, editorType: 'text' },
    { key: 'terminalType', value: 'feed_through', type: 'string', visible: true, editorType: 'text' },
    { key: 'wireSizeMm2', value: 2.5, type: 'number', visible: true, editorType: 'number' },
    { key: 'terminalCount', value: 1, type: 'number', visible: true, editorType: 'number' },
  ],
};
