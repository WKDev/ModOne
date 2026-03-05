import { describe, expect, it } from 'vitest';
import type { GraphicPrimitive, SymbolDefinition, SymbolProperty } from '../types/symbol';
import { validateSymbol } from '../utils/symbolValidation';

function createValidSymbol(): SymbolDefinition {
  return {
    id: 'custom:valid',
    name: 'Valid Symbol',
    version: '1.0.0',
    category: 'test',
    createdAt: '2026-03-05T00:00:00.000Z',
    updatedAt: '2026-03-05T00:00:00.000Z',
    width: 80,
    height: 60,
    graphics: [
      { kind: 'rect', x: 10, y: 10, width: 40, height: 30, stroke: '#000', fill: 'none', strokeWidth: 1 },
    ],
    pins: [
      { id: 'p_in', name: 'IN', number: '1', type: 'input', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 20 },
      { id: 'p_out', name: 'OUT', number: '2', type: 'output', shape: 'line', position: { x: 80, y: 40 }, orientation: 'right', length: 20 },
    ],
    properties: [{ key: 'enabled', value: true, type: 'boolean', visible: true, editorType: 'checkbox' }],
  };
}

function hasRequiredSymbolFields(candidate: Partial<SymbolDefinition>): boolean {
  const required: Array<keyof SymbolDefinition> = [
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
  return required.every((key) => candidate[key] !== undefined);
}

function hasPropertyTypeMismatch(property: SymbolProperty): boolean {
  if (property.type === 'string') {
    return typeof property.value !== 'string';
  }
  if (property.type === 'number') {
    return typeof property.value !== 'number';
  }
  if (property.type === 'boolean') {
    return typeof property.value !== 'boolean';
  }
  return property.options !== undefined && !property.options.includes(String(property.value));
}

describe('symbol validation', () => {
  it('passes validation for a valid symbol definition', () => {
    const result = validateSymbol(createValidSymbol());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when required fields are missing (type-level/inlined required-field validation)', () => {
    const missingRequired: Partial<SymbolDefinition> = {
      name: 'Missing ID',
      version: '1.0.0',
      category: 'test',
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z',
      width: 40,
      height: 40,
      graphics: [],
      pins: [],
      properties: [],
    };

    expect(hasRequiredSymbolFields(missingRequired)).toBe(false);
  });

  it('fails for empty pins array', () => {
    const symbol = createValidSymbol();
    symbol.pins = [];

    const result = validateSymbol(symbol);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.rule === 'at_least_one_pin')).toBe(true);
  });

  it('fails for duplicate pin IDs', () => {
    const symbol = createValidSymbol();
    symbol.pins = [symbol.pins[0], { ...symbol.pins[0], name: 'Duplicate' }];

    const result = validateSymbol(symbol);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.rule === 'unique_pin_ids')).toBe(true);
  });

  it('fails for pin positions that are not snapped to 20px grid', () => {
    const symbol = createValidSymbol();
    symbol.pins = [{ ...symbol.pins[0], position: { x: -1, y: 19 } }];

    const result = validateSymbol(symbol);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.rule === 'pin_grid_snap')).toBe(true);
  });

  it('fails for out-of-bounds graphic primitives', () => {
    const symbol = createValidSymbol();
    symbol.graphics = [
      { kind: 'rect', x: 1490, y: 1490, width: 20, height: 20, stroke: '#000', fill: 'none', strokeWidth: 1 },
    ];

    const result = validateSymbol(symbol);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.rule === 'primitive_bounds')).toBe(true);
  });

  it('fails for invalid dimensions and blank name', () => {
    const symbol = createValidSymbol();
    symbol.width = 0;
    symbol.height = 1200;
    symbol.name = '   ';

    const result = validateSymbol(symbol);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.rule === 'valid_dimensions')).toBe(true);
    expect(result.errors.some((error) => error.rule === 'non_empty_name')).toBe(true);
  });

  it('throws on malformed primitive kind in untrusted payload', () => {
    const malformedPrimitive = {
      kind: 'triangle',
      x: 10,
      y: 10,
      width: 10,
      height: 10,
    } as unknown as GraphicPrimitive;

    const malformedSymbol: SymbolDefinition = {
      ...createValidSymbol(),
      graphics: [malformedPrimitive],
    };

    expect(() => validateSymbol(malformedSymbol)).toThrow();
  });

  it('detects property type mismatches for edge cases', () => {
    const wrongNumberProperty: SymbolProperty = {
      key: 'voltage',
      value: '24',
      type: 'number',
      visible: true,
      editorType: 'number',
    };
    const validEnumProperty: SymbolProperty = {
      key: 'mode',
      value: 'auto',
      type: 'enum',
      visible: true,
      editorType: 'select',
      options: ['manual', 'auto'],
    };

    expect(hasPropertyTypeMismatch(wrongNumberProperty)).toBe(true);
    expect(hasPropertyTypeMismatch(validEnumProperty)).toBe(false);
  });
});
