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
  width: 20,
  height: 30,
  graphics: [
    { id: 'lead-top', kind: 'polyline', points: [{ x: 10, y: 0 }, { x: 10, y: 5 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { id: 'diode-body', kind: 'polyline', points: [{ x: 5, y: 10 }, { x: 15, y: 10 }, { x: 10, y: 17 }, { x: 5, y: 10 }], stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { id: 'cathode-bar', kind: 'polyline', points: [{ x: 5, y: 19 }, { x: 15, y: 19 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { id: 'ray-1', kind: 'polyline', points: [{ x: 12, y: 7.5 }, { x: 15, y: 4.5 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { id: 'ray-2', kind: 'polyline', points: [{ x: 14, y: 9.5 }, { x: 17, y: 6.5 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { id: 'lead-bottom', kind: 'polyline', points: [{ x: 10, y: 19 }, { x: 10, y: 30 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'anode', name: '+', number: 'A', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 10, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'cathode', name: '-', number: 'K', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 10, y: 30 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
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
        { id: 'glow', kind: 'circle', cx: 10, cy: 14, r: 8, stroke: 'transparent', fill: '#fca5a5', strokeWidth: 0 },
        { id: 'lead-top', kind: 'polyline', points: [{ x: 10, y: 0 }, { x: 10, y: 5 }], stroke: '#ef4444', fill: 'none', strokeWidth: 1 },
        { id: 'diode-body', kind: 'polyline', points: [{ x: 5, y: 10 }, { x: 15, y: 10 }, { x: 10, y: 17 }, { x: 5, y: 10 }], stroke: '#ef4444', fill: '#fecaca', strokeWidth: 1 },
        { id: 'cathode-bar', kind: 'polyline', points: [{ x: 5, y: 19 }, { x: 15, y: 19 }], stroke: '#ef4444', fill: 'none', strokeWidth: 1 },
        { id: 'ray-1', kind: 'polyline', points: [{ x: 12, y: 7.5 }, { x: 15, y: 4.5 }], stroke: '#ef4444', fill: 'none', strokeWidth: 0.75 },
        { id: 'ray-2', kind: 'polyline', points: [{ x: 14, y: 9.5 }, { x: 17, y: 6.5 }], stroke: '#ef4444', fill: 'none', strokeWidth: 0.75 },
        { id: 'lead-bottom', kind: 'polyline', points: [{ x: 10, y: 19 }, { x: 10, y: 30 }], stroke: '#ef4444', fill: 'none', strokeWidth: 1 },
      ],
    },
  },
  properties: [
    { key: 'color', value: 'red', type: 'string', visible: true, editorType: 'text' },
    { key: 'forwardVoltage', value: 2, type: 'number', visible: true, editorType: 'number' },
    { key: 'lit', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};

