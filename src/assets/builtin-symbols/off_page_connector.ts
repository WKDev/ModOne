import type { SymbolDefinition } from '@/types/symbol';

export const offPageConnectorSymbol: SymbolDefinition = {
  id: 'builtin:off_page_connector',
  name: 'Off-Page Connector',
  version: '1.0.0',
  description: 'Off-page signal continuation connector',
  category: 'connection',
  author: 'ModOne',
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-05T00:00:00Z',
  width: 80,
  height: 40,
  graphics: [
    { kind: 'polyline', points: [{ x: 0, y: 20 }, { x: 12, y: 20 }], stroke: '#888', fill: 'none', strokeWidth: 2 },
    { kind: 'polyline', points: [{ x: 12, y: 6 }, { x: 64, y: 6 }, { x: 78, y: 20 }, { x: 64, y: 34 }, { x: 12, y: 34 }, { x: 12, y: 6 }], stroke: '#888', fill: 'transparent', strokeWidth: 2 },
    { kind: 'text', x: 42, y: 24, text: 'OPC', fontSize: 10, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
  ],
  pins: [
    { id: 'conn', name: 'CONN', number: '1', type: 'bidirectional', electricalType: 'bidirectional', functionalRole: 'general', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
  ],
  properties: [
    { key: 'signalLabel', value: 'SIGNAL', type: 'string', visible: true, editorType: 'text' },
    { key: 'direction', value: 'outgoing', type: 'string', visible: true, editorType: 'text' },
    { key: 'targetPageId', value: '', type: 'string', visible: true, editorType: 'text' },
    { key: 'targetPageNumber', value: '', type: 'string', visible: true, editorType: 'text' },
    { key: 'targetPageName', value: '', type: 'string', visible: true, editorType: 'text' },
    { key: 'dangling', value: true, type: 'boolean', visible: true, editorType: 'checkbox' },
  ],
};
