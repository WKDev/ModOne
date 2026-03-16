import type { SymbolDefinition } from '@/types/symbol';

export const ledSymbol: SymbolDefinition = {
  id: 'builtin:led',
  name: 'LED',
  version: '1.0.0',
  description: 'Light emitting diode',
  category: 'indicator',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 40,
  height: 60,
  graphics: [
    { id: 'lead-top', kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { id: 'diode-body', kind: 'polyline', points: [{ x: 10, y: 20 }, { x: 30, y: 20 }, { x: 20, y: 34 }, { x: 10, y: 20 }], stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { id: 'cathode-bar', kind: 'polyline', points: [{ x: 10, y: 38 }, { x: 30, y: 38 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { id: 'ray-1', kind: 'polyline', points: [{ x: 24, y: 15 }, { x: 30, y: 9 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { id: 'ray-2', kind: 'polyline', points: [{ x: 28, y: 19 }, { x: 34, y: 13 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { id: 'lead-bottom', kind: 'polyline', points: [{ x: 20, y: 38 }, { x: 20, y: 60 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'anode', name: '+', number: 'A', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'cathode', name: '-', number: 'K', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 20, y: 60 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  behavior: {
    templateId: 'archetype:lamp',
    archetype: 'lamp',
    interactionMode: 'none',
    deviceScoped: true,
    terminalRoles: { anode: 'L+', cathode: 'L-' },
  },
  visualStates: {
    lit: {
      graphics: [
        { id: 'glow', kind: 'circle', cx: 20, cy: 28, r: 16, stroke: 'transparent', fill: '#fca5a5', strokeWidth: 0 },
        { id: 'lead-top', kind: 'polyline', points: [{ x: 20, y: 0 }, { x: 20, y: 10 }], stroke: '#ef4444', fill: 'none', strokeWidth: 2 },
        { id: 'diode-body', kind: 'polyline', points: [{ x: 10, y: 20 }, { x: 30, y: 20 }, { x: 20, y: 34 }, { x: 10, y: 20 }], stroke: '#ef4444', fill: '#fecaca', strokeWidth: 2 },
        { id: 'cathode-bar', kind: 'polyline', points: [{ x: 10, y: 38 }, { x: 30, y: 38 }], stroke: '#ef4444', fill: 'none', strokeWidth: 2 },
        { id: 'ray-1', kind: 'polyline', points: [{ x: 24, y: 15 }, { x: 30, y: 9 }], stroke: '#ef4444', fill: 'none', strokeWidth: 1.5 },
        { id: 'ray-2', kind: 'polyline', points: [{ x: 28, y: 19 }, { x: 34, y: 13 }], stroke: '#ef4444', fill: 'none', strokeWidth: 1.5 },
        { id: 'lead-bottom', kind: 'polyline', points: [{ x: 20, y: 38 }, { x: 20, y: 60 }], stroke: '#ef4444', fill: 'none', strokeWidth: 2 },
      ],
    },
  },
  properties: [
    { key: 'color', value: 'red', type: 'string', visible: true, editorType: 'text' },
    { key: 'forwardVoltage', value: 2, type: 'number', visible: true, editorType: 'number' },
    { key: 'lit', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};

