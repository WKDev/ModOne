import type { SymbolDefinition } from '@/types/symbol';

export const transformerSymbol: SymbolDefinition = {
  id: 'builtin:transformer',
  name: 'Transformer',
  version: '1.0.0',
  description: 'Control transformer',
  category: 'power',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 70,
  height: 80,
  graphics: [
    { kind: 'polyline', points: [{ x: 21, y: 0 }, { x: 21, y: 16 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 49, y: 0 }, { x: 49, y: 16 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'arc', cx: 21, cy: 24, r: 8, startAngle: 90, endAngle: 270, stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'arc', cx: 21, cy: 40, r: 8, startAngle: 90, endAngle: 270, stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'arc', cx: 49, cy: 24, r: 8, startAngle: 270, endAngle: 90, stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'arc', cx: 49, cy: 40, r: 8, startAngle: 270, endAngle: 90, stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 21, y: 64 }, { x: 21, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 49, y: 64 }, { x: 49, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
  ],
  pins: [
    { id: 'pri_1', name: 'L1', number: 'L1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 21, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'pri_2', name: 'N', number: 'N1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 49, y: 0 }, orientation: 'up', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'sec_1', name: 'L', number: 'L2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 21, y: 80 }, orientation: 'down', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
    { id: 'sec_2', name: 'N', number: 'N2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 49, y: 80 }, orientation: 'down', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'T1', type: 'string', visible: true, editorType: 'text' },
    { key: 'transformerType', value: 'control', type: 'string', visible: true, editorType: 'text' },
    { key: 'primaryVoltage', value: 400, type: 'number', visible: true, editorType: 'number' },
    { key: 'secondaryVoltage', value: 24, type: 'number', visible: true, editorType: 'number' },
    { key: 'powerVa', value: 100, type: 'number', visible: true, editorType: 'number' },
  ],
};
