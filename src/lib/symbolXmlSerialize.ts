import type { SymbolDefinition, SymbolPin, SymbolProperty, GraphicPrimitive, SymbolVisualVariant, SymbolAnimationSpec, LibraryScope } from "@/types/symbol";
import type { SymbolBehaviorBinding, BehaviorVisualState } from "@/types/behavior";
import { SYMBOL_SCHEMA_NS, SYMBOL_SCHEMA_VERSION } from "./symbolXmlTypes";
import type { ExtendedBehaviorBinding, ParsedSymbolDefinition, SymbolLibraryMetadata, XmlPort } from "./symbolXmlTypes";

// Public API — Serialization
// ============================================================================

export function xmlEsc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function serializePrimitive(p: GraphicPrimitive, indent: string): string {
  const id = p.id ? ` id="${xmlEsc(p.id)}"` : '';
  switch (p.kind) {
    case 'rect':
      return (
        `${indent}<ms:Rect${id} x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}"` +
        ` stroke="${xmlEsc(p.stroke)}" fill="${xmlEsc(p.fill)}" strokeWidth="${p.strokeWidth}"/>`
      );
    case 'circle':
      return (
        `${indent}<ms:Circle${id} cx="${p.cx}" cy="${p.cy}" r="${p.r}"` +
        ` stroke="${xmlEsc(p.stroke)}" fill="${xmlEsc(p.fill)}" strokeWidth="${p.strokeWidth}"/>`
      );
    case 'polyline': {
      const pts = p.points.map((pt) => `${indent}  <ms:Point x="${pt.x}" y="${pt.y}"/>`).join('\n');
      return (
        `${indent}<ms:Polyline${id} stroke="${xmlEsc(p.stroke)}" fill="${xmlEsc(p.fill)}" strokeWidth="${p.strokeWidth}">\n` +
        `${pts}\n${indent}</ms:Polyline>`
      );
    }
    case 'arc':
      return (
        `${indent}<ms:Arc${id} cx="${p.cx}" cy="${p.cy}" r="${p.r}"` +
        ` startAngle="${p.startAngle}" endAngle="${p.endAngle}"` +
        ` stroke="${xmlEsc(p.stroke)}" fill="${xmlEsc(p.fill)}" strokeWidth="${p.strokeWidth}"/>`
      );
    case 'text':
      return (
        `${indent}<ms:Text${id} x="${p.x}" y="${p.y}"` +
        ` fontSize="${p.fontSize ?? 12}" fontFamily="${xmlEsc(p.fontFamily ?? 'Arial')}"` +
        ` fill="${xmlEsc(p.fill ?? '#888888')}" anchor="${p.anchor ?? 'middle'}">${xmlEsc(p.text ?? '')}</ms:Text>`
      );
    default:
      return '';
  }
}

export function serializeGraphicsBlock(graphics: GraphicPrimitive[], indent: string): string {
  if (graphics.length === 0) return `${indent}<ms:Graphics/>`;
  const lines = graphics.map((p) => serializePrimitive(p, `${indent}  `)).filter(Boolean);
  return `${indent}<ms:Graphics>\n${lines.join('\n')}\n${indent}</ms:Graphics>`;
}

export function serializePortEl(pin: SymbolPin, indent: string): string {
  const ext = pin as XmlPort;
  const parts = [
    `id="${xmlEsc(pin.id)}"`,
    `name="${xmlEsc(pin.name)}"`,
    `number="${xmlEsc(pin.number)}"`,
    `electricalType="${pin.electricalType ?? pin.type}"`,
    `functionalRole="${pin.functionalRole ?? 'general'}"`,
    `shape="${pin.shape ?? 'line'}"`,
    `orientation="${pin.orientation}"`,
    `x="${pin.position.x}"`,
    `y="${pin.position.y}"`,
    `length="${pin.length ?? 0}"`,
    pin.sortOrder !== undefined ? `sortOrder="${pin.sortOrder}"` : null,
    `nameVisible="${pin.nameVisible ?? true}"`,
    `numberVisible="${pin.numberVisible ?? true}"`,
    pin.hidden ? `hidden="true"` : null,
    ext.edgePosition ? `edgePosition="${ext.edgePosition}"` : null,
    ext.edgeOffset !== undefined ? `edgeOffset="${ext.edgeOffset}"` : null,
    ext.maxConnections !== undefined ? `maxConnections="${ext.maxConnections}"` : null,
  ].filter(Boolean).join(' ');
  return `${indent}<ms:Port ${parts}/>`;
}

export function serializePortsBlock(pins: SymbolPin[], indent: string): string {
  if (pins.length === 0) return `${indent}<ms:Ports/>`;
  const lines = pins.map((p) => serializePortEl(p, `${indent}  `));
  return `${indent}<ms:Ports>\n${lines.join('\n')}\n${indent}</ms:Ports>`;
}

export function serializePropertyEl(prop: SymbolProperty, indent: string): string {
  const parts = [
    `key="${xmlEsc(prop.key)}"`,
    `type="${prop.type}"`,
    prop.editorType ? `editorType="${prop.editorType}"` : null,
    `visible="${prop.visible ?? true}"`,
  ].filter(Boolean).join(' ');

  const children: string[] = [
    `${indent}  <ms:DefaultValue>${xmlEsc(String(prop.value))}</ms:DefaultValue>`,
  ];

  if (prop.options?.length) {
    const opts = prop.options.map((o) => `${indent}    <ms:Option>${xmlEsc(o)}</ms:Option>`).join('\n');
    children.push(`${indent}  <ms:Options>\n${opts}\n${indent}  </ms:Options>`);
  }

  return `${indent}<ms:Property ${parts}>\n${children.join('\n')}\n${indent}</ms:Property>`;
}

export function serializePropertiesBlock(props: SymbolProperty[], indent: string): string {
  if (props.length === 0) return `${indent}<ms:Properties/>`;
  const lines = props.map((p) => serializePropertyEl(p, `${indent}  `));
  return `${indent}<ms:Properties>\n${lines.join('\n')}\n${indent}</ms:Properties>`;
}

export function serializeBehaviorBlock(
  b: SymbolBehaviorBinding | ExtendedBehaviorBinding,
  indent: string,
): string {
  const ext = b as ExtendedBehaviorBinding;
  const parts = [
    b.templateId ? `templateId="${xmlEsc(String(b.templateId))}"` : null,
    b.archetype ? `archetype="${b.archetype}"` : null,
    `interactionMode="${b.interactionMode ?? 'none'}"`,
    `deviceScoped="${b.deviceScoped ?? false}"`,
    ext.domain ? `domain="${ext.domain}"` : null,
  ].filter(Boolean).join(' ');

  const children: string[] = [];

  if (b.terminalRoles && Object.keys(b.terminalRoles).length > 0) {
    const roles = Object.entries(b.terminalRoles)
      .map(([portId, role]) => `${indent}    <ms:TerminalRole portId="${xmlEsc(portId)}" role="${xmlEsc(role)}"/>`)
      .join('\n');
    children.push(`${indent}  <ms:TerminalRoles>\n${roles}\n${indent}  </ms:TerminalRoles>`);
  }

  if (ext.rules?.length) {
    const ruleLines = ext.rules.map((rule) => {
      const rAttrs = [
        rule.id ? `id="${xmlEsc(rule.id)}"` : null,
        rule.name ? `name="${xmlEsc(rule.name)}"` : null,
        `priority="${rule.priority}"`,
        `conditionLogic="${rule.conditionLogic}"`,
      ].filter(Boolean).join(' ');

      const condToAttrs = (obj: Record<string, unknown>) =>
        Object.entries(obj)
          .filter(([k, v]) => k !== 'type' && v !== undefined && v !== null)
          .map(([k, v]) => `${k}="${xmlEsc(String(v))}"`)
          .join(' ');

      const ifLines = rule.conditions.map((c) => {
        const extra = condToAttrs(c as unknown as Record<string, unknown>);
        return `${indent}      <ms:If type="${c.type}"${extra ? ' ' + extra : ''}/>`;
      });
      const thenLines = rule.thenActions.map((a) => {
        const extra = condToAttrs(a as unknown as Record<string, unknown>);
        return `${indent}      <ms:Then type="${a.type}"${extra ? ' ' + extra : ''}/>`;
      });
      const elseLines = rule.elseActions.map((a) => {
        const extra = condToAttrs(a as unknown as Record<string, unknown>);
        return `${indent}      <ms:Else type="${a.type}"${extra ? ' ' + extra : ''}/>`;
      });

      const ruleBody = [...ifLines, ...thenLines, ...elseLines].join('\n');
      return `${indent}    <ms:Rule ${rAttrs}>\n${ruleBody}\n${indent}    </ms:Rule>`;
    });
    children.push(`${indent}  <ms:Rules>\n${ruleLines.join('\n')}\n${indent}  </ms:Rules>`);
  }

  if (children.length === 0) return `${indent}<ms:Behavior ${parts}/>`;
  return `${indent}<ms:Behavior ${parts}>\n${children.join('\n')}\n${indent}</ms:Behavior>`;
}

export function serializeVisualStatesBlock(
  vs: Partial<Record<BehaviorVisualState, SymbolVisualVariant>>,
  indent: string,
): string {
  const entries = Object.entries(vs);
  if (entries.length === 0) return `${indent}<ms:VisualStates/>`;

  const stateLines = entries.map(([stateName, variant]) => {
    const children: string[] = [];

    if (variant?.graphics?.length) {
      children.push(serializeGraphicsBlock(variant.graphics, `${indent}    `));
    }

    const overrides = variant?.primitiveOverrides;
    if (overrides && Object.keys(overrides).length > 0) {
      const overrideLines = Object.entries(overrides).map(([targetId, o]) => {
        const attrs = [
          `targetId="${xmlEsc(targetId)}"`,
          o.visible !== undefined ? `visible="${o.visible}"` : null,
          o.opacity !== undefined ? `opacity="${o.opacity}"` : null,
          o.stroke ? `stroke="${xmlEsc(o.stroke)}"` : null,
          o.fill ? `fill="${xmlEsc(o.fill)}"` : null,
          o.strokeWidth !== undefined ? `strokeWidth="${o.strokeWidth}"` : null,
          o.text ? `text="${xmlEsc(o.text)}"` : null,
          o.fontSize ? `fontSize="${o.fontSize}"` : null,
          o.fontFamily ? `fontFamily="${xmlEsc(o.fontFamily)}"` : null,
        ].filter(Boolean).join(' ');
        return `${indent}      <ms:Override ${attrs}/>`;
      });
      children.push(
        `${indent}    <ms:PrimitiveOverrides>\n${overrideLines.join('\n')}\n${indent}    </ms:PrimitiveOverrides>`,
      );
    }

    const body = children.length ? `\n${children.join('\n')}\n${indent}  ` : '';
    return `${indent}  <ms:VisualState name="${xmlEsc(stateName)}">${body}</ms:VisualState>`;
  });

  return `${indent}<ms:VisualStates>\n${stateLines.join('\n')}\n${indent}</ms:VisualStates>`;
}

export function serializeAnimationsBlock(
  anims: Partial<Record<BehaviorVisualState, SymbolAnimationSpec[]>>,
  indent: string,
): string {
  const entries = Object.entries(anims).filter(([, specs]) => specs?.length);
  if (entries.length === 0) return `${indent}<ms:Animations/>`;

  const stateLines = entries.map(([stateName, specs]) => {
    const animLines = (specs ?? []).map((spec) => {
      const parts = [
        `type="${spec.type}"`,
        `target="${xmlEsc(spec.target)}"`,
        spec.speed !== undefined ? `speed="${spec.speed}"` : null,
        spec.duration !== undefined ? `duration="${spec.duration}"` : null,
        spec.dx !== undefined ? `dx="${spec.dx}"` : null,
        spec.dy !== undefined ? `dy="${spec.dy}"` : null,
        spec.pivot ? `pivotX="${spec.pivot.x}" pivotY="${spec.pivot.y}"` : null,
      ].filter(Boolean).join(' ');
      return `${indent}    <ms:Animation ${parts}/>`;
    });
    return (
      `${indent}  <ms:StateAnimations state="${xmlEsc(stateName)}">\n` +
      `${animLines.join('\n')}\n${indent}  </ms:StateAnimations>`
    );
  });

  return `${indent}<ms:Animations>\n${stateLines.join('\n')}\n${indent}</ms:Animations>`;
}

/**
 * Serialize a SymbolDefinition (or ParsedSymbolDefinition) to XML.
 * Output conforms to `http://modone.io/schema/symbol/1.0`.
 *
 * @example
 * ```ts
 * import { symbolDefinitionToXml } from '@/lib/symbolXmlParser';
 * const xml = symbolDefinitionToXml(relaySymbol);
 * ```
 */
export function symbolDefinitionToXml(
  def: SymbolDefinition | ParsedSymbolDefinition,
): string {
  const ext = def as ParsedSymbolDefinition;
  const i = '  '; // base indent

  const rootAttrs = [
    `xmlns:ms="${SYMBOL_SCHEMA_NS}"`,
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
    `xsi:schemaLocation="${SYMBOL_SCHEMA_NS} ../../symbol-schema/modone-symbol.xsd"`,
    `id="${xmlEsc(def.id)}"`,
    `name="${xmlEsc(def.name)}"`,
    `version="${def.version}"`,
    `domain="${ext.domain ?? 'circuit'}"`,
    ext.canonicalType ? `canonicalType="${xmlEsc(ext.canonicalType)}"` : null,
    `placeable="${ext.placeable ?? true}"`,
  ].filter(Boolean).join('\n         ');

  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<ms:SymbolDefinition`,
    `  ${rootAttrs}>`,
    ``,
    def.description ? `${i}<ms:Description>${xmlEsc(def.description)}</ms:Description>` : null,
    `${i}<ms:Category>${xmlEsc(def.category)}</ms:Category>`,
    def.author ? `${i}<ms:Author>${xmlEsc(def.author)}</ms:Author>` : null,
    `${i}<ms:CreatedAt>${def.createdAt}</ms:CreatedAt>`,
    `${i}<ms:UpdatedAt>${def.updatedAt}</ms:UpdatedAt>`,
    ``,
    `${i}<ms:Layout width="${def.width}" height="${def.height}" unit="px"/>`,
    ``,
    serializePortsBlock(ext.portsExtended ?? def.pins, i),
    ``,
    serializeGraphicsBlock(def.graphics, i),
    ``,
  ].filter((l) => l !== null) as string[];

  if (def.units?.length) {
    const unitLines = def.units.map((unit) => {
      const uLines: string[] = [];
      if (unit.graphics.length) uLines.push(serializeGraphicsBlock(unit.graphics, `${i}  `));
      if (unit.pins.length) uLines.push(serializePortsBlock(unit.pins, `${i}  `));
      return [`${i}<ms:Unit unitId="${unit.unitId}" name="${xmlEsc(unit.name)}">`, ...uLines, `${i}</ms:Unit>`].join('\n');
    });
    lines.push(`${i}<ms:Units>\n${unitLines.join('\n')}\n${i}</ms:Units>`, ``);
  }

  lines.push(serializePropertiesBlock(def.properties, i), ``);

  const behav = ext.extendedBehavior ?? def.behavior;
  if (behav) {
    lines.push(serializeBehaviorBlock(behav, i), ``);
  }

  lines.push(
    serializeVisualStatesBlock(def.visualStates ?? {}, i),
    ``,
    serializeAnimationsBlock(def.animations ?? {}, i),
    ``,
  );

  const sr = ext.standardsRef;
  if (sr) {
    const srAttrs = [
      sr.iecSection ? `iecSection="${xmlEsc(sr.iecSection)}"` : null,
      sr.iecCategory ? `iecCategory="${xmlEsc(sr.iecCategory)}"` : null,
      sr.refDesignator ? `refDesignator="${xmlEsc(sr.refDesignator)}"` : null,
      sr.spiceDevice ? `spiceDevice="${xmlEsc(sr.spiceDevice)}"` : null,
      sr.spiceLibrary ? `spiceLibrary="${xmlEsc(sr.spiceLibrary)}"` : null,
    ].filter(Boolean).join(' ');
    if (srAttrs) lines.push(`${i}<ms:StandardsRef ${srAttrs}/>`, ``);
  }

  lines.push(`</ms:SymbolDefinition>`);
  return lines.join('\n');
}

/** Options for serializing a symbol library */
export interface SymbolLibraryXmlOptions {
  id: string;
  name: string;
  scope: LibraryScope | 'builtin';
  symbols: (SymbolDefinition | ParsedSymbolDefinition)[];
  metadata?: Partial<SymbolLibraryMetadata>;
}

/**
 * Serialize a collection of SymbolDefinitions to a `<ms:SymbolLibrary>` XML string.
 *
 * @example
 * ```ts
 * import { symbolLibraryToXml } from '@/lib/symbolXmlParser';
 * const xml = symbolLibraryToXml({ id: 'mylib', name: 'My Library', scope: 'project', symbols });
 * ```
 */
export function symbolLibraryToXml(opts: SymbolLibraryXmlOptions): string {
  const i = '  ';
  const now = new Date().toISOString();
  const meta = opts.metadata ?? {};

  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!--`,
    `  ModOne Symbol Library: ${opts.name}`,
    `  Schema: ${SYMBOL_SCHEMA_NS}`,
    `-->`,
    `<ms:SymbolLibrary`,
    `  xmlns:ms="${SYMBOL_SCHEMA_NS}"`,
    `  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
    `  xsi:schemaLocation="${SYMBOL_SCHEMA_NS} symbol-schema/modone-symbol.xsd"`,
    `  id="${xmlEsc(opts.id)}"`,
    `  name="${xmlEsc(opts.name)}"`,
    `  scope="${opts.scope}">`,
    ``,
    `${i}<ms:MetaInformation>`,
    `${i}  <ms:SchemaVersion>${SYMBOL_SCHEMA_VERSION}</ms:SchemaVersion>`,
    `${i}  <ms:SourceTool>ModOne Symbol Editor</ms:SourceTool>`,
    meta.description ? `${i}  <ms:Description>${xmlEsc(meta.description)}</ms:Description>` : null,
    meta.author ? `${i}  <ms:Author>${xmlEsc(meta.author)}</ms:Author>` : null,
    `${i}  <ms:CreatedAt>${meta.createdAt ?? now}</ms:CreatedAt>`,
    `${i}  <ms:UpdatedAt>${meta.updatedAt ?? now}</ms:UpdatedAt>`,
    `${i}</ms:MetaInformation>`,
    ``,
    `${i}<ms:SymbolDefinitions>`,
  ].filter((l) => l !== null) as string[];

  for (const sym of opts.symbols) {
    const ext = sym as ParsedSymbolDefinition;
    const symAttrs = [
      `id="${xmlEsc(sym.id)}"`,
      `name="${xmlEsc(sym.name)}"`,
      `version="${sym.version}"`,
      `domain="${ext.domain ?? 'circuit'}"`,
      ext.canonicalType ? `canonicalType="${xmlEsc(ext.canonicalType)}"` : null,
      `placeable="${ext.placeable ?? true}"`,
    ].filter(Boolean).join(' ');

    const ii = `${i}  `;
    const symLines: string[] = [
      sym.description ? `${ii}  <ms:Description>${xmlEsc(sym.description)}</ms:Description>` : null,
      `${ii}  <ms:Category>${xmlEsc(sym.category)}</ms:Category>`,
      sym.author ? `${ii}  <ms:Author>${xmlEsc(sym.author)}</ms:Author>` : null,
      `${ii}  <ms:CreatedAt>${sym.createdAt}</ms:CreatedAt>`,
      `${ii}  <ms:UpdatedAt>${sym.updatedAt}</ms:UpdatedAt>`,
      `${ii}  <ms:Layout width="${sym.width}" height="${sym.height}" unit="px"/>`,
      serializePortsBlock(ext.portsExtended ?? sym.pins, `${ii}  `),
      serializeGraphicsBlock(sym.graphics, `${ii}  `),
    ].filter((l) => l !== null) as string[];

    if (sym.units?.length) {
      const uLines = sym.units.map((unit) => {
        const uBody: string[] = [];
        if (unit.graphics.length) uBody.push(serializeGraphicsBlock(unit.graphics, `${ii}    `));
        if (unit.pins.length) uBody.push(serializePortsBlock(unit.pins, `${ii}    `));
        return [`${ii}    <ms:Unit unitId="${unit.unitId}" name="${xmlEsc(unit.name)}">`, ...uBody, `${ii}    </ms:Unit>`].join('\n');
      });
      symLines.push(`${ii}  <ms:Units>\n${uLines.join('\n')}\n${ii}  </ms:Units>`);
    }

    symLines.push(serializePropertiesBlock(sym.properties, `${ii}  `));

    const behav = ext.extendedBehavior ?? sym.behavior;
    if (behav) symLines.push(serializeBehaviorBlock(behav, `${ii}  `));

    symLines.push(
      serializeVisualStatesBlock(sym.visualStates ?? {}, `${ii}  `),
      serializeAnimationsBlock(sym.animations ?? {}, `${ii}  `),
    );

    lines.push(
      `${ii}<ms:SymbolDefinition ${symAttrs}>`,
      symLines.join('\n'),
      `${ii}</ms:SymbolDefinition>`,
      ``,
    );
  }

  lines.push(`${i}</ms:SymbolDefinitions>`, ``, `</ms:SymbolLibrary>`);
  return lines.join('\n');
}

// ============================================================================
