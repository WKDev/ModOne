import type { SymbolDefinition } from '@/types/symbol';

export const scopeSymbol: SymbolDefinition = {
  id: 'builtin:scope',
  name: 'Scope',
  version: '1.0.0',
  description: 'Measurement oscilloscope',
  category: 'measurement',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 100,
  height: 80,
  graphics: [
    { kind: 'rect', x: 10, y: 8, width: 84, height: 64, stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 18, y: 48 }, { x: 30, y: 48 }, { x: 38, y: 28 }, { x: 50, y: 60 }, { x: 62, y: 36 }, { x: 78, y: 36 }], stroke: '#888', fill: 'none', strokeWidth: 1.5 },
    { kind: 'text', x: 52, y: 22, text: 'SCOPE', fontSize: 9, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
  ],
  pins: [
    { id: 'ch1', name: 'CH1', number: '1', type: 'input', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0 },
    { id: 'ch2', name: 'CH2', number: '2', type: 'input', shape: 'line', position: { x: 0, y: 40 }, orientation: 'left', length: 0 },
    { id: 'ch3', name: 'CH3', number: '3', type: 'input', shape: 'line', position: { x: 0, y: 60 }, orientation: 'left', length: 0 },
    { id: 'ch4', name: 'CH4', number: '4', type: 'input', shape: 'line', position: { x: 0, y: 80 }, orientation: 'left', length: 0 },
  ],
  properties: [
    { key: 'channels', value: 1, type: 'number', visible: true, editorType: 'number' },
    { key: 'triggerMode', value: 'auto', type: 'string', visible: true, editorType: 'text' },
    { key: 'timeBase', value: 100, type: 'number', visible: true, editorType: 'number' },
    { key: 'voltageScale', value: 5, type: 'number', visible: true, editorType: 'number' },
  ],
};
