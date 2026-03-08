import type { SymbolDefinition } from '@/types/symbol';

export const motorSymbol: SymbolDefinition = {
  id: 'builtin:motor',
  name: 'Motor',
  version: '1.0.0',
  description: 'Three-phase motor',
  category: 'actuator',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 60,
  height: 60,
  graphics: [
    { kind: 'polyline', points: [{ x: 15, y: 0 }, { x: 15, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 30, y: 0 }, { x: 30, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 45, y: 0 }, { x: 45, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'circle', cx: 30, cy: 30, r: 18, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'text', x: 30, y: 34, text: 'M', fontSize: 14, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
    { kind: 'polyline', points: [{ x: 30, y: 48 }, { x: 30, y: 60 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
  ],
  pins: [
    { id: 'l1', name: 'U', number: 'U', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 15, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'l2', name: 'V', number: 'V', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 30, y: 0 }, orientation: 'up', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'l3', name: 'W', number: 'W', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 45, y: 0 }, orientation: 'up', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
    { id: 'pe', name: 'PE', number: 'PE', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 30, y: 60 }, orientation: 'down', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'M1', type: 'string', visible: true, editorType: 'text' },
    { key: 'powerKw', value: 1.5, type: 'number', visible: true, editorType: 'number' },
    { key: 'voltageRating', value: 400, type: 'number', visible: true, editorType: 'number' },
    { key: 'running', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
