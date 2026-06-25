import type { SymbolDefinition } from '@/types/symbol';

export const circuitBreakerSymbol: SymbolDefinition = {
  id: 'builtin:circuit_breaker',
  name: 'Circuit Breaker',
  version: '1.0.0',
  description: 'Resettable overcurrent protection',
  category: 'protection',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 20,
  height: 30,
  graphics: [
    { kind: 'polyline', points: [{ x: 10, y: 0 }, { x: 10, y: 8 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 10, y: 22 }, { x: 10, y: 30 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'circle', cx: 10, cy: 8, r: 1, stroke: '#888', fill: '#888', strokeWidth: 1 },
    { kind: 'circle', cx: 10, cy: 22, r: 1, stroke: '#888', fill: '#888', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 10, y: 8 }, { x: 14, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 12, y: 16 }, { x: 16, y: 19 }], stroke: '#f00', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 16, y: 16 }, { x: 12, y: 19 }], stroke: '#f00', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'in', name: 'LINE', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 10, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'LOAD', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 10, y: 30 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'Q1', type: 'string', visible: true, editorType: 'text' },
    { key: 'currentRating', value: 10, type: 'number', visible: true, editorType: 'number' },
    { key: 'tripped', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
