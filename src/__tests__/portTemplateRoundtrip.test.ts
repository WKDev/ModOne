// PortTemplate(가변 포트)의 services 파서 파싱·직렬화 라운드트립 검증 (트랙 B Phase 1)
import { describe, it, expect } from 'vitest';
import { parseSymbolXml, symbolToXml } from '@/services/symbolXmlParser';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition xmlns:ms="http://modone.io/schema/symbol/1.0"
  id="test:scope" name="Test Scope" version="1.0.0">
  <ms:Category>measurement</ms:Category>
  <ms:Layout width="50" height="40" unit="mm"/>
  <ms:Ports>
    <ms:Port id="trig" name="TRIG" number="1" type="input" electricalType="input"
      shape="line" orientation="up" x="25" y="0" length="0"/>
    <ms:PortTemplate repeat="channels" min="1" max="8"
      idPattern="ch{i}" namePattern="CH{i}" numberFrom="2"
      type="input" electricalType="input" orientation="left" shape="line"
      x="0" yStart="10" yStep="10"/>
  </ms:Ports>
  <ms:Properties>
    <ms:Property key="channels" type="number" editorType="number" visible="true">
      <ms:DefaultValue>4</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>
</ms:SymbolDefinition>`;

describe('PortTemplate roundtrip (services parser)', () => {
  it('parses a PortTemplate alongside static ports', () => {
    const [def] = parseSymbolXml(XML);
    expect(def.pins).toHaveLength(1);
    expect(def.pins[0].id).toBe('trig');
    expect(def.portTemplates).toHaveLength(1);
    expect(def.portTemplates![0]).toMatchObject({
      repeat: 'channels',
      min: 1,
      max: 8,
      idPattern: 'ch{i}',
      namePattern: 'CH{i}',
      numberFrom: 2,
      type: 'input',
      electricalType: 'input',
      orientation: 'left',
      shape: 'line',
      x: 0,
      yStart: 10,
      yStep: 10,
    });
  });

  it('survives a symbolToXml → parse round-trip', () => {
    const [def] = parseSymbolXml(XML);
    const [def2] = parseSymbolXml(symbolToXml(def));
    expect(def2.portTemplates).toEqual(def.portTemplates);
    expect(def2.pins).toHaveLength(1);
    expect(def2.pins[0].id).toBe('trig');
  });

  it('leaves portTemplates undefined when none are present', () => {
    const noTpl = XML.replace(/<ms:PortTemplate[\s\S]*?\/>/, '');
    const [def] = parseSymbolXml(noTpl);
    expect(def.portTemplates).toBeUndefined();
    expect(def.pins).toHaveLength(1);
  });
});
