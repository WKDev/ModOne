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
  height: 40,
  graphics: [
    { kind: 'polyline', points: [{ x: 4, y: 20 }, { x: 15, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'rect', x: 15, y: 14, width: 30, height: 12, stroke: '#888', fill: '#888', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 45, y: 20 }, { x: 56, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'passive', electricalType: 'passive', functionalRole: 'general', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'passive', electricalType: 'passive', functionalRole: 'general', shape: 'line', position: { x: 60, y: 20 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'L1', type: 'string', visible: true, editorType: 'text' },
    { key: 'value', value: 10, type: 'number', visible: true, editorType: 'number' },
    { key: 'unit', value: 'mH', type: 'enum', visible: true, editorType: 'select', options: ['uH', 'mH', 'H'] },
  ],
};
