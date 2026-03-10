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
  width: 80,
  height: 80,
  graphics: [
    { kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 12 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 40, y: 0 }, { x: 40, y: 12 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 60, y: 0 }, { x: 60, y: 12 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'circle', cx: 40, cy: 40, r: 24, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'text', x: 40, y: 45, text: 'M', fontSize: 16, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
    { kind: 'polyline', points: [{ x: 34, y: 50 }, { x: 37, y: 48 }, { x: 43, y: 52 }, { x: 46, y: 50 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 40, y: 64 }, { x: 40, y: 80 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
  ],
  pins: [
    { id: 'l1', name: 'U', number: 'U', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'l2', name: 'V', number: 'V', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 40, y: 0 }, orientation: 'up', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'l3', name: 'W', number: 'W', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 60, y: 0 }, orientation: 'up', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
    { id: 'pe', name: 'PE', number: 'PE', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 40, y: 80 }, orientation: 'down', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'M1', type: 'string', visible: true, editorType: 'text' },
    { key: 'powerKw', value: 1.5, type: 'number', visible: true, editorType: 'number' },
    { key: 'voltageRating', value: 400, type: 'number', visible: true, editorType: 'number' },
    { key: 'running', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
