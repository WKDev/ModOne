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
  width: 30,
  height: 20,
  graphics: [
    { kind: 'polyline', points: [{ x: 2, y: 10 }, { x: 7.5, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'rect', x: 7.5, y: 7, width: 15, height: 6, stroke: '#888', fill: '#888', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 22.5, y: 10 }, { x: 28, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'passive', electricalType: 'passive', functionalRole: 'general', shape: 'line', position: { x: 0, y: 10 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'passive', electricalType: 'passive', functionalRole: 'general', shape: 'line', position: { x: 30, y: 10 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'L1', type: 'string', visible: true, editorType: 'text' },
    { key: 'value', value: 10, type: 'number', visible: true, editorType: 'number' },
    { key: 'unit', value: 'mH', type: 'enum', visible: true, editorType: 'select', options: ['uH', 'mH', 'H'] },
  ],
};
