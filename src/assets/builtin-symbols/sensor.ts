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
  width: 60,
  height: 40,
  graphics: [
    { kind: 'polyline', points: [{ x: 30, y: 0 }, { x: 30, y: 8 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'rect', x: 10, y: 8, width: 36, height: 24, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'arc', cx: 14, cy: 20, r: 6, startAngle: 270, endAngle: 90, stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 46, y: 20 }, { x: 60, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 30, y: 32 }, { x: 30, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
  ],
  pins: [
    { id: 'vcc', name: '+V', number: '1', type: 'input', shape: 'line', position: { x: 30, y: 0 }, orientation: 'up', length: 0 },
    { id: 'out', name: 'OUT', number: '4', type: 'output', shape: 'line', position: { x: 60, y: 20 }, orientation: 'right', length: 0 },
    { id: 'gnd', name: '0V', number: '3', type: 'output', shape: 'line', position: { x: 30, y: 40 }, orientation: 'down', length: 0 },
  ],
  properties: [
    { key: 'designation', value: 'B1', type: 'string', visible: true, editorType: 'text' },
    { key: 'sensorType', value: 'proximity_inductive', type: 'string', visible: true, editorType: 'text' },
    { key: 'outputType', value: 'PNP', type: 'string', visible: true, editorType: 'text' },
    { key: 'detecting', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
