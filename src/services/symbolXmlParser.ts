/**
 * XML Symbol Parser
 *
 * Parses ModOne Symbol XML (namespace: http://modone.io/schema/symbol/1.0)
 * into SymbolDefinition objects using the browser's built-in DOMParser.
 */
import type {
  SymbolDefinition,
  SymbolPin,
  SymbolUnit,
  SymbolProperty,
  GraphicPrimitive,
  RectPrimitive,
  CirclePrimitive,
  PolylinePrimitive,
  ArcPrimitive,
  TextPrimitive,
  GraphicPrimitiveOverride,
  SymbolVisualVariant,
  SymbolAnimationSpec,
  SymbolVisualTransform,
} from '../types/symbol';
import type { SymbolBehaviorBinding } from '../types/behavior';
import type { BehaviorRule, BehaviorCondition, BehaviorAction } from '../types/behaviorRules';

const NS = 'http://modone.io/schema/symbol/1.0';

// ============================================================================
// Helpers
// ============================================================================

function children(el: Element, localName: string): Element[] {
  return Array.from(el.children).filter((c) => unqualified(c) === localName);
}

function matchesName(c: Element, localName: string): boolean {
  return unqualified(c) === localName;
}

function child(el: Element, localName: string): Element | null {
  return children(el, localName)[0] ?? null;
}

function textOf(el: Element, localName: string): string | undefined {
  const c = child(el, localName);
  return c?.textContent?.trim() || undefined;
}

function attr(el: Element, name: string): string | undefined {
  return el.getAttribute(name) ?? undefined;
}

function numAttr(el: Element, name: string): number | undefined {
  const v = attr(el, name);
  return v != null ? Number(v) : undefined;
}

function boolAttr(el: Element, name: string): boolean | undefined {
  const v = attr(el, name);
  if (v == null) return undefined;
  return v === 'true';
}

// ============================================================================
// Graphic Primitives
// ============================================================================

/** Extract the unqualified tag name (strip namespace prefix) */
function unqualified(el: Element): string {
  const name = el.localName ?? el.tagName ?? '';
  const idx = name.lastIndexOf(':');
  return idx >= 0 ? name.slice(idx + 1) : name;
}

function parseGraphics(graphicsEl: Element | null): GraphicPrimitive[] {
  if (!graphicsEl) return [];
  const prims: GraphicPrimitive[] = [];

  for (const el of Array.from(graphicsEl.children)) {
    switch (unqualified(el)) {
      case 'Rect':
        prims.push(parseRect(el));
        break;
      case 'Circle':
        prims.push(parseCircle(el));
        break;
      case 'Polyline':
        prims.push(parsePolyline(el));
        break;
      case 'Arc':
        prims.push(parseArc(el));
        break;
      case 'Text':
        prims.push(parseText(el));
        break;
    }
  }
  return prims;
}

function parseRect(el: Element): RectPrimitive {
  return {
    kind: 'rect',
    id: attr(el, 'id'),
    x: numAttr(el, 'x') ?? 0,
    y: numAttr(el, 'y') ?? 0,
    width: numAttr(el, 'width') ?? 0,
    height: numAttr(el, 'height') ?? 0,
    stroke: attr(el, 'stroke') ?? '#888888',
    fill: attr(el, 'fill') ?? 'transparent',
    strokeWidth: numAttr(el, 'strokeWidth') ?? 2,
  };
}

function parseCircle(el: Element): CirclePrimitive {
  return {
    kind: 'circle',
    id: attr(el, 'id'),
    cx: numAttr(el, 'cx') ?? 0,
    cy: numAttr(el, 'cy') ?? 0,
    r: numAttr(el, 'r') ?? 0,
    stroke: attr(el, 'stroke') ?? '#888888',
    fill: attr(el, 'fill') ?? 'transparent',
    strokeWidth: numAttr(el, 'strokeWidth') ?? 2,
  };
}

function parsePolyline(el: Element): PolylinePrimitive {
  const points = children(el, 'Point').map((p) => ({
    x: numAttr(p, 'x') ?? 0,
    y: numAttr(p, 'y') ?? 0,
  }));
  return {
    kind: 'polyline',
    id: attr(el, 'id'),
    points,
    stroke: attr(el, 'stroke') ?? '#888888',
    fill: attr(el, 'fill') ?? 'none',
    strokeWidth: numAttr(el, 'strokeWidth') ?? 2,
  };
}

function parseArc(el: Element): ArcPrimitive {
  return {
    kind: 'arc',
    id: attr(el, 'id'),
    cx: numAttr(el, 'cx') ?? 0,
    cy: numAttr(el, 'cy') ?? 0,
    r: numAttr(el, 'r') ?? 0,
    startAngle: numAttr(el, 'startAngle') ?? 0,
    endAngle: numAttr(el, 'endAngle') ?? 360,
    stroke: attr(el, 'stroke') ?? '#888888',
    fill: attr(el, 'fill') ?? 'transparent',
    strokeWidth: numAttr(el, 'strokeWidth') ?? 2,
  };
}

function parseText(el: Element): TextPrimitive {
  return {
    kind: 'text',
    id: attr(el, 'id'),
    x: numAttr(el, 'x') ?? 0,
    y: numAttr(el, 'y') ?? 0,
    text: el.textContent?.trim() ?? '',
    fontSize: numAttr(el, 'fontSize') ?? 12,
    fontFamily: attr(el, 'fontFamily') ?? 'Arial',
    fill: attr(el, 'fill') ?? '#888888',
    anchor: (attr(el, 'anchor') as TextPrimitive['anchor']) ?? 'middle',
  };
}

// ============================================================================
// Ports / Pins
// ============================================================================

function parsePorts(portsEl: Element | null): SymbolPin[] {
  if (!portsEl) return [];
  return children(portsEl, 'Port').map(parsePort);
}

function parsePort(el: Element): SymbolPin {
  return {
    id: attr(el, 'id') ?? '',
    name: attr(el, 'name') ?? '',
    number: attr(el, 'number') ?? '',
    type: (attr(el, 'electricalType') as SymbolPin['type']) ?? 'input',
    electricalType: attr(el, 'electricalType') as SymbolPin['electricalType'],
    functionalRole: attr(el, 'functionalRole') as SymbolPin['functionalRole'],
    shape: (attr(el, 'shape') as SymbolPin['shape']) ?? 'line',
    position: {
      x: numAttr(el, 'x') ?? 0,
      y: numAttr(el, 'y') ?? 0,
    },
    orientation: (attr(el, 'orientation') as SymbolPin['orientation']) ?? 'right',
    length: numAttr(el, 'length') ?? 0,
    sortOrder: numAttr(el, 'sortOrder'),
    nameVisible: boolAttr(el, 'nameVisible'),
    numberVisible: boolAttr(el, 'numberVisible'),
    hidden: boolAttr(el, 'hidden'),
  };
}

// ============================================================================
// Units
// ============================================================================

function parseUnits(unitsEl: Element | null): SymbolUnit[] | undefined {
  if (!unitsEl) return undefined;
  const units = children(unitsEl, 'Unit');
  if (units.length === 0) return undefined;
  return units.map((u) => ({
    unitId: numAttr(u, 'unitId') ?? 1,
    name: attr(u, 'name') ?? '',
    graphics: parseGraphics(child(u, 'Graphics')),
    pins: parsePorts(child(u, 'Ports')),
  }));
}

// ============================================================================
// Properties
// ============================================================================

function parseProperties(propsEl: Element | null): SymbolProperty[] {
  if (!propsEl) return [];
  return children(propsEl, 'Property').map((p) => {
    const defaultVal = textOf(p, 'DefaultValue');
    const type = attr(p, 'type') ?? 'string';
    let value: string | number | boolean = defaultVal ?? '';
    if (type === 'number') value = Number(defaultVal) || 0;
    else if (type === 'boolean') value = defaultVal === 'true';

    const optionsEl = child(p, 'Options');
    const options = optionsEl
      ? children(optionsEl, 'Option').map((o) => o.textContent?.trim() ?? '')
      : undefined;

    return {
      key: attr(p, 'key') ?? '',
      value,
      type: type as SymbolProperty['type'],
      visible: boolAttr(p, 'visible'),
      editorType: attr(p, 'editorType') as SymbolProperty['editorType'],
      options,
    };
  });
}

// ============================================================================
// Behavior
// ============================================================================

function parseBehavior(behaviorEl: Element | null): SymbolBehaviorBinding | undefined {
  if (!behaviorEl) return undefined;

  const terminalRolesEl = child(behaviorEl, 'TerminalRoles');
  const terminalRoles: Record<string, string> = {};
  if (terminalRolesEl) {
    for (const tr of children(terminalRolesEl, 'TerminalRole')) {
      const portId = attr(tr, 'portId');
      const role = attr(tr, 'role');
      if (portId && role) terminalRoles[portId] = role;
    }
  }

  // Parse IFTTT rules
  const rulesEl = child(behaviorEl, 'Rules');
  const rules = rulesEl ? parseRules(rulesEl) : undefined;
  const domain = attr(behaviorEl, 'domain') as SymbolBehaviorBinding['domain'];

  return {
    templateId: attr(behaviorEl, 'templateId'),
    archetype: attr(behaviorEl, 'archetype'),
    interactionMode: attr(behaviorEl, 'interactionMode') as SymbolBehaviorBinding['interactionMode'],
    deviceScoped: boolAttr(behaviorEl, 'deviceScoped'),
    terminalRoles: Object.keys(terminalRoles).length > 0 ? terminalRoles : undefined,
    rules: rules && rules.length > 0 ? rules : undefined,
    domain,
  };
}

function parseRules(rulesEl: Element): BehaviorRule[] {
  return children(rulesEl, 'Rule').map((r) => ({
    id: attr(r, 'id'),
    name: attr(r, 'name'),
    priority: numAttr(r, 'priority') ?? 1,
    conditionLogic: (attr(r, 'conditionLogic') as BehaviorRule['conditionLogic']) ?? 'all',
    enabled: boolAttr(r, 'enabled') ?? true,
    conditions: children(r, 'If').map(parseCondition),
    thenActions: children(r, 'Then').map(parseAction),
    elseActions: children(r, 'Else').map(parseAction),
  }));
}

function parseCondition(el: Element): BehaviorCondition {
  return {
    type: attr(el, 'type') as BehaviorCondition['type'],
    portId: attr(el, 'portId'),
    threshold: numAttr(el, 'threshold'),
    registerAddress: attr(el, 'registerAddress'),
    bitIndex: numAttr(el, 'bitIndex'),
    propertyKey: attr(el, 'propertyKey'),
    value: attr(el, 'value'),
    stateName: attr(el, 'stateName'),
    negate: boolAttr(el, 'negate'),
  };
}

function parseAction(el: Element): BehaviorAction {
  return {
    type: attr(el, 'type') as BehaviorAction['type'],
    portId: attr(el, 'portId'),
    stateName: attr(el, 'stateName'),
    propertyKey: attr(el, 'propertyKey'),
    value: attr(el, 'value'),
    registerAddress: attr(el, 'registerAddress'),
    bitIndex: numAttr(el, 'bitIndex'),
    eventName: attr(el, 'eventName'),
    targetProperty: attr(el, 'targetProperty'),
  };
}

// ============================================================================
// Visual States
// ============================================================================

function parseVisualStates(
  vsEl: Element | null,
): Record<string, SymbolVisualVariant> | undefined {
  if (!vsEl) return undefined;
  const states = children(vsEl, 'VisualState');
  if (states.length === 0) return undefined;

  const result: Record<string, SymbolVisualVariant> = {};
  for (const s of states) {
    const name = attr(s, 'name');
    if (!name) continue;

    const graphicsEl = child(s, 'Graphics');
    const overridesEl = child(s, 'PrimitiveOverrides');

    const variant: SymbolVisualVariant = {};
    if (graphicsEl) {
      variant.graphics = parseGraphics(graphicsEl);
    }
    if (overridesEl) {
      const overrides: Record<string, GraphicPrimitiveOverride> = {};
      for (const o of children(overridesEl, 'Override')) {
        const targetId = attr(o, 'targetId');
        if (!targetId) continue;
        const override: GraphicPrimitiveOverride = {};
        if (attr(o, 'visible') != null) override.visible = boolAttr(o, 'visible');
        if (attr(o, 'opacity') != null) override.opacity = numAttr(o, 'opacity');
        if (attr(o, 'stroke')) override.stroke = attr(o, 'stroke');
        if (attr(o, 'fill')) override.fill = attr(o, 'fill');
        if (attr(o, 'strokeWidth') != null) override.strokeWidth = numAttr(o, 'strokeWidth');
        if (attr(o, 'text')) override.text = attr(o, 'text');
        if (attr(o, 'fontSize') != null) override.fontSize = numAttr(o, 'fontSize');
        if (attr(o, 'fontFamily')) override.fontFamily = attr(o, 'fontFamily');

        const transformEl = child(o, 'Transform');
        if (transformEl) {
          const t: SymbolVisualTransform = {};
          if (attr(transformEl, 'translateX') != null) t.translateX = numAttr(transformEl, 'translateX');
          if (attr(transformEl, 'translateY') != null) t.translateY = numAttr(transformEl, 'translateY');
          if (attr(transformEl, 'rotation') != null) t.rotation = numAttr(transformEl, 'rotation');
          if (attr(transformEl, 'scaleX') != null) t.scaleX = numAttr(transformEl, 'scaleX');
          if (attr(transformEl, 'scaleY') != null) t.scaleY = numAttr(transformEl, 'scaleY');
          if (attr(transformEl, 'pivotX') != null) t.pivotX = numAttr(transformEl, 'pivotX');
          if (attr(transformEl, 'pivotY') != null) t.pivotY = numAttr(transformEl, 'pivotY');
          override.transform = t;
        }
        overrides[targetId] = override;
      }
      variant.primitiveOverrides = overrides;
    }
    result[name] = variant;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

// ============================================================================
// Animations
// ============================================================================

function parseAnimations(
  animEl: Element | null,
): Record<string, SymbolAnimationSpec[]> | undefined {
  if (!animEl) return undefined;
  const stateAnims = children(animEl, 'StateAnimations');
  if (stateAnims.length === 0) return undefined;

  const result: Record<string, SymbolAnimationSpec[]> = {};
  for (const sa of stateAnims) {
    const state = attr(sa, 'state');
    if (!state) continue;
    const anims = children(sa, 'Animation').map((a) => {
      const spec: SymbolAnimationSpec = {
        type: (attr(a, 'type') as SymbolAnimationSpec['type']) ?? 'rotate',
        target: attr(a, 'target') ?? '',
        speed: numAttr(a, 'speed'),
      };
      const px = numAttr(a, 'pivotX');
      const py = numAttr(a, 'pivotY');
      if (px != null && py != null) spec.pivot = { x: px, y: py };
      return spec;
    });
    if (anims.length > 0) result[state] = anims;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse a ModOne Symbol XML string into a SymbolDefinition.
 * Supports both <SymbolDefinition> (single) and <SymbolLibrary> (multiple) roots.
 */
export function parseSymbolXml(xmlString: string): SymbolDefinition[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML parse error: ${parseError.textContent}`);
  }

  const root = doc.documentElement;

  if (matchesName(root, 'SymbolDefinition')) {
    return [parseSymbolDefinitionElement(root)];
  }

  if (matchesName(root, 'SymbolLibrary')) {
    const defsEl = child(root, 'SymbolDefinitions');
    if (!defsEl) return [];
    return children(defsEl, 'SymbolDefinition').map(parseSymbolDefinitionElement);
  }

  throw new Error(`Unexpected root element: ${root.localName ?? root.tagName}`);
}

function parseSymbolDefinitionElement(el: Element): SymbolDefinition {
  const layoutEl = child(el, 'Layout');

  return {
    id: attr(el, 'id') ?? '',
    name: attr(el, 'name') ?? '',
    version: attr(el, 'version') ?? '1.0.0',
    description: textOf(el, 'Description'),
    category: textOf(el, 'Category') ?? 'custom',
    author: textOf(el, 'Author'),
    createdAt: textOf(el, 'CreatedAt') ?? new Date().toISOString(),
    updatedAt: textOf(el, 'UpdatedAt') ?? new Date().toISOString(),
    width: numAttr(layoutEl!, 'width') ?? 60,
    height: numAttr(layoutEl!, 'height') ?? 60,
    graphics: parseGraphics(child(el, 'Graphics')),
    pins: parsePorts(child(el, 'Ports')),
    units: parseUnits(child(el, 'Units')),
    properties: parseProperties(child(el, 'Properties')),
    behavior: parseBehavior(child(el, 'Behavior')),
    visualStates: parseVisualStates(child(el, 'VisualStates')),
    animations: parseAnimations(child(el, 'Animations')),
  };
}

/**
 * Serialize a SymbolDefinition back to ModOne Symbol XML string.
 */
export function symbolToXml(sym: SymbolDefinition): string {
  const lines: string[] = [];
  const ind = (n: number) => '  '.repeat(n);

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<ms:SymbolDefinition`);
  lines.push(`  xmlns:ms="${NS}"`);
  lines.push(`  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`);
  lines.push(`  xsi:schemaLocation="${NS} ../../symbol-schema/modone-symbol.xsd"`);
  lines.push(`  id="${esc(sym.id)}"`);
  lines.push(`  name="${esc(sym.name)}"`);
  lines.push(`  version="${esc(sym.version)}"`);
  lines.push(`  domain="circuit"`);
  lines.push(`  placeable="true">`);
  lines.push('');

  if (sym.description) lines.push(`${ind(1)}<ms:Description>${esc(sym.description)}</ms:Description>`);
  lines.push(`${ind(1)}<ms:Category>${esc(sym.category)}</ms:Category>`);
  if (sym.author) lines.push(`${ind(1)}<ms:Author>${esc(sym.author)}</ms:Author>`);
  lines.push(`${ind(1)}<ms:CreatedAt>${esc(sym.createdAt)}</ms:CreatedAt>`);
  lines.push(`${ind(1)}<ms:UpdatedAt>${esc(sym.updatedAt)}</ms:UpdatedAt>`);
  lines.push('');
  lines.push(`${ind(1)}<ms:Layout width="${sym.width}" height="${sym.height}" unit="mm"/>`);
  lines.push('');

  // Ports
  lines.push(`${ind(1)}<ms:Ports>`);
  for (const pin of sym.pins) {
    lines.push(`${ind(2)}<ms:Port id="${esc(pin.id)}" name="${esc(pin.name)}" number="${esc(pin.number)}"`);
    lines.push(`${ind(3)}electricalType="${pin.electricalType ?? pin.type}" functionalRole="${pin.functionalRole ?? 'general'}"`);
    lines.push(`${ind(3)}shape="${pin.shape}" orientation="${pin.orientation}"`);
    lines.push(`${ind(3)}x="${pin.position.x}" y="${pin.position.y}" length="${pin.length}" sortOrder="${pin.sortOrder ?? 1}"`);
    lines.push(`${ind(3)}nameVisible="${pin.nameVisible ?? true}" numberVisible="${pin.numberVisible ?? true}"/>`);
  }
  lines.push(`${ind(1)}</ms:Ports>`);
  lines.push('');

  // Graphics
  if (sym.graphics.length > 0) {
    lines.push(`${ind(1)}<ms:Graphics>`);
    for (const g of sym.graphics) {
      lines.push(graphicToXml(g, 2));
    }
    lines.push(`${ind(1)}</ms:Graphics>`);
    lines.push('');
  }

  // Units
  if (sym.units && sym.units.length > 0) {
    lines.push(`${ind(1)}<ms:Units>`);
    for (const u of sym.units) {
      lines.push(`${ind(2)}<ms:Unit unitId="${u.unitId}" name="${esc(u.name)}">`);
      if (u.graphics.length > 0) {
        lines.push(`${ind(3)}<ms:Graphics>`);
        for (const g of u.graphics) lines.push(graphicToXml(g, 4));
        lines.push(`${ind(3)}</ms:Graphics>`);
      }
      lines.push(`${ind(3)}<ms:Ports>`);
      for (const pin of u.pins) {
        lines.push(`${ind(4)}<ms:Port id="${esc(pin.id)}" name="${esc(pin.name)}" number="${esc(pin.number)}"`);
        lines.push(`${ind(5)}electricalType="${pin.electricalType ?? pin.type}" functionalRole="${pin.functionalRole ?? 'general'}"`);
        lines.push(`${ind(5)}shape="${pin.shape}" orientation="${pin.orientation}"`);
        lines.push(`${ind(5)}x="${pin.position.x}" y="${pin.position.y}" length="${pin.length}" sortOrder="${pin.sortOrder ?? 1}"`);
        lines.push(`${ind(5)}nameVisible="${pin.nameVisible ?? true}" numberVisible="${pin.numberVisible ?? true}"/>`);
      }
      lines.push(`${ind(3)}</ms:Ports>`);
      lines.push(`${ind(2)}</ms:Unit>`);
    }
    lines.push(`${ind(1)}</ms:Units>`);
    lines.push('');
  }

  // Properties
  lines.push(`${ind(1)}<ms:Properties>`);
  for (const p of sym.properties) {
    const attrs = `key="${esc(p.key)}" type="${p.type}" editorType="${p.editorType ?? 'text'}" visible="${p.visible ?? true}"`;
    if (p.options && p.options.length > 0) {
      lines.push(`${ind(2)}<ms:Property ${attrs}>`);
      lines.push(`${ind(3)}<ms:DefaultValue>${esc(String(p.value))}</ms:DefaultValue>`);
      lines.push(`${ind(3)}<ms:Options>`);
      for (const o of p.options) lines.push(`${ind(4)}<ms:Option>${esc(o)}</ms:Option>`);
      lines.push(`${ind(3)}</ms:Options>`);
      lines.push(`${ind(2)}</ms:Property>`);
    } else {
      lines.push(`${ind(2)}<ms:Property ${attrs}>`);
      lines.push(`${ind(3)}<ms:DefaultValue>${esc(String(p.value))}</ms:DefaultValue>`);
      lines.push(`${ind(2)}</ms:Property>`);
    }
  }
  lines.push(`${ind(1)}</ms:Properties>`);
  lines.push('');

  // Behavior
  if (sym.behavior) {
    const b = sym.behavior;
    const bAttrs = [
      b.templateId ? `templateId="${esc(b.templateId)}"` : '',
      b.archetype ? `archetype="${esc(b.archetype)}"` : '',
      `interactionMode="${b.interactionMode ?? 'none'}"`,
      `deviceScoped="${b.deviceScoped ?? false}"`,
    ].filter(Boolean).join(' ');
    lines.push(`${ind(1)}<ms:Behavior ${bAttrs}>`);
    if (b.terminalRoles && Object.keys(b.terminalRoles).length > 0) {
      lines.push(`${ind(2)}<ms:TerminalRoles>`);
      for (const [portId, role] of Object.entries(b.terminalRoles)) {
        lines.push(`${ind(3)}<ms:TerminalRole portId="${esc(portId)}" role="${esc(role)}"/>`);
      }
      lines.push(`${ind(2)}</ms:TerminalRoles>`);
    }
    lines.push(`${ind(1)}</ms:Behavior>`);
    lines.push('');
  }

  // Visual States
  if (sym.visualStates && Object.keys(sym.visualStates).length > 0) {
    lines.push(`${ind(1)}<ms:VisualStates>`);
    for (const [stateName, variant] of Object.entries(sym.visualStates)) {
      if (!variant) continue;
      lines.push(`${ind(2)}<ms:VisualState name="${esc(stateName)}">`);
      // Full-replacement graphics form (e.g. led "lit"). Must be emitted or the
      // state's geometry is silently dropped on save.
      if (variant.graphics && variant.graphics.length > 0) {
        lines.push(`${ind(3)}<ms:Graphics>`);
        for (const g of variant.graphics) lines.push(graphicToXml(g, 4));
        lines.push(`${ind(3)}</ms:Graphics>`);
      }
      if (variant.primitiveOverrides) {
        lines.push(`${ind(3)}<ms:PrimitiveOverrides>`);
        for (const [targetId, ov] of Object.entries(variant.primitiveOverrides)) {
          const ovAttrs = [
            `targetId="${esc(targetId)}"`,
            ov.stroke ? `stroke="${esc(ov.stroke)}"` : '',
            ov.fill ? `fill="${esc(ov.fill)}"` : '',
            ov.opacity != null ? `opacity="${ov.opacity}"` : '',
            ov.visible != null ? `visible="${ov.visible}"` : '',
            ov.strokeWidth != null ? `strokeWidth="${ov.strokeWidth}"` : '',
          ].filter(Boolean).join(' ');
          lines.push(`${ind(4)}<ms:Override ${ovAttrs}/>`);
        }
        lines.push(`${ind(3)}</ms:PrimitiveOverrides>`);
      }
      lines.push(`${ind(2)}</ms:VisualState>`);
    }
    lines.push(`${ind(1)}</ms:VisualStates>`);
    lines.push('');
  }

  // Animations (e.g. motor "running" rotation). Dropped before this fix.
  if (sym.animations && Object.keys(sym.animations).length > 0) {
    lines.push(`${ind(1)}<ms:Animations>`);
    for (const [state, specs] of Object.entries(sym.animations)) {
      if (!specs || specs.length === 0) continue;
      lines.push(`${ind(2)}<ms:StateAnimations state="${esc(state)}">`);
      for (const a of specs) {
        const aAttrs = [
          `type="${esc(a.type)}"`,
          `target="${esc(a.target)}"`,
          a.speed != null ? `speed="${a.speed}"` : '',
          a.pivot ? `pivotX="${a.pivot.x}" pivotY="${a.pivot.y}"` : '',
        ].filter(Boolean).join(' ');
        lines.push(`${ind(3)}<ms:Animation ${aAttrs}/>`);
      }
      lines.push(`${ind(2)}</ms:StateAnimations>`);
    }
    lines.push(`${ind(1)}</ms:Animations>`);
    lines.push('');
  }

  lines.push(`</ms:SymbolDefinition>`);
  return lines.join('\n');
}

function graphicToXml(g: GraphicPrimitive, indent: number): string {
  const ind = '  '.repeat(indent);
  const idAttr = g.id ? ` id="${esc(g.id)}"` : '';
  switch (g.kind) {
    case 'rect':
      return `${ind}<ms:Rect${idAttr} x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" stroke="${esc(g.stroke)}" fill="${esc(g.fill)}" strokeWidth="${g.strokeWidth}"/>`;
    case 'circle':
      return `${ind}<ms:Circle${idAttr} cx="${g.cx}" cy="${g.cy}" r="${g.r}" stroke="${esc(g.stroke)}" fill="${esc(g.fill)}" strokeWidth="${g.strokeWidth}"/>`;
    case 'polyline': {
      const pts = g.points.map((p) => `${ind}  <ms:Point x="${p.x}" y="${p.y}"/>`).join('\n');
      return `${ind}<ms:Polyline${idAttr} stroke="${esc(g.stroke)}" fill="${esc(g.fill)}" strokeWidth="${g.strokeWidth}">\n${pts}\n${ind}</ms:Polyline>`;
    }
    case 'arc':
      return `${ind}<ms:Arc${idAttr} cx="${g.cx}" cy="${g.cy}" r="${g.r}" startAngle="${g.startAngle}" endAngle="${g.endAngle}" stroke="${esc(g.stroke)}" fill="${esc(g.fill)}" strokeWidth="${g.strokeWidth}"/>`;
    case 'text':
      return `${ind}<ms:Text${idAttr} x="${g.x}" y="${g.y}" fontSize="${g.fontSize}" fontFamily="${esc(g.fontFamily)}" fill="${esc(g.fill)}" anchor="${g.anchor ?? 'middle'}">${esc(g.text)}</ms:Text>`;
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
