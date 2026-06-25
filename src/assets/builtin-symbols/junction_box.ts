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
  width: 40,
  height: 40,
  graphics: [
    { kind: 'rect', x: 2, y: 2, width: 36, height: 36, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'circle', cx: 20, cy: 4, r: 1.5, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'circle', cx: 36, cy: 20, r: 1.5, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'circle', cx: 20, cy: 36, r: 1.5, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'circle', cx: 4, cy: 20, r: 1.5, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
  ],
  pins: [
    { id: 'top', name: 'TOP', number: '1', type: 'bidirectional', electricalType: 'bidirectional', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'right', name: 'RIGHT', number: '2', type: 'bidirectional', electricalType: 'bidirectional', functionalRole: 'general', shape: 'line', position: { x: 40, y: 20 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'bottom', name: 'BOT', number: '3', type: 'bidirectional', electricalType: 'bidirectional', functionalRole: 'general', shape: 'line', position: { x: 20, y: 40 }, orientation: 'down', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
    { id: 'left', name: 'LEFT', number: '4', type: 'bidirectional', electricalType: 'bidirectional', functionalRole: 'general', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'JB1', type: 'string', visible: true, editorType: 'text' },
    { key: 'enclosureRating', value: 'IP65', type: 'string', visible: true, editorType: 'text' },
  ],
};
