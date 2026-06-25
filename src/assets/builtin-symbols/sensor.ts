import type { SymbolDefinition } from '@/types/symbol';

export const sensorSymbol: SymbolDefinition = {
  id: 'builtin:sensor',
  name: 'Sensor',
  version: '1.0.0',
  description: 'Three-wire industrial sensor',
  category: 'sensing',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 20,
  height: 20,
  graphics: [
    { kind: 'polyline', points: [{ x: 10, y: 0 }, { x: 10, y: 4 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { kind: 'rect', x: 1, y: 4, width: 15, height: 12, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'arc', cx: 3, cy: 10, r: 3, startAngle: 270, endAngle: 90, stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { kind: 'polyline', points: [{ x: 16, y: 10 }, { x: 20, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { kind: 'polyline', points: [{ x: 10, y: 16 }, { x: 10, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
  ],
  pins: [
    { id: 'vcc', name: '+V', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 10, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '4', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 10 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'gnd', name: '0V', number: '3', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 10, y: 20 }, orientation: 'down', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'B1', type: 'string', visible: true, editorType: 'text' },
    { key: 'sensorType', value: 'proximity_inductive', type: 'string', visible: true, editorType: 'text' },
    { key: 'outputType', value: 'PNP', type: 'string', visible: true, editorType: 'text' },
    { key: 'detecting', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
