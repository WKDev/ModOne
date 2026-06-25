import type { SymbolDefinition } from '@/types/symbol';

export const powerSourceAc1pSymbol: SymbolDefinition = {
  id: 'builtin:power_source_ac_1p',
  name: 'AC Power Source (1-Port)',
  version: '1.0.0',
  description: 'Single-port AC power origin (e.g. L1)',
  category: 'power',
  author: 'ModOne',
  createdAt: '2026-03-10T00:00:00Z',
  updatedAt: '2026-03-10T00:00:00Z',
  width: 20,
  height: 20,
  graphics: [
    { kind: 'circle', cx: 10, cy: 8, r: 5, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 7, y: 8 }, { x: 8.5, y: 6.5 }, { x: 11.5, y: 9.5 }, { x: 13, y: 8 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { kind: 'polyline', points: [{ x: 10, y: 13 }, { x: 10, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'out', name: 'L', number: '1', type: 'output', electricalType: 'power_out', functionalRole: 'general', shape: 'line', position: { x: 10, y: 20 }, orientation: 'down', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'L1', type: 'string', visible: true, editorType: 'text' },
    { key: 'voltage', value: 230, type: 'number', visible: true, editorType: 'number' },
    { key: 'frequency', value: 50, type: 'number', visible: true, editorType: 'number' },
  ],
};
