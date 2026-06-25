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
  width: 50,
  height: 40,
  graphics: [
    { kind: 'rect', x: 5, y: 4, width: 42, height: 32, stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 9, y: 24 }, { x: 15, y: 24 }, { x: 19, y: 14 }, { x: 25, y: 30 }, { x: 31, y: 18 }, { x: 39, y: 18 }], stroke: '#888', fill: 'none', strokeWidth: 0.75 },
    { kind: 'text', x: 26, y: 11, text: 'SCOPE', fontSize: 4.5, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
  ],
  pins: [
    { id: 'ch1', name: 'CH1', number: '1', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 10 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
    { id: 'ch2', name: 'CH2', number: '2', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0, sortOrder: 2, nameVisible: true, numberVisible: true },
    { id: 'ch3', name: 'CH3', number: '3', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 30 }, orientation: 'left', length: 0, sortOrder: 3, nameVisible: true, numberVisible: true },
    { id: 'ch4', name: 'CH4', number: '4', type: 'input', electricalType: 'input', functionalRole: 'general', shape: 'line', position: { x: 0, y: 40 }, orientation: 'left', length: 0, sortOrder: 4, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'channels', value: 1, type: 'number', visible: true, editorType: 'number' },
    { key: 'triggerMode', value: 'auto', type: 'string', visible: true, editorType: 'text' },
    { key: 'timeBase', value: 100, type: 'number', visible: true, editorType: 'number' },
    { key: 'voltageScale', value: 5, type: 'number', visible: true, editorType: 'number' },
  ],
};
