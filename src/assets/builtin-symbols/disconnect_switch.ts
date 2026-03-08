import type { SymbolDefinition } from '@/types/symbol';

export const disconnectSwitchSymbol: SymbolDefinition = {
  id: 'builtin:disconnect_switch',
  name: 'Disconnect Switch',
  version: '1.0.0',
  description: 'Three-pole disconnect switch',
  category: 'switching',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 60,
  height: 70,
  graphics: [
    { kind: 'polyline', points: [{ x: 15, y: 0 }, { x: 15, y: 24 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 15, y: 26 }, { x: 15, y: 70 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 30, y: 0 }, { x: 30, y: 24 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 30, y: 26 }, { x: 30, y: 70 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 45, y: 0 }, { x: 45, y: 24 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 45, y: 26 }, { x: 45, y: 70 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 10, y: 24 }, { x: 50, y: 24 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'l1_in', name: '1', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 15, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'l2_in', name: '3', number: '3', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 30, y: 0 }, orientation: 'up', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'l3_in', name: '5', number: '5', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 45, y: 0 }, orientation: 'up', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
    { id: 'l1_out', name: '2', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 15, y: 70 }, orientation: 'down', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
    { id: 'l2_out', name: '4', number: '4', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 30, y: 70 }, orientation: 'down', length: 0, sortOrder: 5, nameVisible: true, numberVisible: true },
    { id: 'l3_out', name: '6', number: '6', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 45, y: 70 }, orientation: 'down', length: 0, sortOrder: 6, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'Q1', type: 'string', visible: true, editorType: 'text' },
    { key: 'disconnectType', value: 'rotary', type: 'string', visible: true, editorType: 'text' },
    { key: 'poles', value: 3, type: 'number', visible: true, editorType: 'number' },
    { key: 'currentRating', value: 25, type: 'number', visible: true, editorType: 'number' },
    { key: 'open', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
