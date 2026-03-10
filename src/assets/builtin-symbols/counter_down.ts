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
  width: 80,
  height: 80,
  graphics: [
    { kind: 'rect', x: 4, y: 4, width: 72, height: 72, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 18, y: 30 }, { x: 18, y: 50 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 18, y: 50 }, { x: 14, y: 42 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 18, y: 50 }, { x: 22, y: 42 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 34, y: 28 }, { x: 34, y: 52 }, { x: 48, y: 52 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'arc', cx: 48, cy: 40, r: 12, startAngle: Math.PI / 2, endAngle: -Math.PI / 2, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
  ],
  pins: [
    { id: 'count_in', name: 'CD', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 40 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 80, y: 40 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'reset', name: 'RST', number: '3', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 40, y: 80 }, orientation: 'down', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'C1', type: 'string', visible: true, editorType: 'text' },
    { key: 'preset', value: 10, type: 'number', visible: true, editorType: 'number' },
    { key: 'currentValue', value: 0, type: 'number', visible: true, editorType: 'number' },
  ],
};
