import type { SymbolDefinition } from '@/types/symbol';

export const junctionBoxSymbol: SymbolDefinition = {
  id: 'builtin:junction_box',
  name: 'Junction Box',
  version: '1.0.0',
  description: 'Four-way electrical junction box',
  category: 'connection',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 80,
  height: 80,
  graphics: [
    { kind: 'rect', x: 4, y: 4, width: 72, height: 72, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'circle', cx: 40, cy: 8, r: 3, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'circle', cx: 72, cy: 40, r: 3, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'circle', cx: 40, cy: 72, r: 3, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'circle', cx: 8, cy: 40, r: 3, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
  ],
  pins: [
    { id: 'top', name: 'TOP', number: '1', type: 'bidirectional', electricalType: 'bidirectional', functionalRole: 'general', shape: 'line', position: { x: 40, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'right', name: 'RIGHT', number: '2', type: 'bidirectional', electricalType: 'bidirectional', functionalRole: 'general', shape: 'line', position: { x: 80, y: 40 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'bottom', name: 'BOT', number: '3', type: 'bidirectional', electricalType: 'bidirectional', functionalRole: 'general', shape: 'line', position: { x: 40, y: 80 }, orientation: 'down', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
    { id: 'left', name: 'LEFT', number: '4', type: 'bidirectional', electricalType: 'bidirectional', functionalRole: 'general', shape: 'line', position: { x: 0, y: 40 }, orientation: 'left', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'JB1', type: 'string', visible: true, editorType: 'text' },
    { key: 'enclosureRating', value: 'IP65', type: 'string', visible: true, editorType: 'text' },
  ],
};
