/**
 * xmlSymbolLoader.ts
 *
 * Parses ModOne XML symbol definition files (.symbol.xml) into SymbolDefinition
 * TypeScript objects.
 *
 * Format reference: src/assets/symbol-schema/modone-symbol.xsd
 * Example:          src/assets/builtin-symbols/xml/relay.symbol.xml
 *
 * This loader is the bridge between the XML-based CAEX/AutomationML-inspired
 * symbol format and the runtime SymbolDefinition type system.
 */

import type {
  SymbolDefinition,
  SymbolPin,
  GraphicPrimitive,
  SymbolUnit,
  SymbolProperty,
  SymbolVisualVariant,
  GraphicPrimitiveOverride,
  PinElectricalType,
  PinShape,
  PinOrientation,
} from '../types/symbol';

// ---------------------------------------------------------------------------
// Namespace constant
// ---------------------------------------------------------------------------

const NS = 'http://modone.io/schema/symbol/1.0';

// ---------------------------------------------------------------------------
// Parse result
// ---------------------------------------------------------------------------

export interface XmlSymbolParseResult {
  /** Parsed symbol definition on success */
  symbol?: SymbolDefinition;
  /** Error message(s) on failure */
  errors: string[];
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

/** Get string attribute or return fallback */
function attr(el: Element, name: string, fallback = ''): string {
  return el.getAttribute(name) ?? fallback;
}

/** Get optional string attribute */
function attrOpt(el: Element, name: string): string | undefined {
  const v = el.getAttribute(name);
  return v === null || v === '' ? undefined : v;
}

/** Get numeric attribute */
function numAttr(el: Element, name: string, fallback = 0): number {
  const v = el.getAttribute(name);
  if (v === null) return fallback;
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

/** Get boolean attribute */
function boolAttr(el: Element, name: string, fallback = false): boolean {
  const v = el.getAttribute(name);
  if (v === null) return fallback;
  return v.toLowerCase() === 'true' || v === '1';
}

/**
 * Get direct child elements with given local name in the ModOne namespace.
 * Only returns *direct* children, not descendants.
 */
function childrenNS(parent: Element, localName: string): Element[] {
  const result: Element[] = [];
  for (const child of Array.from(parent.children)) {
    if (child.localName === localName && child.namespaceURI === NS) {
      result.push(child);
    }
  }
  return result;
}

/**
 * Get the first direct child element with given local name in the ModOne namespace.
 */
function firstChildNS(parent: Element, localName: string): Element | undefined {
  return childrenNS(parent, localName)[0];
}

/**
 * Get text content of the first child element with given local name.
 */
function childText(parent: Element, localName: string): string | undefined {
  const el = firstChildNS(parent, localName);
  const text = el?.textContent?.trim();
  return text || undefined;
}

// ---------------------------------------------------------------------------
// Type coercions
// ---------------------------------------------------------------------------

const ELECTRICAL_TYPE_MAP: Record<string, PinElectricalType> = {
  input: 'input',
  output: 'output',
  bidirectional: 'bidirectional',
  power: 'power',
  passive: 'passive',
  power_in: 'power',
  power_out: 'output',
};

function parseElectricalType(v: string): PinElectricalType {
  return ELECTRICAL_TYPE_MAP[v.toLowerCase()] ?? 'passive';
}

const ORIENTATION_MAP: Record<string, PinOrientation> = {
  left: 'left',
  right: 'right',
  up: 'up',
  down: 'down',
};

function parseOrientation(v: string): PinOrientation {
  return ORIENTATION_MAP[v.toLowerCase()] ?? 'left';
}

const SHAPE_MAP: Record<string, PinShape> = {
  line: 'line',
  inverted: 'inverted',
  clock: 'clock',
  inverted_clock: 'clock',
};

function parsePinShape(v: string): PinShape {
  return SHAPE_MAP[v.toLowerCase()] ?? 'line';
}

// ---------------------------------------------------------------------------
// Port (Pin) parsing
// ---------------------------------------------------------------------------

function parsePortElement(portEl: Element): SymbolPin {
  return {
    id: attr(portEl, 'id'),
    name: attr(portEl, 'name'),
    number: attr(portEl, 'number'),
    type: parseElectricalType(attr(portEl, 'electricalType', 'passive')),
    shape: parsePinShape(attr(portEl, 'shape', 'line')),
    position: {
      x: numAttr(portEl, 'x'),
      y: numAttr(portEl, 'y'),
    },
    orientation: parseOrientation(attr(portEl, 'orientation', 'left')),
    length: numAttr(portEl, 'length', 0),
    // V2 fields
    electricalType: attrOpt(portEl, 'electricalType') as SymbolPin['electricalType'],
    functionalRole: attrOpt(portEl, 'functionalRole') as SymbolPin['functionalRole'],
    sortOrder: portEl.hasAttribute('sortOrder') ? numAttr(portEl, 'sortOrder') : undefined,
    nameVisible: portEl.hasAttribute('nameVisible') ? boolAttr(portEl, 'nameVisible', true) : undefined,
    numberVisible: portEl.hasAttribute('numberVisible') ? boolAttr(portEl, 'numberVisible', true) : undefined,
    hidden: portEl.hasAttribute('hidden') ? boolAttr(portEl, 'hidden', false) : undefined,
  };
}

function parsePortsContainer(container: Element): SymbolPin[] {
  const portsEl = firstChildNS(container, 'Ports');
  if (!portsEl) return [];
  return childrenNS(portsEl, 'Port').map(parsePortElement);
}

// ---------------------------------------------------------------------------
// Graphics parsing
// ---------------------------------------------------------------------------

function parseGraphicElement(el: Element): GraphicPrimitive | null {
  const id = attrOpt(el, 'id');
  const label = attrOpt(el, 'label');
  const base = { ...(id ? { id } : {}), ...(label ? { label } : {}) };

  switch (el.localName) {
    case 'Rect': {
      return {
        ...base,
        kind: 'rect',
        x: numAttr(el, 'x'),
        y: numAttr(el, 'y'),
        width: numAttr(el, 'width'),
        height: numAttr(el, 'height'),
        stroke: attr(el, 'stroke', 'none'),
        fill: attr(el, 'fill', 'none'),
        strokeWidth: numAttr(el, 'strokeWidth', 1),
      };
    }
    case 'Circle': {
      return {
        ...base,
        kind: 'circle',
        cx: numAttr(el, 'cx'),
        cy: numAttr(el, 'cy'),
        r: numAttr(el, 'r'),
        stroke: attr(el, 'stroke', 'none'),
        fill: attr(el, 'fill', 'none'),
        strokeWidth: numAttr(el, 'strokeWidth', 1),
      };
    }
    case 'Polyline': {
      const points = childrenNS(el, 'Point').map((pt) => ({
        x: numAttr(pt, 'x'),
        y: numAttr(pt, 'y'),
      }));
      return {
        ...base,
        kind: 'polyline',
        points,
        stroke: attr(el, 'stroke', 'none'),
        fill: attr(el, 'fill', 'none'),
        strokeWidth: numAttr(el, 'strokeWidth', 1),
      };
    }
    case 'Arc': {
      return {
        ...base,
        kind: 'arc',
        cx: numAttr(el, 'cx'),
        cy: numAttr(el, 'cy'),
        r: numAttr(el, 'r'),
        startAngle: numAttr(el, 'startAngle'),
        endAngle: numAttr(el, 'endAngle'),
        stroke: attr(el, 'stroke', 'none'),
        fill: attr(el, 'fill', 'none'),
        strokeWidth: numAttr(el, 'strokeWidth', 1),
      };
    }
    case 'Text': {
      return {
        ...base,
        kind: 'text',
        x: numAttr(el, 'x'),
        y: numAttr(el, 'y'),
        text: el.textContent?.trim() ?? '',
        fontSize: numAttr(el, 'fontSize', 12),
        fontFamily: attr(el, 'fontFamily', 'Arial'),
        fill: attr(el, 'fill', '#000'),
        anchor: (attr(el, 'anchor', 'middle') as 'start' | 'middle' | 'end') || 'middle',
      };
    }
    default:
      return null;
  }
}

function parseGraphicsContainer(container: Element): GraphicPrimitive[] {
  const graphicsEl = firstChildNS(container, 'Graphics');
  if (!graphicsEl) return [];

  const result: GraphicPrimitive[] = [];
  for (const child of Array.from(graphicsEl.children)) {
    if (child.namespaceURI !== NS) continue;
    const parsed = parseGraphicElement(child);
    if (parsed !== null) {
      result.push(parsed);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Units parsing
// ---------------------------------------------------------------------------

function parseUnit(unitEl: Element): SymbolUnit {
  return {
    unitId: numAttr(unitEl, 'unitId', 1),
    name: attr(unitEl, 'name', 'Unit'),
    graphics: parseGraphicsContainer(unitEl),
    pins: parsePortsContainer(unitEl),
  };
}

function parseUnits(root: Element): SymbolUnit[] | undefined {
  const unitsEl = firstChildNS(root, 'Units');
  if (!unitsEl) return undefined;
  const units = childrenNS(unitsEl, 'Unit').map(parseUnit);
  return units.length > 0 ? units : undefined;
}

// ---------------------------------------------------------------------------
// Properties parsing
// ---------------------------------------------------------------------------

function parseProperty(propEl: Element): SymbolProperty {
  const key = attr(propEl, 'key');
  const type = attr(propEl, 'type', 'string') as SymbolProperty['type'];
  const editorType = attr(propEl, 'editorType', 'text') as SymbolProperty['editorType'];
  const visible = boolAttr(propEl, 'visible', true);

  // Parse default value
  const defaultValueText = childText(propEl, 'DefaultValue') ?? '';
  let value: string | number | boolean;
  if (type === 'number') {
    value = parseFloat(defaultValueText) || 0;
  } else if (type === 'boolean') {
    value = defaultValueText.toLowerCase() === 'true';
  } else {
    value = defaultValueText;
  }

  // Parse options for enum/select
  const optionsEl = firstChildNS(propEl, 'Options');
  const options = optionsEl
    ? childrenNS(optionsEl, 'Option').map((o) => o.textContent?.trim() ?? '')
    : undefined;

  return {
    key,
    value,
    type: type === 'enum' ? 'string' : type,
    visible,
    editorType,
    ...(options && options.length > 0 ? { options } : {}),
  };
}

function parseProperties(root: Element): SymbolProperty[] {
  const propsEl = firstChildNS(root, 'Properties');
  if (!propsEl) return [];
  return childrenNS(propsEl, 'Property').map(parseProperty);
}

// ---------------------------------------------------------------------------
// Visual states parsing
// ---------------------------------------------------------------------------

function parsePrimitiveOverride(overrideEl: Element): [string, GraphicPrimitiveOverride] {
  const targetId = attr(overrideEl, 'targetId');
  const override: GraphicPrimitiveOverride = {};

  if (overrideEl.hasAttribute('stroke')) override.stroke = attr(overrideEl, 'stroke');
  if (overrideEl.hasAttribute('fill')) override.fill = attr(overrideEl, 'fill');
  if (overrideEl.hasAttribute('strokeWidth')) override.strokeWidth = numAttr(overrideEl, 'strokeWidth');
  if (overrideEl.hasAttribute('opacity')) override.opacity = numAttr(overrideEl, 'opacity');
  if (overrideEl.hasAttribute('visible')) override.visible = boolAttr(overrideEl, 'visible');

  return [targetId, override];
}

function parseVisualStates(
  root: Element,
): Partial<Record<string, SymbolVisualVariant>> | undefined {
  const vsEl = firstChildNS(root, 'VisualStates');
  if (!vsEl) return undefined;

  const stateEls = childrenNS(vsEl, 'VisualState');
  if (stateEls.length === 0) return undefined;

  const result: Partial<Record<string, SymbolVisualVariant>> = {};

  for (const stateEl of stateEls) {
    const name = attr(stateEl, 'name');
    if (!name) continue;

    const variant: SymbolVisualVariant = {};

    // Primitive overrides
    const overridesEl = firstChildNS(stateEl, 'PrimitiveOverrides');
    if (overridesEl) {
      const overrides: Record<string, GraphicPrimitiveOverride> = {};
      for (const overrideEl of childrenNS(overridesEl, 'Override')) {
        const [id, ov] = parsePrimitiveOverride(overrideEl);
        if (id) overrides[id] = ov;
      }
      if (Object.keys(overrides).length > 0) {
        variant.primitiveOverrides = overrides;
      }
    }

    // Additional graphics
    const graphicsEls = childrenNS(stateEl, 'Graphics');
    if (graphicsEls.length > 0) {
      const graphics: GraphicPrimitive[] = [];
      for (const gEl of Array.from(graphicsEls[0].children)) {
        if (gEl.namespaceURI !== NS) continue;
        const parsed = parseGraphicElement(gEl);
        if (parsed) graphics.push(parsed);
      }
      if (graphics.length > 0) {
        variant.graphics = graphics;
      }
    }

    result[name] = variant;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

// ---------------------------------------------------------------------------
// Behavior parsing
// ---------------------------------------------------------------------------

function parseBehavior(root: Element): SymbolDefinition['behavior'] {
  const behaviorEl = firstChildNS(root, 'Behavior');
  if (!behaviorEl) return undefined;

  const templateId = attr(behaviorEl, 'templateId');
  const archetype = attrOpt(behaviorEl, 'archetype');
  const interactionMode = (attr(behaviorEl, 'interactionMode', 'none') as 'none' | 'momentary' | 'maintained') ?? 'none';
  const deviceScoped = boolAttr(behaviorEl, 'deviceScoped', false);

  // Terminal roles
  const terminalRolesEl = firstChildNS(behaviorEl, 'TerminalRoles');
  const terminalRoles: Record<string, string> = {};
  if (terminalRolesEl) {
    for (const roleEl of childrenNS(terminalRolesEl, 'TerminalRole')) {
      const portId = attr(roleEl, 'portId');
      const role = attr(roleEl, 'role');
      if (portId && role) terminalRoles[portId] = role;
    }
  }

  return {
    templateId,
    archetype,
    interactionMode,
    deviceScoped,
    ...(Object.keys(terminalRoles).length > 0 ? { terminalRoles } : {}),
  };
}

// ---------------------------------------------------------------------------
// Root document parsing
// ---------------------------------------------------------------------------

/**
 * Parse a ModOne symbol XML string into a SymbolDefinition.
 *
 * @param xmlString - The full XML string content of a .symbol.xml file
 * @returns Parse result with either the symbol definition or error messages
 */
export function parseSymbolXml(xmlString: string): XmlSymbolParseResult {
  // Parse the XML document
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return {
      errors: [`XML parse error: ${parseError.textContent?.trim()}`],
    };
  }

  const root = doc.documentElement;
  if (!root || root.localName !== 'SymbolDefinition') {
    return {
      errors: [`Expected root element 'SymbolDefinition', got: ${root?.localName ?? 'none'}`],
    };
  }

  // Validate required attributes
  const id = attr(root, 'id');
  const name = attr(root, 'name');
  const version = attr(root, 'version');

  if (!id) return { errors: ['Missing required attribute: id'] };
  if (!name) return { errors: ['Missing required attribute: name'] };
  if (!version) return { errors: ['Missing required attribute: version'] };

  // Parse layout (dimensions)
  const layoutEl = firstChildNS(root, 'Layout');
  const width = layoutEl ? numAttr(layoutEl, 'width', 60) : 60;
  const height = layoutEl ? numAttr(layoutEl, 'height', 60) : 60;

  // Parse timestamps
  const createdAt = childText(root, 'CreatedAt') ?? new Date().toISOString();
  const updatedAt = childText(root, 'UpdatedAt') ?? createdAt;

  // Build the symbol definition
  const symbol: SymbolDefinition = {
    id,
    name,
    version,
    description: childText(root, 'Description'),
    category: childText(root, 'Category') ?? 'general',
    author: childText(root, 'Author'),
    createdAt,
    updatedAt,
    width,
    height,
    graphics: parseGraphicsContainer(root),
    pins: parsePortsContainer(root),
    units: parseUnits(root),
    properties: parseProperties(root),
    behavior: parseBehavior(root),
    visualStates: parseVisualStates(root) as SymbolDefinition['visualStates'],
  };

  return { symbol, errors: [] };
}

/**
 * Parse a ModOne symbol XML string and return the symbol definition directly.
 * Throws an error if parsing fails.
 *
 * @param xmlString - The full XML string content of a .symbol.xml file
 * @returns The parsed SymbolDefinition
 */
export function parseSymbolXmlOrThrow(xmlString: string): SymbolDefinition {
  const result = parseSymbolXml(xmlString);
  if (result.errors.length > 0 || !result.symbol) {
    throw new Error(`Failed to parse symbol XML: ${result.errors.join('; ')}`);
  }
  return result.symbol;
}

/**
 * Check whether an XML string is a valid ModOne symbol definition.
 */
export function isValidSymbolXml(xmlString: string): boolean {
  const result = parseSymbolXml(xmlString);
  return result.errors.length === 0 && !!result.symbol;
}
