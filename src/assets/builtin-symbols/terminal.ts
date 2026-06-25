import type { SymbolDefinition } from '@/types/symbol';

export const terminalSymbol: SymbolDefinition = {
  id: 'builtin:terminal',
  name: 'Terminal',
  version: '1.0.0',
  description: 'Single connection terminal',
  category: 'connection',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 20,
  height: 20,
  graphics: [
    { kind: 'rect', x: 5, y: 3.5, width: 10, height: 13, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'circle', cx: 10, cy: 10, r: 1, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
  ],
  pins: [
    { id: 'conn', name: 'T', number: '1', type: 'bidirectional', electricalType: 'bidirectional', functionalRole: 'general', shape: 'line', position: { x: 0, y: 10 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'X1', type: 'string', visible: true, editorType: 'text' },
    { key: 'terminalType', value: 'generic', type: 'string', visible: true, editorType: 'text' },
  ],
};
