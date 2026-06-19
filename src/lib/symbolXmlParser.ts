/**
 * ModOne Symbol XML Parser
 *
 * Parses XML symbol definition files conforming to the ModOne Symbol Definition Schema
 * (http://modone.io/schema/symbol/1.0) into TypeScript SymbolDefinition objects.
 *
 * Supports two root elements:
 *   <ms:SymbolDefinition> — standalone single-symbol file
 *   <ms:SymbolLibrary>    — library container with multiple symbols
 *
 * Schema: src/assets/symbol-schema/modone-symbol.xsd
 *
 * Standards references:
 *   IEC 62714 / AutomationML CAEX (hierarchical component modeling)
 *   IEC 60617  (electrical symbol conventions)
 *   KiCad .kicad_sym (pin type/shape vocabulary)
 */

import type {
  SymbolDefinition,
  SymbolPin,
  GraphicPrimitive,
  SymbolProperty,
  SymbolUnit,
  SymbolVisualVariant,
  SymbolAnimationSpec,
  LibraryScope,
  PinElectricalType,
  PinShape,
  PinOrientation,
  PinElectricalTypeV2,
  PinFunctionalRole,
  GraphicPrimitiveOverride,
} from '@/types/symbol';
import type {
  BehaviorVisualState,
  SymbolBehaviorBinding,
  BehaviorArchetype,
  BehaviorTemplateId,
} from '@/types/behavior';
import type {
  BehaviorRule,
  BehaviorCondition,
  BehaviorAction,
  BlockDomain,
  ConditionType,
  ActionType,
} from '@/types/behaviorRules';
import { validateRuleDomain } from '@/types/behaviorRules';

// ============================================================================
// Schema Constants
// ============================================================================

export const SYMBOL_SCHEMA_NS = 'http://modone.io/schema/symbol/1.0';
export const SYMBOL_SCHEMA_VERSION = '1.0.0';

// ============================================================================
// Extended Types  (XML-specific fields beyond SymbolDefinition)
// ============================================================================

// Re-export domain type for consumers
export type { BlockDomain };

/** User interaction mode during simulation */
export type InteractionMode = 'none' | 'click' | 'toggle' | 'drag';

/** Canvas edge the port sits on */
export type EdgePosition = 'top' | 'bottom' | 'left' | 'right';

/** Extended pin with XML-specific routing hints */
export interface XmlPort extends SymbolPin {
  edgePosition?: EdgePosition;
  /** Fractional offset along the edge (0.0 = start, 1.0 = end) */
  edgeOffset?: number;
  /** Maximum simultaneous connections (0 = unlimited) */
  maxConnections?: number;
  description?: string;
}

/**
 * Extended behavior binding — SymbolBehaviorBinding already has `rules` and
 * `domain` (from behaviorRules.ts); this alias adds no new fields but is
 * kept as a named export for clarity in the parser's public API.
 */
export type ExtendedBehaviorBinding = SymbolBehaviorBinding;

/** IEC / SPICE standards cross-reference */
export interface StandardsRef {
  iecSection?: string;
  iecCategory?: string;
  refDesignator?: string;
  spiceDevice?: string;
  spiceLibrary?: string;
}

/** ParsedSymbolDefinition — extends SymbolDefinition with XML-specific fields */
export interface ParsedSymbolDefinition extends SymbolDefinition {
  domain?: BlockDomain;
  canonicalType?: string;
  placeable?: boolean;
  extendedBehavior?: ExtendedBehaviorBinding;
  standardsRef?: StandardsRef;
  extendsSymbol?: string;
  /** Full ports with routing hints (superset of pins) */
  portsExtended?: XmlPort[];
}

/** Symbol library metadata (maps to ms:MetaInformation) */
export interface SymbolLibraryMetadata {
  schemaVersion: string;
  sourceTool?: string;
  description?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Parsed symbol library */
export interface ParsedSymbolLibrary {
  id: string;
  name: string;
  scope: LibraryScope | 'builtin';
  metadata: SymbolLibraryMetadata;
  symbols: ParsedSymbolDefinition[];
}

/** Parse issue (error or warning) */
export interface XmlParseIssue {
  message: string;
  level: 'error' | 'warning';
  path?: string;
}

/** Result of an XML parse operation */
export interface XmlParseResult<T> {
  data: T | null;
  errors: XmlParseIssue[];
  warnings: XmlParseIssue[];
  isValid: boolean;
}

// ============================================================================
// DOM Utilities
// ============================================================================

const NS = SYMBOL_SCHEMA_NS;

/** First direct child with matching localName in the schema namespace */
function childEl(parent: Element, localName: string): Element | null {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName === localName && child.namespaceURI === NS) {
      return child;
    }
  }
  return null;
}

/** All direct children with matching localName in the schema namespace */
function childEls(parent: Element, localName: string): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName === localName && child.namespaceURI === NS) {
      result.push(child);
    }
  }
  return result;
}

function attr(el: Element, name: string): string | undefined {
  const val = el.getAttribute(name);
  return val === null ? undefined : val;
}

function requiredAttr(
  el: Element,
  name: string,
  path: string,
  issues: XmlParseIssue[],
): string {
  const val = el.getAttribute(name);
  if (val === null) {
    issues.push({
      message: `Missing required attribute '${name}' on <${el.localName}>`,
      level: 'error',
      path,
    });
    return '';
  }
  return val;
}

function numAttr(el: Element, name: string, defaultVal = 0): number {
  const val = el.getAttribute(name);
  if (val === null) return defaultVal;
  const n = parseFloat(val);
  return isNaN(n) ? defaultVal : n;
}

function boolAttr(el: Element, name: string, defaultVal = false): boolean {
  const val = el.getAttribute(name);
  if (val === null) return defaultVal;
  return val === 'true' || val === '1';
}

function elText(el: Element | null): string {
  return el?.textContent?.trim() ?? '';
}

function childText(parent: Element, localName: string): string | undefined {
  const el = childEl(parent, localName);
  if (!el) return undefined;
  const t = elText(el);
  return t || undefined;
}

// ============================================================================
// Graphic Primitives
// ============================================================================

function parseGraphicPrimitive(
  el: Element,
  path: string,
  issues: XmlParseIssue[],
): GraphicPrimitive | null {
  const kind = el.localName.toLowerCase();
  const id = attr(el, 'id');
  const stroke = attr(el, 'stroke') ?? '#888888';
  const fill = attr(el, 'fill') ?? 'transparent';
  const strokeWidth = numAttr(el, 'strokeWidth', 2);

  switch (kind) {
    case 'rect':
      return {
        kind: 'rect',
        ...(id !== undefined && { id }),
        x: numAttr(el, 'x'),
        y: numAttr(el, 'y'),
        width: numAttr(el, 'width', 10),
        height: numAttr(el, 'height', 10),
        stroke,
        fill,
        strokeWidth,
      };

    case 'circle':
      return {
        kind: 'circle',
        ...(id !== undefined && { id }),
        cx: numAttr(el, 'cx'),
        cy: numAttr(el, 'cy'),
        r: numAttr(el, 'r', 5),
        stroke,
        fill,
        strokeWidth,
      };

    case 'polyline': {
      const pts = childEls(el, 'Point').map((pt) => ({
        x: numAttr(pt, 'x'),
        y: numAttr(pt, 'y'),
      }));
      if (pts.length < 2) {
        issues.push({
          message: 'Polyline requires at least 2 points',
          level: 'warning',
          path,
        });
      }
      return {
        kind: 'polyline',
        ...(id !== undefined && { id }),
        points: pts,
        stroke,
        fill,
        strokeWidth,
      };
    }

    case 'arc':
      return {
        kind: 'arc',
        ...(id !== undefined && { id }),
        cx: numAttr(el, 'cx'),
        cy: numAttr(el, 'cy'),
        r: numAttr(el, 'r', 5),
        startAngle: numAttr(el, 'startAngle'),
        endAngle: numAttr(el, 'endAngle', 360),
        stroke,
        fill,
        strokeWidth,
      };

    case 'text':
      return {
        kind: 'text',
        ...(id !== undefined && { id }),
        x: numAttr(el, 'x'),
        y: numAttr(el, 'y'),
        text: elText(el),
        fontSize: numAttr(el, 'fontSize', 12),
        fontFamily: attr(el, 'fontFamily') ?? 'Arial',
        fill: attr(el, 'fill') ?? '#888888',
        anchor: (attr(el, 'anchor') as 'start' | 'middle' | 'end') ?? 'middle',
      };

    case 'svgembed':
      issues.push({
        message: 'SvgEmbed primitive skipped (renderer support pending)',
        level: 'warning',
        path,
      });
      return null;

    default:
      issues.push({
        message: `Unknown graphic primitive: <ms:${el.localName}>`,
        level: 'warning',
        path,
      });
      return null;
  }
}

function parseGraphics(
  graphicsEl: Element,
  path: string,
  issues: XmlParseIssue[],
): GraphicPrimitive[] {
  const result: GraphicPrimitive[] = [];
  for (let i = 0; i < graphicsEl.children.length; i++) {
    const child = graphicsEl.children[i];
    if (child.namespaceURI !== NS) continue;
    const prim = parseGraphicPrimitive(
      child,
      `${path}/${child.localName}[${i}]`,
      issues,
    );
    if (prim !== null) result.push(prim);
  }
  return result;
}

// ============================================================================
// Port Parser
// ============================================================================

/**
 * Map an XML electricalType attribute (12-value KiCad vocabulary) to the
 * 5-value PinElectricalType used by the SymbolPin interface.
 */
function mapElectricalType(xmlType: string): PinElectricalType {
  switch (xmlType) {
    case 'input':
      return 'input';
    case 'output':
      return 'output';
    case 'bidirectional':
      return 'bidirectional';
    case 'power':
    case 'power_in':
    case 'power_out':
      return 'power';
    default:
      return 'passive';
  }
}

function parsePort(portEl: Element, path: string, issues: XmlParseIssue[]): XmlPort {
  const xmlElType = requiredAttr(portEl, 'electricalType', path, issues) || 'passive';
  const orientRaw = attr(portEl, 'orientation');
  if (!orientRaw) {
    issues.push({ message: `Port missing 'orientation' attribute`, level: 'error', path });
  }

  const sortOrderRaw = attr(portEl, 'sortOrder');
  const maxConnRaw = attr(portEl, 'maxConnections');
  const edgeOffsetRaw = attr(portEl, 'edgeOffset');

  return {
    id: requiredAttr(portEl, 'id', path, issues),
    name: requiredAttr(portEl, 'name', path, issues),
    number: attr(portEl, 'number') ?? '',
    type: mapElectricalType(xmlElType),
    electricalType: xmlElType as PinElectricalTypeV2,
    functionalRole: (attr(portEl, 'functionalRole') as PinFunctionalRole | undefined) ?? 'general',
    shape: (attr(portEl, 'shape') as PinShape | undefined) ?? 'line',
    position: { x: numAttr(portEl, 'x'), y: numAttr(portEl, 'y') },
    orientation: ((orientRaw ?? 'right') as PinOrientation),
    length: numAttr(portEl, 'length', 0),
    sortOrder: sortOrderRaw !== undefined ? parseInt(sortOrderRaw, 10) : undefined,
    nameVisible: boolAttr(portEl, 'nameVisible', true),
    numberVisible: boolAttr(portEl, 'numberVisible', true),
    hidden: boolAttr(portEl, 'hidden', false) || undefined,
    // XML-specific routing hints
    edgePosition: attr(portEl, 'edgePosition') as EdgePosition | undefined,
    edgeOffset: edgeOffsetRaw !== undefined ? parseFloat(edgeOffsetRaw) : undefined,
    maxConnections: maxConnRaw !== undefined ? parseInt(maxConnRaw, 10) : undefined,
    description: childText(portEl, 'Description') ?? attr(portEl, 'description') ?? undefined,
    // v3 fields
    group: attr(portEl, 'group') ?? undefined,
    locked: boolAttr(portEl, 'locked', false) || undefined,
    color: attr(portEl, 'color') ?? undefined,
    labelOffset: (() => {
      const lxRaw = attr(portEl, 'labelOffsetX');
      const lyRaw = attr(portEl, 'labelOffsetY');
      if (lxRaw !== undefined && lyRaw !== undefined) {
        return { x: parseFloat(lxRaw), y: parseFloat(lyRaw) };
      }
      return undefined;
    })(),
  };
}

function parsePorts(portsEl: Element, path: string, issues: XmlParseIssue[]): XmlPort[] {
  return childEls(portsEl, 'Port').map((el, i) =>
    parsePort(el, `${path}/Port[${i}]`, issues),
  );
}

// ============================================================================
// Properties Parser
// ============================================================================

function parseProperty(
  propEl: Element,
  path: string,
  issues: XmlParseIssue[],
): SymbolProperty {
  const key = requiredAttr(propEl, 'key', path, issues);
  const typeStr = (attr(propEl, 'type') ?? 'string') as SymbolProperty['type'];
  const defaultRaw = childText(propEl, 'DefaultValue') ?? '';

  let value: string | number | boolean = defaultRaw;
  if (typeStr === 'number') {
    value = parseFloat(defaultRaw) || 0;
  } else if (typeStr === 'boolean') {
    value = defaultRaw === 'true' || defaultRaw === '1';
  }

  const optionsEl = childEl(propEl, 'Options');
  const options = optionsEl
    ? childEls(optionsEl, 'Option').map((o) => elText(o))
    : undefined;

  return {
    key,
    value,
    type: typeStr,
    visible: boolAttr(propEl, 'visible', true),
    editorType: attr(propEl, 'editorType') as SymbolProperty['editorType'],
    options,
  };
}

function parseProperties(
  propsEl: Element,
  path: string,
  issues: XmlParseIssue[],
): SymbolProperty[] {
  return childEls(propsEl, 'Property').map((el, i) =>
    parseProperty(el, `${path}/Property[${i}]`, issues),
  );
}

// ============================================================================
// Units Parser
// ============================================================================

function parseUnit(
  unitEl: Element,
  path: string,
  issues: XmlParseIssue[],
): SymbolUnit {
  const graphicsEl = childEl(unitEl, 'Graphics');
  const portsEl = childEl(unitEl, 'Ports');
  return {
    unitId: numAttr(unitEl, 'unitId', 1),
    name: attr(unitEl, 'name') ?? 'Unit',
    graphics: graphicsEl ? parseGraphics(graphicsEl, `${path}/Graphics`, issues) : [],
    pins: portsEl ? parsePorts(portsEl, `${path}/Ports`, issues) : [],
  };
}

function parseUnits(
  unitsEl: Element,
  path: string,
  issues: XmlParseIssue[],
): SymbolUnit[] {
  return childEls(unitsEl, 'Unit').map((el, i) =>
    parseUnit(el, `${path}/Unit[${i}]`, issues),
  );
}

// ============================================================================
// Behavior Parser
// ============================================================================

function parseBehaviorCondition(el: Element): BehaviorCondition {
  const bitIndexRaw = attr(el, 'bitIndex');
  const thresholdRaw = attr(el, 'threshold');
  return {
    type: (attr(el, 'type') ?? 'always') as ConditionType,
    portId: attr(el, 'portId'),
    threshold: thresholdRaw !== undefined ? parseFloat(thresholdRaw) : undefined,
    registerAddress: attr(el, 'registerAddress'),
    bitIndex: bitIndexRaw !== undefined ? parseInt(bitIndexRaw, 10) : undefined,
    propertyKey: attr(el, 'propertyKey'),
    value: attr(el, 'value'),
    stateName: attr(el, 'stateName'),
    negate: boolAttr(el, 'negate', false),
  };
}

function parseBehaviorAction(el: Element): BehaviorAction {
  const bitIndexRaw = attr(el, 'bitIndex');
  return {
    type: (attr(el, 'type') ?? 'set_state') as ActionType,
    portId: attr(el, 'portId'),
    stateName: attr(el, 'stateName'),
    propertyKey: attr(el, 'propertyKey'),
    value: attr(el, 'value'),
    registerAddress: attr(el, 'registerAddress'),
    bitIndex: bitIndexRaw !== undefined ? parseInt(bitIndexRaw, 10) : undefined,
    eventName: attr(el, 'eventName'),
    targetProperty: attr(el, 'targetProperty'),
  };
}

function parseBehaviorRule(ruleEl: Element): BehaviorRule {
  return {
    id: attr(ruleEl, 'id'),
    name: attr(ruleEl, 'name'),
    priority: numAttr(ruleEl, 'priority', 1),
    conditionLogic: (attr(ruleEl, 'conditionLogic') ?? 'all') as 'all' | 'any',
    enabled: boolAttr(ruleEl, 'enabled', true),
    conditions: childEls(ruleEl, 'If').map(parseBehaviorCondition),
    thenActions: childEls(ruleEl, 'Then').map(parseBehaviorAction),
    elseActions: childEls(ruleEl, 'Else').map(parseBehaviorAction),
  };
}

function parseBehavior(
  behaviorEl: Element,
  path: string,
  issues: XmlParseIssue[],
): ExtendedBehaviorBinding | undefined {
  const templateId = attr(behaviorEl, 'templateId');
  const archetype = attr(behaviorEl, 'archetype');

  if (!templateId && !archetype) {
    issues.push({
      message: 'Behavior element missing both templateId and archetype',
      level: 'warning',
      path,
    });
    return undefined;
  }

  // Terminal roles (CAEX MappingObject)
  const terminalRoles: Record<string, string> = {};
  const terminalRolesEl = childEl(behaviorEl, 'TerminalRoles');
  if (terminalRolesEl) {
    for (const roleEl of childEls(terminalRolesEl, 'TerminalRole')) {
      const portId = attr(roleEl, 'portId');
      const role = attr(roleEl, 'role');
      if (portId && role) terminalRoles[portId] = role;
    }
  }

  // IFTTT rules
  const rulesEl = childEl(behaviorEl, 'Rules');
  const rules = rulesEl ? childEls(rulesEl, 'Rule').map(parseBehaviorRule) : [];

  const interactionModeRaw = attr(behaviorEl, 'interactionMode') ?? 'none';
  const interactionMode: SymbolBehaviorBinding['interactionMode'] =
    interactionModeRaw === 'momentary'
      ? 'momentary'
      : interactionModeRaw === 'maintained'
        ? 'maintained'
        : 'none';

  const resolvedTemplateId = (templateId ?? `archetype:${archetype}`) as BehaviorTemplateId;
  const resolvedArchetype = (
    archetype ?? (templateId?.replace('archetype:', '') ?? '')
  ) as BehaviorArchetype;

  return {
    templateId: resolvedTemplateId,
    archetype: resolvedArchetype,
    interactionMode,
    deviceScoped: boolAttr(behaviorEl, 'deviceScoped', false),
    terminalRoles: Object.keys(terminalRoles).length > 0 ? terminalRoles : undefined,
    rules: rules.length > 0 ? rules : undefined,
    domain: attr(behaviorEl, 'domain') as BlockDomain | undefined,
  };
}

// ============================================================================
// Visual States Parser
// ============================================================================

function parsePrimitiveOverride(el: Element): GraphicPrimitiveOverride {
  const override: GraphicPrimitiveOverride = {};

  const visible = attr(el, 'visible');
  if (visible !== undefined) override.visible = visible === 'true';

  const opacity = attr(el, 'opacity');
  if (opacity !== undefined) override.opacity = parseFloat(opacity);

  const stroke = attr(el, 'stroke');
  if (stroke !== undefined) override.stroke = stroke;

  const fill = attr(el, 'fill');
  if (fill !== undefined) override.fill = fill;

  const strokeWidth = attr(el, 'strokeWidth');
  if (strokeWidth !== undefined) override.strokeWidth = parseFloat(strokeWidth);

  const text = attr(el, 'text');
  if (text !== undefined) override.text = text;

  const fontSize = attr(el, 'fontSize');
  if (fontSize !== undefined) override.fontSize = parseInt(fontSize, 10);

  const fontFamily = attr(el, 'fontFamily');
  if (fontFamily !== undefined) override.fontFamily = fontFamily;

  return override;
}

function parseVisualStates(
  vsEl: Element,
  path: string,
  issues: XmlParseIssue[],
): Record<string, SymbolVisualVariant> {
  const result: Record<string, SymbolVisualVariant> = {};

  for (const stateEl of childEls(vsEl, 'VisualState')) {
    const stateName = attr(stateEl, 'name');
    if (!stateName) {
      issues.push({ message: 'VisualState missing name attribute', level: 'warning', path });
      continue;
    }

    const variant: SymbolVisualVariant = {};

    const graphicsEl = childEl(stateEl, 'Graphics');
    if (graphicsEl) {
      variant.graphics = parseGraphics(graphicsEl, `${path}/${stateName}/Graphics`, issues);
    }

    const overridesEl = childEl(stateEl, 'PrimitiveOverrides');
    if (overridesEl) {
      const overrides: Record<string, GraphicPrimitiveOverride> = {};
      for (const overrideEl of childEls(overridesEl, 'Override')) {
        const targetId = attr(overrideEl, 'targetId');
        if (targetId) overrides[targetId] = parsePrimitiveOverride(overrideEl);
      }
      if (Object.keys(overrides).length > 0) variant.primitiveOverrides = overrides;
    }

    result[stateName] = variant;
  }

  return result;
}

// ============================================================================
// Animations Parser
// ============================================================================

function parseAnimations(
  animsEl: Element,
  path: string,
  issues: XmlParseIssue[],
): Record<string, SymbolAnimationSpec[]> {
  const result: Record<string, SymbolAnimationSpec[]> = {};

  for (const stateAnimsEl of childEls(animsEl, 'StateAnimations')) {
    const stateName = attr(stateAnimsEl, 'state');
    if (!stateName) {
      issues.push({ message: 'StateAnimations missing state attribute', level: 'warning', path });
      continue;
    }

    const specs: SymbolAnimationSpec[] = [];
    for (const animEl of childEls(stateAnimsEl, 'Animation')) {
      const type = attr(animEl, 'type');
      const target = attr(animEl, 'target');
      if (!type || !target) {
        issues.push({ message: 'Animation missing type or target', level: 'warning', path });
        continue;
      }

      if (type === 'rotate') {
        const pivotXRaw = attr(animEl, 'pivotX');
        const pivotYRaw = attr(animEl, 'pivotY');
        const spec: SymbolAnimationSpec = {
          type: 'rotate',
          target,
          speed: attr(animEl, 'speed') !== undefined ? numAttr(animEl, 'speed') : undefined,
          pivot:
            pivotXRaw !== undefined && pivotYRaw !== undefined
              ? { x: parseFloat(pivotXRaw), y: parseFloat(pivotYRaw) }
              : undefined,
        };
        specs.push(spec);
      } else {
        issues.push({
          message: `Animation type '${type}' not yet supported by renderer`,
          level: 'warning',
          path,
        });
      }
    }

    if (specs.length > 0) result[stateName] = specs;
  }

  return result;
}

// ============================================================================
// SymbolDefinition Element Parser
// ============================================================================

function parseSymbolDefinitionElement(
  el: Element,
  path: string,
  issues: XmlParseIssue[],
): ParsedSymbolDefinition | null {
  if (el.localName !== 'SymbolDefinition') {
    issues.push({
      message: `Expected <SymbolDefinition>, got <${el.localName}>`,
      level: 'error',
      path,
    });
    return null;
  }

  const id = requiredAttr(el, 'id', path, issues);
  const name = requiredAttr(el, 'name', path, issues);
  if (!id || !name) return null;

  const version = attr(el, 'version') ?? '1.0.0';
  const domain = (attr(el, 'domain') ?? 'circuit') as BlockDomain;
  const canonicalType = attr(el, 'canonicalType');
  const placeable = boolAttr(el, 'placeable', true);

  // Metadata
  const description = childText(el, 'Description');
  const category = childText(el, 'Category') ?? 'custom';
  const author = childText(el, 'Author');
  const createdAt = childText(el, 'CreatedAt') ?? new Date().toISOString();
  const updatedAt = childText(el, 'UpdatedAt') ?? new Date().toISOString();

  // Layout
  const layoutEl = childEl(el, 'Layout');
  if (!layoutEl) {
    issues.push({ message: `Symbol '${id}' missing <Layout>`, level: 'error', path: `${path}/Layout` });
    return null;
  }
  const width = numAttr(layoutEl, 'width', 60);
  const height = numAttr(layoutEl, 'height', 60);

  // Ports
  const portsEl = childEl(el, 'Ports');
  const portsExtended = portsEl ? parsePorts(portsEl, `${path}/Ports`, issues) : [];
  const pins: SymbolPin[] = portsExtended;

  // Graphics
  const graphicsEl = childEl(el, 'Graphics');
  const graphics = graphicsEl ? parseGraphics(graphicsEl, `${path}/Graphics`, issues) : [];

  // Units
  const unitsEl = childEl(el, 'Units');
  const units = unitsEl ? parseUnits(unitsEl, `${path}/Units`, issues) : undefined;

  // Properties
  const propsEl = childEl(el, 'Properties');
  const properties = propsEl ? parseProperties(propsEl, `${path}/Properties`, issues) : [];

  // Behavior
  const behaviorEl = childEl(el, 'Behavior');
  const extendedBehavior = behaviorEl
    ? parseBehavior(behaviorEl, `${path}/Behavior`, issues)
    : undefined;

  // Slim SymbolBehaviorBinding (without rules) for the base interface field
  const behavior: SymbolBehaviorBinding | undefined = extendedBehavior
    ? {
        templateId: extendedBehavior.templateId,
        archetype: extendedBehavior.archetype,
        interactionMode: extendedBehavior.interactionMode,
        deviceScoped: extendedBehavior.deviceScoped,
        terminalRoles: extendedBehavior.terminalRoles,
      }
    : undefined;

  // Visual states
  const vsEl = childEl(el, 'VisualStates');
  const rawVS = vsEl ? parseVisualStates(vsEl, `${path}/VisualStates`, issues) : {};
  const visualStates = Object.keys(rawVS).length > 0 ? rawVS : undefined;

  // Animations
  const animsEl = childEl(el, 'Animations');
  const rawAnims = animsEl ? parseAnimations(animsEl, `${path}/Animations`, issues) : {};
  const animations = Object.keys(rawAnims).length > 0 ? rawAnims : undefined;

  // StandardsRef
  const srEl = childEl(el, 'StandardsRef');
  const standardsRef = srEl
    ? {
        iecSection: attr(srEl, 'iecSection'),
        iecCategory: attr(srEl, 'iecCategory'),
        refDesignator: attr(srEl, 'refDesignator'),
        spiceDevice: attr(srEl, 'spiceDevice'),
        spiceLibrary: attr(srEl, 'spiceLibrary'),
      }
    : undefined;

  // Extends
  const extendsEl = childEl(el, 'Extends');
  const extendsSymbol = extendsEl ? attr(extendsEl, 'symbolId') : undefined;

  return {
    id,
    name,
    version,
    description,
    category,
    author,
    createdAt,
    updatedAt,
    width,
    height,
    graphics,
    pins,
    units,
    properties,
    behavior,
    visualStates,
    animations,
    // Extended
    domain,
    canonicalType,
    placeable,
    extendedBehavior,
    standardsRef,
    extendsSymbol,
    portsExtended,
  };
}

// ============================================================================
// Public API — Parsing
// ============================================================================

/**
 * Parse a standalone symbol definition XML string.
 * Root element must be `<ms:SymbolDefinition>`.
 *
 * @example
 * ```ts
 * import { parseSymbolXml } from '@/lib/symbolXmlParser';
 * const result = parseSymbolXml(xmlString);
 * if (result.isValid) console.log(result.data?.id);
 * ```
 */
export function parseSymbolXml(xml: string): XmlParseResult<ParsedSymbolDefinition> {
  const issues: XmlParseIssue[] = [];

  if (!xml?.trim()) {
    return { data: null, errors: [{ message: 'Empty XML input', level: 'error' }], warnings: [], isValid: false };
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, 'application/xml');
  } catch (e) {
    return {
      data: null,
      errors: [{ message: `DOMParser failed: ${e}`, level: 'error' }],
      warnings: [],
      isValid: false,
    };
  }

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return {
      data: null,
      errors: [{ message: `XML syntax error: ${parseError.textContent?.trim()}`, level: 'error' }],
      warnings: [],
      isValid: false,
    };
  }

  const root = doc.documentElement;
  if (root.localName !== 'SymbolDefinition') {
    return {
      data: null,
      errors: [{ message: `Root must be <SymbolDefinition>, got <${root.localName}>`, level: 'error' }],
      warnings: [],
      isValid: false,
    };
  }

  const data = parseSymbolDefinitionElement(root, '/SymbolDefinition', issues);
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');

  return { data, errors, warnings, isValid: errors.length === 0 && data !== null };
}

/**
 * Parse a symbol library XML string.
 * Root element must be `<ms:SymbolLibrary>`.
 *
 * @example
 * ```ts
 * import { parseSymbolLibraryXml } from '@/lib/symbolXmlParser';
 * const result = parseSymbolLibraryXml(xmlString);
 * if (result.isValid) result.data?.symbols.forEach(s => console.log(s.id));
 * ```
 */
export function parseSymbolLibraryXml(xml: string): XmlParseResult<ParsedSymbolLibrary> {
  const issues: XmlParseIssue[] = [];

  if (!xml?.trim()) {
    return { data: null, errors: [{ message: 'Empty XML input', level: 'error' }], warnings: [], isValid: false };
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, 'application/xml');
  } catch (e) {
    return {
      data: null,
      errors: [{ message: `DOMParser failed: ${e}`, level: 'error' }],
      warnings: [],
      isValid: false,
    };
  }

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return {
      data: null,
      errors: [{ message: `XML syntax error: ${parseError.textContent?.trim()}`, level: 'error' }],
      warnings: [],
      isValid: false,
    };
  }

  const root = doc.documentElement;
  if (root.localName !== 'SymbolLibrary') {
    return {
      data: null,
      errors: [{ message: `Root must be <SymbolLibrary>, got <${root.localName}>`, level: 'error' }],
      warnings: [],
      isValid: false,
    };
  }

  const libraryId = requiredAttr(root, 'id', '/SymbolLibrary', issues);
  const libraryName = requiredAttr(root, 'name', '/SymbolLibrary', issues);
  const scope = (attr(root, 'scope') ?? 'global') as LibraryScope | 'builtin';

  // MetaInformation
  const metaEl = childEl(root, 'MetaInformation');
  const metadata: SymbolLibraryMetadata = {
    schemaVersion: metaEl ? (childText(metaEl, 'SchemaVersion') ?? SYMBOL_SCHEMA_VERSION) : SYMBOL_SCHEMA_VERSION,
    sourceTool: metaEl ? childText(metaEl, 'SourceTool') : undefined,
    description: metaEl ? childText(metaEl, 'Description') : undefined,
    author: metaEl ? childText(metaEl, 'Author') : undefined,
    createdAt: metaEl ? childText(metaEl, 'CreatedAt') : undefined,
    updatedAt: metaEl ? childText(metaEl, 'UpdatedAt') : undefined,
  };

  // SymbolDefinitions
  const symbolDefsEl = childEl(root, 'SymbolDefinitions');
  const symbols: ParsedSymbolDefinition[] = [];

  if (symbolDefsEl) {
    for (const symEl of childEls(symbolDefsEl, 'SymbolDefinition')) {
      const symId = symEl.getAttribute('id') ?? '?';
      const sym = parseSymbolDefinitionElement(
        symEl,
        `/SymbolLibrary/SymbolDefinitions/${symId}`,
        issues,
      );
      if (sym) symbols.push(sym);
    }
  }

  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');

  return {
    data: { id: libraryId, name: libraryName, scope, metadata, symbols },
    errors,
    warnings,
    isValid: errors.length === 0,
  };
}

// ============================================================================
// Public API — Serialization
// ============================================================================

function xmlEsc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function serializePrimitive(p: GraphicPrimitive, indent: string): string {
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

function serializeGraphicsBlock(graphics: GraphicPrimitive[], indent: string): string {
  if (graphics.length === 0) return `${indent}<ms:Graphics/>`;
  const lines = graphics.map((p) => serializePrimitive(p, `${indent}  `)).filter(Boolean);
  return `${indent}<ms:Graphics>\n${lines.join('\n')}\n${indent}</ms:Graphics>`;
}

function serializePortEl(pin: SymbolPin, indent: string): string {
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

function serializePortsBlock(pins: SymbolPin[], indent: string): string {
  if (pins.length === 0) return `${indent}<ms:Ports/>`;
  const lines = pins.map((p) => serializePortEl(p, `${indent}  `));
  return `${indent}<ms:Ports>\n${lines.join('\n')}\n${indent}</ms:Ports>`;
}

function serializePropertyEl(prop: SymbolProperty, indent: string): string {
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

function serializePropertiesBlock(props: SymbolProperty[], indent: string): string {
  if (props.length === 0) return `${indent}<ms:Properties/>`;
  const lines = props.map((p) => serializePropertyEl(p, `${indent}  `));
  return `${indent}<ms:Properties>\n${lines.join('\n')}\n${indent}</ms:Properties>`;
}

function serializeBehaviorBlock(
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

function serializeVisualStatesBlock(
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

function serializeAnimationsBlock(
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
// Utilities
// ============================================================================

/**
 * Convert a plain SymbolDefinition to ParsedSymbolDefinition with default
 * extended fields. Useful before calling symbolDefinitionToXml().
 */
export function toParsedSymbolDefinition(
  def: SymbolDefinition,
  options?: {
    domain?: BlockDomain;
    canonicalType?: string;
    placeable?: boolean;
    standardsRef?: StandardsRef;
  },
): ParsedSymbolDefinition {
  return {
    ...def,
    domain: options?.domain ?? 'circuit',
    canonicalType: options?.canonicalType,
    placeable: options?.placeable ?? true,
    standardsRef: options?.standardsRef,
    portsExtended: def.pins.map((pin) => ({
      ...pin,
      edgePosition: _inferEdgePosition(pin.position, def.width, def.height),
    })),
  };
}

/** Infer the canvas edge a pin sits on from its position. */
function _inferEdgePosition(
  position: { x: number; y: number },
  width: number,
  height: number,
): EdgePosition {
  const { x, y } = position;
  const threshold = Math.min(width, height) * 0.15;
  if (y <= threshold) return 'top';
  if (y >= height - threshold) return 'bottom';
  if (x <= threshold) return 'left';
  if (x >= width - threshold) return 'right';
  return x < width / 2 ? 'left' : 'right';
}

/**
 * Validate domain constraint rules:
 * - circuit blocks must not reference PLC register actions/conditions
 * - PLC blocks may use any action type
 *
 * Returns a list of issues found; empty array means the definition is valid.
 */
export function validateDomainConstraints(def: ParsedSymbolDefinition): XmlParseIssue[] {
  const issues: XmlParseIssue[] = [];
  const domain = def.behavior?.domain ?? def.domain;
  if (domain !== 'circuit') return issues;

  for (const rule of def.behavior?.rules ?? []) {
    const errs = validateRuleDomain(rule, 'circuit');
    for (const msg of errs) {
      issues.push({
        message: `Symbol '${def.id}': ${msg}`,
        level: 'error',
        path: `/SymbolDefinition[@id='${def.id}']/Behavior/Rules/Rule`,
      });
    }
  }

  return issues;
}
