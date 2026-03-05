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
  width: 70,
  height: 80,
  graphics: [
    { kind: 'rect', x: 6, y: 14, width: 18, height: 52, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'text', x: 15, y: 43, text: 'KM', fontSize: 8, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
    { kind: 'polyline', points: [{ x: 17.5, y: 0 }, { x: 17.5, y: 26 }, { x: 17.5, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 35, y: 0 }, { x: 35, y: 26 }, { x: 35, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 52.5, y: 0 }, { x: 52.5, y: 26 }, { x: 52.5, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
  ],
  pins: [
    { id: 'coil_a1', name: 'A1', number: 'A1', type: 'input', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0 },
    { id: 'coil_a2', name: 'A2', number: 'A2', type: 'output', shape: 'line', position: { x: 0, y: 60 }, orientation: 'left', length: 0 },
    { id: 'l1_in', name: '1', number: '1', type: 'input', shape: 'line', position: { x: 17.5, y: 0 }, orientation: 'up', length: 0 },
    { id: 'l2_in', name: '3', number: '3', type: 'input', shape: 'line', position: { x: 35, y: 0 }, orientation: 'up', length: 0 },
    { id: 'l3_in', name: '5', number: '5', type: 'input', shape: 'line', position: { x: 52.5, y: 0 }, orientation: 'up', length: 0 },
    { id: 'l1_out', name: '2', number: '2', type: 'output', shape: 'line', position: { x: 17.5, y: 80 }, orientation: 'down', length: 0 },
    { id: 'l2_out', name: '4', number: '4', type: 'output', shape: 'line', position: { x: 35, y: 80 }, orientation: 'down', length: 0 },
    { id: 'l3_out', name: '6', number: '6', type: 'output', shape: 'line', position: { x: 52.5, y: 80 }, orientation: 'down', length: 0 },
  ],
  units: [
    {
      unitId: 1,
      name: 'Coil',
      graphics: [
        { kind: 'polyline', points: [{ x: 0, y: 20 }, { x: 6, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
        { kind: 'polyline', points: [{ x: 0, y: 60 }, { x: 6, y: 60 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
        { kind: 'rect', x: 6, y: 14, width: 18, height: 52, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
        { kind: 'text', x: 15, y: 43, text: 'KM', fontSize: 8, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
      ],
      pins: [
        { id: 'coil_a1', name: 'A1', number: 'A1', type: 'input', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0 },
        { id: 'coil_a2', name: 'A2', number: 'A2', type: 'output', shape: 'line', position: { x: 0, y: 60 }, orientation: 'left', length: 0 },
      ],
    },
    {
      unitId: 2,
      name: 'Power Contacts',
      graphics: [
        { kind: 'polyline', points: [{ x: 17.5, y: 0 }, { x: 17.5, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
        { kind: 'polyline', points: [{ x: 35, y: 0 }, { x: 35, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
        { kind: 'polyline', points: [{ x: 52.5, y: 0 }, { x: 52.5, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
      ],
      pins: [
        { id: 'l1_in', name: '1', number: '1', type: 'input', shape: 'line', position: { x: 17.5, y: 0 }, orientation: 'up', length: 0 },
        { id: 'l2_in', name: '3', number: '3', type: 'input', shape: 'line', position: { x: 35, y: 0 }, orientation: 'up', length: 0 },
        { id: 'l3_in', name: '5', number: '5', type: 'input', shape: 'line', position: { x: 52.5, y: 0 }, orientation: 'up', length: 0 },
        { id: 'l1_out', name: '2', number: '2', type: 'output', shape: 'line', position: { x: 17.5, y: 80 }, orientation: 'down', length: 0 },
        { id: 'l2_out', name: '4', number: '4', type: 'output', shape: 'line', position: { x: 35, y: 80 }, orientation: 'down', length: 0 },
        { id: 'l3_out', name: '6', number: '6', type: 'output', shape: 'line', position: { x: 52.5, y: 80 }, orientation: 'down', length: 0 },
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
