import type { SymbolDefinition } from '@/types/symbol';

export const relayContactNcSymbol: SymbolDefinition = {
  id: 'builtin:relay_contact_nc',
  name: 'Relay Contact NC',
  version: '1.0.0',
  description: 'Normally-closed relay contact',
  category: 'switching',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 60,
  height: 40,
  graphics: [
    { kind: 'polyline', points: [{ x: 4, y: 20 }, { x: 20, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 20, y: 20 }, { x: 40, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 40, y: 20 }, { x: 56, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 24, y: 12 }, { x: 36, y: 28 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 60, y: 20 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'K1', type: 'string', visible: true, editorType: 'text' },
    { key: 'coilVoltage', value: 24, type: 'number', visible: true, editorType: 'number' },
    { key: 'energized', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
    { key: 'normallyOpen', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
