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
  width: 60,
  height: 50,
  graphics: [
    { kind: 'polyline', points: [{ x: 30, y: 0 }, { x: 30, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'rect', x: 14, y: 10, width: 32, height: 20, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'text', x: 30, y: 24, text: 'Y', fontSize: 10, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
    { kind: 'polyline', points: [{ x: 14, y: 36 }, { x: 46, y: 36 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 30, y: 30 }, { x: 30, y: 50 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'coil_in', name: 'A1', number: 'A1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 30, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'coil_out', name: 'A2', number: 'A2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 30, y: 50 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'Y1', type: 'string', visible: true, editorType: 'text' },
    { key: 'valveType', value: '5-2', type: 'string', visible: true, editorType: 'text' },
    { key: 'coilVoltage', value: 24, type: 'number', visible: true, editorType: 'number' },
    { key: 'energized', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
