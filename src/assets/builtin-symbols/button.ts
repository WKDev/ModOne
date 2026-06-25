import type { SymbolDefinition } from '@/types/symbol';

export const buttonSymbol: SymbolDefinition = {
  id: 'builtin:button',
  name: 'Button',
  version: '1.0.0',
  description: 'Pushbutton contact',
  category: 'control',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 20,
  height: 20,
  graphics: [
    { id: 'lead-in', kind: 'polyline', points: [{ x: 0, y: 10 }, { x: 7, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { id: 'contact-arm', kind: 'polyline', points: [{ x: 7, y: 12 }, { x: 13, y: 8 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { id: 'lead-out', kind: 'polyline', points: [{ x: 13, y: 10 }, { x: 20, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { id: 'plunger-head', kind: 'polyline', points: [{ x: 7, y: 5 }, { x: 13, y: 5 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 10 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 10 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
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
      graphics: [
        { id: 'lead-in', kind: 'polyline', points: [{ x: 0, y: 10 }, { x: 7, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
        { id: 'contact-arm', kind: 'polyline', points: [{ x: 7, y: 10 }, { x: 13, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
        { id: 'lead-out', kind: 'polyline', points: [{ x: 13, y: 10 }, { x: 20, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
        { id: 'plunger-head', kind: 'polyline', points: [{ x: 7, y: 6 }, { x: 13, y: 6 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
      ],
    },
  },
  properties: [
    { key: 'mode', value: 'momentary', type: 'string', visible: true, editorType: 'text' },
    { key: 'contactConfig', value: '1a', type: 'string', visible: true, editorType: 'text' },
    { key: 'pressed', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};

