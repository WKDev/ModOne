import type { SymbolDefinition } from '@/types/symbol';

export const capacitorSymbol: SymbolDefinition = {
  id: 'builtin:capacitor',
  name: 'Capacitor',
  version: '1.0.0',
  description: 'Capacitive passive element',
  category: 'passive',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 20,
  height: 20,
  graphics: [
    { kind: 'polyline', points: [{ x: 10, y: 2 }, { x: 10, y: 8 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 5, y: 8 }, { x: 15, y: 8 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 5, y: 12 }, { x: 15, y: 12 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 10, y: 12 }, { x: 10, y: 18 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'passive', electricalType: 'passive', functionalRole: 'general', shape: 'line', position: { x: 10, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'passive', electricalType: 'passive', functionalRole: 'general', shape: 'line', position: { x: 10, y: 20 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'C1', type: 'string', visible: true, editorType: 'text' },
    { key: 'value', value: 10, type: 'number', visible: true, editorType: 'number' },
    { key: 'unit', value: 'uF', type: 'enum', visible: true, editorType: 'select', options: ['pF', 'nF', 'uF', 'mF'] },
    { key: 'voltageRating', value: 50, type: 'number', visible: true, editorType: 'number' },
  ],
};
