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
  width: 80,
  height: 80,
  graphics: [
    { kind: 'rect', x: 4, y: 4, width: 72, height: 72, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'circle', cx: 24, cy: 40, r: 10, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 24, y: 40 }, { x: 24, y: 34.5 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 24, y: 40 }, { x: 28.5, y: 40 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 42, y: 28 }, { x: 42, y: 52 }, { x: 50, y: 44 }, { x: 58, y: 52 }, { x: 58, y: 28 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
  ],
  pins: [
    { id: 'in', name: 'IN', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 40 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'out', name: 'OUT', number: '2', type: 'output', electricalType: 'output', functionalRole: 'general', shape: 'line', position: { x: 80, y: 40 }, orientation: 'right', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'designation', value: 'T1', type: 'string', visible: true, editorType: 'text' },
    { key: 'delayMs', value: 1000, type: 'number', visible: true, editorType: 'number' },
    { key: 'running', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
