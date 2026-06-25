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
  width: 40,
  height: 20,
  graphics: [
    { kind: 'polyline', points: [{ x: 0, y: 10 }, { x: 6, y: 10 }], stroke: '#888', fill: 'none', strokeWidth: 1 },
    { kind: 'polyline', points: [{ x: 6, y: 3 }, { x: 32, y: 3 }, { x: 39, y: 10 }, { x: 32, y: 17 }, { x: 6, y: 17 }, { x: 6, y: 3 }], stroke: '#888', fill: 'transparent', strokeWidth: 1 },
    { kind: 'text', x: 21, y: 12, text: 'OPC', fontSize: 5, fontFamily: 'Arial', fill: '#888', anchor: 'middle' },
  ],
  pins: [
    { id: 'conn', name: 'CONN', number: '1', type: 'bidirectional', electricalType: 'bidirectional', functionalRole: 'general', shape: 'line', position: { x: 0, y: 10 }, orientation: 'left', length: 0, sortOrder: 1, nameVisible: true, numberVisible: true },
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
