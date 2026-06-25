import type { SymbolDefinition } from '@/types/symbol';

export const timerOnDelaySymbol: SymbolDefinition = {
  id: 'builtin:timer_on_delay',
  name: 'Timer On-Delay',
  version: '1.0.0',
  description: 'PLC on-delay timer block',
  category: 'plc',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 40,
  height: 40,
  graphics: [
    { kind: 'rect', x: 2, y: 2, width: 36, height: 36, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'circle', cx: 12, cy: 20, r: 5, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 12, y: 20 }, { x: 12, y: 17.25 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 12, y: 20 }, { x: 14.25, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 21, y: 14 }, { x: 21, y: 26 }, { x: 25, y: 22 }, { x: 29, y: 26 }, { x: 29, y: 14 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 40, y: 20 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'T1', type: 'string', visible: true, editorType: 'text' },
    { key: 'delayMs', value: 1000, type: 'number', visible: true, editorType: 'number' },
    { key: 'running', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
