import { describe, expect, it } from 'vitest';
import type {
  GraphicPrimitive,
  SymbolDefinition,
  SymbolPin,
  SymbolProperty,
  SymbolSummary,
} from '../types/symbol';

function createMinimalSymbolDefinition(): SymbolDefinition {
  return {
    id: 'custom:minimal',
    name: 'Minimal Symbol',
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
        name: 'IN',
        number: '1',
        type: 'input',
        shape: 'line',
        position: { x: 0, y: 20 },
        orientation: 'left',
        length: 20,
      },
    ],
    properties: [],
  };
}

function extractSummary(symbol: SymbolDefinition, scope: 'project' | 'global' = 'project'): SymbolSummary {
  return {
    id: symbol.id,
    name: symbol.name,
    version: symbol.version,
    category: symbol.category,
    description: symbol.description,
    scope,
    updatedAt: symbol.updatedAt,
  };
}

describe('symbol data model', () => {
  it('creates a minimal valid SymbolDefinition with required fields', () => {
    const symbol = createMinimalSymbolDefinition();
    const requiredKeys: Array<keyof SymbolDefinition> = [
      'id',
      'name',
      'version',
      'category',
      'createdAt',
      'updatedAt',
      'width',
      'height',
      'graphics',
      'pins',
      'properties',
    ];

    for (const key of requiredKeys) {
      expect(symbol[key]).not.toBeUndefined();
    }
    expect(symbol.id).toBe('custom:minimal');
    expect(symbol.pins).toHaveLength(1);
  });

  it('supports all GraphicPrimitive kinds', () => {
    const graphics: GraphicPrimitive[] = [
      { kind: 'rect', x: 5, y: 5, width: 30, height: 20, stroke: '#000', fill: 'none', strokeWidth: 1 },
      { kind: 'circle', cx: 20, cy: 20, r: 8, stroke: '#000', fill: 'none', strokeWidth: 1 },
      { kind: 'polyline', points: [{ x: 0, y: 20 }, { x: 40, y: 20 }], stroke: '#000', fill: 'none', strokeWidth: 1 },
      {
        kind: 'arc',
        cx: 20,
        cy: 20,
        r: 10,
        startAngle: 0,
        endAngle: 180,
        stroke: '#000',
        fill: 'none',
        strokeWidth: 1,
      },
      {
        kind: 'text',
        x: 20,
        y: 10,
        text: 'M',
        fontSize: 10,
        fontFamily: 'Arial',
        fill: '#000',
        anchor: 'middle',
      },
    ];

    const symbol: SymbolDefinition = {
      ...createMinimalSymbolDefinition(),
      id: 'custom:all-primitives',
      graphics,
    };

    expect(symbol.graphics.map((primitive) => primitive.kind)).toEqual([
      'rect',
      'circle',
      'polyline',
      'arc',
      'text',
    ]);
  });

  it('supports all pin electrical types and orientations', () => {
    const pins: SymbolPin[] = [
      { id: 'i', name: 'IN', number: '1', type: 'input', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 20 },
      { id: 'o', name: 'OUT', number: '2', type: 'output', shape: 'line', position: { x: 40, y: 20 }, orientation: 'right', length: 20 },
      { id: 'b', name: 'BIDIR', number: '3', type: 'bidirectional', shape: 'clock', position: { x: 20, y: 0 }, orientation: 'up', length: 20 },
      { id: 'p', name: 'VCC', number: '4', type: 'power', shape: 'inverted', position: { x: 20, y: 40 }, orientation: 'down', length: 20 },
      { id: 'x', name: 'PASS', number: '5', type: 'passive', shape: 'line', position: { x: 20, y: 20 }, orientation: 'left', length: 20 },
    ];

    expect(new Set(pins.map((pin) => pin.type))).toEqual(
      new Set(['input', 'output', 'bidirectional', 'power', 'passive']),
    );
    expect(new Set(pins.map((pin) => pin.orientation))).toEqual(
      new Set(['left', 'right', 'up', 'down']),
    );
  });

  it('supports SymbolProperty values for string, number, boolean, and enum', () => {
    const properties: SymbolProperty[] = [
      { key: 'designation', value: 'K1', type: 'string', visible: true, editorType: 'text' },
      { key: 'coilVoltage', value: 24, type: 'number', visible: true, editorType: 'number' },
      { key: 'energized', value: false, type: 'boolean', visible: true, editorType: 'checkbox' },
      {
        key: 'phase',
        value: 'L1',
        type: 'enum',
        visible: true,
        editorType: 'select',
        options: ['L1', 'L2', 'L3'],
      },
    ];

    expect(properties).toHaveLength(4);
    expect(properties.map((property) => property.type)).toEqual([
      'string',
      'number',
      'boolean',
      'enum',
    ]);
  });

  it('supports multi-unit symbol definitions', () => {
    const symbol: SymbolDefinition = {
      ...createMinimalSymbolDefinition(),
      id: 'custom:multi-unit',
      units: [
        {
          unitId: 1,
          name: 'Coil',
          graphics: [{ kind: 'rect', x: 10, y: 10, width: 20, height: 20, stroke: '#000', fill: 'none', strokeWidth: 1 }],
          pins: [{ id: 'a1', name: 'A1', number: '1', type: 'input', shape: 'line', position: { x: 20, y: 0 }, orientation: 'up', length: 20 }],
        },
        {
          unitId: 2,
          name: 'Contact',
          graphics: [{ kind: 'polyline', points: [{ x: 0, y: 20 }, { x: 40, y: 20 }], stroke: '#000', fill: 'none', strokeWidth: 1 }],
          pins: [{ id: 'c1', name: 'COM', number: '11', type: 'passive', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 20 }],
        },
      ],
    };

    expect(symbol.units).toHaveLength(2);
    expect(symbol.units?.map((unit) => unit.name)).toEqual(['Coil', 'Contact']);
  });

  it('extracts a SymbolSummary from a SymbolDefinition', () => {
    const symbol: SymbolDefinition = {
      ...createMinimalSymbolDefinition(),
      description: 'Summary extraction test',
      updatedAt: '2026-03-05T12:34:56.000Z',
    };

    const summary = extractSummary(symbol, 'project');

    expect(summary).toEqual({
      id: symbol.id,
      name: symbol.name,
      version: symbol.version,
      category: symbol.category,
      description: symbol.description,
      scope: 'project',
      updatedAt: '2026-03-05T12:34:56.000Z',
    });
  });
});
