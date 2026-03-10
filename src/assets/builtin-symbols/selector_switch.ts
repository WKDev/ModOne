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
  width: 80,
  height: 80,
  graphics: [
    { kind: 'polyline', points: [{ x: 0, y: 20 }, { x: 20, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'circle', cx: 32, cy: 20, r: 10, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 32, y: 20 }, { x: 56, y: 12 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 56, y: 20 }, { x: 80, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 56, y: 40 }, { x: 80, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'com', name: 'COM', number: 'C', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'pos1', name: '1', number: '1', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 80, y: 20 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'pos2', name: '2', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 80, y: 40 }, orientation: 'right', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'S1', type: 'string', visible: true, editorType: 'text' },
    { key: 'positions', value: 2, type: 'number', visible: true, editorType: 'number' },
    { key: 'currentPosition', value: 0, type: 'number', visible: true, editorType: 'number' },
    { key: 'maintained', value: true, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
