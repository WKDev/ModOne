import type { SymbolDefinition } from '@/types/symbol';

export const emergencyStopSymbol: SymbolDefinition = {
  id: 'builtin:emergency_stop',
  name: 'Emergency Stop',
  version: '1.0.0',
  description: 'Emergency stop pushbutton',
  category: 'control',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 50,
  height: 50,
  graphics: [
    { kind: 'polyline', points: [{ x: 0, y: 25 }, { x: 12, y: 25 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'circle', cx: 25, cy: 25, r: 11, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'circle', cx: 25, cy: 25, r: 6, stroke: '#888', fill: 'transparent', strokeWidth: 1.5 },
    { kind: 'polyline', points: [{ x: 38, y: 25 }, { x: 50, y: 25 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'input', shape: 'line', position: { x: 0, y: 25 }, orientation: 'left', length: 0 },
    { id: 'out', name: 'OUT', number: '2', type: 'output', shape: 'line', position: { x: 50, y: 25 }, orientation: 'right', length: 0 },
  ],
  properties: [
    { key: 'designation', value: 'ES1', type: 'string', visible: true, editorType: 'text' },
    { key: 'engaged', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
