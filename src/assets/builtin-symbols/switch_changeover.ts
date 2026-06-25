import type { SymbolDefinition } from '@/types/symbol';

export const switchChangeoverSymbol: SymbolDefinition = {
  id: 'builtin:switch_changeover',
  name: 'Switch Changeover',
  version: '1.0.0',
  description: 'Single-pole changeover switch',
  category: 'switching',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 40,
  height: 40,
  graphics: [
    { id: 'lead-com', kind: 'polyline', points: [{ x: 2, y: 20 }, { x: 12, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { id: 'lead-pos1', kind: 'polyline', points: [{ x: 28, y: 10 }, { x: 38, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { id: 'lead-pos2', kind: 'polyline', points: [{ x: 28, y: 20 }, { x: 38, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { id: 'terminal-com', kind: 'circle', cx: 12, cy: 20, r: 1, stroke: '#888', fill: '#888', strokeWidth: 1 },
    { id: 'terminal-pos1', kind: 'circle', cx: 28, cy: 10, r: 1, stroke: '#888', fill: '#888', strokeWidth: 1 },
    { id: 'terminal-pos2', kind: 'circle', cx: 28, cy: 20, r: 1, stroke: '#888', fill: '#888', strokeWidth: 1 },
    { id: 'switch-arm', kind: 'polyline', points: [{ x: 12, y: 20 }, { x: 27, y: 11 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'com', name: 'COM', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'pos1', name: 'NO', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 40, y: 10 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'pos2', name: 'NC', number: '3', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 40, y: 20 }, orientation: 'right', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
  ],
  behavior: {
    templateId: 'archetype:switch',
    archetype: 'switch',
    interactionMode: 'maintained',
    deviceScoped: false,
    terminalRoles: { com: 'COM', pos1: 'NO', pos2: 'NC' },
  },
  visualStates: {
    open: {
      primitiveOverrides: {
        'switch-arm': {
          transform: {
            translateX: -4,
            translateY: 4,
          },
        },
      },
    },
    closed: {
      primitiveOverrides: {
        'switch-arm': {
          stroke: '#eab308',
        },
      },
    },
  },
  properties: [
    { key: 'designation', value: 'S1', type: 'string', visible: true, editorType: 'text' },
    { key: 'normallyOpen', value: true, type: 'boolean', visible: true, editorType: 'checkbox' },
    { key: 'position', value: 1, type: 'number', visible: true, editorType: 'number' },
  ],
};
