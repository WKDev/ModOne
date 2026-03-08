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
  width: 40,
  height: 40,
  graphics: [
    { kind: 'polyline', points: [{ x: 20, y: 4 }, { x: 20, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 10, y: 24 }, { x: 30, y: 24 }, { x: 20, y: 12 }, { x: 10, y: 24 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 10, y: 28 }, { x: 30, y: 28 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 20, y: 28 }, { x: 20, y: 36 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'anode', name: 'A', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'cathode', name: 'K', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 40 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'D1', type: 'string', visible: true, editorType: 'text' },
    { key: 'forwardVoltage', value: 0.7, type: 'number', visible: true, editorType: 'number' },
    { key: 'currentRatingMa', value: 1000, type: 'number', visible: true, editorType: 'number' },
  ],
};
