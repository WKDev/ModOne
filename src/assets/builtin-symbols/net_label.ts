import type { SymbolDefinition } from '@/types/symbol';

export const netLabelSymbol: SymbolDefinition = {
  id: 'builtin:net_label',
  name: 'Net Label',
  version: '1.0.0',
  description: 'Named network connection marker',
  category: 'connection',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 40,
  height: 20,
  graphics: [
    { kind: 'polyline', points: [{ x: 0, y: 10 }, { x: 7, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'rect', x: 7, y: 4, width: 25, height: 12, stroke: '#888', fill: 'transparent', strokeWidth: 0.75 },
    { kind: 'polyline', points: [{ x: 32, y: 4 }, { x: 40, y: 10 }, { x: 32, y: 16 }], stroke: '#888', fill: 'transparent', strokeWidth: 0.75 },
    { kind: 'text', x: 19, y: 12, text: 'NET', fontSize: 5, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
  ],
  pins: [
    { id: 'conn', name: 'CONN', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 10 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'netName', value: '+24V', type: 'string', visible: true, editorType: 'text' },
    { key: 'direction', value: 'right', type: 'string', visible: true, editorType: 'text' },
    { key: 'description', value: '', type: 'string', visible: true, editorType: 'text' },
  ],
};
