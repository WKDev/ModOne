import type { SymbolDefinition } from '@/types/symbol';

export const solenoidValveSymbol: SymbolDefinition = {
  id: 'builtin:solenoid_valve',
  name: 'Solenoid Valve',
  version: '1.0.0',
  description: 'Pneumatic solenoid valve coil',
  category: 'actuator',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 20,
  height: 30,
  graphics: [
    { kind: 'polyline', points: [{ x: 10, y: 0 }, { x: 10, y: 6 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'rect', x: 2, y: 6, width: 16, height: 12, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'text', x: 10, y: 14, text: 'Y', fontSize: 5, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
    { kind: 'polyline', points: [{ x: 2, y: 21 }, { x: 18, y: 21 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { kind: 'polyline', points: [{ x: 10, y: 18 }, { x: 10, y: 30 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'coil_in', name: 'A1', number: 'A1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 10, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'coil_out', name: 'A2', number: 'A2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 10, y: 30 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'Y1', type: 'string', visible: true, editorType: 'text' },
    { key: 'valveType', value: '5-2', type: 'string', visible: true, editorType: 'text' },
    { key: 'coilVoltage', value: 24, type: 'number', visible: true, editorType: 'number' },
    { key: 'energized', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
