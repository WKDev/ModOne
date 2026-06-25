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
  width: 40,
  height: 40,
  graphics: [
    { id: 'coil-body', kind: 'rect', x: 15, y: 8, width: 10, height: 24, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { id: 'coil-label', kind: 'text', x: 20, y: 20, text: 'K', fontSize: 6, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
  ],
  pins: [
    { id: 'coil_in', name: 'A1', number: 'A1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'coil_out', name: 'A2', number: 'A2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 40 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'com', name: 'COM', number: '11', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
    { id: 'no', name: 'NO', number: '14', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 40, y: 10 }, orientation: 'right', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
    { id: 'nc', name: 'NC', number: '12', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 40, y: 30 }, orientation: 'right', length: 0, sortOrder: 5, nameVisible: true, numberVisible: true },
  ],
  units: [
    {
      unitId: 1,
      name: 'Coil',
      graphics: [
        { kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 8 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
        { kind: 'rect', x: 15, y: 8, width: 10, height: 24, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
        { kind: 'text', x: 20, y: 20, text: 'K', fontSize: 6, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
        { kind: 'polyline', points: [{ x: 20, y: 32 }, { x: 20, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
      ],
      pins: [
        { id: 'coil_in', name: 'A1', number: 'A1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
        { id: 'coil_out', name: 'A2', number: 'A2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 40 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
      ],
    },
    {
      unitId: 2,
      name: 'Contact',
      graphics: [
        { kind: 'polyline', points: [{ x: 0, y: 20 }, { x: 12, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
        { kind: 'polyline', points: [{ x: 28, y: 10 }, { x: 40, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
        { kind: 'polyline', points: [{ x: 28, y: 30 }, { x: 40, y: 30 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
        { kind: 'circle', cx: 12, cy: 20, r: 1, stroke: '#888', fill: '#888', strokeWidth: 1 },
        { kind: 'circle', cx: 28, cy: 10, r: 1, stroke: '#888', fill: '#888', strokeWidth: 1 },
        { kind: 'circle', cx: 28, cy: 30, r: 1, stroke: '#888', fill: '#888', strokeWidth: 1 },
        { kind: 'polyline', points: [{ x: 12, y: 20 }, { x: 27, y: 11 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
      ],
      pins: [
        { id: 'com', name: 'COM', number: '11', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
        { id: 'no', name: 'NO', number: '14', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 40, y: 10 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
        { id: 'nc', name: 'NC', number: '12', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 40, y: 30 }, orientation: 'right', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
      ],
    },
  ],
  behavior: {
    templateId: 'archetype:relay',
    archetype: 'relay',
    interactionMode: 'none',
    deviceScoped: true,
    terminalRoles: { coil_in: 'A1', coil_out: 'A2', com: 'COM', no: 'NO', nc: 'NC' },
  },
  visualStates: {
    energized: {
      primitiveOverrides: {
        'coil-body': {
          stroke: '#22c55e',
          fill: '#d1fae5',
        },
        'coil-label': {
          fill: '#15803d',
        },
      },
    },
  },
  properties: [
    { key: 'designation', value: 'K1', type: 'string', visible: true, editorType: 'text' },
    { key: 'coilVoltage', value: 24, type: 'number', visible: true, editorType: 'number' },
    { key: 'contacts', value: 'NO', type: 'string', visible: true, editorType: 'text' },
    { key: 'energized', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};

