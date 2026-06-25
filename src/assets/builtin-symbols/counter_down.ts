import type { SymbolDefinition } from '@/types/symbol';

export const counterDownSymbol: SymbolDefinition = {
  id: 'builtin:counter_down',
  name: 'Counter Down',
  version: '1.0.0',
  description: 'PLC down-counter block',
  category: 'plc',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 40,
  height: 40,
  graphics: [
    { kind: 'rect', x: 2, y: 2, width: 36, height: 36, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 9, y: 15 }, { x: 9, y: 25 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 9, y: 25 }, { x: 7, y: 21 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 9, y: 25 }, { x: 11, y: 21 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 17, y: 14 }, { x: 17, y: 26 }, { x: 24, y: 26 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'arc', cx: 24, cy: 20, r: 6, startAngle: Math.PI / 2, endAngle: -Math.PI / 2, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
  ],
  pins: [
    { id: 'count_in', name: 'CD', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 40, y: 20 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'reset', name: 'RST', number: '3', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 40 }, orientation: 'down', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'C1', type: 'string', visible: true, editorType: 'text' },
    { key: 'preset', value: 10, type: 'number', visible: true, editorType: 'number' },
    { key: 'currentValue', value: 0, type: 'number', visible: true, editorType: 'number' },
  ],
};
