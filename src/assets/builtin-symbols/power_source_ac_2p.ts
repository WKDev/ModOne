import type { SymbolDefinition } from '@/types/symbol';

export const powerSourceAc2pSymbol: SymbolDefinition = {
  id: 'builtin:power_source_ac_2p',
  name: 'AC Power Source (2-Port)',
  version: '1.0.0',
  description: 'Two-port AC power generator (L and N)',
  category: 'power',
  author: 'ModOne',
  createdAt: '2026-03-10T00:00:00Z',
  updatedAt: '2026-03-10T00:00:00Z',
  width: 60,
  height: 60,
  graphics: [
    { kind: 'circle', cx: 30, cy: 30, r: 16, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 20, y: 30 }, { x: 25, y: 26 }, { x: 35, y: 34 }, { x: 40, y: 30 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 30, y: 14 }, { x: 30, y: 0 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 30, y: 46 }, { x: 30, y: 60 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'l', name: 'L', number: '1', type: 'output', electricalType: 'power_out', functionalRole: 'general', shape: 'line', position: { x: 30, y: 0 }, orientation: 'up', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'n', name: 'N', number: '2', type: 'output', electricalType: 'power_out', functionalRole: 'general', shape: 'line', position: { x: 30, y: 60 }, orientation: 'down', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'G1', type: 'string', visible: true, editorType: 'text' },
    { key: 'voltage', value: 230, type: 'number', visible: true, editorType: 'number' },
    { key: 'frequency', value: 50, type: 'number', visible: true, editorType: 'number' },
  ],
};
