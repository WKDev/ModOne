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
  width: 80,
  height: 40,
  graphics: [
    { kind: 'polyline', points: [{ x: 0, y: 20 }, { x: 14, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'rect', x: 14, y: 8, width: 50, height: 24, stroke: '#888', fill: 'transparent', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 64, y: 8 }, { x: 80, y: 20 }, { x: 64, y: 32 }], stroke: '#888', fill: 'transparent', strokeWidth: 1.5 },
    { kind: 'text', x: 38, y: 24, text: 'NET', fontSize: 10, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
  ],
  pins: [
    { id: 'conn', name: 'CONN', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'netName', value: '+24V', type: 'string', visible: true, editorType: 'text' },
    { key: 'direction', value: 'right', type: 'string', visible: true, editorType: 'text' },
    { key: 'description', value: '', type: 'string', visible: true, editorType: 'text' },
  ],
};
