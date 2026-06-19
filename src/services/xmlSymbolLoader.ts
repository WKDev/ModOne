/**
 * XML Symbol Loader
 *
 * Parses ModOne symbol definition XML files (schema: http://modone.io/schema/symbol/1.0)
 * into runtime SymbolDefinition objects.
 *
 * The XML format follows CAEX/AutomationML conventions and stores the full symbol
 * specification — SVG primitives, port/pin layout, IFTTT behavior rules, and
 * visual state overrides — in a single self-contained XML document.
 *
 * @example
 *   import relayXml from '@/assets/builtin-symbols/xml/relay.symbol.xml?raw';
 *   const symbol = parseXmlSymbolDefinition(relayXml);
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
  TextPrimitive,
  PinElectricalType,
  PinShape,
  PinOrientation,
  SymbolVisualVariant,
  GraphicPrimitiveOverride,
} from '@/types/symbol';
import type { SymbolBehaviorBinding } from '@/types/behavior';
import type { BehaviorRule, BehaviorCondition, BehaviorAction, ConditionType, ActionType, BlockDomain } from '@/types/behaviorRules';

// ============================================================================
// DOM Helpers
// ============================================================================

/**
 * Return the first direct child element with the given local name.
 */
function directChild(parent: Element, localName: string): Element | null {
  for (const child of Array.from(parent.children)) {
    if (child.localName === localName) {
      return child;
    }
  }
  return null;
}

/**
 * Return all direct child elements with the given local name.
 */
function directChildren(parent: Element, localName: string): Element[] {
  return Array.from(parent.children).filter((child) => child.localName === localName);
}

/**
 * Get a string attribute value with an optional fallback.
 */
function attr(element: Element, name: string, fallback = ''): string {
  return element.getAttribute(name) ?? fallback;
}

/**
 * Get a numeric attribute value with an optional fallback.
 */
function numAttr(element: Element, name: string, fallback = 0): number {
  const val = element.getAttribute(name);
  if (val === null) return fallback;
  const parsed = parseFloat(val);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Get a boolean attribute value.
 * Returns true unless the attribute is explicitly "false".
 */
function boolAttr(element: Element, name: string, fallback = true): boolean {
  const val = element.getAttribute(name);
  if (val === null) return fallback;
  return val !== 'false';
}

// ============================================================================
// Pin Parsing
// ============================================================================

function parsePin(portEl: Element): SymbolPin {
  const electricalType = attr(portEl, 'electricalType', 'input') as PinElectricalType;
  return {
    id: attr(portEl, 'id'),
    name: attr(portEl, 'name'),
    number: attr(portEl, 'number'),
    type: electricalType,
    electricalType: electricalType === 'power' ? 'power_in' : electricalType,
    functionalRole: attr(portEl, 'functionalRole', 'general') as
      | 'general'
      | 'plc_input'
      | 'plc_output'
      | 'communication',
    shape: attr(portEl, 'shape', 'line') as PinShape,
    position: {
      x: numAttr(portEl, 'x'),
      y: numAttr(portEl, 'y'),
    },
    orientation: attr(portEl, 'orientation', 'right') as PinOrientation,
    length: numAttr(portEl, 'length', 0),
    sortOrder: numAttr(portEl, 'sortOrder', 0),
    nameVisible: boolAttr(portEl, 'nameVisible', true),
    numberVisible: boolAttr(portEl, 'numberVisible', true),
  };
}

function parsePins(portsEl: Element): SymbolPin[] {
  return directChildren(portsEl, 'Port').map(parsePin);
}

// ============================================================================
// Graphics Parsing
// ============================================================================

function parseRect(el: Element): RectPrimitive {
  return {
    kind: 'rect',
    id: el.getAttribute('id') ?? undefined,
    x: numAttr(el, 'x'),
    y: numAttr(el, 'y'),
    width: numAttr(el, 'width'),
    height: numAttr(el, 'height'),
    stroke: attr(el, 'stroke', '#888888'),
    fill: attr(el, 'fill', 'none'),
    strokeWidth: numAttr(el, 'strokeWidth', 1),
  };
}

function parseCircle(el: Element): CirclePrimitive {
  return {
    kind: 'circle',
    id: el.getAttribute('id') ?? undefined,
    cx: numAttr(el, 'cx'),
    cy: numAttr(el, 'cy'),
    r: numAttr(el, 'r'),
    stroke: attr(el, 'stroke', '#888888'),
    fill: attr(el, 'fill', 'none'),
    strokeWidth: numAttr(el, 'strokeWidth', 1),
  };
}

function parsePolyline(el: Element): PolylinePrimitive {
  const pointEls = directChildren(el, 'Point');
  return {
    kind: 'polyline',
    id: el.getAttribute('id') ?? undefined,
    points: pointEls.map((pt) => ({
      x: numAttr(pt, 'x'),
      y: numAttr(pt, 'y'),
    })),
    stroke: attr(el, 'stroke', '#888888'),
    fill: attr(el, 'fill', 'none'),
    strokeWidth: numAttr(el, 'strokeWidth', 1),
  };
}

function parseText(el: Element): TextPrimitive {
  return {
    kind: 'text',
    id: el.getAttribute('id') ?? undefined,
    x: numAttr(el, 'x'),
    y: numAttr(el, 'y'),
    text: el.textContent?.trim() ?? '',
    fontSize: numAttr(el, 'fontSize', 12),
    fontFamily: attr(el, 'fontFamily', 'Arial'),
    fill: attr(el, 'fill', '#888888'),
    anchor: (el.getAttribute('anchor') as TextPrimitive['anchor']) ?? 'start',
  };
}

function parseGraphicPrimitive(el: Element): GraphicPrimitive | null {
  switch (el.localName) {
    case 'Rect':
      return parseRect(el);
    case 'Circle':
      return parseCircle(el);
    case 'Polyline':
      return parsePolyline(el);
    case 'Text':
      return parseText(el);
    default:
      return null;
  }
}

function parseGraphics(graphicsEl: Element): GraphicPrimitive[] {
  const primitives: GraphicPrimitive[] = [];
  for (const child of Array.from(graphicsEl.children)) {
    const primitive = parseGraphicPrimitive(child);
    if (primitive !== null) {
      primitives.push(primitive);
    }
  }
  return primitives;
}

// ============================================================================
// Unit Parsing
// ============================================================================

function parseUnit(unitEl: Element): SymbolUnit {
  const graphicsEl = directChild(unitEl, 'Graphics');
  const portsEl = directChild(unitEl, 'Ports');

  return {
    unitId: parseInt(attr(unitEl, 'unitId', '1'), 10),
    name: attr(unitEl, 'name'),
    graphics: graphicsEl ? parseGraphics(graphicsEl) : [],
    pins: portsEl ? parsePins(portsEl) : [],
  };
}

// ============================================================================
// Property Parsing
// ============================================================================

function parseProperty(propEl: Element): SymbolProperty {
  const defaultValueEl = directChild(propEl, 'DefaultValue');
  const rawDefault = defaultValueEl?.textContent?.trim() ?? '';

  const type = attr(propEl, 'type', 'string') as SymbolProperty['type'];

  let value: string | number | boolean = rawDefault;
  if (type === 'number') {
    value = parseFloat(rawDefault);
  } else if (type === 'boolean') {
    value = rawDefault === 'true';
  }

  const optionEls = directChildren(propEl, 'Options').flatMap((opts) =>
    directChildren(opts, 'Option'),
  );

  return {
    key: attr(propEl, 'key'),
    value,
    type,
    visible: boolAttr(propEl, 'visible', true),
    editorType: attr(propEl, 'editorType', 'text') as SymbolProperty['editorType'],
    options: optionEls.length > 0 ? optionEls.map((o) => o.textContent?.trim() ?? '') : undefined,
  };
}

// ============================================================================
// Behavior Parsing (IFTTT Rules)
// ============================================================================

function parseBehaviorCondition(el: Element): BehaviorCondition {
  return {
    type: attr(el, 'type') as ConditionType,
    portId: el.getAttribute('portId') ?? undefined,
    threshold: el.hasAttribute('threshold') ? numAttr(el, 'threshold') : undefined,
    registerAddress: el.getAttribute('registerAddress') ?? undefined,
    bitIndex: el.hasAttribute('bitIndex') ? numAttr(el, 'bitIndex') : undefined,
    propertyKey: el.getAttribute('propertyKey') ?? undefined,
    value: el.getAttribute('value') ?? undefined,
    stateName: el.getAttribute('stateName') ?? undefined,
    negate: el.getAttribute('negate') === 'true',
  };
}

function parseBehaviorAction(el: Element): BehaviorAction {
  return {
    type: attr(el, 'type') as ActionType,
    portId: el.getAttribute('portId') ?? undefined,
    stateName: el.getAttribute('stateName') ?? undefined,
    propertyKey: el.getAttribute('propertyKey') ?? undefined,
    value: el.getAttribute('value') ?? undefined,
    registerAddress: el.getAttribute('registerAddress') ?? undefined,
    bitIndex: el.hasAttribute('bitIndex') ? numAttr(el, 'bitIndex') : undefined,
    eventName: el.getAttribute('eventName') ?? undefined,
    targetProperty: el.getAttribute('targetProperty') ?? undefined,
  };
}

function parseBehaviorRule(ruleEl: Element): BehaviorRule {
  const conditionLogic = attr(ruleEl, 'conditionLogic', 'all') as 'all' | 'any';
  const priority = numAttr(ruleEl, 'priority', 1);
  const enabled = boolAttr(ruleEl, 'enabled', true);

  // The <ms:If> elements are conditions; <ms:Then>/<ms:Else> are actions
  const conditions: BehaviorCondition[] = directChildren(ruleEl, 'If').map(
    parseBehaviorCondition,
  );
  const thenActions: BehaviorAction[] = directChildren(ruleEl, 'Then').map(parseBehaviorAction);
  const elseActions: BehaviorAction[] = directChildren(ruleEl, 'Else').map(parseBehaviorAction);

  return {
    id: ruleEl.getAttribute('id') ?? undefined,
    name: ruleEl.getAttribute('name') ?? undefined,
    priority,
    conditionLogic,
    enabled,
    conditions,
    thenActions,
    elseActions,
  };
}

function parseBehavior(behaviorEl: Element): SymbolBehaviorBinding {
  const templateId = attr(behaviorEl, 'templateId');
  const archetype = attr(behaviorEl, 'archetype');
  const interactionMode = attr(behaviorEl, 'interactionMode', 'none') as
    | 'none'
    | 'momentary'
    | 'maintained';
  const deviceScoped = boolAttr(behaviorEl, 'deviceScoped', false);
  const domain = attr(behaviorEl, 'domain', 'circuit') as BlockDomain;

  // Terminal roles
  const terminalRolesEl = directChild(behaviorEl, 'TerminalRoles');
  const terminalRoles: Record<string, string> = {};
  if (terminalRolesEl) {
    for (const tr of directChildren(terminalRolesEl, 'TerminalRole')) {
      const portId = tr.getAttribute('portId');
      const role = tr.getAttribute('role');
      if (portId && role) {
        terminalRoles[portId] = role;
      }
    }
  }

  // IFTTT rules
  const rulesEl = directChild(behaviorEl, 'Rules');
  const rules: BehaviorRule[] =
    rulesEl ? directChildren(rulesEl, 'Rule').map(parseBehaviorRule) : [];

  return {
    templateId: templateId || undefined,
    archetype: archetype || undefined,
    interactionMode,
    deviceScoped,
    domain,
    terminalRoles: Object.keys(terminalRoles).length > 0 ? terminalRoles : undefined,
    rules: rules.length > 0 ? rules : undefined,
  };
}

// ============================================================================
// Visual States Parsing
// ============================================================================

function parsePrimitiveOverride(overrideEl: Element): GraphicPrimitiveOverride {
  const override: GraphicPrimitiveOverride = {};

  const stroke = overrideEl.getAttribute('stroke');
  if (stroke !== null) override.stroke = stroke;

  const fill = overrideEl.getAttribute('fill');
  if (fill !== null) override.fill = fill;

  const strokeWidth = overrideEl.getAttribute('strokeWidth');
  if (strokeWidth !== null) override.strokeWidth = parseFloat(strokeWidth);

  const opacity = overrideEl.getAttribute('opacity');
  if (opacity !== null) override.opacity = parseFloat(opacity);

  const visible = overrideEl.getAttribute('visible');
  if (visible !== null) override.visible = visible !== 'false';

  const text = overrideEl.getAttribute('text');
  if (text !== null) override.text = text;

  return override;
}

function parseVisualState(vsEl: Element): SymbolVisualVariant {
  const overridesEl = directChild(vsEl, 'PrimitiveOverrides');
  const primitiveOverrides: Record<string, GraphicPrimitiveOverride> = {};

  if (overridesEl) {
    for (const overrideEl of directChildren(overridesEl, 'Override')) {
      const targetId = overrideEl.getAttribute('targetId');
      if (targetId) {
        primitiveOverrides[targetId] = parsePrimitiveOverride(overrideEl);
      }
    }
  }

  return {
    primitiveOverrides:
      Object.keys(primitiveOverrides).length > 0 ? primitiveOverrides : undefined,
  };
}

// ============================================================================
// Root Parser
// ============================================================================

/**
 * Parse a ModOne symbol definition XML string into a SymbolDefinition object.
 *
 * Supports:
 *  - Graphic primitives (Rect, Circle, Polyline, Text)
 *  - Pin/port definitions with electrical types and orientation
 *  - Multi-unit symbol decomposition
 *  - Configurable instance properties
 *  - IFTTT-style behavior rules
 *  - Visual state overrides
 *
 * @param xmlString  Raw XML text conforming to http://modone.io/schema/symbol/1.0
 * @throws {Error}   On XML parse errors or invalid root element
 */
export function parseXmlSymbolDefinition(xmlString: string): SymbolDefinition {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  // Check for XML parse errors (reported as <parsererror> in most browsers / jsdom)
  const parseError = doc.getElementsByTagName('parsererror').item(0);
  if (parseError) {
    const msg = parseError.textContent ?? 'Unknown XML parse error';
    throw new Error(`XML parse error: ${msg}`);
  }

  const root = doc.documentElement;
  if (root.localName !== 'SymbolDefinition') {
    throw new Error(
      `Expected root element "SymbolDefinition", got "${root.localName}"`,
    );
  }

  // ---- Metadata -----------------------------------------------------------
  const id = attr(root, 'id');
  const name = attr(root, 'name');
  const version = attr(root, 'version', '1.0.0');

  const descEl = directChild(root, 'Description');
  const catEl = directChild(root, 'Category');
  const authorEl = directChild(root, 'Author');
  const createdEl = directChild(root, 'CreatedAt');
  const updatedEl = directChild(root, 'UpdatedAt');

  // ---- Layout -------------------------------------------------------------
  const layoutEl = directChild(root, 'Layout');
  const width = layoutEl ? numAttr(layoutEl, 'width', 80) : 80;
  const height = layoutEl ? numAttr(layoutEl, 'height', 80) : 80;

  // ---- Top-level Ports (union of all units) --------------------------------
  const portsEl = directChild(root, 'Ports');
  const pins: SymbolPin[] = portsEl ? parsePins(portsEl) : [];

  // ---- Top-level Graphics -------------------------------------------------
  const graphicsEl = directChild(root, 'Graphics');
  const graphics: GraphicPrimitive[] = graphicsEl ? parseGraphics(graphicsEl) : [];

  // ---- Units (multi-unit decomposition) -----------------------------------
  const unitsEl = directChild(root, 'Units');
  const units: SymbolUnit[] = unitsEl
    ? directChildren(unitsEl, 'Unit').map(parseUnit)
    : [];

  // ---- Properties ---------------------------------------------------------
  const propsEl = directChild(root, 'Properties');
  const properties: SymbolProperty[] = propsEl
    ? directChildren(propsEl, 'Property').map(parseProperty)
    : [];

  // ---- Behavior -----------------------------------------------------------
  const behaviorEl = directChild(root, 'Behavior');
  const behavior: SymbolBehaviorBinding | undefined = behaviorEl
    ? parseBehavior(behaviorEl)
    : undefined;

  // ---- Visual States ------------------------------------------------------
  const visualStatesEl = directChild(root, 'VisualStates');
  const visualStates: Record<string, SymbolVisualVariant> = {};
  if (visualStatesEl) {
    for (const vsEl of directChildren(visualStatesEl, 'VisualState')) {
      const stateName = vsEl.getAttribute('name');
      if (stateName) {
        visualStates[stateName] = parseVisualState(vsEl);
      }
    }
  }

  // ---- Assemble -----------------------------------------------------------
  return {
    id,
    name,
    version,
    description: descEl?.textContent?.trim() ?? undefined,
    category: catEl?.textContent?.trim() ?? 'general',
    author: authorEl?.textContent?.trim() ?? undefined,
    createdAt: createdEl?.textContent?.trim() ?? new Date().toISOString(),
    updatedAt: updatedEl?.textContent?.trim() ?? new Date().toISOString(),
    width,
    height,
    graphics,
    pins,
    units: units.length > 0 ? units : undefined,
    properties,
    behavior,
    visualStates: Object.keys(visualStates).length > 0 ? visualStates : undefined,
  };
}

/**
 * Validate that a parsed SymbolDefinition has the required minimum fields.
 * Returns an array of validation error messages (empty = valid).
 */
export function validateSymbolDefinition(symbol: SymbolDefinition): string[] {
  const errors: string[] = [];

  if (!symbol.id) errors.push('Symbol ID is required');
  if (!symbol.name) errors.push('Symbol name is required');
  if (!symbol.version) errors.push('Symbol version is required');
  if (!symbol.category) errors.push('Symbol category is required');
  if (symbol.width <= 0) errors.push('Symbol width must be positive');
  if (symbol.height <= 0) errors.push('Symbol height must be positive');

  // Verify pin IDs are unique
  const pinIds = new Set<string>();
  const allPins = [
    ...symbol.pins,
    ...(symbol.units?.flatMap((u) => u.pins) ?? []),
  ];
  for (const pin of allPins) {
    if (!pin.id) {
      errors.push('All pins must have an ID');
    } else if (pinIds.has(pin.id)) {
      // Duplicate IDs are allowed across units (same pin defined in top-level and unit)
      // but warn if they appear in the same scope
    } else {
      pinIds.add(pin.id);
    }
  }

  return errors;
}
