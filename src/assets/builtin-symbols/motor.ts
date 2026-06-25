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
  width: 40,
  height: 40,
  graphics: [
    { id: 'lead-u', kind: 'polyline', points: [{ x: 10, y: 0 }, { x: 10, y: 6 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { id: 'lead-v', kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 6 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { id: 'lead-w', kind: 'polyline', points: [{ x: 30, y: 0 }, { x: 30, y: 6 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { id: 'motor-body', kind: 'circle', cx: 20, cy: 20, r: 12, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { id: 'motor-label', kind: 'text', x: 20, y: 22.5, text: 'M', fontSize: 8, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
    { id: 'rotor', kind: 'polyline', points: [{ x: 17, y: 25 }, { x: 18.5, y: 24 }, { x: 21.5, y: 26 }, { x: 23, y: 25 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { id: 'lead-pe', kind: 'polyline', points: [{ x: 20, y: 32 }, { x: 20, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
  ],
  pins: [
    { id: 'l1', name: 'U', number: 'U', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 10, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'l2', name: 'V', number: 'V', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'l3', name: 'W', number: 'W', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 30, y: 0 }, orientation: 'up', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
    { id: 'pe', name: 'PE', number: 'PE', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 40 }, orientation: 'down', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
  ],
  behavior: {
    templateId: 'archetype:motor',
    archetype: 'motor',
    interactionMode: 'none',
    deviceScoped: true,
    terminalRoles: { l1: 'L1', l2: 'L2', l3: 'L3', pe: 'PE' },
  },
  visualStates: {
    running: {
      primitiveOverrides: {
        'motor-body': {
          stroke: '#22c55e',
          fill: '#dcfce7',
        },
        'motor-label': {
          fill: '#15803d',
        },
        rotor: {
          stroke: '#166534',
          transform: {
            pivotX: 40,
            pivotY: 50,
          },
        },
      },
    },
  },
  animations: {
    running: [
      {
        type: 'rotate',
        target: 'rotor',
        speed: 240,
        pivot: { x: 20, y: 25 },
      },
    ],
  },
  properties: [
    { key: 'designation', value: 'M1', type: 'string', visible: true, editorType: 'text' },
    { key: 'powerKw', value: 1.5, type: 'number', visible: true, editorType: 'number' },
    { key: 'voltageRating', value: 400, type: 'number', visible: true, editorType: 'number' },
    { key: 'running', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};

