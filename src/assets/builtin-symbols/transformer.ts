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
  width: 80,
  height: 80,
  graphics: [
    { kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 24 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 60, y: 0 }, { x: 60, y: 24 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 20, y: 56 }, { x: 20, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 60, y: 56 }, { x: 60, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 20, y: 24 }, { x: 30, y: 24 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 60, y: 24 }, { x: 50, y: 24 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 20, y: 56 }, { x: 30, y: 56 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 60, y: 56 }, { x: 50, y: 56 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'circle', cx: 40, cy: 30, r: 16, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'circle', cx: 40, cy: 50, r: 16, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
  ],
  pins: [
    { id: 'pri_1', name: 'L1', number: 'L1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'pri_2', name: 'N', number: 'N1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 60, y: 0 }, orientation: 'up', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'sec_1', name: 'L', number: 'L2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 80 }, orientation: 'down', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
    { id: 'sec_2', name: 'N', number: 'N2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 60, y: 80 }, orientation: 'down', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'T1', type: 'string', visible: true, editorType: 'text' },
    { key: 'transformerType', value: 'control', type: 'string', visible: true, editorType: 'text' },
    { key: 'primaryVoltage', value: 400, type: 'number', visible: true, editorType: 'number' },
    { key: 'secondaryVoltage', value: 24, type: 'number', visible: true, editorType: 'number' },
    { key: 'powerVa', value: 100, type: 'number', visible: true, editorType: 'number' },
  ],
};
