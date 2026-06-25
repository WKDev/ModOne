import type { SymbolDefinition } from '@/types/symbol';

export const textSymbol: SymbolDefinition = {
  id: 'builtin:text',
  name: 'Text',
  version: '1.0.0',
  description: 'Text annotation block',
  category: 'annotation',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 80,
  height: 20,
  graphics: [
    { kind: 'rect', x: 1, y: 1, width: 78, height: 18, stroke: '#888', fill: 'transparent', strokeWidth: 0.75 },
    { kind: 'text', x: 40, y: 12, text: 'Text', fontSize: 7, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
  ],
  pins: [],
  properties: [
    { key: 'content', value: 'Text', type: 'string', visible: true, editorType: 'text' },
    { key: 'textStyle', value: 'label', type: 'string', visible: true, editorType: 'text' },
    { key: 'fontSize', value: 14, type: 'number', visible: true, editorType: 'number' },
    { key: 'textColor', value: '#e5e5e5', type: 'string', visible: true, editorType: 'text' },
    { key: 'backgroundColor', value: '', type: 'string', visible: true, editorType: 'text' },
    { key: 'showBorder', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
