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
  width: 40,
  height: 60,
  graphics: [
    { kind: 'polyline', points: [{ x: 8, y: 26 }, { x: 32, y: 26 }], stroke: '#ef4444', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 14, y: 34 }, { x: 26, y: 34 }], stroke: '#888', fill: 'none', strokeWidth: 4 },
    { kind: 'polyline', points: [{ x: 20, y: 26 }, { x: 20, y: 0 }], stroke: '#ef4444', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 20, y: 34 }, { x: 20, y: 60 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'pos', name: '+', number: '1', type: 'output', electricalType: 'power_out', functionalRole: 'general', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'neg', name: '-', number: '2', type: 'output', electricalType: 'power_out', functionalRole: 'general', shape: 'line', position: { x: 20, y: 60 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'BAT1', type: 'string', visible: true, editorType: 'text' },
    { key: 'voltage', value: 24, type: 'number', visible: true, editorType: 'number' },
  ],
};
