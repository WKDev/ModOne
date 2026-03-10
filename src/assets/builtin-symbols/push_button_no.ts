import type { SymbolDefinition } from '@/types/symbol';

export const pushButtonNoSymbol: SymbolDefinition = {
  id: 'builtin:push_button_no',
  name: 'Push Button NO',
  version: '1.0.0',
  description: 'Momentary normally-open push button',
  category: 'switching',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 60,
  height: 40,
  graphics: [
    { kind: 'polyline', points: [{ x: 4, y: 20 }, { x: 20, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 40, y: 20 }, { x: 56, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'circle', cx: 20, cy: 20, r: 2, stroke: '#888', fill: '#888', strokeWidth: 2 },
    { kind: 'circle', cx: 40, cy: 20, r: 2, stroke: '#888', fill: '#888', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 20, y: 20 }, { x: 36, y: 8 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 30, y: 12 }, { x: 30, y: 4 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 26, y: 4 }, { x: 34, y: 4 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 60, y: 20 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'S1', type: 'string', visible: true, editorType: 'text' },
    { key: 'normallyOpen', value: true, type: 'boolean', visible: true, editorType: 'checkbox' },
    { key: 'momentary', value: true, type: 'boolean', visible: true, editorType: 'checkbox' },
    { key: 'pressed', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
