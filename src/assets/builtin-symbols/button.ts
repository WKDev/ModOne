import type { SymbolDefinition } from '@/types/symbol';

export const buttonSymbol: SymbolDefinition = {
  id: 'builtin:button',
  name: 'Button',
  version: '1.0.0',
  description: 'Pushbutton contact',
  category: 'control',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 40,
  height: 40,
  graphics: [
    { kind: 'polyline', points: [{ x: 0, y: 20 }, { x: 14, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 14, y: 24 }, { x: 26, y: 16 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 26, y: 20 }, { x: 40, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 14, y: 10 }, { x: 26, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'input', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0 },
    { id: 'out', name: 'OUT', number: '2', type: 'output', shape: 'line', position: { x: 40, y: 20 }, orientation: 'right', length: 0 },
  ],
  properties: [
    { key: 'mode', value: 'momentary', type: 'string', visible: true, editorType: 'text' },
    { key: 'contactConfig', value: '1a', type: 'string', visible: true, editorType: 'text' },
    { key: 'pressed', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
