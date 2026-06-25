import type { SymbolDefinition } from '@/types/symbol';

export const emergencyStopSymbol: SymbolDefinition = {
  id: 'builtin:emergency_stop',
  name: 'Emergency Stop',
  version: '1.0.0',
  description: 'Emergency stop pushbutton',
  category: 'control',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 30,
  height: 20,
  graphics: [
    { id: 'lead-in', kind: 'polyline', points: [{ x: 0, y: 10 }, { x: 7, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { id: 'outer-ring', kind: 'circle', cx: 15, cy: 10, r: 6.5, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { id: 'inner-button', kind: 'circle', cx: 15, cy: 10, r: 3.5, stroke: '#888', fill: 'transparent', strokeWidth: 0.75 },
    { id: 'lead-out', kind: 'polyline', points: [{ x: 23, y: 10 }, { x: 30, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 10 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 30, y: 10 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  behavior: {
    templateId: 'archetype:switch',
    archetype: 'switch',
    interactionMode: 'momentary',
    deviceScoped: false,
    terminalRoles: { in: 'IN', out: 'OUT' },
  },
  visualStates: {
    pressed: {
      primitiveOverrides: {
        'outer-ring': {
          stroke: '#dc2626',
          fill: '#fecaca',
        },
        'inner-button': {
          stroke: '#991b1b',
          fill: '#ef4444',
          transform: {
            translateY: 2,
          },
        },
        'lead-in': {
          stroke: '#dc2626',
        },
        'lead-out': {
          stroke: '#dc2626',
        },
      },
    },
  },
  properties: [
    { key: 'designation', value: 'ES1', type: 'string', visible: true, editorType: 'text' },
    { key: 'engaged', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
