/**
 * Port Data Model Tests (Sub-AC 5.1)
 *
 * Tests for:
 *  - PortDef schema (createPortDef, validatePortDef)
 *  - Round-trip conversion: PortDef ↔ SymbolPin
 *  - Utility functions (electricalTypeToCanvasType, orientationToEdgePosition, etc.)
 */

import { describe, it, expect } from 'vitest';
import type { PortDef } from '../types/port';
import {
  createPortDef,
  validatePortDef,
  portDefToSymbolPin,
  symbolPinToPortDef,
  symbolPinsToPortDefs,
  portDefsToSymbolPins,
  electricalTypeToCanvasType,
  orientationToEdgePosition,
  portShapeToSymbolPinShape,
} from '../types/port';
import type { SymbolPin } from '../types/symbol';

// ============================================================================
// Helpers
// ============================================================================

function makePort(overrides: Partial<PortDef> = {}): PortDef {
  return createPortDef({
    id: 'p1',
    name: 'IN',
    number: '1',
    position: { x: 0, y: 20 },
    electricalType: 'input',
    functionalRole: 'general',
    orientation: 'left',
    shape: 'line',
    length: 40,
    sortOrder: 0,
    ...overrides,
  });
}

function makeSymbolPin(overrides: Partial<SymbolPin> = {}): SymbolPin {
  return {
    id: 'p1',
    name: 'IN',
    number: '1',
    type: 'input',
    shape: 'line',
    position: { x: 0, y: 20 },
    orientation: 'left',
    length: 40,
    sortOrder: 0,
    ...overrides,
  };
}

// ============================================================================
// createPortDef
// ============================================================================

describe('createPortDef', () => {
  it('creates a port with sensible defaults', () => {
    const port = createPortDef();
    expect(port.id).toBeTruthy();
    expect(port.name).toBe('');
    expect(port.number).toBe('');
    expect(port.electricalType).toBe('passive');
    expect(port.functionalRole).toBe('general');
    expect(port.orientation).toBe('right');
    expect(port.shape).toBe('line');
    expect(port.length).toBe(40);
    expect(port.sortOrder).toBe(0);
    expect(port.hidden).toBe(false);
    expect(port.nameVisible).toBe(true);
    expect(port.numberVisible).toBe(true);
  });

  it('applies overrides correctly', () => {
    const port = createPortDef({ name: 'VCC', electricalType: 'power_in', sortOrder: 3 });
    expect(port.name).toBe('VCC');
    expect(port.electricalType).toBe('power_in');
    expect(port.sortOrder).toBe(3);
    // Defaults are preserved for fields not in overrides
    expect(port.functionalRole).toBe('general');
  });

  it('generates unique IDs when called multiple times', () => {
    const ids = new Set(Array.from({ length: 10 }, () => createPortDef().id));
    expect(ids.size).toBe(10);
  });
});

// ============================================================================
// validatePortDef
// ============================================================================

describe('validatePortDef', () => {
  it('returns valid=true for a well-formed port', () => {
    const result = validatePortDef(makePort());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports error for missing id', () => {
    const result = validatePortDef({ ...makePort(), id: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'id')).toBe(true);
  });

  it('reports error for missing name', () => {
    const result = validatePortDef({ ...makePort(), name: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('reports error for missing position', () => {
    const port = makePort();
    const result = validatePortDef({ ...port, position: undefined });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'position')).toBe(true);
  });

  it('reports error for non-finite position coords', () => {
    const result = validatePortDef({ ...makePort(), position: { x: NaN, y: 0 } });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'position')).toBe(true);
  });

  it('reports error for zero or negative length', () => {
    const result = validatePortDef({ ...makePort(), length: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'length')).toBe(true);
  });

  it('reports error for edgeOffset outside [0,1]', () => {
    const result = validatePortDef({ ...makePort(), edgeOffset: 1.5 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'edgeOffset')).toBe(true);
  });

  it('accepts edgeOffset of exactly 0 and 1', () => {
    expect(validatePortDef({ ...makePort(), edgeOffset: 0 }).valid).toBe(true);
    expect(validatePortDef({ ...makePort(), edgeOffset: 1 }).valid).toBe(true);
  });

  it('reports duplicate pin number in existingPorts', () => {
    const existing: PortDef[] = [makePort({ id: 'p99', number: '1' })];
    const result = validatePortDef(makePort({ id: 'p1', number: '1' }), existing);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'number')).toBe(true);
  });

  it('does not flag duplicate number when IDs match (self-validation)', () => {
    const self = makePort({ id: 'p1', number: '1' });
    // Validate against the same port (editing in-place; self is already in the list)
    const result = validatePortDef(self, [self]);
    expect(result.valid).toBe(true);
  });

  it('allows empty string pin number (cosmetic, no uniqueness issue)', () => {
    const result = validatePortDef(makePort({ number: '' }));
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// electricalTypeToCanvasType
// ============================================================================

describe('electricalTypeToCanvasType', () => {
  it.each([
    ['input',          'input'],
    ['output',         'output'],
    ['bidirectional',  'bidirectional'],
    ['tri_state',      'bidirectional'],
    ['power',          'power'],
    ['power_in',       'power'],
    ['power_out',      'power'],
    ['passive',        'passive'],
    ['open_collector', 'passive'],
    ['open_emitter',   'passive'],
    ['free',           'passive'],
    ['unspecified',    'passive'],
    ['no_connect',     'passive'],
  ] as const)('maps %s → %s', (input, expected) => {
    expect(electricalTypeToCanvasType(input)).toBe(expected);
  });
});

// ============================================================================
// orientationToEdgePosition
// ============================================================================

describe('orientationToEdgePosition', () => {
  it.each([
    ['right', 'right'],
    ['left',  'left'],
    ['up',    'top'],
    ['down',  'bottom'],
  ] as const)('maps orientation %s → edge %s', (orientation, edge) => {
    expect(orientationToEdgePosition(orientation)).toBe(edge);
  });
});

// ============================================================================
// portShapeToSymbolPinShape
// ============================================================================

describe('portShapeToSymbolPinShape', () => {
  it('maps line shapes to "line"', () => {
    expect(portShapeToSymbolPinShape('line')).toBe('line');
    expect(portShapeToSymbolPinShape('non_logic')).toBe('line');
  });

  it('maps inverted variants to "inverted"', () => {
    expect(portShapeToSymbolPinShape('inverted')).toBe('inverted');
    expect(portShapeToSymbolPinShape('inverted_clock')).toBe('inverted');
  });

  it('maps clock variants to "clock"', () => {
    expect(portShapeToSymbolPinShape('clock')).toBe('clock');
    expect(portShapeToSymbolPinShape('input_low')).toBe('clock');
    expect(portShapeToSymbolPinShape('clock_low')).toBe('clock');
    expect(portShapeToSymbolPinShape('output_low')).toBe('clock');
    expect(portShapeToSymbolPinShape('edge_clock_high')).toBe('clock');
  });
});

// ============================================================================
// portDefToSymbolPin
// ============================================================================

describe('portDefToSymbolPin', () => {
  it('converts a PortDef to a SymbolPin preserving identity fields', () => {
    const port = makePort({ id: 'abc', name: 'OUT', number: '2', electricalType: 'output' });
    const pin = portDefToSymbolPin(port);

    expect(pin.id).toBe('abc');
    expect(pin.name).toBe('OUT');
    expect(pin.number).toBe('2');
    expect(pin.type).toBe('output');
    expect(pin.orientation).toBe('left');
    expect(pin.length).toBe(40);
    expect(pin.sortOrder).toBe(0);
  });

  it('derives canvas type from electricalType', () => {
    const port = makePort({ electricalType: 'power_in', canvasType: undefined });
    const pin = portDefToSymbolPin(port);
    expect(pin.type).toBe('power');
  });

  it('uses explicit canvasType over derived when provided', () => {
    const port = makePort({ electricalType: 'power_in', canvasType: 'bidirectional' });
    const pin = portDefToSymbolPin(port);
    expect(pin.type).toBe('bidirectional');
  });

  it('copies position by value (not reference)', () => {
    const port = makePort({ position: { x: 10, y: 20 } });
    const pin = portDefToSymbolPin(port);
    port.position.x = 999;
    expect(pin.position.x).toBe(10);
  });
});

// ============================================================================
// symbolPinToPortDef
// ============================================================================

describe('symbolPinToPortDef', () => {
  it('converts a SymbolPin to a PortDef preserving identity fields', () => {
    const pin = makeSymbolPin({ id: 'q1', name: 'CLK', number: '3', orientation: 'right' });
    const port = symbolPinToPortDef(pin);

    expect(port.id).toBe('q1');
    expect(port.name).toBe('CLK');
    expect(port.number).toBe('3');
    expect(port.orientation).toBe('right');
    expect(port.edgePosition).toBe('right');
  });

  it('prefers V2 electricalType when available', () => {
    const pin = makeSymbolPin({ type: 'passive', electricalType: 'power_in' as 'passive' });
    const port = symbolPinToPortDef(pin);
    expect(port.electricalType).toBe('power_in');
  });

  it('falls back to type field when electricalType is absent', () => {
    const pin = makeSymbolPin({ type: 'output', electricalType: undefined });
    const port = symbolPinToPortDef(pin);
    expect(port.electricalType).toBe('output');
  });

  it('uses provided sortOrder when pin.sortOrder is undefined', () => {
    const pin: SymbolPin = { ...makeSymbolPin(), sortOrder: undefined };
    const port = symbolPinToPortDef(pin, 5);
    expect(port.sortOrder).toBe(5);
  });

  it('copies position by value (not reference)', () => {
    const pin = makeSymbolPin({ position: { x: 10, y: 20 } });
    const port = symbolPinToPortDef(pin);
    pin.position.x = 999;
    expect(port.position.x).toBe(10);
  });
});

// ============================================================================
// Round-trip: PortDef → SymbolPin → PortDef
// ============================================================================

describe('round-trip PortDef ↔ SymbolPin', () => {
  it('preserves key fields after PortDef → SymbolPin → PortDef', () => {
    const original = makePort({
      id: 'rt1',
      name: 'SDA',
      number: '4',
      electricalType: 'bidirectional',
      functionalRole: 'communication',
      orientation: 'up',
      shape: 'line',
      length: 60,
      sortOrder: 2,
      hidden: true,
      nameVisible: false,
    });

    const pin = portDefToSymbolPin(original);
    const restored = symbolPinToPortDef(pin);

    expect(restored.id).toBe(original.id);
    expect(restored.name).toBe(original.name);
    expect(restored.number).toBe(original.number);
    expect(restored.orientation).toBe(original.orientation);
    expect(restored.length).toBe(original.length);
    expect(restored.sortOrder).toBe(original.sortOrder);
    expect(restored.hidden).toBe(original.hidden);
    expect(restored.nameVisible).toBe(original.nameVisible);
    expect(restored.functionalRole).toBe(original.functionalRole);
  });

  it('preserves ALL PortDef fields through PortDef → SymbolPin → PortDef round-trip', () => {
    const original = makePort({
      id: 'rt-all-fields',
      name: 'FULL_PORT',
      number: '42',
      position: { x: 100, y: 200 },
      electricalType: 'power_in',
      functionalRole: 'plc_input',
      orientation: 'down',
      shape: 'line',
      length: 80,
      sortOrder: 7,
      hidden: true,
      nameVisible: false,
      numberVisible: false,
      description: 'A fully populated port for round-trip testing',
      group: 'Power',
      locked: true,
      color: '#FF5733',
      labelOffset: { x: 5, y: -10 },
    });

    const pin = portDefToSymbolPin(original);
    const restored = symbolPinToPortDef(pin);

    // Identity
    expect(restored.id).toBe(original.id);
    expect(restored.name).toBe(original.name);
    expect(restored.number).toBe(original.number);

    // Position (value equality, not reference)
    expect(restored.position).toEqual(original.position);

    // Type & Role
    expect(restored.electricalType).toBe(original.electricalType);
    expect(restored.functionalRole).toBe(original.functionalRole);

    // Visual
    expect(restored.orientation).toBe(original.orientation);
    expect(restored.shape).toBe(original.shape);
    expect(restored.length).toBe(original.length);

    // Visibility
    expect(restored.hidden).toBe(original.hidden);
    expect(restored.nameVisible).toBe(original.nameVisible);
    expect(restored.numberVisible).toBe(original.numberVisible);

    // Metadata (v3 fields)
    expect(restored.description).toBe(original.description);
    expect(restored.group).toBe(original.group);
    expect(restored.locked).toBe(original.locked);
    expect(restored.color).toBe(original.color);
    expect(restored.labelOffset).toEqual(original.labelOffset);

    // Sort order
    expect(restored.sortOrder).toBe(original.sortOrder);
  });

  it('preserves undefined optional fields (no phantom data injection)', () => {
    const original = makePort({
      id: 'rt-minimal',
      name: 'MIN',
      number: '1',
      description: undefined,
      group: undefined,
      locked: false,
      color: undefined,
      labelOffset: undefined,
    });

    const pin = portDefToSymbolPin(original);
    const restored = symbolPinToPortDef(pin);

    expect(restored.description).toBeUndefined();
    expect(restored.group).toBeUndefined();
    expect(restored.locked).toBe(false);
    expect(restored.color).toBeUndefined();
    expect(restored.labelOffset).toBeUndefined();
  });

  it('preserves position values through round-trip without floating-point drift', () => {
    const original = makePort({
      id: 'rt-pos',
      position: { x: 0.1 + 0.2, y: 123.456 },
    });

    const pin = portDefToSymbolPin(original);
    const restored = symbolPinToPortDef(pin);

    expect(restored.position.x).toBe(original.position.x);
    expect(restored.position.y).toBe(original.position.y);
  });

  it('preserves labelOffset values through round-trip', () => {
    const original = makePort({
      id: 'rt-label',
      labelOffset: { x: -3.5, y: 12.75 },
    });

    const pin = portDefToSymbolPin(original);
    const restored = symbolPinToPortDef(pin);

    expect(restored.labelOffset).toEqual({ x: -3.5, y: 12.75 });
  });

  it.each([
    'input', 'output', 'bidirectional', 'power', 'passive',
    'tri_state', 'power_in', 'power_out', 'open_collector',
    'open_emitter', 'free', 'unspecified', 'no_connect',
  ] as const)('round-trips electricalType "%s" without loss', (elType) => {
    const original = makePort({ id: `rt-${elType}`, electricalType: elType });
    const pin = portDefToSymbolPin(original);
    const restored = symbolPinToPortDef(pin);
    expect(restored.electricalType).toBe(elType);
  });

  it.each([
    'general', 'plc_input', 'plc_output', 'communication',
  ] as const)('round-trips functionalRole "%s" without loss', (role) => {
    const original = makePort({ id: `rt-${role}`, functionalRole: role });
    const pin = portDefToSymbolPin(original);
    const restored = symbolPinToPortDef(pin);
    expect(restored.functionalRole).toBe(role);
  });

  it.each([
    'right', 'left', 'up', 'down',
  ] as const)('round-trips orientation "%s" without loss', (orient) => {
    const original = makePort({ id: `rt-${orient}`, orientation: orient });
    const pin = portDefToSymbolPin(original);
    const restored = symbolPinToPortDef(pin);
    expect(restored.orientation).toBe(orient);
  });

  it('round-trips color strings correctly', () => {
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#AABBCC'];
    for (const color of colors) {
      const original = makePort({ id: `rt-color-${color}`, color });
      const pin = portDefToSymbolPin(original);
      const restored = symbolPinToPortDef(pin);
      expect(restored.color).toBe(color);
    }
  });

  it('round-trips description with special characters', () => {
    const descriptions = [
      'Simple text',
      'Line1\nLine2',
      'Quotes: "hello" and \'world\'',
      'Unicode: 日本語 中文 한국어',
      'Symbols: <>&©®™',
      '',
    ];
    for (const desc of descriptions) {
      const original = makePort({ id: 'rt-desc', description: desc || undefined });
      const pin = portDefToSymbolPin(original);
      const restored = symbolPinToPortDef(pin);
      expect(restored.description).toBe(desc || undefined);
    }
  });

  it('round-trips group labels correctly', () => {
    const groups = ['Power', 'Data', 'Control', 'Analog I/O'];
    for (const group of groups) {
      const original = makePort({ id: 'rt-group', group });
      const pin = portDefToSymbolPin(original);
      const restored = symbolPinToPortDef(pin);
      expect(restored.group).toBe(group);
    }
  });

  it('round-trips locked state correctly for both true and false', () => {
    for (const locked of [true, false]) {
      const original = makePort({ id: 'rt-lock', locked });
      const pin = portDefToSymbolPin(original);
      const restored = symbolPinToPortDef(pin);
      expect(restored.locked).toBe(locked);
    }
  });
});

// ============================================================================
// Round-trip: PortDef → JSON → PortDef (save/load simulation)
// ============================================================================

describe('round-trip PortDef → JSON → PortDef (save/load)', () => {
  function jsonRoundtrip(port: PortDef): PortDef {
    return JSON.parse(JSON.stringify(port)) as PortDef;
  }

  it('preserves all fields through JSON serialization', () => {
    const original = makePort({
      id: 'json-rt-full',
      name: 'FULL_JSON',
      number: '99',
      position: { x: 55.5, y: -30.25 },
      electricalType: 'tri_state',
      canvasType: 'bidirectional',
      functionalRole: 'communication',
      edgePosition: 'bottom',
      edgeOffset: 0.75,
      orientation: 'down',
      shape: 'clock',
      length: 100,
      maxConnections: 3,
      hidden: true,
      nameVisible: false,
      numberVisible: false,
      description: 'JSON round-trip test port',
      group: 'TestGroup',
      locked: true,
      color: '#AABB00',
      labelOffset: { x: -2, y: 8 },
      sortOrder: 15,
    });

    const restored = jsonRoundtrip(original);

    // Deep equality check — every field must match
    expect(restored).toEqual(original);
  });

  it('preserves undefined optional fields as absent (not null)', () => {
    const original = makePort({
      id: 'json-rt-undef',
      description: undefined,
      group: undefined,
      locked: false,
      color: undefined,
      labelOffset: undefined,
      maxConnections: undefined,
      edgeOffset: undefined,
      edgePosition: undefined,
      canvasType: undefined,
    });

    const restored = jsonRoundtrip(original);

    // JSON.stringify strips undefined, so these become absent
    expect(restored.description).toBeUndefined();
    expect(restored.group).toBeUndefined();
    expect(restored.color).toBeUndefined();
    expect(restored.labelOffset).toBeUndefined();
    expect(restored.maxConnections).toBeUndefined();
    expect(restored.edgeOffset).toBeUndefined();
    expect(restored.edgePosition).toBeUndefined();
    expect(restored.canvasType).toBeUndefined();
  });

  it('preserves nested position objects', () => {
    const original = makePort({
      id: 'json-rt-nested',
      position: { x: 123.456, y: -789.012 },
      labelOffset: { x: 0, y: 0 },
    });

    const restored = jsonRoundtrip(original);

    expect(restored.position.x).toBe(123.456);
    expect(restored.position.y).toBe(-789.012);
    expect(restored.labelOffset).toEqual({ x: 0, y: 0 });
  });
});

// ============================================================================
// Round-trip: PortDef → SymbolPin → JSON → SymbolPin → PortDef (full pipeline)
// ============================================================================

describe('round-trip PortDef → SymbolPin → JSON → SymbolPin → PortDef (full save/load pipeline)', () => {
  function fullPipelineRoundtrip(port: PortDef): PortDef {
    const pin = portDefToSymbolPin(port);
    const serialized = JSON.stringify(pin);
    const deserialized = JSON.parse(serialized) as SymbolPin;
    return symbolPinToPortDef(deserialized);
  }

  it('preserves all fields through the full save/load pipeline', () => {
    const original = makePort({
      id: 'pipe-full',
      name: 'PIPELINE_TEST',
      number: '77',
      position: { x: 40, y: 60 },
      electricalType: 'open_collector',
      functionalRole: 'plc_output',
      orientation: 'left',
      shape: 'inverted',
      length: 50,
      sortOrder: 3,
      hidden: false,
      nameVisible: true,
      numberVisible: true,
      description: 'Full pipeline round-trip test',
      group: 'Output',
      locked: true,
      color: '#00CCFF',
      labelOffset: { x: 10, y: -5 },
    });

    const restored = fullPipelineRoundtrip(original);

    // Identity
    expect(restored.id).toBe(original.id);
    expect(restored.name).toBe(original.name);
    expect(restored.number).toBe(original.number);

    // Position
    expect(restored.position).toEqual(original.position);

    // Type & Role
    expect(restored.electricalType).toBe(original.electricalType);
    expect(restored.functionalRole).toBe(original.functionalRole);

    // Visual
    expect(restored.orientation).toBe(original.orientation);
    // Note: shape undergoes lossy mapping (9→3→back), so 'inverted' stays 'inverted'
    expect(restored.shape).toBe('inverted');
    expect(restored.length).toBe(original.length);

    // Visibility
    expect(restored.hidden).toBe(original.hidden);
    expect(restored.nameVisible).toBe(original.nameVisible);
    expect(restored.numberVisible).toBe(original.numberVisible);

    // v3 Metadata
    expect(restored.description).toBe(original.description);
    expect(restored.group).toBe(original.group);
    expect(restored.locked).toBe(original.locked);
    expect(restored.color).toBe(original.color);
    expect(restored.labelOffset).toEqual(original.labelOffset);

    // Sort order
    expect(restored.sortOrder).toBe(original.sortOrder);
  });

  it('preserves all fields for a minimal port with only defaults', () => {
    const original = makePort({ id: 'pipe-minimal' });
    const restored = fullPipelineRoundtrip(original);

    expect(restored.id).toBe(original.id);
    expect(restored.name).toBe(original.name);
    expect(restored.number).toBe(original.number);
    expect(restored.position).toEqual(original.position);
    expect(restored.orientation).toBe(original.orientation);
    expect(restored.length).toBe(original.length);
    expect(restored.sortOrder).toBe(original.sortOrder);
  });

  it('preserves fields for an array of ports through batch conversion + JSON', () => {
    const originals: PortDef[] = [
      makePort({
        id: 'arr-1', name: 'A', number: '1', sortOrder: 0,
        description: 'First', group: 'Group1', locked: false, color: '#111111',
      }),
      makePort({
        id: 'arr-2', name: 'B', number: '2', sortOrder: 1,
        description: 'Second', group: 'Group2', locked: true, color: '#222222',
        labelOffset: { x: 1, y: 2 },
      }),
      makePort({
        id: 'arr-3', name: 'C', number: '3', sortOrder: 2,
        description: undefined, group: undefined, locked: false, color: undefined,
      }),
    ];

    // Simulate save: PortDefs → SymbolPins → JSON
    const pins = portDefsToSymbolPins(originals);
    const json = JSON.stringify(pins);

    // Simulate load: JSON → SymbolPins → PortDefs
    const loadedPins = JSON.parse(json) as SymbolPin[];
    const restored = symbolPinsToPortDefs(loadedPins);

    expect(restored).toHaveLength(3);

    // Check each port preserves its unique data
    for (const orig of originals) {
      const match = restored.find((r) => r.id === orig.id);
      expect(match).toBeDefined();
      expect(match!.name).toBe(orig.name);
      expect(match!.number).toBe(orig.number);
      expect(match!.description).toBe(orig.description);
      expect(match!.group).toBe(orig.group);
      expect(match!.locked).toBe(orig.locked);
      expect(match!.color).toBe(orig.color);
      if (orig.labelOffset) {
        expect(match!.labelOffset).toEqual(orig.labelOffset);
      } else {
        expect(match!.labelOffset).toBeUndefined();
      }
    }
  });
});

// ============================================================================
// Array conversion helpers
// ============================================================================

describe('symbolPinsToPortDefs', () => {
  it('converts an array maintaining order', () => {
    const pins: SymbolPin[] = [
      makeSymbolPin({ id: 'a', number: '1', sortOrder: 0 }),
      makeSymbolPin({ id: 'b', number: '2', sortOrder: 1 }),
      makeSymbolPin({ id: 'c', number: '3', sortOrder: 2 }),
    ];
    const ports = symbolPinsToPortDefs(pins);
    expect(ports.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('handles empty array', () => {
    expect(symbolPinsToPortDefs([])).toEqual([]);
  });
});

describe('portDefsToSymbolPins', () => {
  it('sorts by sortOrder before converting', () => {
    const ports: PortDef[] = [
      makePort({ id: 'z', number: '3', sortOrder: 2 }),
      makePort({ id: 'a', number: '1', sortOrder: 0 }),
      makePort({ id: 'm', number: '2', sortOrder: 1 }),
    ];
    const pins = portDefsToSymbolPins(ports);
    expect(pins.map((p) => p.id)).toEqual(['a', 'm', 'z']);
  });
});
