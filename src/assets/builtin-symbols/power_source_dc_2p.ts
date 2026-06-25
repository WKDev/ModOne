import type { SymbolDefinition } from '@/types/symbol';

export const powerSourceDc2pSymbol: SymbolDefinition = {
  id: 'builtin:power_source_dc_2p',
  name: 'DC Power Source (2-Port)',
  version: '1.0.0',
  description: 'DC Battery / Power Source with two ports (+ and -)',
  category: 'power',
  author: 'ModOne',
  createdAt: '2026-03-10T00:00:00Z',
  updatedAt: '2026-03-10T00:00:00Z',
  width: 20,
  height: 30,
  graphics: [
    { kind: 'polyline', points: [{ x: 4, y: 13 }, { x: 16, y: 13 }], stroke: '#ef4444', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 7, y: 17 }, { x: 13, y: 17 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 10, y: 13 }, { x: 10, y: 0 }], stroke: '#ef4444', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 10, y: 17 }, { x: 10, y: 30 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'pos', name: '+', number: '1', type: 'output', electricalType: 'power_out', functionalRole: 'general', shape: 'line', position: { x: 10, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'neg', name: '-', number: '2', type: 'output', electricalType: 'power_out', functionalRole: 'general', shape: 'line', position: { x: 10, y: 30 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'BAT1', type: 'string', visible: true, editorType: 'text' },
    { key: 'voltage', value: 24, type: 'number', visible: true, editorType: 'number' },
  ],
};
