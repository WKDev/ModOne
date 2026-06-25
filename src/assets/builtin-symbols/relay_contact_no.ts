import type { SymbolDefinition } from '@/types/symbol';

export const relayContactNoSymbol: SymbolDefinition = {
  id: 'builtin:relay_contact_no',
  name: 'Relay Contact NO',
  version: '1.0.0',
  description: 'Normally-open relay contact',
  category: 'switching',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 30,
  height: 20,
  graphics: [
    { id: 'lead-in', kind: 'polyline', points: [{ x: 2, y: 10 }, { x: 10, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { id: 'lead-out', kind: 'polyline', points: [{ x: 20, y: 10 }, { x: 28, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { id: 'contact-arm', kind: 'polyline', points: [{ x: 10, y: 14 }, { x: 20, y: 6 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 10 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 30, y: 10 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  behavior: {
    templateId: 'archetype:relay',
    archetype: 'relay',
    interactionMode: 'none',
    deviceScoped: true,
    terminalRoles: { in: 'COM', out: 'NO' },
  },
  visualStates: {
    closed: {
      graphics: [
        { id: 'lead-in', kind: 'polyline', points: [{ x: 2, y: 10 }, { x: 10, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
        { id: 'lead-out', kind: 'polyline', points: [{ x: 20, y: 10 }, { x: 28, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
        { id: 'contact-arm', kind: 'polyline', points: [{ x: 10, y: 10 }, { x: 20, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
      ],
    },
  },
  properties: [
    { key: 'designation', value: 'K1', type: 'string', visible: true, editorType: 'text' },
    { key: 'coilVoltage', value: 24, type: 'number', visible: true, editorType: 'number' },
    { key: 'energized', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
    { key: 'normallyOpen', value: true, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};

