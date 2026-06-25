import type { SymbolDefinition } from '@/types/symbol';

export const contactorSymbol: SymbolDefinition = {
  id: 'builtin:contactor',
  name: 'Contactor',
  version: '1.0.0',
  description: 'Three-phase contactor with coil',
  category: 'switching',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 40,
  height: 40,
  graphics: [
    { kind: 'rect', x: 1, y: 7, width: 8, height: 26, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'text', x: 5, y: 21.5, text: 'KM', fontSize: 4, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
    { kind: 'polyline', points: [{ x: 10, y: 0 }, { x: 10, y: 13 }, { x: 10, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 13 }, { x: 20, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { kind: 'polyline', points: [{ x: 30, y: 0 }, { x: 30, y: 13 }, { x: 30, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
  ],
  pins: [
    { id: 'coil_a1', name: 'A1', number: 'A1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 10 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'coil_a2', name: 'A2', number: 'A2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 0, y: 30 }, orientation: 'left', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'l1_in', name: '1', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 10, y: 0 }, orientation: 'up', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
    { id: 'l2_in', name: '3', number: '3', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
    { id: 'l3_in', name: '5', number: '5', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 30, y: 0 }, orientation: 'up', length: 0, sortOrder: 5, nameVisible: true, numberVisible: true },
    { id: 'l1_out', name: '2', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 10, y: 40 }, orientation: 'down', length: 0, sortOrder: 6, nameVisible: true, numberVisible: true },
    { id: 'l2_out', name: '4', number: '4', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 40 }, orientation: 'down', length: 0, sortOrder: 7, nameVisible: true, numberVisible: true },
    { id: 'l3_out', name: '6', number: '6', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 30, y: 40 }, orientation: 'down', length: 0, sortOrder: 8, nameVisible: true, numberVisible: true },
  ],
  units: [
    {
      unitId: 1,
      name: 'Coil',
      graphics: [
        { kind: 'polyline', points: [{ x: 0, y: 10 }, { x: 1, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
        { kind: 'polyline', points: [{ x: 0, y: 30 }, { x: 1, y: 30 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
        { kind: 'rect', x: 1, y: 7, width: 8, height: 26, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
        { kind: 'text', x: 5, y: 21.5, text: 'KM', fontSize: 4, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
      ],
      pins: [
        { id: 'coil_a1', name: 'A1', number: 'A1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 10 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
        { id: 'coil_a2', name: 'A2', number: 'A2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 0, y: 30 }, orientation: 'left', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
      ],
    },
    {
      unitId: 2,
      name: 'Power Contacts',
      graphics: [
        { kind: 'polyline', points: [{ x: 10, y: 0 }, { x: 10, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
        { kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
        { kind: 'polyline', points: [{ x: 30, y: 0 }, { x: 30, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
      ],
      pins: [
        { id: 'l1_in', name: '1', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 10, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
        { id: 'l2_in', name: '3', number: '3', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
        { id: 'l3_in', name: '5', number: '5', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 30, y: 0 }, orientation: 'up', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
        { id: 'l1_out', name: '2', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 10, y: 40 }, orientation: 'down', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
        { id: 'l2_out', name: '4', number: '4', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 40 }, orientation: 'down', length: 0, sortOrder: 5, nameVisible: true, numberVisible: true },
        { id: 'l3_out', name: '6', number: '6', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 30, y: 40 }, orientation: 'down', length: 0, sortOrder: 6, nameVisible: true, numberVisible: true },
      ],
    },
  ],
  properties: [
    { key: 'designation', value: 'KM1', type: 'string', visible: true, editorType: 'text' },
    { key: 'contactorType', value: 'main', type: 'string', visible: true, editorType: 'text' },
    { key: 'coilVoltage', value: 24, type: 'number', visible: true, editorType: 'number' },
    { key: 'powerRating', value: 4, type: 'number', visible: true, editorType: 'number' },
    { key: 'mainContacts', value: 3, type: 'number', visible: true, editorType: 'number' },
    { key: 'auxContacts', value: 1, type: 'number', visible: true, editorType: 'number' },
    { key: 'energized', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
