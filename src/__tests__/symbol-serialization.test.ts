import { describe, expect, it } from 'vitest';
import { getBuiltinSymbol } from '../assets/builtin-symbols';
import type { SymbolDefinition } from '../types/symbol';

function createSerializableSymbol(): SymbolDefinition {
  return {
    id: 'custom:serialize-full',
    name: 'Serialization Full',
    version: '2.1.0',
    description: 'Comprehensive serialization test symbol',
    category: 'test',
    author: 'ModOne Test Suite',
    createdAt: '2026-03-05T01:02:03.456Z',
    updatedAt: '2026-03-05T04:05:06.789Z',
    width: 80,
    height: 80,
    graphics: [
      { kind: 'rect', x: 8, y: 8, width: 64, height: 64, stroke: '#000', fill: 'transparent', strokeWidth: 2 },
      { kind: 'circle', cx: 40, cy: 40, r: 12, stroke: '#000', fill: 'none', strokeWidth: 1 },
      { kind: 'polyline', points: [{ x: 0, y: 40 }, { x: 80, y: 40 }], stroke: '#000', fill: 'none', strokeWidth: 1 },
      { kind: 'arc', cx: 40, cy: 40, r: 20, startAngle: 30, endAngle: 300, stroke: '#000', fill: 'none', strokeWidth: 1 },
      {
        kind: 'text',
        x: 40,
        y: 20,
        text: 'S',
        fontSize: 12,
        fontFamily: 'Arial',
        fill: '#111',
        anchor: 'middle',
      },
    ],
    pins: [
      { id: 'in', name: 'IN', number: '1', type: 'input', shape: 'line', position: { x: 0, y: 40 }, orientation: 'left', length: 20 },
      { id: 'out', name: 'OUT', number: '2', type: 'output', shape: 'line', position: { x: 80, y: 40 }, orientation: 'right', length: 20 },
    ],
    units: [
      {
        unitId: 1,
        name: 'U1',
        graphics: [{ kind: 'rect', x: 20, y: 20, width: 40, height: 40, stroke: '#333', fill: 'none', strokeWidth: 1 }],
        pins: [{ id: 'u1_in', name: 'U1 IN', number: 'A', type: 'passive', shape: 'line', position: { x: 20, y: 40 }, orientation: 'left', length: 20 }],
      },
      {
        unitId: 2,
        name: 'U2',
        graphics: [{ kind: 'circle', cx: 60, cy: 40, r: 10, stroke: '#333', fill: 'none', strokeWidth: 1 }],
        pins: [{ id: 'u2_out', name: 'U2 OUT', number: 'B', type: 'passive', shape: 'line', position: { x: 60, y: 40 }, orientation: 'right', length: 20 }],
      },
    ],
    properties: [
      { key: 'designation', value: 'X1', type: 'string', visible: true, editorType: 'text' },
      { key: 'voltage', value: 24, type: 'number', visible: true, editorType: 'number' },
      { key: 'enabled', value: true, type: 'boolean', visible: true, editorType: 'checkbox' },
      { key: 'mode', value: 'auto', type: 'enum', visible: true, editorType: 'select', options: ['manual', 'auto'] },
    ],
    runtimeStateSchema: {
      type: 'object',
      properties: {
        energized: { type: 'boolean' },
      },
      required: ['energized'],
    },
  };
}

function roundtrip(symbol: SymbolDefinition): SymbolDefinition {
  return JSON.parse(JSON.stringify(symbol)) as SymbolDefinition;
}

describe('symbol serialization', () => {
  it('preserves all fields through JSON.stringify and JSON.parse roundtrip', () => {
    const symbol = createSerializableSymbol();
    const restored = roundtrip(symbol);

    expect(restored).toEqual(symbol);
    expect(restored.createdAt).toBe('2026-03-05T01:02:03.456Z');
    expect(restored.updatedAt).toBe('2026-03-05T04:05:06.789Z');
  });

  it('roundtrips symbol with empty graphics and pins arrays', () => {
    const symbol: SymbolDefinition = {
      id: 'custom:empty',
      name: 'Empty Symbol',
      version: '1.0.0',
      category: 'test',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z',
      width: 20,
      height: 20,
      graphics: [],
      pins: [],
      properties: [],
    };

    const restored = roundtrip(symbol);

    expect(restored.graphics).toEqual([]);
    expect(restored.pins).toEqual([]);
    expect(restored.properties).toEqual([]);
  });

  it('roundtrips symbol with all primitive kinds and multi-unit definitions', () => {
    const symbol = createSerializableSymbol();
    const restored = roundtrip(symbol);

    expect(restored.graphics.map((primitive) => primitive.kind)).toEqual([
      'rect',
      'circle',
      'polyline',
      'arc',
      'text',
    ]);
    expect(restored.units).toHaveLength(2);
    expect(restored.units?.map((unit) => unit.unitId)).toEqual([1, 2]);
  });

  it('preserves optional fields when present and omits them when absent', () => {
    const withOptional = createSerializableSymbol();
    const withoutOptional: SymbolDefinition = {
      id: 'custom:without-optional',
      name: 'Without Optional',
      version: '1.0.0',
      category: 'test',
      createdAt: '2026-03-05T10:00:00.000Z',
      updatedAt: '2026-03-05T10:00:00.000Z',
      width: 40,
      height: 40,
      graphics: [],
      pins: [
        {
          id: 'p1',
          name: 'Pin 1',
          number: '1',
          type: 'passive',
          shape: 'line',
          position: { x: 20, y: 0 },
          orientation: 'up',
          length: 20,
        },
      ],
      properties: [],
    };

    const restoredWithOptional = roundtrip(withOptional);
    const restoredWithoutOptional = roundtrip(withoutOptional);

    expect(restoredWithOptional.description).toBeDefined();
    expect(restoredWithOptional.author).toBeDefined();
    expect(restoredWithOptional.units).toBeDefined();
    expect(restoredWithOptional.runtimeStateSchema).toBeDefined();

    expect(restoredWithoutOptional.description).toBeUndefined();
    expect(restoredWithoutOptional.author).toBeUndefined();
    expect(restoredWithoutOptional.units).toBeUndefined();
    expect(restoredWithoutOptional.runtimeStateSchema).toBeUndefined();
  });

  it('supports backward-compatible pin payload without absolutePosition metadata', () => {
    const legacyJson = JSON.stringify({
      id: 'custom:legacy',
      name: 'Legacy Symbol',
      version: '0.9.0',
      category: 'legacy',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      width: 40,
      height: 40,
      graphics: [],
      pins: [
        {
          id: 'legacy_pin',
          name: 'LEGACY',
          number: '1',
          type: 'input',
          shape: 'line',
          position: { x: 0, y: 20 },
          orientation: 'left',
          length: 20,
        },
      ],
      properties: [],
    });

    const restored = JSON.parse(legacyJson) as SymbolDefinition;

    expect(restored.pins[0].position).toEqual({ x: 0, y: 20 });
    expect('absolutePosition' in restored.pins[0]).toBe(false);
  });

  it('handles missing symbol references gracefully during lookup after deserialize', () => {
    const serialized = JSON.stringify({ symbolId: 'builtin:missing_symbol' });
    const restored = JSON.parse(serialized) as { symbolId: string };
    const resolved = getBuiltinSymbol(restored.symbolId);

    expect(resolved).toBeUndefined();
  });
});
