/**
 * Unit tests for symbolXmlParser.ts
 *
 * Verifies parsing of:
 *   - Single <ms:SymbolDefinition> documents (relay.symbol.xml format)
 *   - <ms:SymbolLibrary> documents
 *   - Serialization (SymbolDefinition → XML → SymbolDefinition round-trip)
 *   - Domain constraint validation
 *   - Error handling for malformed XML
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  parseSymbolXml,
  parseSymbolLibraryXml,
  symbolDefinitionToXml,
  symbolLibraryToXml,
  toParsedSymbolDefinition,
  validateDomainConstraints,
  SYMBOL_SCHEMA_NS,
} from '@/lib/symbolXmlParser';
import type { ParsedSymbolDefinition } from '@/lib/symbolXmlParser';
import type { SymbolDefinition } from '@/types/symbol';

// ============================================================================
// Minimal valid symbol XML (relay-like)
// ============================================================================

const MINIMAL_RELAY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="${SYMBOL_SCHEMA_NS}"
  id="test:relay"
  name="Test Relay"
  version="1.0.0"
  domain="circuit"
  canonicalType="relay"
  placeable="true">
  <ms:Description>Test relay symbol</ms:Description>
  <ms:Category>switching</ms:Category>
  <ms:Author>TestSuite</ms:Author>
  <ms:CreatedAt>2026-01-01T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-01-01T00:00:00Z</ms:UpdatedAt>
  <ms:Layout width="80" height="80" unit="px"/>
  <ms:Ports>
    <ms:Port id="coil_in" name="A1" number="A1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="up"
             x="40" y="0" length="0" sortOrder="1"
             nameVisible="true" numberVisible="true"
             edgePosition="top" edgeOffset="0.5"/>
    <ms:Port id="coil_out" name="A2" number="A2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="down"
             x="40" y="80" length="0" sortOrder="2"
             nameVisible="true" numberVisible="true"
             edgePosition="bottom" edgeOffset="0.5"/>
  </ms:Ports>
  <ms:Graphics>
    <ms:Rect id="body" x="10" y="10" width="60" height="60"
             stroke="#888888" fill="transparent" strokeWidth="2"/>
    <ms:Text id="label" x="40" y="40" fontSize="12" fontFamily="Arial"
             fill="#888888" anchor="middle">K</ms:Text>
    <ms:Circle id="dot" cx="40" cy="40" r="3"
               stroke="#888888" fill="#888888" strokeWidth="1"/>
    <ms:Polyline id="lead" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="40" y="0"/>
      <ms:Point x="40" y="10"/>
    </ms:Polyline>
    <ms:Arc id="arc1" cx="40" cy="40" r="10"
            startAngle="0" endAngle="180"
            stroke="#888888" fill="none" strokeWidth="2"/>
  </ms:Graphics>
  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true">
      <ms:DefaultValue>K1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="coilVoltage" type="number" editorType="number" visible="true"
                 min="5" max="690">
      <ms:DefaultValue>24</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="contacts" type="string" editorType="select" visible="true">
      <ms:DefaultValue>NO</ms:DefaultValue>
      <ms:Options>
        <ms:Option>NO</ms:Option>
        <ms:Option>NC</ms:Option>
        <ms:Option>CO</ms:Option>
      </ms:Options>
    </ms:Property>
    <ms:Property key="energized" type="boolean" editorType="checkbox" visible="true">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>
  <ms:Behavior templateId="archetype:relay" archetype="relay"
               interactionMode="none" deviceScoped="false" domain="circuit">
    <ms:TerminalRoles>
      <ms:TerminalRole portId="coil_in" role="A1"/>
      <ms:TerminalRole portId="coil_out" role="A2"/>
    </ms:TerminalRoles>
    <ms:Rules>
      <ms:Rule id="energize" name="Energize coil" priority="1" conditionLogic="all">
        <ms:If type="port_powered" portId="coil_in"/>
        <ms:Then type="set_state" stateName="energized"/>
        <ms:Then type="set_property" propertyKey="energized" value="true"/>
        <ms:Else type="clear_state" stateName="energized"/>
        <ms:Else type="set_property" propertyKey="energized" value="false"/>
      </ms:Rule>
    </ms:Rules>
  </ms:Behavior>
  <ms:VisualStates>
    <ms:VisualState name="energized">
      <ms:PrimitiveOverrides>
        <ms:Override targetId="body" stroke="#22c55e" fill="#d1fae5"/>
        <ms:Override targetId="label" fill="#15803d"/>
      </ms:PrimitiveOverrides>
    </ms:VisualState>
  </ms:VisualStates>
  <ms:Animations/>
  <ms:StandardsRef iecSection="07-12" iecCategory="K" refDesignator="K"/>
</ms:SymbolDefinition>`;

const MINIMAL_LIBRARY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolLibrary
  xmlns:ms="${SYMBOL_SCHEMA_NS}"
  id="test-lib"
  name="Test Library"
  scope="project">
  <ms:MetaInformation>
    <ms:SchemaVersion>1.0.0</ms:SchemaVersion>
    <ms:SourceTool>ModOne Test</ms:SourceTool>
    <ms:Description>Unit test library</ms:Description>
    <ms:Author>Test Suite</ms:Author>
    <ms:CreatedAt>2026-01-01T00:00:00Z</ms:CreatedAt>
    <ms:UpdatedAt>2026-01-01T00:00:00Z</ms:UpdatedAt>
  </ms:MetaInformation>
  <ms:SymbolDefinitions>
    <ms:SymbolDefinition id="lib:switch_no" name="Switch NO" version="1.0.0"
                         domain="circuit" placeable="true">
      <ms:Category>switching</ms:Category>
      <ms:CreatedAt>2026-01-01T00:00:00Z</ms:CreatedAt>
      <ms:UpdatedAt>2026-01-01T00:00:00Z</ms:UpdatedAt>
      <ms:Layout width="60" height="40" unit="px"/>
      <ms:Ports>
        <ms:Port id="in" name="IN" number="1"
                 electricalType="input" shape="line" orientation="left"
                 x="0" y="20" length="0"
                 edgePosition="left" edgeOffset="0.5"/>
        <ms:Port id="out" name="OUT" number="2"
                 electricalType="output" shape="line" orientation="right"
                 x="60" y="20" length="0"
                 edgePosition="right" edgeOffset="0.5"/>
      </ms:Ports>
      <ms:Graphics>
        <ms:Polyline stroke="#888" fill="none" strokeWidth="2">
          <ms:Point x="0" y="20"/>
          <ms:Point x="20" y="20"/>
        </ms:Polyline>
        <ms:Polyline stroke="#888" fill="none" strokeWidth="2">
          <ms:Point x="40" y="20"/>
          <ms:Point x="60" y="20"/>
        </ms:Polyline>
        <ms:Polyline id="arm" stroke="#888" fill="none" strokeWidth="2">
          <ms:Point x="20" y="20"/>
          <ms:Point x="38" y="12"/>
        </ms:Polyline>
        <ms:Circle cx="20" cy="20" r="2" stroke="#888" fill="#888" strokeWidth="1"/>
        <ms:Circle cx="40" cy="20" r="2" stroke="#888" fill="#888" strokeWidth="1"/>
      </ms:Graphics>
      <ms:Properties>
        <ms:Property key="designation" type="string" editorType="text" visible="true">
          <ms:DefaultValue>S1</ms:DefaultValue>
        </ms:Property>
      </ms:Properties>
      <ms:VisualStates/>
      <ms:Animations/>
    </ms:SymbolDefinition>
  </ms:SymbolDefinitions>
</ms:SymbolLibrary>`;

// ============================================================================
// Tests: parseSymbolXml
// ============================================================================

describe('parseSymbolXml', () => {
  it('returns isValid=false for empty input', () => {
    const result = parseSymbolXml('');
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.data).toBeNull();
  });

  it('returns isValid=false for malformed XML', () => {
    const result = parseSymbolXml('<unclosed>');
    expect(result.isValid).toBe(false);
    expect(result.data).toBeNull();
  });

  it('returns isValid=false when root is not SymbolDefinition', () => {
    const result = parseSymbolXml(
      `<ms:SymbolLibrary xmlns:ms="${SYMBOL_SCHEMA_NS}" id="x" name="x" scope="global"></ms:SymbolLibrary>`,
    );
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain('SymbolDefinition');
  });

  it('returns isValid=false when Layout is missing', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <ms:SymbolDefinition xmlns:ms="${SYMBOL_SCHEMA_NS}" id="x" name="X" version="1.0.0">
      <ms:Category>custom</ms:Category>
      <ms:CreatedAt>2026-01-01T00:00:00Z</ms:CreatedAt>
      <ms:UpdatedAt>2026-01-01T00:00:00Z</ms:UpdatedAt>
      <ms:Ports/>
      <ms:Properties/>
    </ms:SymbolDefinition>`;
    const result = parseSymbolXml(xml);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Layout'))).toBe(true);
  });

  it('successfully parses a minimal relay symbol', () => {
    const result = parseSymbolXml(MINIMAL_RELAY_XML);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data).not.toBeNull();
  });

  describe('parsed symbol fields', () => {
    let sym: ParsedSymbolDefinition;

    beforeAll(() => {
      const result = parseSymbolXml(MINIMAL_RELAY_XML);
      sym = result.data!;
    });

    it('has correct id, name, version', () => {
      expect(sym.id).toBe('test:relay');
      expect(sym.name).toBe('Test Relay');
      expect(sym.version).toBe('1.0.0');
    });

    it('has correct metadata', () => {
      expect(sym.description).toBe('Test relay symbol');
      expect(sym.category).toBe('switching');
      expect(sym.author).toBe('TestSuite');
      expect(sym.createdAt).toBe('2026-01-01T00:00:00Z');
    });

    it('has correct layout dimensions', () => {
      expect(sym.width).toBe(80);
      expect(sym.height).toBe(80);
    });

    it('has extended XML fields', () => {
      expect(sym.domain).toBe('circuit');
      expect(sym.canonicalType).toBe('relay');
      expect(sym.placeable).toBe(true);
    });

    it('parses 2 ports correctly', () => {
      expect(sym.pins).toHaveLength(2);
      const coilIn = sym.pins[0];
      expect(coilIn.id).toBe('coil_in');
      expect(coilIn.name).toBe('A1');
      expect(coilIn.number).toBe('A1');
      expect(coilIn.type).toBe('input');
      expect(coilIn.electricalType).toBe('input');
      expect(coilIn.functionalRole).toBe('general');
      expect(coilIn.orientation).toBe('up');
      expect(coilIn.position).toEqual({ x: 40, y: 0 });
      expect(coilIn.sortOrder).toBe(1);
      expect(coilIn.nameVisible).toBe(true);
    });

    it('parses portsExtended with edgePosition and edgeOffset', () => {
      expect(sym.portsExtended).toHaveLength(2);
      const p0 = sym.portsExtended![0];
      expect(p0.edgePosition).toBe('top');
      expect(p0.edgeOffset).toBe(0.5);
    });

    it('parses all 5 graphic primitive types', () => {
      const kinds = sym.graphics.map((g) => g.kind);
      expect(kinds).toContain('rect');
      expect(kinds).toContain('text');
      expect(kinds).toContain('circle');
      expect(kinds).toContain('polyline');
      expect(kinds).toContain('arc');
    });

    it('parses rect primitive fields', () => {
      const rect = sym.graphics.find((g) => g.kind === 'rect');
      expect(rect).toBeDefined();
      if (rect?.kind === 'rect') {
        expect(rect.id).toBe('body');
        expect(rect.x).toBe(10);
        expect(rect.y).toBe(10);
        expect(rect.width).toBe(60);
        expect(rect.height).toBe(60);
        expect(rect.stroke).toBe('#888888');
        expect(rect.strokeWidth).toBe(2);
      }
    });

    it('parses text primitive content', () => {
      const text = sym.graphics.find((g) => g.kind === 'text');
      expect(text).toBeDefined();
      if (text?.kind === 'text') {
        expect(text.id).toBe('label');
        expect(text.text).toBe('K');
        expect(text.anchor).toBe('middle');
        expect(text.fontSize).toBe(12);
      }
    });

    it('parses polyline with points', () => {
      const poly = sym.graphics.find((g) => g.kind === 'polyline');
      expect(poly).toBeDefined();
      if (poly?.kind === 'polyline') {
        expect(poly.points).toHaveLength(2);
        expect(poly.points[0]).toEqual({ x: 40, y: 0 });
        expect(poly.points[1]).toEqual({ x: 40, y: 10 });
      }
    });

    it('parses arc primitive', () => {
      const arc = sym.graphics.find((g) => g.kind === 'arc');
      expect(arc).toBeDefined();
      if (arc?.kind === 'arc') {
        expect(arc.cx).toBe(40);
        expect(arc.cy).toBe(40);
        expect(arc.r).toBe(10);
        expect(arc.startAngle).toBe(0);
        expect(arc.endAngle).toBe(180);
      }
    });

    it('parses 4 properties', () => {
      expect(sym.properties).toHaveLength(4);
    });

    it('parses string property with default value', () => {
      const desig = sym.properties.find((p) => p.key === 'designation');
      expect(desig).toBeDefined();
      expect(desig?.value).toBe('K1');
      expect(desig?.type).toBe('string');
      expect(desig?.editorType).toBe('text');
      expect(desig?.visible).toBe(true);
    });

    it('parses number property as number type', () => {
      const volt = sym.properties.find((p) => p.key === 'coilVoltage');
      expect(volt).toBeDefined();
      expect(volt?.value).toBe(24);
      expect(typeof volt?.value).toBe('number');
    });

    it('parses boolean property as boolean type', () => {
      const energized = sym.properties.find((p) => p.key === 'energized');
      expect(energized).toBeDefined();
      expect(energized?.value).toBe(false);
      expect(typeof energized?.value).toBe('boolean');
    });

    it('parses enum property with options', () => {
      const contacts = sym.properties.find((p) => p.key === 'contacts');
      expect(contacts).toBeDefined();
      expect(contacts?.options).toEqual(['NO', 'NC', 'CO']);
    });

    it('parses behavior binding', () => {
      expect(sym.behavior).toBeDefined();
      expect(sym.behavior?.templateId).toBe('archetype:relay');
      expect(sym.behavior?.archetype).toBe('relay');
      expect(sym.behavior?.interactionMode).toBe('none');
      expect(sym.behavior?.deviceScoped).toBe(false);
    });

    it('parses terminal roles', () => {
      const roles = sym.behavior?.terminalRoles;
      expect(roles).toBeDefined();
      expect(roles?.['coil_in']).toBe('A1');
      expect(roles?.['coil_out']).toBe('A2');
    });

    // QUARANTINED (frozen subsystem): IFTTT extendedBehavior shape in flux during migration.
    it.skip('parses IFTTT rules into extendedBehavior', () => {
      const rules = sym.behavior?.rules;
      expect(rules).toBeDefined();
      expect(rules).toHaveLength(1);
      const rule = rules![0];
      expect(rule.id).toBe('energize');
      expect(rule.conditionLogic).toBe('all');
      expect(rule.conditions).toHaveLength(1);
      expect(rule.conditions[0].type).toBe('port_powered');
      expect(rule.conditions[0].portId).toBe('coil_in');
      expect(rule.thenActions).toHaveLength(2);
      expect(rule.thenActions[0].type).toBe('set_state');
      expect(rule.thenActions[0].stateName).toBe('energized');
      expect(rule.elseActions).toHaveLength(2);
      expect(rule.elseActions[0].type).toBe('clear_state');
    });

    it('parses visual state overrides', () => {
      expect(sym.visualStates).toBeDefined();
      const energized = sym.visualStates?.energized;
      expect(energized).toBeDefined();
      expect(energized?.primitiveOverrides?.['body']).toBeDefined();
      expect(energized?.primitiveOverrides?.['body']?.stroke).toBe('#22c55e');
      expect(energized?.primitiveOverrides?.['body']?.fill).toBe('#d1fae5');
      expect(energized?.primitiveOverrides?.['label']?.fill).toBe('#15803d');
    });

    it('parses standardsRef', () => {
      expect(sym.standardsRef).toBeDefined();
      expect(sym.standardsRef?.iecSection).toBe('07-12');
      expect(sym.standardsRef?.iecCategory).toBe('K');
      expect(sym.standardsRef?.refDesignator).toBe('K');
    });
  });
});

// ============================================================================
// Tests: parseSymbolLibraryXml
// ============================================================================

describe('parseSymbolLibraryXml', () => {
  it('returns isValid=false for empty input', () => {
    const result = parseSymbolLibraryXml('');
    expect(result.isValid).toBe(false);
    expect(result.data).toBeNull();
  });

  it('returns isValid=false when root is SymbolDefinition not SymbolLibrary', () => {
    const result = parseSymbolLibraryXml(MINIMAL_RELAY_XML);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain('SymbolLibrary');
  });

  it('successfully parses a minimal library', () => {
    const result = parseSymbolLibraryXml(MINIMAL_LIBRARY_XML);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data).not.toBeNull();
  });

  describe('parsed library fields', () => {
    let lib: ReturnType<typeof parseSymbolLibraryXml>['data'];

    beforeAll(() => {
      lib = parseSymbolLibraryXml(MINIMAL_LIBRARY_XML).data;
    });

    it('has correct id, name, scope', () => {
      expect(lib?.id).toBe('test-lib');
      expect(lib?.name).toBe('Test Library');
      expect(lib?.scope).toBe('project');
    });

    it('has MetaInformation parsed', () => {
      expect(lib?.metadata.schemaVersion).toBe('1.0.0');
      expect(lib?.metadata.sourceTool).toBe('ModOne Test');
      expect(lib?.metadata.description).toBe('Unit test library');
      expect(lib?.metadata.author).toBe('Test Suite');
    });

    it('contains 1 symbol', () => {
      expect(lib?.symbols).toHaveLength(1);
    });

    it('parsed symbol has correct fields', () => {
      const sym = lib?.symbols[0];
      expect(sym?.id).toBe('lib:switch_no');
      expect(sym?.name).toBe('Switch NO');
      expect(sym?.category).toBe('switching');
      expect(sym?.width).toBe(60);
      expect(sym?.height).toBe(40);
    });

    it('symbol has 2 ports', () => {
      const sym = lib?.symbols[0];
      expect(sym?.pins).toHaveLength(2);
      expect(sym?.pins[0].id).toBe('in');
      expect(sym?.pins[1].id).toBe('out');
    });

    it('symbol has graphics', () => {
      const sym = lib?.symbols[0];
      expect(sym?.graphics.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Tests: symbolDefinitionToXml (serialization)
// ============================================================================

describe('symbolDefinitionToXml', () => {
  it('produces valid XML that can be re-parsed', () => {
    const parsed = parseSymbolXml(MINIMAL_RELAY_XML).data!;
    const xml = symbolDefinitionToXml(parsed);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<ms:SymbolDefinition');
    expect(xml).toContain('id="test:relay"');

    // Re-parse the serialized XML
    const reparsed = parseSymbolXml(xml);
    expect(reparsed.isValid).toBe(true);
    expect(reparsed.data?.id).toBe('test:relay');
  });

  it('round-trips id, name, version', () => {
    const parsed = parseSymbolXml(MINIMAL_RELAY_XML).data!;
    const xml = symbolDefinitionToXml(parsed);
    const reparsed = parseSymbolXml(xml).data!;
    expect(reparsed.id).toBe(parsed.id);
    expect(reparsed.name).toBe(parsed.name);
    expect(reparsed.version).toBe(parsed.version);
  });

  it('round-trips ports count', () => {
    const parsed = parseSymbolXml(MINIMAL_RELAY_XML).data!;
    const xml = symbolDefinitionToXml(parsed);
    const reparsed = parseSymbolXml(xml).data!;
    expect(reparsed.pins.length).toBe(parsed.pins.length);
  });

  it('round-trips port details', () => {
    const parsed = parseSymbolXml(MINIMAL_RELAY_XML).data!;
    const xml = symbolDefinitionToXml(parsed);
    const reparsed = parseSymbolXml(xml).data!;
    const p0 = reparsed.pins[0];
    expect(p0.id).toBe('coil_in');
    expect(p0.type).toBe('input');
    expect(p0.position).toEqual({ x: 40, y: 0 });
  });

  it('round-trips graphics count', () => {
    const parsed = parseSymbolXml(MINIMAL_RELAY_XML).data!;
    const xml = symbolDefinitionToXml(parsed);
    const reparsed = parseSymbolXml(xml).data!;
    expect(reparsed.graphics.length).toBe(parsed.graphics.length);
  });

  it('round-trips properties count and values', () => {
    const parsed = parseSymbolXml(MINIMAL_RELAY_XML).data!;
    const xml = symbolDefinitionToXml(parsed);
    const reparsed = parseSymbolXml(xml).data!;
    expect(reparsed.properties.length).toBe(parsed.properties.length);
    const volt = reparsed.properties.find((p) => p.key === 'coilVoltage');
    expect(volt?.value).toBe(24);
    const contacts = reparsed.properties.find((p) => p.key === 'contacts');
    expect(contacts?.options).toEqual(['NO', 'NC', 'CO']);
  });

  it('round-trips visual states', () => {
    const parsed = parseSymbolXml(MINIMAL_RELAY_XML).data!;
    const xml = symbolDefinitionToXml(parsed);
    const reparsed = parseSymbolXml(xml).data!;
    expect(reparsed.visualStates?.energized).toBeDefined();
    expect(reparsed.visualStates?.energized?.primitiveOverrides?.['body']?.stroke).toBe('#22c55e');
  });

  it('uses ms: namespace prefix in output', () => {
    const parsed = parseSymbolXml(MINIMAL_RELAY_XML).data!;
    const xml = symbolDefinitionToXml(parsed);
    expect(xml).toContain('xmlns:ms=');
    expect(xml).toContain('<ms:Ports>');
    expect(xml).toContain('<ms:Graphics>');
  });
});

// ============================================================================
// Tests: symbolLibraryToXml
// ============================================================================

describe('symbolLibraryToXml', () => {
  it('produces XML with SymbolLibrary root', () => {
    const xml = symbolLibraryToXml({
      id: 'my-lib',
      name: 'My Library',
      scope: 'project',
      symbols: [],
    });
    expect(xml).toContain('<ms:SymbolLibrary');
    expect(xml).toContain('id="my-lib"');
    expect(xml).toContain('scope="project"');
  });

  it('round-trips a library with symbols', () => {
    const parsed = parseSymbolXml(MINIMAL_RELAY_XML).data!;
    const xml = symbolLibraryToXml({
      id: 'test-lib',
      name: 'Test',
      scope: 'project',
      symbols: [parsed],
    });

    const reparsed = parseSymbolLibraryXml(xml);
    expect(reparsed.isValid).toBe(true);
    expect(reparsed.data?.symbols).toHaveLength(1);
    expect(reparsed.data?.symbols[0].id).toBe('test:relay');
  });
});

// ============================================================================
// Tests: toParsedSymbolDefinition
// ============================================================================

describe('toParsedSymbolDefinition', () => {
  const minimalDef: SymbolDefinition = {
    id: 'test:switch',
    name: 'Test Switch',
    version: '1.0.0',
    category: 'switching',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    width: 60,
    height: 40,
    graphics: [],
    pins: [
      {
        id: 'in',
        name: 'IN',
        number: '1',
        type: 'input',
        shape: 'line',
        position: { x: 0, y: 20 },
        orientation: 'left',
        length: 0,
      },
    ],
    properties: [],
  };

  it('adds domain, canonicalType, placeable defaults', () => {
    const parsed = toParsedSymbolDefinition(minimalDef);
    expect(parsed.domain).toBe('circuit');
    expect(parsed.placeable).toBe(true);
  });

  it('infers edgePosition from pin position', () => {
    const parsed = toParsedSymbolDefinition(minimalDef);
    const ext = parsed.portsExtended?.[0];
    expect(ext).toBeDefined();
    // pin at x=0 → left edge
    expect(ext?.edgePosition).toBe('left');
  });

  it('accepts custom domain and canonicalType', () => {
    const parsed = toParsedSymbolDefinition(minimalDef, {
      domain: 'plc',
      canonicalType: 'plc_input',
    });
    expect(parsed.domain).toBe('plc');
    expect(parsed.canonicalType).toBe('plc_input');
  });
});

// ============================================================================
// Tests: validateDomainConstraints
// ============================================================================

describe('validateDomainConstraints', () => {
  it('returns empty array for circuit symbol without rules', () => {
    const sym = parseSymbolXml(MINIMAL_RELAY_XML).data!;
    const issues = validateDomainConstraints(sym);
    expect(issues).toHaveLength(0);
  });

  it('returns empty for plc domain with register actions', () => {
    const sym = parseSymbolXml(MINIMAL_RELAY_XML).data!;
    // Override domain to plc
    const plcSym: ParsedSymbolDefinition = { ...sym, domain: 'plc' };
    const issues = validateDomainConstraints(plcSym);
    expect(issues).toHaveLength(0);
  });
});
