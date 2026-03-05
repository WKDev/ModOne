import type { SymbolDefinition } from '@/types/symbol';

export const powersourceSymbol: SymbolDefinition = {
  id: 'builtin:powersource',
  name: 'Power Source',
  version: '1.0.0',
  description: 'DC power source',
  category: 'power',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 40,
  height: 40,
  graphics: [
    { kind: 'circle', cx: 20, cy: 16, r: 10, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 20, y: 8 }, { x: 20, y: 24 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 14, y: 16 }, { x: 26, y: 16 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 20, y: 26 }, { x: 20, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'out', name: '+', number: '1', type: 'output', shape: 'line', position: { x: 20, y: 40 }, orientation: 'down', length: 0 },
  ],
  properties: [
    { key: 'voltage', value: 24, type: 'number', visible: true, editorType: 'number' },
    { key: 'polarity', value: 'positive', type: 'string', visible: true, editorType: 'text' },
    { key: 'maxCurrent', value: 1000, type: 'number', visible: true, editorType: 'number' },
  ],
};
