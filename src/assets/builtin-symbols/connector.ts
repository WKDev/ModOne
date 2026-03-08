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
  width: 60,
  height: 40,
  graphics: [
    { kind: 'rect', x: 4, y: 4, width: 52, height: 32, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'circle', cx: 18, cy: 20, r: 3, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'circle', cx: 42, cy: 20, r: 3, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 24, y: 20 }, { x: 36, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'left', name: 'L', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'right', name: 'R', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 60, y: 20 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'J1', type: 'string', visible: true, editorType: 'text' },
    { key: 'connectorType', value: 'generic', type: 'string', visible: true, editorType: 'text' },
  ],
};
