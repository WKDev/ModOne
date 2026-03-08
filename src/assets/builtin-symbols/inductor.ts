import type { SymbolDefinition } from '@/types/symbol';

export const inductorSymbol: SymbolDefinition = {
  id: 'builtin:inductor',
  name: 'Inductor',
  version: '1.0.0',
  description: 'Inductive passive element',
  category: 'passive',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 60,
  height: 30,
  graphics: [
    { kind: 'polyline', points: [{ x: 4, y: 15 }, { x: 12, y: 15 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'arc', cx: 18, cy: 15, r: 6, startAngle: Math.PI, endAngle: 0, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'arc', cx: 30, cy: 15, r: 6, startAngle: Math.PI, endAngle: 0, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'arc', cx: 42, cy: 15, r: 6, startAngle: Math.PI, endAngle: 0, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'arc', cx: 54, cy: 15, r: 6, startAngle: Math.PI, endAngle: 0, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 54, y: 15 }, { x: 56, y: 15 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'passive', electricalType: 'passive', functionalRole: 'general', shape: 'line', position: { x: 0, y: 15 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'passive', electricalType: 'passive', functionalRole: 'general', shape: 'line', position: { x: 60, y: 15 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'L1', type: 'string', visible: true, editorType: 'text' },
    { key: 'value', value: 10, type: 'number', visible: true, editorType: 'number' },
    { key: 'unit', value: 'mH', type: 'enum', visible: true, editorType: 'select', options: ['uH', 'mH', 'H'] },
  ],
};
