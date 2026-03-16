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
  width: 40,
  height: 40,
  graphics: [
    { id: 'lead-top', kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 8 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { id: 'lamp-body', kind: 'circle', cx: 20, cy: 20, r: 10, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { id: 'filament-1', kind: 'polyline', points: [{ x: 14, y: 14 }, { x: 26, y: 26 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { id: 'filament-2', kind: 'polyline', points: [{ x: 26, y: 14 }, { x: 14, y: 26 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { id: 'lead-bottom', kind: 'polyline', points: [{ x: 20, y: 30 }, { x: 20, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'in', name: '+', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: '-', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 40 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
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
        { id: 'halo', kind: 'circle', cx: 20, cy: 20, r: 14, stroke: 'transparent', fill: '#bbf7d0', strokeWidth: 0 },
        { id: 'lead-top', kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 8 }], stroke: '#22c55e', fill: 'none', strokeWidth: 2 },
        { id: 'lamp-body', kind: 'circle', cx: 20, cy: 20, r: 10, stroke: '#22c55e', fill: '#86efac', strokeWidth: 2 },
        { id: 'filament-1', kind: 'polyline', points: [{ x: 14, y: 14 }, { x: 26, y: 26 }], stroke: '#166534', fill: 'none', strokeWidth: 1.5 },
        { id: 'filament-2', kind: 'polyline', points: [{ x: 26, y: 14 }, { x: 14, y: 26 }], stroke: '#166534', fill: 'none', strokeWidth: 1.5 },
        { id: 'lead-bottom', kind: 'polyline', points: [{ x: 20, y: 30 }, { x: 20, y: 40 }], stroke: '#22c55e', fill: 'none', strokeWidth: 2 },
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

