/**
 * Migration Script: blockDefinitions.ts → XML Symbol Files
 * Generates ModOne symbol XML files for all 50+ block types.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../src/assets/builtin-symbols/xml');

mkdirSync(OUT_DIR, { recursive: true });

const NS = 'http://modone.io/schema/symbol/1.0';
const SCHEMA_LOC = `${NS} ../../symbol-schema/modone-symbol.xsd`;

function header(id, name, version = '1.0.0', domain = 'circuit', canonicalType = '', placeable = true) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:${id}"
  name="${name}"
  version="${version}"
  domain="${domain}"
  canonicalType="${canonicalType || id}"
  placeable="${placeable}">`;
}

function meta(description, category, standardsRef = '') {
  return `
  <ms:Description>${description}</ms:Description>
  <ms:Category>${category}</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>`;
}

function layout(w, h, unit = 'px') {
  return `\n  <ms:Layout width="${w}" height="${h}" unit="${unit}"/>`;
}

function port(id, name, number, elType, funcRole, shape, orientation, x, y, edgePos, edgeOffset, sortOrder) {
  return `    <ms:Port id="${id}" name="${name}" number="${number}"
             electricalType="${elType}" functionalRole="${funcRole}"
             shape="${shape}" orientation="${orientation}"
             x="${x}" y="${y}" length="0" sortOrder="${sortOrder}"
             nameVisible="true" numberVisible="true"
             edgePosition="${edgePos}" edgeOffset="${edgeOffset}"/>`;
}

function wrapPorts(portsXml) {
  return `\n  <ms:Ports>\n${portsXml}\n  </ms:Ports>`;
}

function prop(key, type, editorType, defaultVal, label, extra = '', description = '') {
  return `    <ms:Property key="${key}" type="${type}" editorType="${editorType}" visible="true" label="${label}"${extra}>
      <ms:DefaultValue>${defaultVal}</ms:DefaultValue>${description ? `\n      <ms:Description>${description}</ms:Description>` : ''}
    </ms:Property>`;
}

function wrapProps(propsXml) {
  return `\n  <ms:Properties>\n${propsXml}\n  </ms:Properties>`;
}

function selectProp(key, defaultVal, label, options, description = '') {
  const opts = options.map(o => `        <ms:Option>${o}</ms:Option>`).join('\n');
  return `    <ms:Property key="${key}" type="string" editorType="select" visible="true" label="${label}">
      <ms:DefaultValue>${defaultVal}</ms:DefaultValue>
      <ms:Options>
${opts}
      </ms:Options>${description ? `\n      <ms:Description>${description}</ms:Description>` : ''}
    </ms:Property>`;
}

function simpleBehavior(archetype, interactionMode = 'none', domain = 'circuit', extra = '') {
  return `\n  <ms:Behavior templateId="archetype:${archetype}" archetype="${archetype}"
               interactionMode="${interactionMode}" deviceScoped="false" domain="${domain}">
    ${extra}
  </ms:Behavior>`;
}

function noAnimations() {
  return '\n  <ms:Animations/>';
}

function footer(standardsRef = '') {
  const std = standardsRef
    ? `\n  ${standardsRef}`
    : '';
  return `${std}\n\n</ms:SymbolDefinition>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper to write a file
// ─────────────────────────────────────────────────────────────────────────────
function write(filename, content) {
  const path = join(OUT_DIR, filename);
  writeFileSync(path, content, 'utf-8');
  console.log(`✓ ${filename}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. power_source (DC single-pole positive bus)
// ─────────────────────────────────────────────────────────────────────────────
write('power_source.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:power_source"
  name="DC Power Source"
  version="1.0.0"
  domain="circuit"
  canonicalType="power_source"
  placeable="true">

  <ms:Description>DC power supply bus symbol — single positive output terminal</ms:Description>
  <ms:Category>power_source</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="40" height="80" unit="px"/>

  <ms:Ports>
    <ms:Port id="out" name="+" number="1"
             electricalType="power_out" functionalRole="general"
             shape="line" orientation="down"
             x="20" y="80" length="0" sortOrder="1"
             nameVisible="true" numberVisible="false"
             edgePosition="bottom" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <!-- Vertical bus bar -->
    <ms:Rect id="body" x="15" y="5" width="10" height="60"
             stroke="#888888" fill="#444444" strokeWidth="2"/>
    <!-- Plus label -->
    <ms:Text id="label-plus" x="20" y="35" fontSize="14" fontFamily="Arial"
             fill="#ffffff" anchor="middle">+</ms:Text>
    <!-- Lead wire to output -->
    <ms:Polyline id="lead-out" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="20" y="65"/>
      <ms:Point x="20" y="80"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Designation">
      <ms:DefaultValue>PS1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="voltage" type="number" editorType="number" visible="true"
                 min="1" max="1000" step="1" unit="V" label="Voltage">
      <ms:DefaultValue>24</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="polarity" type="string" editorType="select" visible="true" label="Polarity">
      <ms:DefaultValue>positive</ms:DefaultValue>
      <ms:Options>
        <ms:Option>positive</ms:Option>
        <ms:Option>negative</ms:Option>
        <ms:Option>ground</ms:Option>
      </ms:Options>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:power_source" archetype="power_source"
               interactionMode="none" deviceScoped="false" domain="circuit">
  </ms:Behavior>

  <ms:VisualStates/>
  <ms:Animations/>

  <ms:StandardsRef iecSection="02-01" iecCategory="G" refDesignator="PS"/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. powersource (legacy alias — same as power_source)
// ─────────────────────────────────────────────────────────────────────────────
write('powersource.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:powersource"
  name="Power Source (Legacy)"
  version="1.0.0"
  domain="circuit"
  canonicalType="powersource"
  placeable="true">

  <ms:Description>Legacy DC power source — single positive output (use power_source for new designs)</ms:Description>
  <ms:Category>power_source</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="40" height="40" unit="px"/>

  <ms:Ports>
    <ms:Port id="out" name="+" number="1"
             electricalType="power_out" functionalRole="general"
             shape="line" orientation="down"
             x="20" y="40" length="0" sortOrder="1"
             nameVisible="true" numberVisible="false"
             edgePosition="bottom" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Circle id="body" cx="20" cy="20" r="16"
               stroke="#888888" fill="transparent" strokeWidth="2"/>
    <ms:Text id="label" x="20" y="24" fontSize="14" fontFamily="Arial"
             fill="#888888" anchor="middle">+</ms:Text>
    <ms:Polyline id="lead-out" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="20" y="36"/>
      <ms:Point x="20" y="40"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="voltage" type="number" editorType="number" visible="true"
                 min="1" max="1000" step="1" unit="V" label="Voltage">
      <ms:DefaultValue>24</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="polarity" type="string" editorType="select" visible="true" label="Polarity">
      <ms:DefaultValue>positive</ms:DefaultValue>
      <ms:Options>
        <ms:Option>positive</ms:Option>
        <ms:Option>negative</ms:Option>
      </ms:Options>
    </ms:Property>
    <ms:Property key="maxCurrent" type="number" editorType="number" visible="true"
                 min="1" max="100000" step="1" unit="mA" label="Max Current (mA)">
      <ms:DefaultValue>1000</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:power_source" archetype="power_source"
               interactionMode="none" deviceScoped="false" domain="circuit">
  </ms:Behavior>

  <ms:VisualStates/>
  <ms:Animations/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 3. power_source_dc_2p
// ─────────────────────────────────────────────────────────────────────────────
write('power_source_dc_2p.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:power_source_dc_2p"
  name="DC Power Source (2-pole)"
  version="1.0.0"
  domain="circuit"
  canonicalType="power_source_dc_2p"
  placeable="true">

  <ms:Description>DC power source with positive and negative terminals (battery/PSU symbol)</ms:Description>
  <ms:Category>power_source</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="40" height="60" unit="px"/>

  <ms:Ports>
    <ms:Port id="pos" name="+" number="1"
             electricalType="power_out" functionalRole="general"
             shape="line" orientation="up"
             x="20" y="0" length="0" sortOrder="1"
             nameVisible="true" numberVisible="false"
             edgePosition="top" edgeOffset="0.5"/>
    <ms:Port id="neg" name="-" number="2"
             electricalType="power_out" functionalRole="general"
             shape="line" orientation="down"
             x="20" y="60" length="0" sortOrder="2"
             nameVisible="true" numberVisible="false"
             edgePosition="bottom" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <!-- Long plate (positive) -->
    <ms:Polyline id="plate-pos" stroke="#888888" fill="none" strokeWidth="3">
      <ms:Point x="8" y="22"/>
      <ms:Point x="32" y="22"/>
    </ms:Polyline>
    <!-- Short plate (negative) -->
    <ms:Polyline id="plate-neg" stroke="#888888" fill="none" strokeWidth="3">
      <ms:Point x="14" y="38"/>
      <ms:Point x="26" y="38"/>
    </ms:Polyline>
    <!-- Lead top -->
    <ms:Polyline id="lead-pos" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="20" y="0"/>
      <ms:Point x="20" y="22"/>
    </ms:Polyline>
    <!-- Lead bottom -->
    <ms:Polyline id="lead-neg" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="20" y="38"/>
      <ms:Point x="20" y="60"/>
    </ms:Polyline>
    <!-- Plus label -->
    <ms:Text id="lbl-plus" x="34" y="22" fontSize="10" fontFamily="Arial"
             fill="#888888" anchor="start">+</ms:Text>
    <!-- Minus label -->
    <ms:Text id="lbl-minus" x="34" y="42" fontSize="10" fontFamily="Arial"
             fill="#888888" anchor="start">-</ms:Text>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Designation">
      <ms:DefaultValue>BAT1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="voltage" type="number" editorType="number" visible="true"
                 min="1" max="1000" step="1" unit="V" label="Voltage">
      <ms:DefaultValue>24</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="polarity" type="string" editorType="select" visible="true" label="Polarity">
      <ms:DefaultValue>positive</ms:DefaultValue>
      <ms:Options>
        <ms:Option>positive</ms:Option>
        <ms:Option>negative</ms:Option>
      </ms:Options>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:power_source" archetype="power_source"
               interactionMode="none" deviceScoped="false" domain="circuit">
  </ms:Behavior>

  <ms:VisualStates/>
  <ms:Animations/>

  <ms:StandardsRef iecSection="02-04" iecCategory="G" refDesignator="BAT"/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 4. power_source_ac_1p
// ─────────────────────────────────────────────────────────────────────────────
write('power_source_ac_1p.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:power_source_ac_1p"
  name="AC Power Source (1-phase)"
  version="1.0.0"
  domain="circuit"
  canonicalType="power_source_ac_1p"
  placeable="true">

  <ms:Description>Single-phase AC power source symbol — Live (L) terminal only</ms:Description>
  <ms:Category>power_source</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="40" height="40" unit="px"/>

  <ms:Ports>
    <ms:Port id="out" name="L" number="1"
             electricalType="power_out" functionalRole="general"
             shape="line" orientation="down"
             x="20" y="40" length="0" sortOrder="1"
             nameVisible="true" numberVisible="false"
             edgePosition="bottom" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Circle id="body" cx="20" cy="18" r="14"
               stroke="#888888" fill="transparent" strokeWidth="2"/>
    <!-- Tilde ~ for AC -->
    <ms:Text id="label-ac" x="20" y="22" fontSize="14" fontFamily="Arial"
             fill="#888888" anchor="middle">~</ms:Text>
    <ms:Polyline id="lead-out" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="20" y="32"/>
      <ms:Point x="20" y="40"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Designation">
      <ms:DefaultValue>L1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="voltage" type="number" editorType="number" visible="true"
                 min="100" max="1000" step="1" unit="V" label="Voltage">
      <ms:DefaultValue>230</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="frequency" type="number" editorType="number" visible="true"
                 min="50" max="60" step="10" unit="Hz" label="Frequency">
      <ms:DefaultValue>50</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:power_source" archetype="power_source"
               interactionMode="none" deviceScoped="false" domain="circuit">
  </ms:Behavior>

  <ms:VisualStates/>
  <ms:Animations/>

  <ms:StandardsRef iecSection="02-02" iecCategory="G" refDesignator="G"/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 5. power_source_ac_2p
// ─────────────────────────────────────────────────────────────────────────────
write('power_source_ac_2p.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:power_source_ac_2p"
  name="AC Power Source (2-pole)"
  version="1.0.0"
  domain="circuit"
  canonicalType="power_source_ac_2p"
  placeable="true">

  <ms:Description>Single-phase AC power source with Live (L) and Neutral (N) terminals</ms:Description>
  <ms:Category>power_source</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="60" height="60" unit="px"/>

  <ms:Ports>
    <ms:Port id="l" name="L" number="1"
             electricalType="power_out" functionalRole="general"
             shape="line" orientation="up"
             x="30" y="0" length="0" sortOrder="1"
             nameVisible="true" numberVisible="false"
             edgePosition="top" edgeOffset="0.5"/>
    <ms:Port id="n" name="N" number="2"
             electricalType="power_out" functionalRole="general"
             shape="line" orientation="down"
             x="30" y="60" length="0" sortOrder="2"
             nameVisible="true" numberVisible="false"
             edgePosition="bottom" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Circle id="body" cx="30" cy="30" r="22"
               stroke="#888888" fill="transparent" strokeWidth="2"/>
    <ms:Text id="label-ac" x="30" y="35" fontSize="16" fontFamily="Arial"
             fill="#888888" anchor="middle">~</ms:Text>
    <ms:Polyline id="lead-top" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="30" y="0"/>
      <ms:Point x="30" y="8"/>
    </ms:Polyline>
    <ms:Polyline id="lead-bot" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="30" y="52"/>
      <ms:Point x="30" y="60"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Designation">
      <ms:DefaultValue>G1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="voltage" type="number" editorType="number" visible="true"
                 min="100" max="1000" step="1" unit="V" label="Voltage">
      <ms:DefaultValue>230</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="frequency" type="number" editorType="number" visible="true"
                 min="50" max="60" step="10" unit="Hz" label="Frequency">
      <ms:DefaultValue>50</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:power_source" archetype="power_source"
               interactionMode="none" deviceScoped="false" domain="circuit">
  </ms:Behavior>

  <ms:VisualStates/>
  <ms:Animations/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 6. ground
// ─────────────────────────────────────────────────────────────────────────────
write('ground.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:ground"
  name="Ground"
  version="1.0.0"
  domain="circuit"
  canonicalType="ground"
  placeable="true">

  <ms:Description>Ground / 0V reference symbol (IEC 60617-2)</ms:Description>
  <ms:Category>power_source</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="40" height="40" unit="px"/>

  <ms:Ports>
    <ms:Port id="in" name="GND" number="1"
             electricalType="power_in" functionalRole="general"
             shape="line" orientation="up"
             x="20" y="0" length="0" sortOrder="1"
             nameVisible="false" numberVisible="false"
             edgePosition="top" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Polyline id="lead" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="20" y="0"/>
      <ms:Point x="20" y="16"/>
    </ms:Polyline>
    <ms:Polyline id="line1" stroke="#888888" fill="none" strokeWidth="3">
      <ms:Point x="6" y="16"/>
      <ms:Point x="34" y="16"/>
    </ms:Polyline>
    <ms:Polyline id="line2" stroke="#888888" fill="none" strokeWidth="3">
      <ms:Point x="11" y="23"/>
      <ms:Point x="29" y="23"/>
    </ms:Polyline>
    <ms:Polyline id="line3" stroke="#888888" fill="none" strokeWidth="3">
      <ms:Point x="16" y="30"/>
      <ms:Point x="24" y="30"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Designation">
      <ms:DefaultValue>GND1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="netName" type="string" editorType="text" visible="true" label="Net Name">
      <ms:DefaultValue>0V</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:ground" archetype="ground"
               interactionMode="none" deviceScoped="false" domain="circuit">
  </ms:Behavior>

  <ms:VisualStates/>
  <ms:Animations/>

  <ms:StandardsRef iecSection="02-01" iecCategory="G" refDesignator="GND"/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 7. fuse
// ─────────────────────────────────────────────────────────────────────────────
write('fuse.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:fuse"
  name="Fuse"
  version="1.0.0"
  domain="circuit"
  canonicalType="fuse"
  placeable="true">

  <ms:Description>Overcurrent protection fuse (IEC 60617-7)</ms:Description>
  <ms:Category>protection</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="40" height="60" unit="px"/>

  <ms:Ports>
    <ms:Port id="in" name="LINE" number="1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="up"
             x="20" y="0" length="0" sortOrder="1"
             nameVisible="true" numberVisible="false"
             edgePosition="top" edgeOffset="0.5"/>
    <ms:Port id="out" name="LOAD" number="2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="down"
             x="20" y="60" length="0" sortOrder="2"
             nameVisible="true" numberVisible="false"
             edgePosition="bottom" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Polyline id="lead-top" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="20" y="0"/>
      <ms:Point x="20" y="14"/>
    </ms:Polyline>
    <ms:Rect id="body" x="10" y="14" width="20" height="32"
             stroke="#888888" fill="transparent" strokeWidth="2"/>
    <!-- Fuse wire inside body -->
    <ms:Polyline id="fuse-wire" stroke="#888888" fill="none" strokeWidth="1">
      <ms:Point x="20" y="18"/>
      <ms:Point x="20" y="42"/>
    </ms:Polyline>
    <ms:Polyline id="lead-bot" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="20" y="46"/>
      <ms:Point x="20" y="60"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Designation">
      <ms:DefaultValue>F1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="fuseType" type="string" editorType="select" visible="true" label="Fuse Type">
      <ms:DefaultValue>fuse</ms:DefaultValue>
      <ms:Options>
        <ms:Option>fuse</ms:Option>
        <ms:Option>slow_blow</ms:Option>
        <ms:Option>fast_blow</ms:Option>
      </ms:Options>
    </ms:Property>
    <ms:Property key="ratingAmps" type="number" editorType="number" visible="true"
                 min="0.1" max="630" step="0.1" unit="A" label="Rating (A)">
      <ms:DefaultValue>10</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="tripped" type="boolean" editorType="checkbox" visible="true" label="Blown">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:fuse" archetype="fuse"
               interactionMode="none" deviceScoped="false" domain="circuit">
    <ms:Rules>
      <ms:Rule id="blown" name="Fuse blown" priority="1" conditionLogic="all">
        <ms:If type="property_true" propertyKey="tripped"/>
        <ms:Then type="set_state" stateName="blown"/>
        <ms:Then type="block_port" portId="out"/>
        <ms:Else type="clear_state" stateName="blown"/>
        <ms:Else type="energize_port" portId="out"/>
      </ms:Rule>
    </ms:Rules>
  </ms:Behavior>

  <ms:VisualStates>
    <ms:VisualState name="blown">
      <ms:PrimitiveOverrides>
        <ms:Override targetId="body" stroke="#ef4444"/>
        <ms:Override targetId="fuse-wire" stroke="#ef4444"/>
      </ms:PrimitiveOverrides>
    </ms:VisualState>
  </ms:VisualStates>
  <ms:Animations/>

  <ms:StandardsRef iecSection="07-23" iecCategory="F" refDesignator="F"/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 8. circuit_breaker
// ─────────────────────────────────────────────────────────────────────────────
write('circuit_breaker.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:circuit_breaker"
  name="Circuit Breaker"
  version="1.0.0"
  domain="circuit"
  canonicalType="circuit_breaker"
  placeable="true">

  <ms:Description>Thermal-magnetic circuit breaker (IEC 60617-7)</ms:Description>
  <ms:Category>protection</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="40" height="60" unit="px"/>

  <ms:Ports>
    <ms:Port id="in" name="LINE" number="1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="up"
             x="20" y="0" length="0" sortOrder="1"
             nameVisible="true" numberVisible="false"
             edgePosition="top" edgeOffset="0.5"/>
    <ms:Port id="out" name="LOAD" number="2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="down"
             x="20" y="60" length="0" sortOrder="2"
             nameVisible="true" numberVisible="false"
             edgePosition="bottom" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Polyline id="lead-top" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="20" y="0"/>
      <ms:Point x="20" y="16"/>
    </ms:Polyline>
    <ms:Rect id="body" x="8" y="16" width="24" height="28"
             stroke="#888888" fill="transparent" strokeWidth="2"/>
    <!-- Trip indicator diagonal line -->
    <ms:Polyline id="trip-line" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="12" y="20"/>
      <ms:Point x="28" y="40"/>
    </ms:Polyline>
    <!-- CB contact symbol -->
    <ms:Polyline id="contact" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="20" y="20"/>
      <ms:Point x="20" y="40"/>
    </ms:Polyline>
    <ms:Polyline id="lead-bot" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="20" y="44"/>
      <ms:Point x="20" y="60"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Designation">
      <ms:DefaultValue>Q1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="currentRating" type="number" editorType="number" visible="true"
                 min="1" max="630" step="1" unit="A" label="Rating (A)">
      <ms:DefaultValue>10</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="tripped" type="boolean" editorType="checkbox" visible="true" label="Tripped">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:circuit_breaker" archetype="circuit_breaker"
               interactionMode="click" deviceScoped="false" domain="circuit">
    <ms:Rules>
      <ms:Rule id="tripped" name="Circuit breaker tripped" priority="1" conditionLogic="all">
        <ms:If type="property_true" propertyKey="tripped"/>
        <ms:Then type="set_state" stateName="tripped"/>
        <ms:Then type="block_port" portId="out"/>
        <ms:Else type="clear_state" stateName="tripped"/>
        <ms:Else type="pass_through" portIdIn="in" portIdOut="out"/>
      </ms:Rule>
    </ms:Rules>
  </ms:Behavior>

  <ms:VisualStates>
    <ms:VisualState name="tripped">
      <ms:PrimitiveOverrides>
        <ms:Override targetId="body" stroke="#ef4444"/>
        <ms:Override targetId="trip-line" stroke="#ef4444"/>
      </ms:PrimitiveOverrides>
    </ms:VisualState>
  </ms:VisualStates>
  <ms:Animations/>

  <ms:StandardsRef iecSection="07-21" iecCategory="Q" refDesignator="Q"/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 9. overload_relay
// ─────────────────────────────────────────────────────────────────────────────
write('overload_relay.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:overload_relay"
  name="Overload Relay"
  version="1.0.0"
  domain="circuit"
  canonicalType="overload_relay"
  placeable="true">

  <ms:Description>Thermal overload relay — motor protection with NC/NO auxiliary contacts (IEC 60617)</ms:Description>
  <ms:Category>protection</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="80" height="80" unit="px"/>

  <ms:Ports>
    <ms:Port id="l1_in" name="1" number="1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="up"
             x="20" y="0" length="0" sortOrder="1"
             nameVisible="true" numberVisible="true"
             edgePosition="top" edgeOffset="0.25"/>
    <ms:Port id="l2_in" name="3" number="3"
             electricalType="input" functionalRole="general"
             shape="line" orientation="up"
             x="40" y="0" length="0" sortOrder="2"
             nameVisible="true" numberVisible="true"
             edgePosition="top" edgeOffset="0.5"/>
    <ms:Port id="l3_in" name="5" number="5"
             electricalType="input" functionalRole="general"
             shape="line" orientation="up"
             x="60" y="0" length="0" sortOrder="3"
             nameVisible="true" numberVisible="true"
             edgePosition="top" edgeOffset="0.75"/>
    <ms:Port id="l1_out" name="2" number="2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="down"
             x="20" y="80" length="0" sortOrder="4"
             nameVisible="true" numberVisible="true"
             edgePosition="bottom" edgeOffset="0.25"/>
    <ms:Port id="l2_out" name="4" number="4"
             electricalType="output" functionalRole="general"
             shape="line" orientation="down"
             x="40" y="80" length="0" sortOrder="5"
             nameVisible="true" numberVisible="true"
             edgePosition="bottom" edgeOffset="0.5"/>
    <ms:Port id="l3_out" name="6" number="6"
             electricalType="output" functionalRole="general"
             shape="line" orientation="down"
             x="60" y="80" length="0" sortOrder="6"
             nameVisible="true" numberVisible="true"
             edgePosition="bottom" edgeOffset="0.75"/>
    <ms:Port id="nc" name="95-96" number="95"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="80" y="20" length="0" sortOrder="7"
             nameVisible="true" numberVisible="true"
             edgePosition="right" edgeOffset="0.25"/>
    <ms:Port id="no" name="97-98" number="97"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="80" y="60" length="0" sortOrder="8"
             nameVisible="true" numberVisible="true"
             edgePosition="right" edgeOffset="0.75"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Rect id="body" x="5" y="15" width="70" height="50"
             stroke="#888888" fill="transparent" strokeWidth="2"/>
    <ms:Text id="label" x="40" y="44" fontSize="11" fontFamily="Arial"
             fill="#888888" anchor="middle">OL</ms:Text>
    <!-- Power leads -->
    <ms:Polyline id="l1-top" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="20" y="0"/><ms:Point x="20" y="15"/>
    </ms:Polyline>
    <ms:Polyline id="l2-top" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="40" y="0"/><ms:Point x="40" y="15"/>
    </ms:Polyline>
    <ms:Polyline id="l3-top" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="60" y="0"/><ms:Point x="60" y="15"/>
    </ms:Polyline>
    <ms:Polyline id="l1-bot" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="20" y="65"/><ms:Point x="20" y="80"/>
    </ms:Polyline>
    <ms:Polyline id="l2-bot" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="40" y="65"/><ms:Point x="40" y="80"/>
    </ms:Polyline>
    <ms:Polyline id="l3-bot" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="60" y="65"/><ms:Point x="60" y="80"/>
    </ms:Polyline>
    <!-- Aux contact leads -->
    <ms:Polyline id="wire-nc" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="75" y="20"/><ms:Point x="80" y="20"/>
    </ms:Polyline>
    <ms:Polyline id="wire-no" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="75" y="60"/><ms:Point x="80" y="60"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Designation">
      <ms:DefaultValue>F1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="overloadClass" type="string" editorType="select" visible="true" label="Class">
      <ms:DefaultValue>10</ms:DefaultValue>
      <ms:Options>
        <ms:Option>10</ms:Option>
        <ms:Option>10A</ms:Option>
        <ms:Option>20</ms:Option>
        <ms:Option>30</ms:Option>
      </ms:Options>
    </ms:Property>
    <ms:Property key="currentMin" type="number" editorType="number" visible="true"
                 min="0.1" max="630" step="0.1" unit="A" label="Current Min (A)">
      <ms:DefaultValue>1.0</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="currentMax" type="number" editorType="number" visible="true"
                 min="0.1" max="630" step="0.1" unit="A" label="Current Max (A)">
      <ms:DefaultValue>1.6</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="tripped" type="boolean" editorType="checkbox" visible="true" label="Tripped">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:overload_relay" archetype="overload_relay"
               interactionMode="none" deviceScoped="false" domain="circuit">
    <ms:Rules>
      <ms:Rule id="overload-trip" name="Overload trip" priority="1" conditionLogic="all">
        <ms:If type="property_true" propertyKey="tripped"/>
        <ms:Then type="set_state" stateName="tripped"/>
        <ms:Then type="block_port" portId="l1_out"/>
        <ms:Then type="block_port" portId="l2_out"/>
        <ms:Then type="block_port" portId="l3_out"/>
        <ms:Then type="energize_port" portId="no"/>
        <ms:Then type="block_port" portId="nc"/>
        <ms:Else type="clear_state" stateName="tripped"/>
        <ms:Else type="pass_through" portIdIn="l1_in" portIdOut="l1_out"/>
        <ms:Else type="pass_through" portIdIn="l2_in" portIdOut="l2_out"/>
        <ms:Else type="pass_through" portIdIn="l3_in" portIdOut="l3_out"/>
        <ms:Else type="block_port" portId="no"/>
        <ms:Else type="energize_port" portId="nc"/>
      </ms:Rule>
    </ms:Rules>
  </ms:Behavior>

  <ms:VisualStates>
    <ms:VisualState name="tripped">
      <ms:PrimitiveOverrides>
        <ms:Override targetId="body" stroke="#ef4444"/>
        <ms:Override targetId="label" fill="#ef4444"/>
      </ms:PrimitiveOverrides>
    </ms:VisualState>
  </ms:VisualStates>
  <ms:Animations/>

  <ms:StandardsRef iecSection="07-52" iecCategory="F" refDesignator="F"/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 10. button
// ─────────────────────────────────────────────────────────────────────────────
write('button.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:button"
  name="Button"
  version="1.0.0"
  domain="circuit"
  canonicalType="button"
  placeable="true">

  <ms:Description>Generic push button — momentary or maintained contact</ms:Description>
  <ms:Category>switching</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="40" height="40" unit="px"/>

  <ms:Ports>
    <ms:Port id="in" name="IN" number="1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="left"
             x="0" y="20" length="0" sortOrder="1"
             nameVisible="false" numberVisible="false"
             edgePosition="left" edgeOffset="0.5"/>
    <ms:Port id="out" name="OUT" number="2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="40" y="20" length="0" sortOrder="2"
             nameVisible="false" numberVisible="false"
             edgePosition="right" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Polyline id="wire-in" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="0" y="20"/><ms:Point x="12" y="20"/>
    </ms:Polyline>
    <ms:Circle id="contact-in" cx="12" cy="20" r="2"
               stroke="#888888" fill="#888888" strokeWidth="1"/>
    <ms:Circle id="contact-out" cx="28" cy="20" r="2"
               stroke="#888888" fill="#888888" strokeWidth="1"/>
    <!-- Contact arm (open = NO) -->
    <ms:Polyline id="arm" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="12" y="20"/><ms:Point x="28" y="12"/>
    </ms:Polyline>
    <!-- Button actuator -->
    <ms:Polyline id="actuator" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="20" y="6"/><ms:Point x="20" y="12"/>
    </ms:Polyline>
    <ms:Rect id="button-cap" x="12" y="2" width="16" height="6"
             stroke="#888888" fill="#555555" strokeWidth="1.5"/>
    <ms:Polyline id="wire-out" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="28" y="20"/><ms:Point x="40" y="20"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="mode" type="string" editorType="select" visible="true" label="Mode">
      <ms:DefaultValue>momentary</ms:DefaultValue>
      <ms:Options>
        <ms:Option>momentary</ms:Option>
        <ms:Option>maintained</ms:Option>
      </ms:Options>
    </ms:Property>
    <ms:Property key="contactConfig" type="string" editorType="select" visible="true" label="Contact Config">
      <ms:DefaultValue>1a</ms:DefaultValue>
      <ms:Options>
        <ms:Option>1a</ms:Option>
        <ms:Option>1b</ms:Option>
        <ms:Option>1a1b</ms:Option>
      </ms:Options>
    </ms:Property>
    <ms:Property key="pressed" type="boolean" editorType="checkbox" visible="true" label="Pressed">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:switch" archetype="switch"
               interactionMode="click" deviceScoped="false" domain="circuit">
    <ms:Rules>
      <ms:Rule id="contact-closed" name="Contact closed" priority="1" conditionLogic="all">
        <ms:If type="property_true" propertyKey="pressed"/>
        <ms:Then type="set_state" stateName="pressed"/>
        <ms:Then type="pass_through" portIdIn="in" portIdOut="out"/>
        <ms:Else type="clear_state" stateName="pressed"/>
        <ms:Else type="block_port" portId="out"/>
      </ms:Rule>
    </ms:Rules>
  </ms:Behavior>

  <ms:VisualStates>
    <ms:VisualState name="pressed">
      <ms:PrimitiveOverrides>
        <ms:Override targetId="arm" stroke="#22c55e"/>
        <ms:Override targetId="button-cap" fill="#22c55e" stroke="#15803d"/>
      </ms:PrimitiveOverrides>
    </ms:VisualState>
  </ms:VisualStates>
  <ms:Animations/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 11. push_button_no
// ─────────────────────────────────────────────────────────────────────────────
write('push_button_no.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:push_button_no"
  name="Push Button (NO)"
  version="1.0.0"
  domain="circuit"
  canonicalType="push_button_no"
  placeable="true">

  <ms:Description>Momentary push button — normally open contact (IEC 60617)</ms:Description>
  <ms:Category>switching</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="60" height="40" unit="px"/>

  <ms:Ports>
    <ms:Port id="in" name="IN" number="1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="left"
             x="0" y="20" length="0" sortOrder="1"
             nameVisible="false" numberVisible="false"
             edgePosition="left" edgeOffset="0.5"/>
    <ms:Port id="out" name="OUT" number="2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="60" y="20" length="0" sortOrder="2"
             nameVisible="false" numberVisible="false"
             edgePosition="right" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Polyline id="wire-in" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="0" y="20"/><ms:Point x="18" y="20"/>
    </ms:Polyline>
    <ms:Circle id="c-in" cx="18" cy="20" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <ms:Circle id="c-out" cx="42" cy="20" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <!-- NO arm -->
    <ms:Polyline id="arm" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="18" y="20"/><ms:Point x="42" y="10"/>
    </ms:Polyline>
    <!-- Actuator line + cap -->
    <ms:Polyline id="actuator" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="30" y="5"/><ms:Point x="30" y="12"/>
    </ms:Polyline>
    <ms:Rect id="cap" x="22" y="1" width="16" height="6"
             stroke="#888888" fill="#555555" strokeWidth="1.5"/>
    <ms:Polyline id="wire-out" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="42" y="20"/><ms:Point x="60" y="20"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Designation">
      <ms:DefaultValue>S1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="normallyOpen" type="boolean" editorType="checkbox" visible="true" label="Normally Open">
      <ms:DefaultValue>true</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="momentary" type="boolean" editorType="checkbox" visible="true" label="Momentary">
      <ms:DefaultValue>true</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="pressed" type="boolean" editorType="checkbox" visible="true" label="Pressed">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:switch" archetype="switch"
               interactionMode="click" deviceScoped="false" domain="circuit">
    <ms:Rules>
      <ms:Rule id="pressed" name="Button pressed (NO closes)" priority="1" conditionLogic="all">
        <ms:If type="property_true" propertyKey="pressed"/>
        <ms:Then type="set_state" stateName="pressed"/>
        <ms:Then type="pass_through" portIdIn="in" portIdOut="out"/>
        <ms:Else type="clear_state" stateName="pressed"/>
        <ms:Else type="block_port" portId="out"/>
      </ms:Rule>
    </ms:Rules>
  </ms:Behavior>

  <ms:VisualStates>
    <ms:VisualState name="pressed">
      <ms:PrimitiveOverrides>
        <ms:Override targetId="arm" stroke="#22c55e"/>
        <ms:Override targetId="cap" fill="#22c55e" stroke="#15803d"/>
      </ms:PrimitiveOverrides>
    </ms:VisualState>
  </ms:VisualStates>
  <ms:Animations/>

  <ms:StandardsRef iecSection="07-07" iecCategory="S" refDesignator="S"/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 12. push_button_nc
// ─────────────────────────────────────────────────────────────────────────────
write('push_button_nc.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:push_button_nc"
  name="Push Button (NC)"
  version="1.0.0"
  domain="circuit"
  canonicalType="push_button_nc"
  placeable="true">

  <ms:Description>Momentary push button — normally closed contact (IEC 60617)</ms:Description>
  <ms:Category>switching</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="60" height="40" unit="px"/>

  <ms:Ports>
    <ms:Port id="in" name="IN" number="1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="left"
             x="0" y="20" length="0" sortOrder="1"
             nameVisible="false" numberVisible="false"
             edgePosition="left" edgeOffset="0.5"/>
    <ms:Port id="out" name="OUT" number="2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="60" y="20" length="0" sortOrder="2"
             nameVisible="false" numberVisible="false"
             edgePosition="right" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Polyline id="wire-in" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="0" y="20"/><ms:Point x="18" y="20"/>
    </ms:Polyline>
    <ms:Circle id="c-in" cx="18" cy="20" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <ms:Circle id="c-out" cx="42" cy="20" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <!-- NC arm (horizontal — closed at rest) -->
    <ms:Polyline id="arm" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="18" y="20"/><ms:Point x="42" y="20"/>
    </ms:Polyline>
    <!-- NC diagonal bar -->
    <ms:Polyline id="nc-bar" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="24" y="14"/><ms:Point x="36" y="26"/>
    </ms:Polyline>
    <!-- Actuator -->
    <ms:Polyline id="actuator" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="30" y="5"/><ms:Point x="30" y="12"/>
    </ms:Polyline>
    <ms:Rect id="cap" x="22" y="1" width="16" height="6"
             stroke="#888888" fill="#555555" strokeWidth="1.5"/>
    <ms:Polyline id="wire-out" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="42" y="20"/><ms:Point x="60" y="20"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Designation">
      <ms:DefaultValue>S1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="normallyOpen" type="boolean" editorType="checkbox" visible="true" label="Normally Open">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="momentary" type="boolean" editorType="checkbox" visible="true" label="Momentary">
      <ms:DefaultValue>true</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="pressed" type="boolean" editorType="checkbox" visible="true" label="Pressed">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:switch" archetype="switch"
               interactionMode="click" deviceScoped="false" domain="circuit">
    <ms:Rules>
      <ms:Rule id="pressed" name="Button pressed (NC opens)" priority="1" conditionLogic="all">
        <ms:If type="property_true" propertyKey="pressed"/>
        <ms:Then type="set_state" stateName="pressed"/>
        <ms:Then type="block_port" portId="out"/>
        <ms:Else type="clear_state" stateName="pressed"/>
        <ms:Else type="pass_through" portIdIn="in" portIdOut="out"/>
      </ms:Rule>
    </ms:Rules>
  </ms:Behavior>

  <ms:VisualStates>
    <ms:VisualState name="pressed">
      <ms:PrimitiveOverrides>
        <ms:Override targetId="arm" stroke="#ef4444"/>
        <ms:Override targetId="cap" fill="#ef4444" stroke="#b91c1c"/>
      </ms:PrimitiveOverrides>
    </ms:VisualState>
  </ms:VisualStates>
  <ms:Animations/>

  <ms:StandardsRef iecSection="07-07" iecCategory="S" refDesignator="S"/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 13. switch_no
// ─────────────────────────────────────────────────────────────────────────────
write('switch_no.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:switch_no"
  name="Switch (NO)"
  version="1.0.0"
  domain="circuit"
  canonicalType="switch_no"
  placeable="true">

  <ms:Description>Normally open switch contact (IEC 60617)</ms:Description>
  <ms:Category>switching</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="60" height="40" unit="px"/>

  <ms:Ports>
    <ms:Port id="in" name="IN" number="1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="left"
             x="0" y="20" length="0" sortOrder="1"
             nameVisible="false" numberVisible="false"
             edgePosition="left" edgeOffset="0.5"/>
    <ms:Port id="out" name="OUT" number="2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="60" y="20" length="0" sortOrder="2"
             nameVisible="false" numberVisible="false"
             edgePosition="right" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Polyline id="wire-in" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="0" y="20"/><ms:Point x="18" y="20"/>
    </ms:Polyline>
    <ms:Circle id="c-in" cx="18" cy="20" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <ms:Circle id="c-out" cx="42" cy="20" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <ms:Polyline id="arm" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="18" y="20"/><ms:Point x="42" y="10"/>
    </ms:Polyline>
    <ms:Polyline id="wire-out" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="42" y="20"/><ms:Point x="60" y="20"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Designation">
      <ms:DefaultValue>S1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="normallyOpen" type="boolean" editorType="checkbox" visible="true" label="Normally Open">
      <ms:DefaultValue>true</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:switch" archetype="switch"
               interactionMode="click" deviceScoped="false" domain="circuit">
  </ms:Behavior>

  <ms:VisualStates/>
  <ms:Animations/>

  <ms:StandardsRef iecSection="07-01" iecCategory="S" refDesignator="S"/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 14. switch_nc
// ─────────────────────────────────────────────────────────────────────────────
write('switch_nc.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:switch_nc"
  name="Switch (NC)"
  version="1.0.0"
  domain="circuit"
  canonicalType="switch_nc"
  placeable="true">

  <ms:Description>Normally closed switch contact (IEC 60617)</ms:Description>
  <ms:Category>switching</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="60" height="40" unit="px"/>

  <ms:Ports>
    <ms:Port id="in" name="IN" number="1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="left"
             x="0" y="20" length="0" sortOrder="1"
             nameVisible="false" numberVisible="false"
             edgePosition="left" edgeOffset="0.5"/>
    <ms:Port id="out" name="OUT" number="2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="60" y="20" length="0" sortOrder="2"
             nameVisible="false" numberVisible="false"
             edgePosition="right" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Polyline id="wire-in" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="0" y="20"/><ms:Point x="18" y="20"/>
    </ms:Polyline>
    <ms:Circle id="c-in" cx="18" cy="20" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <ms:Circle id="c-out" cx="42" cy="20" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <!-- NC arm (horizontal) -->
    <ms:Polyline id="arm" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="18" y="20"/><ms:Point x="42" y="20"/>
    </ms:Polyline>
    <!-- NC diagonal slash -->
    <ms:Polyline id="nc-slash" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="24" y="14"/><ms:Point x="36" y="26"/>
    </ms:Polyline>
    <ms:Polyline id="wire-out" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="42" y="20"/><ms:Point x="60" y="20"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Designation">
      <ms:DefaultValue>S1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="normallyOpen" type="boolean" editorType="checkbox" visible="true" label="Normally Open">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:switch" archetype="switch"
               interactionMode="click" deviceScoped="false" domain="circuit">
  </ms:Behavior>

  <ms:VisualStates/>
  <ms:Animations/>

  <ms:StandardsRef iecSection="07-02" iecCategory="S" refDesignator="S"/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 15. switch_changeover
// ─────────────────────────────────────────────────────────────────────────────
write('switch_changeover.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:switch_changeover"
  name="Switch (Changeover)"
  version="1.0.0"
  domain="circuit"
  canonicalType="switch_changeover"
  placeable="true">

  <ms:Description>Changeover (SPDT) switch contact with NO and NC positions (IEC 60617)</ms:Description>
  <ms:Category>switching</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="80" height="80" unit="px"/>

  <ms:Ports>
    <ms:Port id="com" name="COM" number="1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="left"
             x="0" y="40" length="0" sortOrder="1"
             nameVisible="true" numberVisible="false"
             edgePosition="left" edgeOffset="0.5"/>
    <ms:Port id="pos1" name="NO" number="2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="80" y="20" length="0" sortOrder="2"
             nameVisible="true" numberVisible="false"
             edgePosition="right" edgeOffset="0.25"/>
    <ms:Port id="pos2" name="NC" number="3"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="80" y="40" length="0" sortOrder="3"
             nameVisible="true" numberVisible="false"
             edgePosition="right" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Polyline id="wire-com" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="0" y="40"/><ms:Point x="22" y="40"/>
    </ms:Polyline>
    <ms:Circle id="c-com" cx="22" cy="40" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <ms:Circle id="c-no" cx="58" cy="20" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <ms:Circle id="c-nc" cx="58" cy="40" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <!-- Arm to NO -->
    <ms:Polyline id="arm" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="22" y="40"/><ms:Point x="56" y="22"/>
    </ms:Polyline>
    <ms:Polyline id="wire-no" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="58" y="20"/><ms:Point x="80" y="20"/>
    </ms:Polyline>
    <ms:Polyline id="wire-nc" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="58" y="40"/><ms:Point x="80" y="40"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Designation">
      <ms:DefaultValue>S1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="normallyOpen" type="boolean" editorType="checkbox" visible="true" label="Normally Open">
      <ms:DefaultValue>true</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="position" type="number" editorType="number" visible="true"
                 min="1" max="2" step="1" label="Position">
      <ms:DefaultValue>1</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:switch" archetype="switch"
               interactionMode="click" deviceScoped="false" domain="circuit">
  </ms:Behavior>

  <ms:VisualStates/>
  <ms:Animations/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 16. selector_switch
// ─────────────────────────────────────────────────────────────────────────────
write('selector_switch.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:selector_switch"
  name="Selector Switch"
  version="1.0.0"
  domain="circuit"
  canonicalType="selector_switch"
  placeable="true">

  <ms:Description>Rotary selector switch — maintained multi-position (IEC 60617)</ms:Description>
  <ms:Category>switching</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="80" height="80" unit="px"/>

  <ms:Ports>
    <ms:Port id="com" name="COM" number="1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="left"
             x="0" y="20" length="0" sortOrder="1"
             nameVisible="true" numberVisible="false"
             edgePosition="left" edgeOffset="0.25"/>
    <ms:Port id="pos1" name="1" number="2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="80" y="20" length="0" sortOrder="2"
             nameVisible="true" numberVisible="false"
             edgePosition="right" edgeOffset="0.25"/>
    <ms:Port id="pos2" name="2" number="3"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="80" y="40" length="0" sortOrder="3"
             nameVisible="true" numberVisible="false"
             edgePosition="right" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Circle id="body" cx="40" cy="40" r="28"
               stroke="#888888" fill="transparent" strokeWidth="2"/>
    <ms:Text id="label" x="40" y="44" fontSize="11" fontFamily="Arial"
             fill="#888888" anchor="middle">SEL</ms:Text>
    <ms:Polyline id="wire-com" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="0" y="20"/><ms:Point x="14" y="20"/>
    </ms:Polyline>
    <ms:Polyline id="wire-p1" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="66" y="20"/><ms:Point x="80" y="20"/>
    </ms:Polyline>
    <ms:Polyline id="wire-p2" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="68" y="40"/><ms:Point x="80" y="40"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Designation">
      <ms:DefaultValue>S1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="positions" type="number" editorType="number" visible="true"
                 min="2" max="10" step="1" label="Positions">
      <ms:DefaultValue>2</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="currentPosition" type="number" editorType="number" visible="true"
                 min="0" max="9" step="1" label="Current Position">
      <ms:DefaultValue>0</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="maintained" type="boolean" editorType="checkbox" visible="true" label="Maintained">
      <ms:DefaultValue>true</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:selector_switch" archetype="selector_switch"
               interactionMode="click" deviceScoped="false" domain="circuit">
  </ms:Behavior>

  <ms:VisualStates/>
  <ms:Animations/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 17. emergency_stop
// ─────────────────────────────────────────────────────────────────────────────
write('emergency_stop.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:emergency_stop"
  name="Emergency Stop"
  version="1.0.0"
  domain="circuit"
  canonicalType="emergency_stop"
  placeable="true">

  <ms:Description>Emergency stop button — mushroom head, NC, latching (IEC 60617 / ISO 13850)</ms:Description>
  <ms:Category>switching</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="60" height="40" unit="px"/>

  <ms:Ports>
    <ms:Port id="in" name="IN" number="1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="left"
             x="0" y="20" length="0" sortOrder="1"
             nameVisible="false" numberVisible="false"
             edgePosition="left" edgeOffset="0.5"/>
    <ms:Port id="out" name="OUT" number="2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="60" y="20" length="0" sortOrder="2"
             nameVisible="false" numberVisible="false"
             edgePosition="right" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Polyline id="wire-in" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="0" y="20"/><ms:Point x="14" y="20"/>
    </ms:Polyline>
    <ms:Circle id="c-in" cx="14" cy="20" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <ms:Circle id="c-out" cx="46" cy="20" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <!-- NC arm -->
    <ms:Polyline id="arm" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="14" y="20"/><ms:Point x="46" y="20"/>
    </ms:Polyline>
    <!-- NC diagonal -->
    <ms:Polyline id="nc-slash" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="22" y="14"/><ms:Point x="38" y="26"/>
    </ms:Polyline>
    <!-- Mushroom head (red circle) -->
    <ms:Circle id="mushroom" cx="30" cy="7" r="7"
               stroke="#dc2626" fill="#ef4444" strokeWidth="2"/>
    <!-- Actuator stem -->
    <ms:Polyline id="stem" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="30" y="14"/><ms:Point x="30" y="20"/>
    </ms:Polyline>
    <ms:Polyline id="wire-out" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="46" y="20"/><ms:Point x="60" y="20"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Designation">
      <ms:DefaultValue>ES1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="engaged" type="boolean" editorType="checkbox" visible="true" label="Engaged (Latched)">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:emergency_stop" archetype="emergency_stop"
               interactionMode="click" deviceScoped="false" domain="circuit">
    <ms:Rules>
      <ms:Rule id="estop-engaged" name="E-Stop engaged (NC opens)" priority="1" conditionLogic="all">
        <ms:If type="property_true" propertyKey="engaged"/>
        <ms:Then type="set_state" stateName="engaged"/>
        <ms:Then type="block_port" portId="out"/>
        <ms:Else type="clear_state" stateName="engaged"/>
        <ms:Else type="pass_through" portIdIn="in" portIdOut="out"/>
      </ms:Rule>
    </ms:Rules>
  </ms:Behavior>

  <ms:VisualStates>
    <ms:VisualState name="engaged">
      <ms:PrimitiveOverrides>
        <ms:Override targetId="mushroom" fill="#b91c1c" stroke="#7f1d1d"/>
        <ms:Override targetId="arm" stroke="#ef4444"/>
      </ms:PrimitiveOverrides>
    </ms:VisualState>
  </ms:VisualStates>
  <ms:Animations/>

  <ms:StandardsRef iecSection="07-08" iecCategory="S" refDesignator="ES"/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 18. relay_coil
// ─────────────────────────────────────────────────────────────────────────────
write('relay_coil.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:relay_coil"
  name="Relay Coil"
  version="1.0.0"
  domain="circuit"
  canonicalType="relay_coil"
  placeable="true">

  <ms:Description>Relay electromagnetic coil unit — standalone coil (A1/A2) without contact</ms:Description>
  <ms:Category>switching</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="40" height="60" unit="px"/>

  <ms:Ports>
    <ms:Port id="in" name="A1" number="A1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="up"
             x="20" y="0" length="0" sortOrder="1"
             nameVisible="true" numberVisible="true"
             edgePosition="top" edgeOffset="0.5"/>
    <ms:Port id="out" name="A2" number="A2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="down"
             x="20" y="60" length="0" sortOrder="2"
             nameVisible="true" numberVisible="true"
             edgePosition="bottom" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Polyline id="lead-a1" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="20" y="0"/><ms:Point x="20" y="12"/>
    </ms:Polyline>
    <ms:Rect id="coil-body" x="10" y="12" width="20" height="36"
             stroke="#888888" fill="transparent" strokeWidth="2"/>
    <ms:Text id="coil-label" x="20" y="34" fontSize="11" fontFamily="Arial"
             fill="#888888" anchor="middle">K</ms:Text>
    <ms:Polyline id="lead-a2" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="20" y="48"/><ms:Point x="20" y="60"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Designation">
      <ms:DefaultValue>K1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="coilVoltage" type="number" editorType="number" visible="true"
                 min="5" max="690" step="1" unit="V" label="Coil Voltage">
      <ms:DefaultValue>24</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="energized" type="boolean" editorType="checkbox" visible="true" label="Energized">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:relay_coil" archetype="relay_coil"
               interactionMode="none" deviceScoped="false" domain="circuit">
    <ms:Rules>
      <ms:Rule id="energize" name="Energize coil" priority="1" conditionLogic="all">
        <ms:If type="port_powered" portId="in"/>
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
        <ms:Override targetId="coil-body" stroke="#22c55e" fill="#d1fae5"/>
        <ms:Override targetId="coil-label" fill="#15803d"/>
      </ms:PrimitiveOverrides>
    </ms:VisualState>
  </ms:VisualStates>
  <ms:Animations/>

  <ms:StandardsRef iecSection="07-12" iecCategory="K" refDesignator="K"/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 19. relay_contact_no
// ─────────────────────────────────────────────────────────────────────────────
write('relay_contact_no.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:relay_contact_no"
  name="Relay Contact (NO)"
  version="1.0.0"
  domain="circuit"
  canonicalType="relay_contact_no"
  placeable="true">

  <ms:Description>Relay normally-open contact — controlled by associated relay coil designation</ms:Description>
  <ms:Category>switching</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="60" height="40" unit="px"/>

  <ms:Ports>
    <ms:Port id="in" name="IN" number="1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="left"
             x="0" y="20" length="0" sortOrder="1"
             nameVisible="false" numberVisible="false"
             edgePosition="left" edgeOffset="0.5"/>
    <ms:Port id="out" name="OUT" number="2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="60" y="20" length="0" sortOrder="2"
             nameVisible="false" numberVisible="false"
             edgePosition="right" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Polyline id="wire-in" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="0" y="20"/><ms:Point x="18" y="20"/>
    </ms:Polyline>
    <ms:Circle id="c-in" cx="18" cy="20" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <ms:Circle id="c-out" cx="42" cy="20" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <ms:Polyline id="arm" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="18" y="20"/><ms:Point x="42" y="10"/>
    </ms:Polyline>
    <ms:Polyline id="wire-out" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="42" y="20"/><ms:Point x="60" y="20"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Coil Designation">
      <ms:DefaultValue>K1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="coilVoltage" type="number" editorType="number" visible="true"
                 min="5" max="690" step="1" unit="V" label="Coil Voltage">
      <ms:DefaultValue>24</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="energized" type="boolean" editorType="checkbox" visible="true" label="Energized">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="normallyOpen" type="boolean" editorType="checkbox" visible="true" label="Normally Open">
      <ms:DefaultValue>true</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:relay_contact" archetype="relay_contact"
               interactionMode="none" deviceScoped="false" domain="circuit">
    <ms:Rules>
      <ms:Rule id="contact-closes" name="NO contact closes when energized" priority="1" conditionLogic="all">
        <ms:If type="property_true" propertyKey="energized"/>
        <ms:Then type="set_state" stateName="energized"/>
        <ms:Then type="pass_through" portIdIn="in" portIdOut="out"/>
        <ms:Else type="clear_state" stateName="energized"/>
        <ms:Else type="block_port" portId="out"/>
      </ms:Rule>
    </ms:Rules>
  </ms:Behavior>

  <ms:VisualStates>
    <ms:VisualState name="energized">
      <ms:PrimitiveOverrides>
        <ms:Override targetId="arm" stroke="#22c55e"/>
      </ms:PrimitiveOverrides>
    </ms:VisualState>
  </ms:VisualStates>
  <ms:Animations/>

</ms:SymbolDefinition>`);

// ─────────────────────────────────────────────────────────────────────────────
// 20. relay_contact_nc
// ─────────────────────────────────────────────────────────────────────────────
write('relay_contact_nc.symbol.xml', `<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCHEMA_LOC}"
  id="builtin:relay_contact_nc"
  name="Relay Contact (NC)"
  version="1.0.0"
  domain="circuit"
  canonicalType="relay_contact_nc"
  placeable="true">

  <ms:Description>Relay normally-closed contact — opens when associated relay coil is energized</ms:Description>
  <ms:Category>switching</ms:Category>
  <ms:Author>ModOne</ms:Author>
  <ms:CreatedAt>2026-03-30T00:00:00Z</ms:CreatedAt>
  <ms:UpdatedAt>2026-03-30T00:00:00Z</ms:UpdatedAt>

  <ms:Layout width="60" height="40" unit="px"/>

  <ms:Ports>
    <ms:Port id="in" name="IN" number="1"
             electricalType="input" functionalRole="general"
             shape="line" orientation="left"
             x="0" y="20" length="0" sortOrder="1"
             nameVisible="false" numberVisible="false"
             edgePosition="left" edgeOffset="0.5"/>
    <ms:Port id="out" name="OUT" number="2"
             electricalType="output" functionalRole="general"
             shape="line" orientation="right"
             x="60" y="20" length="0" sortOrder="2"
             nameVisible="false" numberVisible="false"
             edgePosition="right" edgeOffset="0.5"/>
  </ms:Ports>

  <ms:Graphics>
    <ms:Polyline id="wire-in" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="0" y="20"/><ms:Point x="18" y="20"/>
    </ms:Polyline>
    <ms:Circle id="c-in" cx="18" cy="20" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <ms:Circle id="c-out" cx="42" cy="20" r="2" stroke="#888888" fill="#888888" strokeWidth="1"/>
    <ms:Polyline id="arm" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="18" y="20"/><ms:Point x="42" y="20"/>
    </ms:Polyline>
    <ms:Polyline id="nc-slash" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="24" y="14"/><ms:Point x="36" y="26"/>
    </ms:Polyline>
    <ms:Polyline id="wire-out" stroke="#888888" fill="none" strokeWidth="2">
      <ms:Point x="42" y="20"/><ms:Point x="60" y="20"/>
    </ms:Polyline>
  </ms:Graphics>

  <ms:Properties>
    <ms:Property key="designation" type="string" editorType="text" visible="true" label="Coil Designation">
      <ms:DefaultValue>K1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="coilVoltage" type="number" editorType="number" visible="true"
                 min="5" max="690" step="1" unit="V" label="Coil Voltage">
      <ms:DefaultValue>24</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="energized" type="boolean" editorType="checkbox" visible="true" label="Energized">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="normallyOpen" type="boolean" editorType="checkbox" visible="true" label="Normally Open">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>

  <ms:Behavior templateId="archetype:relay_contact" archetype="relay_contact"
               interactionMode="none" deviceScoped="false" domain="circuit">
    <ms:Rules>
      <ms:Rule id="contact-opens" name="NC contact opens when energized" priority="1" conditionLogic="all">
        <ms:If type="property_true" propertyKey="energized"/>
        <ms:Then type="set_state" stateName="energized"/>
        <ms:Then type="block_port" portId="out"/>
        <ms:Else type="clear_state" stateName="energized"/>
        <ms:Else type="pass_through" portIdIn="in" portIdOut="out"/>
      </ms:Rule>
    </ms:Rules>
  </ms:Behavior>

  <ms:VisualStates>
    <ms:VisualState name="energized">
      <ms:PrimitiveOverrides>
        <ms:Override targetId="arm" stroke="#ef4444"/>
      </ms:PrimitiveOverrides>
    </ms:VisualState>
  </ms:VisualStates>
  <ms:Animations/>

</ms:SymbolDefinition>`);

console.log('\nBatch 1 complete (power sources + protection + switches + relay contacts)');
