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
  width: 60,
  height: 60,
  graphics: [
    { kind: 'polyline', points: [{ x: 30, y: 4 }, { x: 30, y: 16 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 30, y: 44 }, { x: 30, y: 56 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 16, y: 18 }, { x: 30, y: 30 }, { x: 44, y: 22 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'arc', cx: 30, cy: 34, r: 10, startAngle: Math.PI * 0.15, endAngle: Math.PI * 0.85, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
  ],
  pins: [
    { id: 'in', name: 'LINE', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 30, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'LOAD', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 30, y: 60 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'Q1', type: 'string', visible: true, editorType: 'text' },
    { key: 'currentRating', value: 10, type: 'number', visible: true, editorType: 'number' },
    { key: 'tripped', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
