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
  width: 60,
  height: 70,
  graphics: [
    { kind: 'rect', x: 8, y: 10, width: 44, height: 50, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 15, y: 0 }, { x: 15, y: 70 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 30, y: 0 }, { x: 30, y: 70 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 45, y: 0 }, { x: 45, y: 70 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 46, y: 24.5 }, { x: 60, y: 24.5 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 46, y: 45.5 }, { x: 60, y: 45.5 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
  ],
  pins: [
    { id: 'l1_in', name: '1', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 15, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'l2_in', name: '3', number: '3', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 30, y: 0 }, orientation: 'up', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'l3_in', name: '5', number: '5', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 45, y: 0 }, orientation: 'up', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
    { id: 'l1_out', name: '2', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 15, y: 70 }, orientation: 'down', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
    { id: 'l2_out', name: '4', number: '4', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 30, y: 70 }, orientation: 'down', length: 0, sortOrder: 5, nameVisible: true, numberVisible: true },
    { id: 'l3_out', name: '6', number: '6', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 45, y: 70 }, orientation: 'down', length: 0, sortOrder: 6, nameVisible: true, numberVisible: true },
    { id: 'nc', name: '95-96', number: '95-96', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 60, y: 24.5 }, orientation: 'right', length: 0, sortOrder: 7, nameVisible: true, numberVisible: true },
    { id: 'no', name: '97-98', number: '97-98', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 60, y: 45.5 }, orientation: 'right', length: 0, sortOrder: 8, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'F1', type: 'string', visible: true, editorType: 'text' },
    { key: 'overloadClass', value: '10', type: 'string', visible: true, editorType: 'text' },
    { key: 'currentMin', value: 1, type: 'number', visible: true, editorType: 'number' },
    { key: 'currentMax', value: 1.6, type: 'number', visible: true, editorType: 'number' },
    { key: 'tripped', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
