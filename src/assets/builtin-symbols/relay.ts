import type { SymbolDefinition } from '@/types/symbol';

export const relaySymbol: SymbolDefinition = {
  id: 'builtin:relay',
  name: 'Relay',
  version: '1.0.0',
  description: 'Control relay with coil and changeover contact',
  category: 'switching',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 60,
  height: 60,
  graphics: [
    { kind: 'rect', x: 18, y: 14, width: 24, height: 20, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'text', x: 30, y: 27, text: 'K', fontSize: 10, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
    { kind: 'polyline', points: [{ x: 0, y: 30 }, { x: 20, y: 30 }, { x: 40, y: 22 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 40, y: 21 }, { x: 60, y: 21 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 40, y: 39 }, { x: 60, y: 39 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'coil_in', name: 'A1', number: 'A1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 30, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'coil_out', name: 'A2', number: 'A2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 30, y: 60 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'com', name: 'COM', number: '11', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 30 }, orientation: 'left', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
    { id: 'no', name: 'NO', number: '14', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 60, y: 21 }, orientation: 'right', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
    { id: 'nc', name: 'NC', number: '12', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 60, y: 39 }, orientation: 'right', length: 0, sortOrder: 5, nameVisible: true, numberVisible: true },
  ],
  units: [
    {
      unitId: 1,
      name: 'Coil',
      graphics: [
        { kind: 'polyline', points: [{ x: 30, y: 0 }, { x: 30, y: 14 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
        { kind: 'rect', x: 18, y: 14, width: 24, height: 20, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
        { kind: 'text', x: 30, y: 27, text: 'K', fontSize: 10, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
        { kind: 'polyline', points: [{ x: 30, y: 34 }, { x: 30, y: 60 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
      ],
      pins: [
        { id: 'coil_in', name: 'A1', number: 'A1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 30, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
        { id: 'coil_out', name: 'A2', number: 'A2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 30, y: 60 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
      ],
    },
    {
      unitId: 2,
      name: 'Contact',
      graphics: [
        { kind: 'polyline', points: [{ x: 0, y: 30 }, { x: 22, y: 30 }, { x: 40, y: 22 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
        { kind: 'polyline', points: [{ x: 40, y: 21 }, { x: 60, y: 21 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
        { kind: 'polyline', points: [{ x: 40, y: 39 }, { x: 60, y: 39 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
      ],
      pins: [
        { id: 'com', name: 'COM', number: '11', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 30 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
        { id: 'no', name: 'NO', number: '14', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 60, y: 21 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
        { id: 'nc', name: 'NC', number: '12', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 60, y: 39 }, orientation: 'right', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
      ],
    },
  ],
  properties: [
    { key: 'designation', value: 'K1', type: 'string', visible: true, editorType: 'text' },
    { key: 'coilVoltage', value: 24, type: 'number', visible: true, editorType: 'number' },
    { key: 'contacts', value: 'NO', type: 'string', visible: true, editorType: 'text' },
    { key: 'energized', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
