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
  width: 40,
  height: 60,
  graphics: [
    { kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 16 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 20, y: 44 }, { x: 20, y: 60 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'circle', cx: 20, cy: 16, r: 2, stroke: '#888', fill: '#888', strokeWidth: 2 },
    { kind: 'circle', cx: 20, cy: 44, r: 2, stroke: '#888', fill: '#888', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 20, y: 16 }, { x: 28, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 24, y: 32 }, { x: 32, y: 38 }], stroke: '#f00', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 32, y: 32 }, { x: 24, y: 38 }], stroke: '#f00', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'in', name: 'LINE', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'LOAD', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 60 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'Q1', type: 'string', visible: true, editorType: 'text' },
    { key: 'currentRating', value: 10, type: 'number', visible: true, editorType: 'number' },
    { key: 'tripped', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
