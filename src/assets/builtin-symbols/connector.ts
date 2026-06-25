import type { SymbolDefinition } from '@/types/symbol';

export const connectorSymbol: SymbolDefinition = {
  id: 'builtin:connector',
  name: 'Connector',
  version: '1.0.0',
  description: 'Two-sided signal connector',
  category: 'connection',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 30,
  height: 20,
  graphics: [
    { kind: 'rect', x: 2, y: 2, width: 26, height: 16, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'circle', cx: 9, cy: 10, r: 1.5, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'circle', cx: 21, cy: 10, r: 1.5, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 12, y: 10 }, { x: 18, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'left', name: 'L', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 10 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'right', name: 'R', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 30, y: 10 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'J1', type: 'string', visible: true, editorType: 'text' },
    { key: 'connectorType', value: 'generic', type: 'string', visible: true, editorType: 'text' },
  ],
};
