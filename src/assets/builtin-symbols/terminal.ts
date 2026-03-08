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
  width: 40,
  height: 40,
  graphics: [
    { kind: 'rect', x: 10, y: 7, width: 20, height: 26, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'circle', cx: 20, cy: 20, r: 2, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
  ],
  pins: [
    { id: 'conn', name: 'T', number: '1', type: 'bidirectional', electricalType: 'bidirectional', functionalRole: 'general', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'X1', type: 'string', visible: true, editorType: 'text' },
    { key: 'terminalType', value: 'generic', type: 'string', visible: true, editorType: 'text' },
  ],
};
