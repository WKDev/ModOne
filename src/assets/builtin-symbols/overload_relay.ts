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
  width: 40,
  height: 40,
  graphics: [
    { kind: 'rect', x: 4, y: 5, width: 28, height: 30, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 10, y: 0 }, { x: 10, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { kind: 'polyline', points: [{ x: 30, y: 0 }, { x: 30, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { kind: 'polyline', points: [{ x: 32, y: 10 }, { x: 40, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { kind: 'polyline', points: [{ x: 32, y: 30 }, { x: 40, y: 30 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
  ],
  pins: [
    { id: 'l1_in', name: '1', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 10, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'l2_in', name: '3', number: '3', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'l3_in', name: '5', number: '5', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 30, y: 0 }, orientation: 'up', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
    { id: 'l1_out', name: '2', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 10, y: 40 }, orientation: 'down', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
    { id: 'l2_out', name: '4', number: '4', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 40 }, orientation: 'down', length: 0, sortOrder: 5, nameVisible: true, numberVisible: true },
    { id: 'l3_out', name: '6', number: '6', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 30, y: 40 }, orientation: 'down', length: 0, sortOrder: 6, nameVisible: true, numberVisible: true },
    { id: 'nc', name: '95-96', number: '95-96', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 40, y: 10 }, orientation: 'right', length: 0, sortOrder: 7, nameVisible: true, numberVisible: true },
    { id: 'no', name: '97-98', number: '97-98', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 40, y: 30 }, orientation: 'right', length: 0, sortOrder: 8, nameVisible: true, numberVisible: true },
  ],
  units: [
    {
      unitId: 1,
      name: 'Power',
      graphics: [
        { kind: 'rect', x: 4, y: 5, width: 28, height: 30, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
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
    {
      unitId: 2,
      name: 'Aux Contact',
      graphics: [
        { kind: 'polyline', points: [{ x: 32, y: 10 }, { x: 40, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
        { kind: 'polyline', points: [{ x: 32, y: 30 }, { x: 40, y: 30 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
      ],
      pins: [
        { id: 'nc', name: '95-96', number: '95-96', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 40, y: 10 }, orientation: 'right', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
        { id: 'no', name: '97-98', number: '97-98', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 40, y: 30 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
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
