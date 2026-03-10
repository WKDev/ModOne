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
  width: 40,
  height: 40,
  graphics: [
    { kind: 'polyline', points: [{ x: 20, y: 4 }, { x: 20, y: 16 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 10, y: 16 }, { x: 30, y: 16 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 10, y: 24 }, { x: 30, y: 24 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 20, y: 24 }, { x: 20, y: 36 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'passive', electricalType: 'passive', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'passive', electricalType: 'passive', functionalRole: 'general', shape: 'line', position: { x: 20, y: 40 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'C1', type: 'string', visible: true, editorType: 'text' },
    { key: 'value', value: 10, type: 'number', visible: true, editorType: 'number' },
    { key: 'unit', value: 'uF', type: 'enum', visible: true, editorType: 'select', options: ['pF', 'nF', 'uF', 'mF'] },
    { key: 'voltageRating', value: 50, type: 'number', visible: true, editorType: 'number' },
  ],
};
