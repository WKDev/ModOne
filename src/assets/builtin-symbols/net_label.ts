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
  height: 24,
  graphics: [
    { kind: 'polyline', points: [{ x: 0, y: 12 }, { x: 14, y: 12 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'rect', x: 14, y: 4, width: 50, height: 16, stroke: '#888', fill: 'transparent', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 64, y: 4 }, { x: 80, y: 12 }, { x: 64, y: 20 }], stroke: '#888', fill: 'transparent', strokeWidth: 1.5 },
    { kind: 'text', x: 38, y: 16, text: 'NET', fontSize: 10, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
  ],
  pins: [
    { id: 'conn', name: 'CONN', number: '1', type: 'input', shape: 'line', position: { x: 0, y: 12 }, orientation: 'left', length: 0 },
  ],
  properties: [
    { key: 'netName', value: '+24V', type: 'string', visible: true, editorType: 'text' },
    { key: 'direction', value: 'right', type: 'string', visible: true, editorType: 'text' },
    { key: 'description', value: '', type: 'string', visible: true, editorType: 'text' },
  ],
};
