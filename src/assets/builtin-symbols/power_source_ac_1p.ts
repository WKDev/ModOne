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
  width: 40,
  height: 40,
  graphics: [
    { kind: 'circle', cx: 20, cy: 16, r: 10, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 14, y: 16 }, { x: 17, y: 13 }, { x: 23, y: 19 }, { x: 26, y: 16 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 20, y: 26 }, { x: 20, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'out', name: 'L', number: '1', type: 'output', electricalType: 'power_out', functionalRole: 'general', shape: 'line', position: { x: 20, y: 40 }, orientation: 'down', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'L1', type: 'string', visible: true, editorType: 'text' },
    { key: 'voltage', value: 230, type: 'number', visible: true, editorType: 'number' },
    { key: 'frequency', value: 50, type: 'number', visible: true, editorType: 'number' },
  ],
};
