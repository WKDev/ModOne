import type { SymbolDefinition } from '@/types/symbol';

export const switchNcSymbol: SymbolDefinition = {
  id: 'builtin:switch_nc',
  name: 'Switch NC',
  version: '1.0.0',
  description: 'Normally-closed switch contact',
  category: 'switching',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 30,
  height: 20,
  graphics: [
    { id: 'lead-in', kind: 'polyline', points: [{ x: 2, y: 10 }, { x: 10, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { id: 'lead-out', kind: 'polyline', points: [{ x: 20, y: 10 }, { x: 28, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { id: 'terminal-in', kind: 'circle', cx: 10, cy: 10, r: 1, stroke: '#888', fill: '#888', strokeWidth: 1 },
    { id: 'terminal-out', kind: 'circle', cx: 20, cy: 10, r: 1, stroke: '#888', fill: '#888', strokeWidth: 1 },
    { id: 'contact-arm', kind: 'polyline', points: [{ x: 10, y: 10 }, { x: 19, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 10 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 30, y: 10 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  behavior: {
    templateId: 'archetype:switch',
    archetype: 'switch',
    interactionMode: 'maintained',
    deviceScoped: false,
    terminalRoles: { in: 'IN', out: 'OUT' },
  },
  visualStates: {
    open: {
      graphics: [
        { id: 'lead-in', kind: 'polyline', points: [{ x: 2, y: 10 }, { x: 10, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
        { id: 'lead-out', kind: 'polyline', points: [{ x: 20, y: 10 }, { x: 28, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
        { id: 'terminal-in', kind: 'circle', cx: 10, cy: 10, r: 1, stroke: '#888', fill: '#888', strokeWidth: 1 },
        { id: 'terminal-out', kind: 'circle', cx: 20, cy: 10, r: 1, stroke: '#888', fill: '#888', strokeWidth: 1 },
        { id: 'contact-arm', kind: 'polyline', points: [{ x: 10, y: 10 }, { x: 18, y: 4 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
      ],
    },
  },
  properties: [
    { key: 'designation', value: 'S1', type: 'string', visible: true, editorType: 'text' },
    { key: 'normallyOpen', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};

