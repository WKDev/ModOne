import type { SymbolDefinition } from '@/types/symbol';

export const diodeSymbol: SymbolDefinition = {
  id: 'builtin:diode',
  name: 'Diode',
  version: '1.0.0',
  description: 'Current-direction control diode',
  category: 'passive',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 20,
  height: 20,
  graphics: [
    { kind: 'polyline', points: [{ x: 10, y: 2 }, { x: 10, y: 7 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 5, y: 7 }, { x: 15, y: 7 }, { x: 10, y: 13 }, { x: 5, y: 7 }], stroke: '#888', fill: '#1a1d23', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 5, y: 13 }, { x: 15, y: 13 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 10, y: 13 }, { x: 10, y: 18 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'anode', name: 'A', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 10, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'cathode', name: 'K', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 10, y: 20 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'D1', type: 'string', visible: true, editorType: 'text' },
    { key: 'forwardVoltage', value: 0.7, type: 'number', visible: true, editorType: 'number' },
    { key: 'currentRatingMa', value: 1000, type: 'number', visible: true, editorType: 'number' },
  ],
};
