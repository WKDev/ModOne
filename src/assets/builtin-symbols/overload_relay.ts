import type { SymbolDefinition } from '@/types/symbol';

export const overloadRelaySymbol: SymbolDefinition = {
  id: 'builtin:overload_relay',
  name: 'Overload Relay',
  version: '1.0.0',
  description: 'Motor overload protection relay',
  category: 'protection',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 80,
  height: 80,
  graphics: [
    { kind: 'rect', x: 8, y: 10, width: 56, height: 60, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 40, y: 0 }, { x: 40, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 60, y: 0 }, { x: 60, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 64, y: 20 }, { x: 80, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 64, y: 60 }, { x: 80, y: 60 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
  ],
  pins: [
    { id: 'l1_in', name: '1', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'l2_in', name: '3', number: '3', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 40, y: 0 }, orientation: 'up', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'l3_in', name: '5', number: '5', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 60, y: 0 }, orientation: 'up', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
    { id: 'l1_out', name: '2', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 80 }, orientation: 'down', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
    { id: 'l2_out', name: '4', number: '4', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 40, y: 80 }, orientation: 'down', length: 0, sortOrder: 5, nameVisible: true, numberVisible: true },
    { id: 'l3_out', name: '6', number: '6', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 60, y: 80 }, orientation: 'down', length: 0, sortOrder: 6, nameVisible: true, numberVisible: true },
    { id: 'nc', name: '95-96', number: '95-96', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 80, y: 20 }, orientation: 'right', length: 0, sortOrder: 7, nameVisible: true, numberVisible: true },
    { id: 'no', name: '97-98', number: '97-98', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 80, y: 60 }, orientation: 'right', length: 0, sortOrder: 8, nameVisible: true, numberVisible: true },
  ],
  units: [
    {
      unitId: 1,
      name: 'Power',
      graphics: [
        { kind: 'rect', x: 8, y: 10, width: 56, height: 60, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
        { kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
        { kind: 'polyline', points: [{ x: 40, y: 0 }, { x: 40, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
        { kind: 'polyline', points: [{ x: 60, y: 0 }, { x: 60, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
      ],
      pins: [
        { id: 'l1_in', name: '1', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
        { id: 'l2_in', name: '3', number: '3', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 40, y: 0 }, orientation: 'up', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
        { id: 'l3_in', name: '5', number: '5', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 60, y: 0 }, orientation: 'up', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
        { id: 'l1_out', name: '2', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 80 }, orientation: 'down', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
        { id: 'l2_out', name: '4', number: '4', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 40, y: 80 }, orientation: 'down', length: 0, sortOrder: 5, nameVisible: true, numberVisible: true },
        { id: 'l3_out', name: '6', number: '6', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 60, y: 80 }, orientation: 'down', length: 0, sortOrder: 6, nameVisible: true, numberVisible: true },
      ],
    },
    {
      unitId: 2,
      name: 'Aux Contact',
      graphics: [
        { kind: 'polyline', points: [{ x: 64, y: 20 }, { x: 80, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
        { kind: 'polyline', points: [{ x: 64, y: 60 }, { x: 80, y: 60 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
      ],
      pins: [
        { id: 'nc', name: '95-96', number: '95-96', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 80, y: 20 }, orientation: 'right', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
        { id: 'no', name: '97-98', number: '97-98', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 80, y: 60 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
      ],
    },
  ],
  properties: [
    { key: 'designation', value: 'F1', type: 'string', visible: true, editorType: 'text' },
    { key: 'overloadClass', value: '10', type: 'string', visible: true, editorType: 'text' },
    { key: 'currentMin', value: 1, type: 'number', visible: true, editorType: 'number' },
    { key: 'currentMax', value: 1.6, type: 'number', visible: true, editorType: 'number' },
    { key: 'tripped', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
