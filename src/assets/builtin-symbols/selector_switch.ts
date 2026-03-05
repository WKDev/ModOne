import type { SymbolDefinition } from '@/types/symbol';

export const selectorSwitchSymbol: SymbolDefinition = {
  id: 'builtin:selector_switch',
  name: 'Selector Switch',
  version: '1.0.0',
  description: 'Two-position selector switch',
  category: 'control',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 50,
  height: 50,
  graphics: [
    { kind: 'polyline', points: [{ x: 0, y: 25 }, { x: 14, y: 25 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'circle', cx: 24, cy: 25, r: 8, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 24, y: 25 }, { x: 40, y: 17.5 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 40, y: 17.5 }, { x: 50, y: 17.5 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 40, y: 32.5 }, { x: 50, y: 32.5 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'com', name: 'COM', number: 'C', type: 'input', shape: 'line', position: { x: 0, y: 25 }, orientation: 'left', length: 0 },
    { id: 'pos1', name: '1', number: '1', type: 'output', shape: 'line', position: { x: 50, y: 17.5 }, orientation: 'right', length: 0 },
    { id: 'pos2', name: '2', number: '2', type: 'output', shape: 'line', position: { x: 50, y: 32.5 }, orientation: 'right', length: 0 },
  ],
  properties: [
    { key: 'designation', value: 'S1', type: 'string', visible: true, editorType: 'text' },
    { key: 'positions', value: 2, type: 'number', visible: true, editorType: 'number' },
    { key: 'currentPosition', value: 0, type: 'number', visible: true, editorType: 'number' },
    { key: 'maintained', value: true, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
