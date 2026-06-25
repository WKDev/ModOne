import type { SymbolDefinition } from '@/types/symbol';

export const pilotLampSymbol: SymbolDefinition = {
  id: 'builtin:pilot_lamp',
  name: 'Pilot Lamp',
  version: '1.0.0',
  description: 'Panel indicator lamp',
  category: 'indicator',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 20,
  height: 20,
  graphics: [
    { id: 'lead-top', kind: 'polyline', points: [{ x: 10, y: 0 }, { x: 10, y: 4 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { id: 'lamp-body', kind: 'circle', cx: 10, cy: 10, r: 5, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { id: 'filament-1', kind: 'polyline', points: [{ x: 7, y: 7 }, { x: 13, y: 13 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { id: 'filament-2', kind: 'polyline', points: [{ x: 13, y: 7 }, { x: 7, y: 13 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { id: 'lead-bottom', kind: 'polyline', points: [{ x: 10, y: 15 }, { x: 10, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'in', name: '+', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 10, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: '-', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 10, y: 20 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  behavior: {
    templateId: 'archetype:lamp',
    archetype: 'lamp',
    interactionMode: 'none',
    deviceScoped: true,
    terminalRoles: { in: 'L+', out: 'L-' },
  },
  visualStates: {
    lit: {
      graphics: [
        { id: 'halo', kind: 'circle', cx: 10, cy: 10, r: 7, stroke: 'transparent', fill: '#bbf7d0', strokeWidth: 0 },
        { id: 'lead-top', kind: 'polyline', points: [{ x: 10, y: 0 }, { x: 10, y: 4 }], stroke: '#22c55e', fill: 'none', strokeWidth: 1 },
        { id: 'lamp-body', kind: 'circle', cx: 10, cy: 10, r: 5, stroke: '#22c55e', fill: '#86efac', strokeWidth: 1 },
        { id: 'filament-1', kind: 'polyline', points: [{ x: 7, y: 7 }, { x: 13, y: 13 }], stroke: '#166534', fill: 'none', strokeWidth: 0.75 },
        { id: 'filament-2', kind: 'polyline', points: [{ x: 13, y: 7 }, { x: 7, y: 13 }], stroke: '#166534', fill: 'none', strokeWidth: 0.75 },
        { id: 'lead-bottom', kind: 'polyline', points: [{ x: 10, y: 15 }, { x: 10, y: 20 }], stroke: '#22c55e', fill: 'none', strokeWidth: 1 },
      ],
    },
  },
  properties: [
    { key: 'designation', value: 'H1', type: 'string', visible: true, editorType: 'text' },
    { key: 'lampColor', value: 'green', type: 'string', visible: true, editorType: 'text' },
    { key: 'voltageRating', value: 24, type: 'number', visible: true, editorType: 'number' },
    { key: 'lit', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};

