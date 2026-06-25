/**
 * XML Symbol Loader Tests
 *
 * Verifies that the XML-based symbol definition parser correctly converts
 * .symbol.xml files into SymbolDefinition runtime objects, and that XML
 * definitions for representative blocks are structurally equivalent to their
 * TypeScript counterparts in src/assets/builtin-symbols/.
 *
 * Coverage:
 *  1. parseXmlSymbolDefinition — basic structural parsing
 *  2. Relay (multi-unit, with behavior + visual states)
 *  3. Fuse (simple single-unit)
 *  4. Circuit Breaker (simple single-unit)
 *  5. Motor (single-unit with visual states + animations definition)
 *  6. validateSymbolDefinition — error detection
 *  7. SymbolRegistry — dynamic registration and lookup
 *  8. blockDefinitions.ts compatibility (port parity check)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseXmlSymbolDefinition, validateSymbolDefinition } from '../xmlSymbolLoader';
import { SymbolRegistry, initializeSymbolRegistry } from '../xmlSymbolRegistry';
import { BUILTIN_SYMBOLS } from '@/assets/builtin-symbols';

// TypeScript ground-truth symbol definitions
import { relaySymbol } from '@/assets/builtin-symbols/relay';
import { fuseSymbol } from '@/assets/builtin-symbols/fuse';
import { circuitBreakerSymbol } from '@/assets/builtin-symbols/circuit_breaker';
import { motorSymbol } from '@/assets/builtin-symbols/motor';

// XML files imported as raw strings (Vite ?raw transform)
import relayXml from '@/assets/builtin-symbols/xml/relay.symbol.xml?raw';
import fuseXml from '@/assets/builtin-symbols/xml/fuse.symbol.xml?raw';
import circuitBreakerXml from '@/assets/builtin-symbols/xml/circuit_breaker.symbol.xml?raw';
import motorXml from '@/assets/builtin-symbols/xml/motor.symbol.xml?raw';

// ============================================================================
// Helper utilities
// ============================================================================

/** Collect pin IDs from a symbol (top-level + unit-level, deduplicated). */
function collectPinIds(symbol: ReturnType<typeof parseXmlSymbolDefinition>): string[] {
  const topLevel = symbol.pins.map((p) => p.id);
  const unitLevel = symbol.units?.flatMap((u) => u.pins.map((p) => p.id)) ?? [];
  // Deduplicate (top-level is the union, unit pins repeat the same IDs)
  return Array.from(new Set([...topLevel, ...unitLevel]));
}

/** Find a pin by ID across top-level and unit pins. */
function findPin(
  symbol: ReturnType<typeof parseXmlSymbolDefinition>,
  pinId: string,
) {
  return (
    symbol.pins.find((p) => p.id === pinId) ??
    symbol.units?.flatMap((u) => u.pins).find((p) => p.id === pinId)
  );
}

// ============================================================================
// 1. Basic XML parsing
// ============================================================================

describe('parseXmlSymbolDefinition — basic parsing', () => {
  it('parses relay XML without errors', () => {
    expect(() => parseXmlSymbolDefinition(relayXml)).not.toThrow();
  });

  it('parses fuse XML without errors', () => {
    expect(() => parseXmlSymbolDefinition(fuseXml)).not.toThrow();
  });

  it('parses circuit_breaker XML without errors', () => {
    expect(() => parseXmlSymbolDefinition(circuitBreakerXml)).not.toThrow();
  });

  it('parses motor XML without errors', () => {
    expect(() => parseXmlSymbolDefinition(motorXml)).not.toThrow();
  });

  it('throws on malformed XML', () => {
    expect(() => parseXmlSymbolDefinition('<invalid xml <<< >')).toThrow();
  });

  it('throws when root element is not SymbolDefinition', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <ms:WrongRoot xmlns:ms="http://modone.io/schema/symbol/1.0" id="test"/>`;
    expect(() => parseXmlSymbolDefinition(xml)).toThrow(/SymbolDefinition/);
  });

  it('parses a minimal valid symbol', () => {
    const minimal = `<?xml version="1.0" encoding="UTF-8"?>
      <ms:SymbolDefinition
        xmlns:ms="http://modone.io/schema/symbol/1.0"
        id="test:minimal"
        name="Minimal"
        version="1.0.0">
        <ms:Category>test</ms:Category>
        <ms:Layout width="40" height="40" unit="px"/>
        <ms:Ports/>
        <ms:Graphics/>
        <ms:Properties/>
      </ms:SymbolDefinition>`;
    const result = parseXmlSymbolDefinition(minimal);
    expect(result.id).toBe('test:minimal');
    expect(result.name).toBe('Minimal');
    expect(result.version).toBe('1.0.0');
    expect(result.width).toBe(40);
    expect(result.height).toBe(40);
    expect(result.pins).toHaveLength(0);
    expect(result.graphics).toHaveLength(0);
    expect(result.properties).toHaveLength(0);
  });
});

// ============================================================================
// 2. Relay — multi-unit symbol with behavior + visual states
// ============================================================================

describe('Relay XML vs TypeScript parity', () => {
  const xmlSymbol = parseXmlSymbolDefinition(relayXml);
  const tsSymbol = relaySymbol;

  it('has matching id', () => {
    expect(xmlSymbol.id).toBe(tsSymbol.id);
  });

  it('has matching name', () => {
    expect(xmlSymbol.name).toBe(tsSymbol.name);
  });

  it('has matching version', () => {
    expect(xmlSymbol.version).toBe(tsSymbol.version);
  });

  it('has matching category', () => {
    expect(xmlSymbol.category).toBe(tsSymbol.category);
  });

  it('has matching dimensions', () => {
    expect(xmlSymbol.width).toBe(tsSymbol.width);
    expect(xmlSymbol.height).toBe(tsSymbol.height);
  });

  it('has the same top-level pin count', () => {
    expect(xmlSymbol.pins).toHaveLength(tsSymbol.pins.length);
  });

  it('has the same pin IDs', () => {
    const xmlPinIds = xmlSymbol.pins.map((p) => p.id).sort();
    const tsPinIds = tsSymbol.pins.map((p) => p.id).sort();
    expect(xmlPinIds).toEqual(tsPinIds);
  });

  it.each(['coil_in', 'coil_out', 'com', 'no', 'nc'])(
    'pin "%s" has matching position',
    (pinId) => {
      const xmlPin = findPin(xmlSymbol, pinId);
      const tsPin = tsSymbol.pins.find((p) => p.id === pinId);
      expect(xmlPin).toBeDefined();
      expect(tsPin).toBeDefined();
      expect(xmlPin?.position).toEqual(tsPin?.position);
    },
  );

  it.each(['coil_in', 'coil_out', 'com', 'no', 'nc'])(
    'pin "%s" has matching electricalType',
    (pinId) => {
      const xmlPin = findPin(xmlSymbol, pinId);
      const tsPin = tsSymbol.pins.find((p) => p.id === pinId);
      expect(xmlPin?.electricalType).toBe(tsPin?.electricalType);
    },
  );

  it('has the same number of multi-units', () => {
    expect(xmlSymbol.units).toHaveLength(tsSymbol.units?.length ?? 0);
  });

  it('unit 1 is named "Coil"', () => {
    const unit1 = xmlSymbol.units?.[0];
    expect(unit1?.name).toBe('Coil');
    expect(unit1?.unitId).toBe(1);
  });

  it('unit 2 is named "Contact"', () => {
    const unit2 = xmlSymbol.units?.[1];
    expect(unit2?.name).toBe('Contact');
    expect(unit2?.unitId).toBe(2);
  });

  it('unit 1 has coil_in and coil_out pins', () => {
    const unit1Pins = xmlSymbol.units?.[0].pins.map((p) => p.id).sort();
    expect(unit1Pins).toEqual(['coil_in', 'coil_out']);
  });

  it('unit 2 has com, no, nc pins', () => {
    const unit2Pins = xmlSymbol.units?.[1].pins.map((p) => p.id).sort();
    expect(unit2Pins).toEqual(['com', 'nc', 'no']);
  });

  it('has the same number of properties', () => {
    expect(xmlSymbol.properties).toHaveLength(tsSymbol.properties.length);
  });

  it.each(['designation', 'coilVoltage', 'contacts', 'energized'])(
    'property "%s" has matching key and default value',
    (key) => {
      const xmlProp = xmlSymbol.properties.find((p) => p.key === key);
      const tsProp = tsSymbol.properties.find((p) => p.key === key);
      expect(xmlProp).toBeDefined();
      expect(tsProp).toBeDefined();
      expect(xmlProp?.value).toBe(tsProp?.value);
      expect(xmlProp?.type).toBe(tsProp?.type);
    },
  );

  it('behavior templateId matches', () => {
    expect(xmlSymbol.behavior?.templateId).toBe(tsSymbol.behavior?.templateId);
  });

  it('behavior archetype matches', () => {
    expect(xmlSymbol.behavior?.archetype).toBe(tsSymbol.behavior?.archetype);
  });

  it('behavior terminal roles match', () => {
    const xmlRoles = xmlSymbol.behavior?.terminalRoles ?? {};
    const tsRoles = tsSymbol.behavior?.terminalRoles ?? {};
    expect(xmlRoles).toEqual(tsRoles);
  });

  it('has visual state "energized"', () => {
    expect(xmlSymbol.visualStates).toBeDefined();
    expect(xmlSymbol.visualStates?.['energized']).toBeDefined();
  });

  it('energized visual state overrides coil-body', () => {
    const override = xmlSymbol.visualStates?.['energized']?.primitiveOverrides?.['coil-body'];
    expect(override).toBeDefined();
    expect(override?.stroke).toBe('#22c55e');
    expect(override?.fill).toBe('#d1fae5');
  });

  it('has at least 1 top-level graphic primitive', () => {
    expect(xmlSymbol.graphics.length).toBeGreaterThan(0);
  });

  it('is valid according to validateSymbolDefinition', () => {
    const errors = validateSymbolDefinition(xmlSymbol);
    expect(errors).toHaveLength(0);
  });
});

// ============================================================================
// 3. Fuse — simple single-unit symbol
// ============================================================================

describe('Fuse XML vs TypeScript parity', () => {
  const xmlSymbol = parseXmlSymbolDefinition(fuseXml);
  const tsSymbol = fuseSymbol;

  it('has matching id', () => {
    expect(xmlSymbol.id).toBe(tsSymbol.id);
  });

  it('has matching dimensions', () => {
    expect(xmlSymbol.width).toBe(tsSymbol.width);
    expect(xmlSymbol.height).toBe(tsSymbol.height);
  });

  it('has exactly 2 pins', () => {
    expect(xmlSymbol.pins).toHaveLength(2);
  });

  it('has "in" pin at top (y=0)', () => {
    const pin = xmlSymbol.pins.find((p) => p.id === 'in');
    expect(pin).toBeDefined();
    expect(pin?.position).toEqual({ x: 10, y: 0 });
    expect(pin?.electricalType).toBe('input');
    expect(pin?.orientation).toBe('up');
  });

  it('has "out" pin at bottom (y=30)', () => {
    const pin = xmlSymbol.pins.find((p) => p.id === 'out');
    expect(pin).toBeDefined();
    expect(pin?.position).toEqual({ x: 10, y: 30 });
    expect(pin?.electricalType).toBe('output');
    expect(pin?.orientation).toBe('down');
  });

  it('has no units (single-unit symbol)', () => {
    expect(xmlSymbol.units).toBeUndefined();
  });

  it('has 2 graphic primitives (line + rect)', () => {
    expect(xmlSymbol.graphics).toHaveLength(2);
    expect(xmlSymbol.graphics[0].kind).toBe('polyline');
    expect(xmlSymbol.graphics[1].kind).toBe('rect');
  });

  it('fuse-body rect has correct geometry', () => {
    const rect = xmlSymbol.graphics.find((g) => g.kind === 'rect');
    expect(rect).toBeDefined();
    if (rect?.kind === 'rect') {
      expect(rect.x).toBe(6);
      expect(rect.y).toBe(7.5);
      expect(rect.width).toBe(8);
      expect(rect.height).toBe(15);
    }
  });

  it('has matching property count', () => {
    expect(xmlSymbol.properties).toHaveLength(tsSymbol.properties.length);
  });

  it('designation property default is "F1"', () => {
    const prop = xmlSymbol.properties.find((p) => p.key === 'designation');
    expect(prop?.value).toBe('F1');
    expect(prop?.type).toBe('string');
  });

  it('ratingAmps property default is 10', () => {
    const prop = xmlSymbol.properties.find((p) => p.key === 'ratingAmps');
    expect(prop?.value).toBe(10);
    expect(prop?.type).toBe('number');
  });

  it('tripped property default is false', () => {
    const prop = xmlSymbol.properties.find((p) => p.key === 'tripped');
    expect(prop?.value).toBe(false);
    expect(prop?.type).toBe('boolean');
  });

  it('fuseType property has select options', () => {
    const prop = xmlSymbol.properties.find((p) => p.key === 'fuseType');
    expect(prop?.editorType).toBe('select');
    expect(prop?.options).toContain('fuse');
    expect(prop?.options).toContain('mcb');
    expect(prop?.options).toContain('mpcb');
  });

  it('is valid according to validateSymbolDefinition', () => {
    const errors = validateSymbolDefinition(xmlSymbol);
    expect(errors).toHaveLength(0);
  });
});

// ============================================================================
// 4. Circuit Breaker — simple single-unit
// ============================================================================

describe('Circuit Breaker XML vs TypeScript parity', () => {
  const xmlSymbol = parseXmlSymbolDefinition(circuitBreakerXml);
  const tsSymbol = circuitBreakerSymbol;

  it('has matching id', () => {
    expect(xmlSymbol.id).toBe(tsSymbol.id);
  });

  it('has matching name', () => {
    expect(xmlSymbol.name).toBe(tsSymbol.name);
  });

  it('has matching dimensions', () => {
    expect(xmlSymbol.width).toBe(tsSymbol.width);
    expect(xmlSymbol.height).toBe(tsSymbol.height);
  });

  it('has 2 pins matching TypeScript counterpart', () => {
    expect(xmlSymbol.pins).toHaveLength(tsSymbol.pins.length);

    const xmlPinIds = xmlSymbol.pins.map((p) => p.id).sort();
    const tsPinIds = tsSymbol.pins.map((p) => p.id).sort();
    expect(xmlPinIds).toEqual(tsPinIds);
  });

  it('"in" pin position matches TypeScript', () => {
    const xmlPin = xmlSymbol.pins.find((p) => p.id === 'in');
    const tsPin = tsSymbol.pins.find((p) => p.id === 'in');
    expect(xmlPin?.position).toEqual(tsPin?.position);
  });

  it('"out" pin position matches TypeScript', () => {
    const xmlPin = xmlSymbol.pins.find((p) => p.id === 'out');
    const tsPin = tsSymbol.pins.find((p) => p.id === 'out');
    expect(xmlPin?.position).toEqual(tsPin?.position);
  });

  it('has 7 graphic primitives matching TypeScript', () => {
    // TypeScript has 7 graphics primitives
    expect(xmlSymbol.graphics).toHaveLength(tsSymbol.graphics.length);
  });

  it('has matching property keys', () => {
    const xmlKeys = xmlSymbol.properties.map((p) => p.key).sort();
    const tsKeys = tsSymbol.properties.map((p) => p.key).sort();
    expect(xmlKeys).toEqual(tsKeys);
  });

  it('designation property default is "Q1"', () => {
    const prop = xmlSymbol.properties.find((p) => p.key === 'designation');
    expect(prop?.value).toBe('Q1');
  });

  it('currentRating property default is 10', () => {
    const prop = xmlSymbol.properties.find((p) => p.key === 'currentRating');
    expect(prop?.value).toBe(10);
  });

  it('tripped property default is false', () => {
    const prop = xmlSymbol.properties.find((p) => p.key === 'tripped');
    expect(prop?.value).toBe(false);
  });
});

// ============================================================================
// 5. Motor — visual states + animation spec
// ============================================================================

describe('Motor XML vs TypeScript parity', () => {
  const xmlSymbol = parseXmlSymbolDefinition(motorXml);
  const tsSymbol = motorSymbol;

  it('has matching id', () => {
    expect(xmlSymbol.id).toBe(tsSymbol.id);
  });

  it('has matching dimensions', () => {
    expect(xmlSymbol.width).toBe(tsSymbol.width);
    expect(xmlSymbol.height).toBe(tsSymbol.height);
  });

  it('has 4 pins (U, V, W, PE)', () => {
    expect(xmlSymbol.pins).toHaveLength(4);
  });

  it('has matching pin IDs', () => {
    const xmlIds = xmlSymbol.pins.map((p) => p.id).sort();
    const tsIds = tsSymbol.pins.map((p) => p.id).sort();
    expect(xmlIds).toEqual(tsIds);
  });

  it.each([
    ['l1', { x: 10, y: 0 }],
    ['l2', { x: 20, y: 0 }],
    ['l3', { x: 30, y: 0 }],
    ['pe', { x: 20, y: 40 }],
  ])('pin "%s" has position %j', (pinId, expectedPos) => {
    const pin = xmlSymbol.pins.find((p) => p.id === pinId);
    expect(pin?.position).toEqual(expectedPos);
  });

  it('has 7 graphic primitives matching TypeScript', () => {
    expect(xmlSymbol.graphics).toHaveLength(tsSymbol.graphics.length);
  });

  it('motor-body is a circle', () => {
    const circle = xmlSymbol.graphics.find((g) => g.id === 'motor-body');
    expect(circle).toBeDefined();
    expect(circle?.kind).toBe('circle');
  });

  it('motor-label is a text element', () => {
    const label = xmlSymbol.graphics.find((g) => g.id === 'motor-label');
    expect(label).toBeDefined();
    expect(label?.kind).toBe('text');
    if (label?.kind === 'text') {
      expect(label.text).toBe('M');
    }
  });

  it('has matching behavior archetype', () => {
    expect(xmlSymbol.behavior?.templateId).toBe(tsSymbol.behavior?.templateId);
    expect(xmlSymbol.behavior?.archetype).toBe(tsSymbol.behavior?.archetype);
  });

  it('has "running" visual state', () => {
    expect(xmlSymbol.visualStates?.['running']).toBeDefined();
  });

  it('running state overrides motor-body with green', () => {
    const override = xmlSymbol.visualStates?.['running']?.primitiveOverrides?.['motor-body'];
    expect(override?.stroke).toBe('#22c55e');
    expect(override?.fill).toBe('#dcfce7');
  });

  it('has matching property count', () => {
    expect(xmlSymbol.properties).toHaveLength(tsSymbol.properties.length);
  });

  it('powerKw property default matches TypeScript (1.5)', () => {
    const prop = xmlSymbol.properties.find((p) => p.key === 'powerKw');
    expect(prop?.value).toBe(1.5);
  });

  it('voltageRating property default matches TypeScript (400)', () => {
    const prop = xmlSymbol.properties.find((p) => p.key === 'voltageRating');
    expect(prop?.value).toBe(400);
  });
});

// ============================================================================
// 6. validateSymbolDefinition — error detection
// ============================================================================

describe('validateSymbolDefinition', () => {
  it('returns no errors for valid relay symbol', () => {
    expect(validateSymbolDefinition(relaySymbol)).toHaveLength(0);
  });

  it('returns error when id is empty', () => {
    const bad = { ...relaySymbol, id: '' };
    const errors = validateSymbolDefinition(bad);
    expect(errors.some((e) => e.includes('ID'))).toBe(true);
  });

  it('returns error when name is empty', () => {
    const bad = { ...relaySymbol, name: '' };
    const errors = validateSymbolDefinition(bad);
    expect(errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('returns error when width is zero', () => {
    const bad = { ...relaySymbol, width: 0 };
    const errors = validateSymbolDefinition(bad);
    expect(errors.some((e) => e.includes('width'))).toBe(true);
  });

  it('returns error when height is negative', () => {
    const bad = { ...relaySymbol, height: -1 };
    const errors = validateSymbolDefinition(bad);
    expect(errors.some((e) => e.includes('height'))).toBe(true);
  });

  it('returns no errors for parsed fuse XML', () => {
    const symbol = parseXmlSymbolDefinition(fuseXml);
    expect(validateSymbolDefinition(symbol)).toHaveLength(0);
  });

  it('returns no errors for parsed motor XML', () => {
    const symbol = parseXmlSymbolDefinition(motorXml);
    expect(validateSymbolDefinition(symbol)).toHaveLength(0);
  });
});

// ============================================================================
// 7. SymbolRegistry — dynamic registration and lookup
// ============================================================================

describe('SymbolRegistry', () => {
  let registry: SymbolRegistry;

  beforeEach(() => {
    registry = new SymbolRegistry();
  });

  it('starts empty before initialization', () => {
    expect(registry.size).toBe(0);
    expect(registry.isInitialized).toBe(false);
  });

  it('registers TypeScript built-ins after initBuiltins()', () => {
    registry.initBuiltins(BUILTIN_SYMBOLS);
    expect(registry.size).toBe(BUILTIN_SYMBOLS.size);
    expect(registry.isInitialized).toBe(true);
  });

  it('can retrieve a TypeScript built-in by ID', () => {
    registry.initBuiltins(BUILTIN_SYMBOLS);
    const relay = registry.get('builtin:relay');
    expect(relay).toBeDefined();
    expect(relay?.id).toBe('builtin:relay');
  });

  it('can resolve a symbol by block type', () => {
    registry.initBuiltins(BUILTIN_SYMBOLS);
    const relay = registry.getForBlockType('relay');
    expect(relay).toBeDefined();
    expect(relay?.id).toBe('builtin:relay');
  });

  it('loads XML override for relay', () => {
    registry.initBuiltins(BUILTIN_SYMBOLS);
    const results = registry.loadBuiltinXml([relayXml]);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].id).toBe('builtin:relay');
  });

  it('XML-loaded relay overrides TypeScript built-in', () => {
    registry.initBuiltins(BUILTIN_SYMBOLS);
    registry.loadBuiltinXml([relayXml]);

    // The XML version is used when requesting by ID
    const relay = registry.get('builtin:relay');
    expect(relay).toBeDefined();
    // Both versions should have the same ID and name
    expect(relay?.id).toBe('builtin:relay');
    expect(relay?.name).toBe('Relay');
  });

  it('loads multiple XML files', () => {
    registry.initBuiltins(BUILTIN_SYMBOLS);
    const results = registry.loadBuiltinXml([relayXml, fuseXml, circuitBreakerXml, motorXml]);
    expect(results).toHaveLength(4);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('returns error result for invalid XML', () => {
    const results = registry.loadBuiltinXml(['<bad xml <<']);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBeTruthy();
  });

  it('project symbols override built-ins', () => {
    registry.initBuiltins(BUILTIN_SYMBOLS);

    // Register a custom project version of relay
    const customRelay = { ...relaySymbol, name: 'Custom Relay', id: 'builtin:relay' };
    registry.registerProjectSymbol(customRelay);

    const relay = registry.get('builtin:relay');
    expect(relay?.name).toBe('Custom Relay');
  });

  it('clearProjectSymbols reverts to built-in', () => {
    registry.initBuiltins(BUILTIN_SYMBOLS);
    registry.registerProjectSymbol({ ...relaySymbol, name: 'Custom Relay' });

    registry.clearProjectSymbols();

    const relay = registry.get('builtin:relay');
    expect(relay?.name).toBe(relaySymbol.name); // TypeScript built-in
  });

  it('listAll returns merged summary', () => {
    registry.initBuiltins(BUILTIN_SYMBOLS);
    const summaries = registry.listAll();
    expect(summaries.length).toBe(BUILTIN_SYMBOLS.size);
    expect(summaries[0]).toHaveProperty('id');
    expect(summaries[0]).toHaveProperty('name');
    expect(summaries[0]).toHaveProperty('scope');
  });

  it('has() returns true for registered symbols', () => {
    registry.initBuiltins(BUILTIN_SYMBOLS);
    expect(registry.has('builtin:relay')).toBe(true);
    expect(registry.has('nonexistent:symbol')).toBe(false);
  });
});

// ============================================================================
// 8. initializeSymbolRegistry helper
// ============================================================================

describe('initializeSymbolRegistry', () => {
  it('initializes with built-ins and XML overrides', () => {
    const registry = new SymbolRegistry();
    const results = registry.loadBuiltinXml([relayXml, fuseXml]);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('global initializeSymbolRegistry does not throw', () => {
    expect(() => initializeSymbolRegistry(BUILTIN_SYMBOLS, [relayXml, fuseXml])).not.toThrow();
  });
});

// ============================================================================
// 9. blockDefinitions.ts port compatibility
// ============================================================================

describe('XML symbols — blockDefinitions.ts port parity', () => {
  /**
   * Verifies that XML-loaded symbols have ports whose IDs match the
   * defaultPorts in blockDefinitions.ts (before unit conversion).
   *
   * Note: symbols are now authored mm-natively (builtin library converted from
   * px to mm), so SymbolPin positions are already in mm and getBlockDefinition()
   * applies no rescaling. This test checks structural pin-ID parity only.
   */

  const testCases: Array<{
    blockType: string;
    xmlString: string;
    expectedPinIds: string[];
  }> = [
    {
      blockType: 'relay',
      xmlString: relayXml,
      expectedPinIds: ['coil_in', 'coil_out', 'com', 'no', 'nc'],
    },
    {
      blockType: 'fuse',
      xmlString: fuseXml,
      expectedPinIds: ['in', 'out'],
    },
    {
      blockType: 'circuit_breaker',
      xmlString: circuitBreakerXml,
      expectedPinIds: ['in', 'out'],
    },
    {
      blockType: 'motor',
      xmlString: motorXml,
      expectedPinIds: ['l1', 'l2', 'l3', 'pe'],
    },
  ];

  it.each(testCases)(
    '$blockType: XML pin IDs match expected port IDs',
    ({ xmlString, expectedPinIds }) => {
      const symbol = parseXmlSymbolDefinition(xmlString);
      const pinIds = collectPinIds(symbol).sort();
      expect(pinIds).toEqual([...expectedPinIds].sort());
    },
  );

  it.each(testCases)(
    '$blockType: all XML pins have valid electricalType',
    ({ xmlString }) => {
      const symbol = parseXmlSymbolDefinition(xmlString);
      const validTypes = ['input', 'output', 'bidirectional', 'power', 'passive'];
      for (const pin of symbol.pins) {
        expect(validTypes).toContain(pin.electricalType);
      }
    },
  );

  it.each(testCases)(
    '$blockType: all XML pins have valid orientation',
    ({ xmlString }) => {
      const symbol = parseXmlSymbolDefinition(xmlString);
      const validOrientations = ['up', 'down', 'left', 'right'];
      for (const pin of symbol.pins) {
        expect(validOrientations).toContain(pin.orientation);
      }
    },
  );
});
