import type { SymbolDefinition } from '@/types/symbol';

export const switchChangeoverSymbol: SymbolDefinition = {
  id: 'builtin:switch_changeover',
  name: 'Switch Changeover',
  version: '1.0.0',
  description: 'Single-pole changeover switch',
  category: 'switching',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 60,
  height: 60,
  graphics: [
    { kind: 'polyline', points: [{ x: 4, y: 30 }, { x: 18, y: 30 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 42, y: 18 }, { x: 56, y: 18 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 42, y: 42 }, { x: 56, y: 42 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 18, y: 30 }, { x: 42, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'circle', cx: 18, cy: 30, r: 2, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
  ],
  pins: [
    { id: 'com', name: 'COM', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 30 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'pos1', name: 'NO', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 60, y: 18 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'pos2', name: 'NC', number: '3', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 60, y: 42 }, orientation: 'right', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'S1', type: 'string', visible: true, editorType: 'text' },
    { key: 'normallyOpen', value: true, type: 'boolean', visible: true, editorType: 'checkbox' },
    { key: 'position', value: 1, type: 'number', visible: true, editorType: 'number' },
  ],
};
