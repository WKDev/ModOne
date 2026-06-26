/**
 * xml-loader-integration.test.ts
 *
 * Integration tests for Sub-AC 4: XML 기반 로더로 교체 후 기존
 * blockDefinitions.ts 의존 코드와의 호환성 검증.
 *
 * Test coverage:
 *  1. XML Symbol Loader — parseSymbolXml() parse correctness
 *  2. Adapter — symbolBlockDefAdapter.ts conversion helpers
 *  3. Compatibility — XML/symbol-system vs blockDefinitions.ts consistency
 *  4. Full pipeline — XML → SymbolDefinition → BlockDefinition → wire-routing
 *  5. Error handling — malformed XML / missing attributes
 */

import { describe, expect, it } from 'vitest';
import { parseSymbolXml, parseSymbolXmlOrThrow, isValidSymbolXml } from '../utils/xmlSymbolLoader';
import {
  symbolPinToPort,
  symbolDefToBlockDefinition,
  getAllPins,
  computePinOffset,
  symbolPinsToRawPorts,
  getBlockDefinitionFromSymbol,
  getSymbolSize,
  getSymbolPorts,
  getSymbolDefaultProps,
  checkCompatibility,
} from '../utils/symbolBlockDefAdapter';
import BLOCK_DEFINITIONS_RAW, { getBlockDefinition, getDefaultPorts, getBlockSize, getDefaultBlockProps } from '../components/OneCanvas/blockDefinitions';
import { BUILTIN_SYMBOLS, getBuiltinSymbol, getBuiltinSymbolForBlockType } from '../assets/builtin-symbols';
import { relaySymbol } from '../assets/builtin-symbols/relay';
import type { SymbolDefinition } from '../types/symbol';
import type { BlockType } from '../components/OneCanvas/types';

// ---------------------------------------------------------------------------
// Relay XML fixture — inline to avoid Vite ?raw import complexity in tests
// ---------------------------------------------------------------------------

const RELAY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="builtin:relay"
  name="Relay"
  version="1.0.0"
  domain="circuit"
  canonicalType="relay"
  placeable="true">
  <ms:Description>Electromagnetic control relay with coil and changeover contact</ms:Description>
  <ms:Category>switching</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-05T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-05T00:00:00Z</ms:UpdatedAt>
  <ms:Layout width="40" height="40" unit="mm"/>
  <ms:Ports>
    <ms:Port id="coil_in" name="A1" number="A1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="up"
             x="20" y="0" length="0" sortOrder="1"
             nameVisible="true" numberVisible="true"
             edgePosition="top" edgeOffset="0.5"/>
    <ms:Port id="coil_out" name="A2" number="A2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="down"
             x="20" y="40" length="0" sortOrder="2"
             nameVisible="true" numberVisible="true"
             edgePosition="bottom" edgeOffset="0.5"/>
    <ms:Port id="com" name="COM" number="11"
             electricalType="input" functionalRole="general"
             shape="line" orientation="left"
             x="0" y="20" length="0" sortOrder="3"
             nameVisible="true" numberVisible="true"
             edgePosition="left" edgeOffset="0.5"/>
    <ms:Port id="no" name="NO" number="14"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="40" y="10" length="0" sortOrder="4"
             nameVisible="true" numberVisible="true"
             edgePosition="right" edgeOffset="0.25"/>
    <ms:Port id="nc" name="NC" number="12"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="40" y="30" length="0" sortOrder="5"
             nameVisible="true" numberVisible="true"
             edgePosition="right" edgeOffset="0.75"/>
  </ms:Ports>
  <ms:Graphics>
    <ms:Rect id="coil-body" x="15" y="8" width="10" height="24"
             stroke="#888888" fill="transparent" strokeWidth="1"/>
    <ms:Text id="coil-label" x="20" y="22" fontSize="6" fontFamily="Arial"
             fill="#888888" anchor="middle">K</ms:Text>
    <ms:Polyline id="wire-com" stroke="#888888" fill="none" strokeWidth="1">
      <ms:Point x="0" y="20"/>
      <ms:Point x="12" y="20"/>
    </ms:Polyline>
  </ms:Graphics>
  <ms:Units>
    <ms:Unit unitId="1" name="Coil">
      <ms:Graphics>
        <ms:Rect id="coil-body" x="15" y="8" width="10" height="24"
                 stroke="#888888" fill="transparent" strokeWidth="1"/>
      </ms:Graphics>
      <ms:Ports>
        <ms:Port id="coil_in" name="A1" number="A1"
                 electricalType="input" functionalRole="general"
                 shape="line" orientation="up"
                 x="20" y="0" length="0" sortOrder="1"
                 nameVisible="true" numberVisible="true"
                 edgePosition="top" edgeOffset="0.5"/>
        <ms:Port id="coil_out" name="A2" number="A2"
                 electricalType="output" functionalRole="general"
                 shape="line" orientation="down"
                 x="20" y="40" length="0" sortOrder="2"
                 nameVisible="true" numberVisible="true"
                 edgePosition="bottom" edgeOffset="0.5"/>
      </ms:Ports>
    </ms:Unit>
    <ms:Unit unitId="2" name="Contact">
      <ms:Graphics>
        <ms:Polyline stroke="#888888" fill="none" strokeWidth="1">
          <ms:Point x="0" y="20"/>
          <ms:Point x="12" y="20"/>
        </ms:Polyline>
      </ms:Graphics>
      <ms:Ports>
        <ms:Port id="com" name="COM" number="11"
                 electricalType="input" functionalRole="general"
                 shape="line" orientation="left"
                 x="0" y="20" length="0" sortOrder="1"
                 nameVisible="true" numberVisible="true"
                 edgePosition="left" edgeOffset="0.5"/>
        <ms:Port id="no" name="NO" number="14"
                 electricalType="output" functionalRole="general"
                 shape="line" orientation="right"
                 x="40" y="10" length="0" sortOrder="2"
                 nameVisible="true" numberVisible="true"
                 edgePosition="right" edgeOffset="0.25"/>
        <ms:Port id="nc" name="NC" number="12"
                 electricalType="output" functionalRole="general"
                 shape="line" orientation="right"
                 x="40" y="30" length="0" sortOrder="3"
                 nameVisible="true" numberVisible="true"
                 edgePosition="right" edgeOffset="0.75"/>
      </ms:Ports>
    </ms:Unit>
  </ms:Units>
  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true">
      <ms:DefaultValue>K1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="coilVoltage" type="number" editorType="number" visible="true">
      <ms:DefaultValue>24</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="contacts" type="string" editorType="text" visible="true">
      <ms:DefaultValue>NO</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="energized" type="boolean" editorType="checkbox" visible="true">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>
  <ms:Behavior templateId="archetype:relay" archetype="relay"
               interactionMode="none" deviceScoped="false" domain="circuit">
    <ms:TerminalRoles>
      <ms:TerminalRole portId="coil_in"  role="A1"/>
      <ms:TerminalRole portId="coil_out" role="A2"/>
      <ms:TerminalRole portId="com"      role="COM"/>
      <ms:TerminalRole portId="no"       role="NO"/>
      <ms:TerminalRole portId="nc"       role="NC"/>
    </ms:TerminalRoles>
  </ms:Behavior>
  <ms:VisualStates>
    <ms:VisualState name="energized">
      <ms:PrimitiveOverrides>
        <ms:Override targetId="coil-body" stroke="#22c55e" fill="#d1fae5"/>
        <ms:Override targetId="coil-label" fill="#15803d"/>
      </ms:PrimitiveOverrides>
    </ms:VisualState>
  </ms:VisualStates>
</ms:SymbolDefinition>`;

// ---------------------------------------------------------------------------
// Minimal valid XML for general loader tests
// ---------------------------------------------------------------------------

const MINIMAL_VALID_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  id="custom:minimal"
  name="Minimal"
  version="1.0.0">
  <ms:Category>test</ms:Category>
  <ms:CreatedAt>2026-03-31T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-31T00:00:00Z</ms:UpdatedAt>
  <ms:Layout width="30" height="20" unit="mm"/>
  <ms:Ports>
    <ms:Port id="in" name="IN" number="1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="left"
             x="0" y="10" length="0"
             nameVisible="true" numberVisible="true"/>
    <ms:Port id="out" name="OUT" number="2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="30" y="10" length="0"
             nameVisible="true" numberVisible="true"/>
  </ms:Ports>
  <ms:Graphics>
    <ms:Rect x="2.5" y="2.5" width="25" height="15" stroke="#888" fill="none" strokeWidth="0.5"/>
  </ms:Graphics>
  <ms:Properties/>
</ms:SymbolDefinition>`;

// ============================================================================
// Part 1: XML Loader — parseSymbolXml()
// ============================================================================

describe('XML Symbol Loader — parseSymbolXml()', () => {
  describe('successful relay XML parsing', () => {
    it('returns no errors for valid relay XML', () => {
      const result = parseSymbolXml(RELAY_XML);
      expect(result.errors).toHaveLength(0);
      expect(result.symbol).toBeDefined();
    });

    it('parses root-level metadata correctly', () => {
      const { symbol } = parseSymbolXml(RELAY_XML);
      expect(symbol!.id).toBe('builtin:relay');
      expect(symbol!.name).toBe('Relay');
      expect(symbol!.version).toBe('1.0.0');
      expect(symbol!.category).toBe('switching');
      expect(symbol!.author).toBe('ModOne');
    });

    it('parses layout dimensions correctly', () => {
      const { symbol } = parseSymbolXml(RELAY_XML);
      expect(symbol!.width).toBe(40);
      expect(symbol!.height).toBe(40);
    });

    it('parses all 5 ports correctly', () => {
      const { symbol } = parseSymbolXml(RELAY_XML);
      expect(symbol!.pins).toHaveLength(5);

      const ids = symbol!.pins.map((p) => p.id);
      expect(ids).toContain('coil_in');
      expect(ids).toContain('coil_out');
      expect(ids).toContain('com');
      expect(ids).toContain('no');
      expect(ids).toContain('nc');
    });

    it('parses pin positions and orientations correctly', () => {
      const { symbol } = parseSymbolXml(RELAY_XML);
      const no = symbol!.pins.find((p) => p.id === 'no')!;
      expect(no.position).toEqual({ x: 40, y: 10 });
      expect(no.orientation).toBe('right');
      expect(no.type).toBe('output');

      const coilIn = symbol!.pins.find((p) => p.id === 'coil_in')!;
      expect(coilIn.position).toEqual({ x: 20, y: 0 });
      expect(coilIn.orientation).toBe('up');
      expect(coilIn.type).toBe('input');
    });

    it('parses graphics primitives correctly', () => {
      const { symbol } = parseSymbolXml(RELAY_XML);
      expect(symbol!.graphics.length).toBeGreaterThanOrEqual(3);

      const rect = symbol!.graphics.find((g) => g.kind === 'rect');
      expect(rect).toBeDefined();
      expect(rect!.kind).toBe('rect');
      if (rect && rect.kind === 'rect') {
        expect(rect.id).toBe('coil-body');
        expect(rect.x).toBe(15);
        expect(rect.y).toBe(8);
        expect(rect.width).toBe(10);
        expect(rect.height).toBe(24);
      }

      const text = symbol!.graphics.find((g) => g.kind === 'text');
      expect(text).toBeDefined();
      if (text && text.kind === 'text') {
        expect(text.id).toBe('coil-label');
        expect(text.text).toBe('K');
        expect(text.fontSize).toBe(6);
        expect(text.anchor).toBe('middle');
      }

      const polyline = symbol!.graphics.find((g) => g.kind === 'polyline');
      expect(polyline).toBeDefined();
      if (polyline && polyline.kind === 'polyline') {
        expect(polyline.points).toHaveLength(2);
        expect(polyline.points[0]).toEqual({ x: 0, y: 20 });
        expect(polyline.points[1]).toEqual({ x: 12, y: 20 });
      }
    });

    it('parses 2 units (Coil and Contact)', () => {
      const { symbol } = parseSymbolXml(RELAY_XML);
      expect(symbol!.units).toHaveLength(2);
      expect(symbol!.units![0].unitId).toBe(1);
      expect(symbol!.units![0].name).toBe('Coil');
      expect(symbol!.units![1].unitId).toBe(2);
      expect(symbol!.units![1].name).toBe('Contact');
    });

    it('parses Coil unit pins correctly', () => {
      const { symbol } = parseSymbolXml(RELAY_XML);
      const coilUnit = symbol!.units![0];
      expect(coilUnit.pins).toHaveLength(2);
      expect(coilUnit.pins.map((p) => p.id)).toEqual(['coil_in', 'coil_out']);
    });

    it('parses Contact unit pins correctly', () => {
      const { symbol } = parseSymbolXml(RELAY_XML);
      const contactUnit = symbol!.units![1];
      expect(contactUnit.pins).toHaveLength(3);
      expect(contactUnit.pins.map((p) => p.id)).toContain('com');
      expect(contactUnit.pins.map((p) => p.id)).toContain('no');
      expect(contactUnit.pins.map((p) => p.id)).toContain('nc');
    });

    it('parses all 4 properties with correct types and values', () => {
      const { symbol } = parseSymbolXml(RELAY_XML);
      expect(symbol!.properties).toHaveLength(4);

      const designation = symbol!.properties.find((p) => p.key === 'designation')!;
      expect(designation.type).toBe('string');
      expect(designation.value).toBe('K1');

      const coilVoltage = symbol!.properties.find((p) => p.key === 'coilVoltage')!;
      expect(coilVoltage.type).toBe('number');
      expect(coilVoltage.value).toBe(24);

      const energized = symbol!.properties.find((p) => p.key === 'energized')!;
      expect(energized.type).toBe('boolean');
      expect(energized.value).toBe(false);
    });

    it('parses behavior with templateId and terminalRoles', () => {
      const { symbol } = parseSymbolXml(RELAY_XML);
      expect(symbol!.behavior).toBeDefined();
      expect(symbol!.behavior!.templateId).toBe('archetype:relay');
      expect(symbol!.behavior!.archetype).toBe('relay');
      expect(symbol!.behavior!.terminalRoles).toMatchObject({
        coil_in: 'A1',
        coil_out: 'A2',
        com: 'COM',
        no: 'NO',
        nc: 'NC',
      });
    });

    it('parses energized visual state with primitive overrides', () => {
      const { symbol } = parseSymbolXml(RELAY_XML);
      expect(symbol!.visualStates).toBeDefined();
      expect(symbol!.visualStates!['energized']).toBeDefined();
      const energized = symbol!.visualStates!['energized']!;
      expect(energized.primitiveOverrides).toBeDefined();
      expect(energized.primitiveOverrides!['coil-body']).toMatchObject({
        stroke: '#22c55e',
        fill: '#d1fae5',
      });
      expect(energized.primitiveOverrides!['coil-label']).toMatchObject({
        fill: '#15803d',
      });
    });

    it('parses timestamps correctly', () => {
      const { symbol } = parseSymbolXml(RELAY_XML);
      expect(symbol!.createdAt).toBe('2026-03-05T00:00:00Z');
      expect(symbol!.updatedAt).toBe('2026-03-05T00:00:00Z');
    });
  });

  describe('minimal valid XML parsing', () => {
    it('parses a minimal symbol with 2 ports', () => {
      const { symbol, errors } = parseSymbolXml(MINIMAL_VALID_XML);
      expect(errors).toHaveLength(0);
      expect(symbol).toBeDefined();
      expect(symbol!.id).toBe('custom:minimal');
      expect(symbol!.width).toBe(30);
      expect(symbol!.height).toBe(20);
      expect(symbol!.pins).toHaveLength(2);
    });

    it('parses rect primitive from minimal XML', () => {
      const { symbol } = parseSymbolXml(MINIMAL_VALID_XML);
      expect(symbol!.graphics).toHaveLength(1);
      const rect = symbol!.graphics[0];
      expect(rect.kind).toBe('rect');
      if (rect.kind === 'rect') {
        expect(rect.x).toBe(2.5);
        expect(rect.y).toBe(2.5);
        expect(rect.width).toBe(25);
        expect(rect.height).toBe(15);
      }
    });

    it('parses port IN at (0, 20) with left orientation', () => {
      const { symbol } = parseSymbolXml(MINIMAL_VALID_XML);
      const inPin = symbol!.pins.find((p) => p.id === 'in')!;
      expect(inPin.position).toEqual({ x: 0, y: 10 });
      expect(inPin.orientation).toBe('left');
      expect(inPin.type).toBe('input');
    });
  });

  describe('all supported graphic primitive kinds', () => {
    const xmlWithAllPrimitives = `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition xmlns:ms="http://modone.io/schema/symbol/1.0"
  id="test:all-prims" name="All Primitives" version="1.0.0">
  <ms:Category>test</ms:Category>
  <ms:CreatedAt>2026-03-31T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-31T00:00:00Z</ms:UpdatedAt>
  <ms:Layout width="40" height="40" unit="mm"/>
  <ms:Ports>
    <ms:Port id="p1" name="P1" number="1"
             electricalType="passive" shape="line" orientation="left"
             x="0" y="20" length="0"
             nameVisible="true" numberVisible="true"/>
  </ms:Ports>
  <ms:Graphics>
    <ms:Rect x="5" y="5" width="30" height="30" stroke="#000" fill="none" strokeWidth="1"/>
    <ms:Circle cx="20" cy="20" r="10" stroke="#000" fill="none" strokeWidth="0.5"/>
    <ms:Polyline stroke="#000" fill="none" strokeWidth="0.5">
      <ms:Point x="0" y="20"/>
      <ms:Point x="40" y="20"/>
    </ms:Polyline>
    <ms:Arc cx="20" cy="20" r="7.5" startAngle="0" endAngle="180" stroke="#000" fill="none" strokeWidth="0.5"/>
    <ms:Text x="20" y="10" fontSize="5" fontFamily="Arial" fill="#000" anchor="middle">T</ms:Text>
  </ms:Graphics>
  <ms:Properties/>
</ms:SymbolDefinition>`;

    it('parses all 5 graphic primitive kinds: rect, circle, polyline, arc, text', () => {
      const { symbol, errors } = parseSymbolXml(xmlWithAllPrimitives);
      expect(errors).toHaveLength(0);
      const kinds = symbol!.graphics.map((g) => g.kind);
      expect(kinds).toContain('rect');
      expect(kinds).toContain('circle');
      expect(kinds).toContain('polyline');
      expect(kinds).toContain('arc');
      expect(kinds).toContain('text');
    });

    it('parses circle cx, cy, r correctly', () => {
      const { symbol } = parseSymbolXml(xmlWithAllPrimitives);
      const circle = symbol!.graphics.find((g) => g.kind === 'circle');
      expect(circle!.kind).toBe('circle');
      if (circle && circle.kind === 'circle') {
        expect(circle.cx).toBe(20);
        expect(circle.cy).toBe(20);
        expect(circle.r).toBe(10);
      }
    });

    it('parses arc startAngle and endAngle', () => {
      const { symbol } = parseSymbolXml(xmlWithAllPrimitives);
      const arc = symbol!.graphics.find((g) => g.kind === 'arc');
      expect(arc!.kind).toBe('arc');
      if (arc && arc.kind === 'arc') {
        expect(arc.startAngle).toBe(0);
        expect(arc.endAngle).toBe(180);
      }
    });
  });

  describe('error handling', () => {
    it('returns parse error for malformed XML', () => {
      const result = parseSymbolXml('<unclosed>');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.symbol).toBeUndefined();
    });

    it('returns error when root element is not SymbolDefinition', () => {
      const wrongRoot = `<?xml version="1.0"?>
<ms:NotASymbol xmlns:ms="http://modone.io/schema/symbol/1.0" id="x" name="y" version="1.0.0"/>`;
      const result = parseSymbolXml(wrongRoot);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('NotASymbol');
    });

    it('returns error when id attribute is missing', () => {
      const noId = `<?xml version="1.0"?>
<ms:SymbolDefinition xmlns:ms="http://modone.io/schema/symbol/1.0" name="Test" version="1.0.0"/>`;
      const result = parseSymbolXml(noId);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('id');
    });

    it('returns error when name attribute is missing', () => {
      const noName = `<?xml version="1.0"?>
<ms:SymbolDefinition xmlns:ms="http://modone.io/schema/symbol/1.0" id="x" version="1.0.0"/>`;
      const result = parseSymbolXml(noName);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('name');
    });

    it('returns error when version attribute is missing', () => {
      const noVersion = `<?xml version="1.0"?>
<ms:SymbolDefinition xmlns:ms="http://modone.io/schema/symbol/1.0" id="x" name="Test"/>`;
      const result = parseSymbolXml(noVersion);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('version');
    });

    it('parseSymbolXmlOrThrow throws on invalid XML', () => {
      expect(() => parseSymbolXmlOrThrow('not xml at all')).toThrow();
    });

    it('isValidSymbolXml returns false for malformed XML', () => {
      expect(isValidSymbolXml('<broken')).toBe(false);
    });

    it('isValidSymbolXml returns true for valid relay XML', () => {
      expect(isValidSymbolXml(RELAY_XML)).toBe(true);
    });
  });

  describe('XML parsed relay matches TypeScript relay definition', () => {
    it('XML and TypeScript relay have same id, name, version', () => {
      const { symbol: xmlRelay } = parseSymbolXml(RELAY_XML);
      expect(xmlRelay!.id).toBe(relaySymbol.id);
      expect(xmlRelay!.name).toBe(relaySymbol.name);
      expect(xmlRelay!.version).toBe(relaySymbol.version);
    });

    it('XML and TypeScript relay have same dimensions', () => {
      const { symbol: xmlRelay } = parseSymbolXml(RELAY_XML);
      expect(xmlRelay!.width).toBe(relaySymbol.width);
      expect(xmlRelay!.height).toBe(relaySymbol.height);
    });

    it('XML relay has same pin count as TypeScript relay', () => {
      const { symbol: xmlRelay } = parseSymbolXml(RELAY_XML);
      expect(xmlRelay!.pins).toHaveLength(relaySymbol.pins.length);
    });

    it('XML relay pin positions match TypeScript relay', () => {
      const { symbol: xmlRelay } = parseSymbolXml(RELAY_XML);
      for (const expectedPin of relaySymbol.pins) {
        const actualPin = xmlRelay!.pins.find((p) => p.id === expectedPin.id);
        expect(actualPin).toBeDefined();
        expect(actualPin!.position).toEqual(expectedPin.position);
        expect(actualPin!.orientation).toBe(expectedPin.orientation);
        expect(actualPin!.type).toBe(expectedPin.type);
      }
    });

    it('XML relay has same unit count as TypeScript relay', () => {
      const { symbol: xmlRelay } = parseSymbolXml(RELAY_XML);
      expect(xmlRelay!.units).toHaveLength(relaySymbol.units!.length);
    });

    it('XML relay has same visual state keys as TypeScript relay', () => {
      const { symbol: xmlRelay } = parseSymbolXml(RELAY_XML);
      expect(Object.keys(xmlRelay!.visualStates ?? {})).toEqual(
        Object.keys(relaySymbol.visualStates ?? {}),
      );
    });
  });
});

// ============================================================================
// Part 2: Adapter — symbolBlockDefAdapter.ts
// ============================================================================

describe('Symbol → BlockDefinition Adapter', () => {
  describe('computePinOffset()', () => {
    it('computes offset 0.5 for center pin on left edge', () => {
      const pin = { id: 'p', name: 'P', number: '1', type: 'input' as const, shape: 'line' as const, position: { x: 0, y: 40 }, orientation: 'left' as const, length: 0 };
      expect(computePinOffset(pin, 80, 80)).toBeCloseTo(0.5);
    });

    it('computes offset 0.25 for no pin on right edge at y=20 of 80px symbol', () => {
      const pin = { id: 'no', name: 'NO', number: '14', type: 'output' as const, shape: 'line' as const, position: { x: 80, y: 20 }, orientation: 'right' as const, length: 0 };
      expect(computePinOffset(pin, 80, 80)).toBeCloseTo(0.25);
    });

    it('computes offset 0.75 for nc pin on right edge at y=60 of 80px symbol', () => {
      const pin = { id: 'nc', name: 'NC', number: '12', type: 'output' as const, shape: 'line' as const, position: { x: 80, y: 60 }, orientation: 'right' as const, length: 0 };
      expect(computePinOffset(pin, 80, 80)).toBeCloseTo(0.75);
    });

    it('computes offset 0.5 for center pin on top edge', () => {
      const pin = { id: 'in', name: 'IN', number: '1', type: 'input' as const, shape: 'line' as const, position: { x: 20, y: 0 }, orientation: 'up' as const, length: 0 };
      expect(computePinOffset(pin, 40, 40)).toBeCloseTo(0.5);
    });

    it('computes correct offset for non-center top pin', () => {
      const pin = { id: 'p', name: 'P', number: '1', type: 'passive' as const, shape: 'line' as const, position: { x: 20, y: 0 }, orientation: 'up' as const, length: 0 };
      // 20/80 = 0.25
      expect(computePinOffset(pin, 80, 80)).toBeCloseTo(0.25);
    });
  });

  describe('symbolPinToPort()', () => {
    it('converts input pin with up orientation to top port', () => {
      const pin = { id: 'coil_in', name: 'A1', number: 'A1', type: 'input' as const, shape: 'line' as const, position: { x: 40, y: 0 }, orientation: 'up' as const, length: 0 };
      const port = symbolPinToPort(pin, 80, 80);
      expect(port.id).toBe('coil_in');
      expect(port.type).toBe('input');
      expect(port.label).toBe('A1');
      expect(port.position).toBe('top');
      expect(port.absolutePosition).toEqual({ x: 40, y: 0 });
    });

    it('converts output pin with right orientation to right port', () => {
      const pin = { id: 'no', name: 'NO', number: '14', type: 'output' as const, shape: 'line' as const, position: { x: 80, y: 20 }, orientation: 'right' as const, length: 0 };
      const port = symbolPinToPort(pin, 80, 80);
      expect(port.position).toBe('right');
      expect(port.type).toBe('output');
      expect(port.offset).toBeCloseTo(0.25);
    });

    it('does not set offset when it equals the default 0.5', () => {
      const pin = { id: 'com', name: 'COM', number: '11', type: 'input' as const, shape: 'line' as const, position: { x: 0, y: 40 }, orientation: 'left' as const, length: 0 };
      const port = symbolPinToPort(pin, 80, 80);
      // offset = 40/80 = 0.5 → default, should not be set
      expect(port.offset).toBeUndefined();
    });

    it('maps power pin to input port type', () => {
      const pin = { id: 'vcc', name: 'VCC', number: '1', type: 'power' as const, shape: 'line' as const, position: { x: 20, y: 0 }, orientation: 'up' as const, length: 0 };
      const port = symbolPinToPort(pin, 40, 40);
      expect(port.type).toBe('input');
    });

    it('maps passive pin to bidirectional port type', () => {
      const pin = { id: 'conn', name: 'CONN', number: '1', type: 'passive' as const, shape: 'line' as const, position: { x: 0, y: 20 }, orientation: 'left' as const, length: 0 };
      const port = symbolPinToPort(pin, 80, 40);
      expect(port.type).toBe('bidirectional');
    });

    it('respects hidden pins implicitly via symbolPinsToRawPorts', () => {
      const symbol: SymbolDefinition = {
        id: 'test:hidden',
        name: 'Hidden Pin Test',
        version: '1.0.0',
        category: 'test',
        createdAt: '2026-03-31T00:00:00Z',
        updatedAt: '2026-03-31T00:00:00Z',
        width: 40,
        height: 40,
        graphics: [],
        pins: [
          { id: 'visible', name: 'V', number: '1', type: 'input', shape: 'line', position: { x: 0, y: 20 }, orientation: 'left', length: 0 },
          { id: 'hidden_pin', name: 'H', number: '2', type: 'output', shape: 'line', position: { x: 40, y: 20 }, orientation: 'right', length: 0, hidden: true },
        ],
        properties: [],
      };
      const ports = symbolPinsToRawPorts(symbol);
      expect(ports).toHaveLength(1);
      expect(ports[0].id).toBe('visible');
    });
  });

  describe('getAllPins() — deduplication for multi-unit symbols', () => {
    it('deduplicates pins shared between top-level and units for relay', () => {
      const allPins = getAllPins(relaySymbol);
      const ids = allPins.map((p) => p.id);
      // Each id should appear exactly once
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('returns all 5 pins for relay (union of coil + contact)', () => {
      const allPins = getAllPins(relaySymbol);
      const ids = new Set(allPins.map((p) => p.id));
      expect(ids.has('coil_in')).toBe(true);
      expect(ids.has('coil_out')).toBe(true);
      expect(ids.has('com')).toBe(true);
      expect(ids.has('no')).toBe(true);
      expect(ids.has('nc')).toBe(true);
    });

    it('returns all pins for a single-unit symbol without duplication', () => {
      const buttonSym = getBuiltinSymbolForBlockType('button')!;
      const allPins = getAllPins(buttonSym);
      expect(allPins).toHaveLength(2);
    });
  });

  describe('symbolDefToBlockDefinition()', () => {
    it('converts relay symbol to a BlockDefinition with normalized size', () => {
      const blockDef = symbolDefToBlockDefinition(relaySymbol);
      // Size is normalized from px to mm (mm values depend on SYMBOL_PX_TO_MM)
      expect(blockDef.size.width).toBeGreaterThan(0);
      expect(blockDef.size.height).toBeGreaterThan(0);
      // width should equal height for relay (80x80 px → symmetric)
      expect(blockDef.size.width).toBe(blockDef.size.height);
    });

    it('converts relay to 5 ports', () => {
      const blockDef = symbolDefToBlockDefinition(relaySymbol);
      expect(blockDef.defaultPorts).toHaveLength(5);
    });

    it('relay derived ports have correct IDs', () => {
      const blockDef = symbolDefToBlockDefinition(relaySymbol);
      const ids = blockDef.defaultPorts.map((p) => p.id);
      expect(ids).toContain('coil_in');
      expect(ids).toContain('coil_out');
      expect(ids).toContain('com');
      expect(ids).toContain('no');
      expect(ids).toContain('nc');
    });

    it('relay.no port has position=right and offset≈0.25', () => {
      const blockDef = symbolDefToBlockDefinition(relaySymbol);
      const noPort = blockDef.defaultPorts.find((p) => p.id === 'no')!;
      expect(noPort.position).toBe('right');
      expect(noPort.offset).toBeCloseTo(0.25);
    });

    it('relay.nc port has position=right and offset≈0.75', () => {
      const blockDef = symbolDefToBlockDefinition(relaySymbol);
      const ncPort = blockDef.defaultPorts.find((p) => p.id === 'nc')!;
      expect(ncPort.position).toBe('right');
      expect(ncPort.offset).toBeCloseTo(0.75);
    });

    it('converts relay defaultProps from properties', () => {
      const blockDef = symbolDefToBlockDefinition(relaySymbol);
      expect(blockDef.defaultProps).toMatchObject({
        designation: 'K1',
        coilVoltage: 24,
        energized: false,
      });
    });
  });
});

// ============================================================================
// Part 3: Compatibility — blockDefinitions.ts vs symbolBlockDefAdapter
// ============================================================================

// The block types that have BOTH a blockDefinitions.ts entry AND a builtin symbol
const COMPATIBLE_BLOCK_TYPES: BlockType[] = [
  'powersource',
  'plc_out',
  'plc_in',
  'led',
  'button',
  'relay',
  'fuse',
  'motor',
  'emergency_stop',
  'selector_switch',
  'solenoid_valve',
  'sensor',
  'pilot_lamp',
  'net_label',
  'transformer',
  'terminal_block',
  'overload_relay',
  'contactor',
  'disconnect_switch',
  'off_page_connector',
  'terminal',
];

describe('Compatibility: blockDefinitions.ts vs Symbol System', () => {
  describe('size consistency', () => {
    it.each(COMPATIBLE_BLOCK_TYPES)(
      '%s: symbol size matches blockDefinitions size',
      (blockType) => {
        const legacyDef = getBlockDefinition(blockType);
        const symbolSize = getSymbolSize(blockType);

        expect(symbolSize).not.toBeNull();
        // Sizes should match within floating point tolerance
        expect(symbolSize!.width).toBeCloseTo(legacyDef.size.width, 3);
        expect(symbolSize!.height).toBeCloseTo(legacyDef.size.height, 3);
      },
    );
  });

  describe('port count consistency', () => {
    it.each(COMPATIBLE_BLOCK_TYPES)(
      '%s: symbol port count matches blockDefinitions port count',
      (blockType) => {
        const legacyPorts = getDefaultPorts(blockType);
        const symbolPorts = getSymbolPorts(blockType);

        expect(symbolPorts).toHaveLength(legacyPorts.length);
      },
    );
  });

  describe('port ID consistency', () => {
    it.each(COMPATIBLE_BLOCK_TYPES)(
      '%s: symbol port IDs match blockDefinitions port IDs',
      (blockType) => {
        const legacyPorts = getDefaultPorts(blockType);
        const symbolPorts = getSymbolPorts(blockType);

        const legacyIds = legacyPorts.map((p) => p.id).sort();
        const symbolIds = symbolPorts.map((p) => p.id).sort();

        expect(symbolIds).toEqual(legacyIds);
      },
    );
  });

  describe('port position string consistency', () => {
    it.each(COMPATIBLE_BLOCK_TYPES)(
      '%s: symbol port positions match blockDefinitions port positions',
      (blockType) => {
        const legacyPorts = getDefaultPorts(blockType);
        const symbolPorts = getSymbolPorts(blockType);

        for (const legacyPort of legacyPorts) {
          const symbolPort = symbolPorts.find((p) => p.id === legacyPort.id);
          expect(symbolPort).toBeDefined();
          expect(symbolPort!.position).toBe(legacyPort.position);
        }
      },
    );
  });

  describe('port offset consistency', () => {
    it.each(COMPATIBLE_BLOCK_TYPES)(
      '%s: symbol port offsets match blockDefinitions port offsets',
      (blockType) => {
        const legacyPorts = getDefaultPorts(blockType);
        const symbolPorts = getSymbolPorts(blockType);

        for (const legacyPort of legacyPorts) {
          const symbolPort = symbolPorts.find((p) => p.id === legacyPort.id);
          if (!symbolPort) continue;

          // Both default to 0.5 if unset
          const legacyOffset = legacyPort.offset ?? 0.5;
          const symbolOffset = symbolPort.offset ?? 0.5;

          expect(symbolOffset).toBeCloseTo(legacyOffset, 3);
        }
      },
    );
  });

  describe('port absolutePosition consistency', () => {
    it.each(COMPATIBLE_BLOCK_TYPES)(
      '%s: symbol port absolutePositions match blockDefinitions',
      (blockType) => {
        const legacyPorts = getDefaultPorts(blockType);
        const symbolPorts = getSymbolPorts(blockType);

        for (const legacyPort of legacyPorts) {
          if (!legacyPort.absolutePosition) continue;

          const symbolPort = symbolPorts.find((p) => p.id === legacyPort.id);
          if (!symbolPort?.absolutePosition) continue;

          expect(symbolPort.absolutePosition.x).toBeCloseTo(
            legacyPort.absolutePosition.x,
            3,
          );
          expect(symbolPort.absolutePosition.y).toBeCloseTo(
            legacyPort.absolutePosition.y,
            3,
          );
        }
      },
    );
  });

  describe('blockDefinitions override set + symbol derivation', () => {
    // The ONLY block types that stay hardcoded: no symbol (custom_symbol) or a
    // strict size/ports(type,offset,abs)/props divergence from their symbol.
    // Established by an exhaustive strict comparison; locked here so a new
    // hardcoded entry (or a removed one) fails loudly.
    const EXPECTED_OVERRIDES = [
      'capacitor', 'connector', 'custom_symbol', 'inductor', 'junction_box',
      'plc_output', 'power_source', 'power_source_dc_2p', 'relay_coil',
      'resistor', 'text',
    ];

    it('BLOCK_DEFINITIONS holds exactly the intentional symbol-divergent overrides', () => {
      expect(Object.keys(BLOCK_DEFINITIONS_RAW).sort()).toEqual([...EXPECTED_OVERRIDES].sort());
    });

    it('override types return the hardcoded override, not the symbol', () => {
      // relay_coil is a 2-pin 20x30 simplification of the 5-pin relay symbol.
      expect(getBlockSize('relay_coil' as BlockType)).toEqual({ width: 20, height: 30 });
      expect(getDefaultPorts('relay_coil' as BlockType)).toHaveLength(2);
      // resistor override pins are directed, not the symbol's bidirectional.
      expect(getDefaultPorts('resistor' as BlockType).find((p) => p.id === 'in')?.type).toBe('input');
    });

    it('non-override symbol-backed types derive geometry from the symbol', () => {
      // relay is NOT an override → full 5-pin symbol geometry, derived live.
      expect(getDefaultPorts('relay')).toHaveLength(5);
      expect(getBlockSize('relay')).toEqual(getSymbolSize('relay'));
      // And every non-override key with a symbol resolves (no throw).
      const overrides = new Set(EXPECTED_OVERRIDES);
      for (const key of Object.keys(BLOCK_DEFINITIONS_RAW) as BlockType[]) {
        if (overrides.has(key)) continue;
        expect(getBlockDefinitionFromSymbol(key)).not.toBeNull();
      }
    });
  });

  describe('defaultProps reverse-coverage probe', () => {
    // PROBE: does the symbol cover ALL legacy default-prop keys (with matching
    // values)? If yes for every type, blockDefinitions defaultProps is fully
    // redundant and the hardcoded entries can be derived from symbols.
    it.each(COMPATIBLE_BLOCK_TYPES)(
      '%s: legacy defaultProps keys are all present in symbol defaultProps with matching values',
      (blockType) => {
        const legacyProps = getDefaultBlockProps(blockType);
        const symbolProps = getSymbolDefaultProps(blockType);

        for (const [key, legacyValue] of Object.entries(legacyProps)) {
          if (legacyValue === undefined) continue;
          expect(symbolProps).toHaveProperty(key);
          expect(String(symbolProps[key])).toBe(String(legacyValue));
        }
      },
    );
  });

  describe('defaultProps consistency', () => {
    it.each(COMPATIBLE_BLOCK_TYPES)(
      '%s: symbol defaultProps keys are a subset of blockDefinitions defaultProps keys',
      (blockType) => {
        // Symbol props are derived from SymbolDefinition.properties which
        // may have a slightly different (usually smaller) set.
        // Verify at minimum that the keys that exist in symbol props
        // also exist in the legacy defaults with the same value.
        const legacyProps = getDefaultBlockProps(blockType);
        const symbolProps = getSymbolDefaultProps(blockType);

        for (const [key, symbolValue] of Object.entries(symbolProps)) {
          expect(legacyProps).toHaveProperty(key);
          // Skip comparison when the legacy value is undefined — blockDefinitions.ts
          // uses undefined as a "no default" placeholder for some optional properties
          // (e.g. off_page_connector.targetPageId) while the symbol system stores ''.
          // These are semantically equivalent for "unset" optional values.
          if (legacyProps[key] === undefined) continue;
          // Values should match (same type and value)
          expect(String(legacyProps[key])).toBe(String(symbolValue));
        }
      },
    );
  });

  describe('checkCompatibility() utility', () => {
    it('returns no mismatches for relay', () => {
      const legacyDef = getBlockDefinition('relay');
      const derivedDef = getBlockDefinitionFromSymbol('relay')!;
      const result = checkCompatibility('relay', legacyDef, derivedDef);

      expect(result.sizeMatch).toBe(true);
      expect(result.portCountMatch).toBe(true);
      expect(result.portPositionsMatch).toBe(true);
      expect(result.mismatches).toHaveLength(0);
    });

    it('returns no mismatches for button', () => {
      const legacyDef = getBlockDefinition('button');
      const derivedDef = getBlockDefinitionFromSymbol('button')!;
      const result = checkCompatibility('button', legacyDef, derivedDef);

      expect(result.sizeMatch).toBe(true);
      expect(result.portCountMatch).toBe(true);
    });

    it('getBlockDefinitionFromSymbol returns null for unknown block type', () => {
      const result = getBlockDefinitionFromSymbol('__nonexistent_type__');
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// Part 4: Full Pipeline Integration
// ============================================================================

describe('Full Pipeline Integration', () => {
  describe('XML → SymbolDefinition → BlockDefinition → wire routing offset', () => {
    it('XML-parsed relay produces same port offsets as blockDefinitions.ts relay', () => {
      const { symbol: xmlRelay } = parseSymbolXml(RELAY_XML);
      const xmlBlockDef = symbolDefToBlockDefinition(xmlRelay!);
      const legacyBlockDef = getBlockDefinition('relay');

      // relay.no should have offset 0.25 in both systems
      const xmlNoPort = xmlBlockDef.defaultPorts.find((p) => p.id === 'no');
      const legacyNoPort = legacyBlockDef.defaultPorts.find((p) => p.id === 'no');

      expect(xmlNoPort!.offset ?? 0.5).toBeCloseTo(legacyNoPort!.offset ?? 0.5, 3);

      // relay.nc should have offset 0.75 in both systems
      const xmlNcPort = xmlBlockDef.defaultPorts.find((p) => p.id === 'nc');
      const legacyNcPort = legacyBlockDef.defaultPorts.find((p) => p.id === 'nc');
      expect(xmlNcPort!.offset ?? 0.5).toBeCloseTo(legacyNcPort!.offset ?? 0.5, 3);
    });

    it('XML-parsed relay produces same size as TypeScript relay symbol', () => {
      const { symbol: xmlRelay } = parseSymbolXml(RELAY_XML);
      const xmlBlockDef = symbolDefToBlockDefinition(xmlRelay!);
      const tsBlockDef = symbolDefToBlockDefinition(relaySymbol);

      expect(xmlBlockDef.size.width).toBeCloseTo(tsBlockDef.size.width, 3);
      expect(xmlBlockDef.size.height).toBeCloseTo(tsBlockDef.size.height, 3);
    });

    it('XML-parsed relay produces same port count as TypeScript relay symbol', () => {
      const { symbol: xmlRelay } = parseSymbolXml(RELAY_XML);
      const xmlPorts = symbolDefToBlockDefinition(xmlRelay!).defaultPorts;
      const tsPorts = symbolDefToBlockDefinition(relaySymbol).defaultPorts;
      expect(xmlPorts).toHaveLength(tsPorts.length);
    });
  });

  describe('symbolBridge — BUILTIN_SYMBOLS covers all canonical types', () => {
    it('BUILTIN_SYMBOLS contains exactly 45 symbols', () => {
      expect(BUILTIN_SYMBOLS.size).toBe(45);
    });

    it('all symbols have required fields: id, name, version, category', () => {
      for (const [, symbol] of BUILTIN_SYMBOLS) {
        expect(symbol.id).toBeTruthy();
        expect(symbol.name).toBeTruthy();
        expect(symbol.version).toBeTruthy();
        expect(symbol.category).toBeTruthy();
      }
    });

    it('all symbols have at least one pin', () => {
      for (const [id, symbol] of BUILTIN_SYMBOLS) {
        // text and scope/net_label are exceptions — check after
        const allPins = getAllPins(symbol);
        if (id !== 'builtin:text') {
          expect(allPins.length).toBeGreaterThan(0);
        }
      }
    });

    it('getBuiltinSymbol returns symbol for builtin:relay', () => {
      const relay = getBuiltinSymbol('builtin:relay');
      expect(relay).toBeDefined();
      expect(relay!.id).toBe('builtin:relay');
    });

    it('getBuiltinSymbolForBlockType handles legacy alias: plc_input → plc_in', () => {
      const sym = getBuiltinSymbolForBlockType('plc_input');
      expect(sym).toBeDefined();
      expect(sym!.id).toBe('builtin:plc_in');
    });

    it('getBuiltinSymbolForBlockType handles legacy alias: relay_coil → relay', () => {
      const sym = getBuiltinSymbolForBlockType('relay_coil');
      expect(sym).toBeDefined();
      expect(sym!.id).toBe('builtin:relay');
    });

    it('getBuiltinSymbolForBlockType returns undefined for unknown type', () => {
      const sym = getBuiltinSymbolForBlockType('__nonexistent__');
      expect(sym).toBeUndefined();
    });
  });

  describe('XML → BlockDefinition → getBlockDefinitionFromSymbol consistency', () => {
    it('getBlockDefinitionFromSymbol produces same size as getBlockSize for relay', () => {
      const symSize = getSymbolSize('relay');
      const legacySize = getBlockSize('relay');

      expect(symSize!.width).toBeCloseTo(legacySize.width, 3);
      expect(symSize!.height).toBeCloseTo(legacySize.height, 3);
    });

    it('getBlockDefinitionFromSymbol returns a valid BlockDefinition for all compatible types', () => {
      for (const blockType of COMPATIBLE_BLOCK_TYPES) {
        const derived = getBlockDefinitionFromSymbol(blockType);
        expect(derived).not.toBeNull();
        expect(derived!.size.width).toBeGreaterThan(0);
        expect(derived!.size.height).toBeGreaterThan(0);
      }
    });
  });

  describe('Property pipeline — symbol properties → blockFactory default props', () => {
    it('relay symbol defaultProps has all keys used by blockFactory', () => {
      const symProps = getSymbolDefaultProps('relay');
      const legacyProps = getDefaultBlockProps('relay');

      // All legacy default prop keys should be representable in the symbol
      // The symbol system may have additional props but must cover the legacy ones
      expect(Object.keys(symProps)).toEqual(
        expect.arrayContaining(['designation', 'coilVoltage', 'contacts', 'energized']),
      );
      expect(Object.keys(legacyProps)).toEqual(
        expect.arrayContaining(['designation', 'coilVoltage', 'contacts', 'energized']),
      );
    });

    it('powersource symbol defaultProps has voltage, polarity, maxCurrent', () => {
      const symProps = getSymbolDefaultProps('powersource');
      expect(symProps).toMatchObject({
        voltage: 24,
        polarity: 'positive',
        maxCurrent: 1000,
      });
    });
  });

  describe('Multi-unit symbol compatibility', () => {
    it('relay (multi-unit) has exactly 2 units in TypeScript definition', () => {
      expect(relaySymbol.units).toHaveLength(2);
    });

    it('relay getAllPins returns 5 unique pins (union of all units)', () => {
      const pins = getAllPins(relaySymbol);
      const ids = new Set(pins.map((p) => p.id));
      expect(ids.size).toBe(5);
    });

    it('contactor getAllPins returns correct number of unique pins', () => {
      const contactor = getBuiltinSymbolForBlockType('contactor')!;
      const legacyPorts = getDefaultPorts('contactor');
      const allPins = getAllPins(contactor);
      // Deduped pins should match the port count in blockDefinitions.ts
      expect(allPins.filter((p) => !p.hidden)).toHaveLength(legacyPorts.length);
    });
  });
});

// ============================================================================
// Part 5: Property Type Fidelity Tests
// ============================================================================

describe('XML Property Parsing — type fidelity', () => {
  const xmlWithAllPropertyTypes = `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition xmlns:ms="http://modone.io/schema/symbol/1.0"
  id="test:props" name="Props Test" version="1.0.0">
  <ms:Category>test</ms:Category>
  <ms:CreatedAt>2026-03-31T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-31T00:00:00Z</ms:UpdatedAt>
  <ms:Layout width="20" height="20" unit="mm"/>
  <ms:Ports>
    <ms:Port id="p" name="P" number="1" electricalType="passive" shape="line"
             orientation="left" x="0" y="10" length="0"
             nameVisible="true" numberVisible="true"/>
  </ms:Ports>
  <ms:Graphics/>
  <ms:Properties>
    <ms:Property key="strProp" type="string" editorType="text" visible="true">
      <ms:DefaultValue>hello</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="numProp" type="number" editorType="number" visible="true">
      <ms:DefaultValue>42</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="boolTrue" type="boolean" editorType="checkbox" visible="true">
      <ms:DefaultValue>true</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="boolFalse" type="boolean" editorType="checkbox" visible="true">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="enumProp" type="string" editorType="select" visible="true">
      <ms:DefaultValue>opt1</ms:DefaultValue>
      <ms:Options>
        <ms:Option>opt1</ms:Option>
        <ms:Option>opt2</ms:Option>
        <ms:Option>opt3</ms:Option>
      </ms:Options>
    </ms:Property>
  </ms:Properties>
</ms:SymbolDefinition>`;

  it('parses string property correctly', () => {
    const { symbol } = parseSymbolXml(xmlWithAllPropertyTypes);
    const prop = symbol!.properties.find((p) => p.key === 'strProp')!;
    expect(prop.type).toBe('string');
    expect(prop.value).toBe('hello');
    expect(typeof prop.value).toBe('string');
  });

  it('parses number property as JavaScript number', () => {
    const { symbol } = parseSymbolXml(xmlWithAllPropertyTypes);
    const prop = symbol!.properties.find((p) => p.key === 'numProp')!;
    expect(prop.type).toBe('number');
    expect(prop.value).toBe(42);
    expect(typeof prop.value).toBe('number');
  });

  it('parses boolean true property as true', () => {
    const { symbol } = parseSymbolXml(xmlWithAllPropertyTypes);
    const prop = symbol!.properties.find((p) => p.key === 'boolTrue')!;
    expect(prop.type).toBe('boolean');
    expect(prop.value).toBe(true);
    expect(typeof prop.value).toBe('boolean');
  });

  it('parses boolean false property as false', () => {
    const { symbol } = parseSymbolXml(xmlWithAllPropertyTypes);
    const prop = symbol!.properties.find((p) => p.key === 'boolFalse')!;
    expect(prop.value).toBe(false);
  });

  it('parses enum/select property with options array', () => {
    const { symbol } = parseSymbolXml(xmlWithAllPropertyTypes);
    const prop = symbol!.properties.find((p) => p.key === 'enumProp')!;
    expect(prop.editorType).toBe('select');
    expect(prop.options).toEqual(['opt1', 'opt2', 'opt3']);
    expect(prop.value).toBe('opt1');
  });
});
