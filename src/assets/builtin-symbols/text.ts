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
  width: 160,
  height: 40,
  graphics: [
    { kind: 'rect', x: 2, y: 2, width: 156, height: 36, stroke: '#888', fill: 'transparent', strokeWidth: 1.5 },
    { kind: 'text', x: 80, y: 24, text: 'Text', fontSize: 14, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
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
