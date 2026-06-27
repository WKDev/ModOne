import type { GraphicPrimitive, GraphicPrimitiveOverride, SymbolProperty, SymbolUnit, SymbolVisualVariant, SymbolAnimationSpec, SymbolAnimationType, PinElectricalType, PinElectricalTypeV2, PinFunctionalRole, PinShape, PinOrientation } from "@/types/symbol";
import type { SymbolBehaviorBinding, BehaviorArchetype, BehaviorTemplateId } from "@/types/behavior";
import type { BehaviorRule, BehaviorCondition, BehaviorAction, BlockDomain, ConditionType, ActionType } from "@/types/behaviorRules";
import { NS, attr, boolAttr, childEl, childEls, childText, elText, numAttr, requiredAttr } from "./xmlDomUtils";
import type { EdgePosition, ExtendedBehaviorBinding, XmlParseIssue, XmlPort } from "./symbolXmlTypes";

// Graphic Primitives
// ============================================================================

export function parseGraphicPrimitive(
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

export function parseGraphics(
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
export function mapElectricalType(xmlType: string): PinElectricalType {
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

export function parsePort(portEl: Element, path: string, issues: XmlParseIssue[]): XmlPort {
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

export function parsePorts(portsEl: Element, path: string, issues: XmlParseIssue[]): XmlPort[] {
  return childEls(portsEl, 'Port').map((el, i) =>
    parsePort(el, `${path}/Port[${i}]`, issues),
  );
}

// ============================================================================
// Properties Parser
// ============================================================================

export function parseProperty(
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

export function parseProperties(
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

export function parseUnit(
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

export function parseUnits(
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

export function parseBehaviorCondition(el: Element): BehaviorCondition {
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

export function parseBehaviorAction(el: Element): BehaviorAction {
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

export function parseBehaviorRule(ruleEl: Element): BehaviorRule {
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

export function parseBehavior(
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

export function parsePrimitiveOverride(el: Element): GraphicPrimitiveOverride {
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

export function parseVisualStates(
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

const ANIMATION_TYPES: ReadonlySet<string> = new Set<SymbolAnimationType>([
  'rotate', 'fade-in', 'fade-out', 'blink', 'move',
]);

export function parseAnimations(
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

      if (ANIMATION_TYPES.has(type)) {
        const pivotXRaw = attr(animEl, 'pivotX');
        const pivotYRaw = attr(animEl, 'pivotY');
        const spec: SymbolAnimationSpec = {
          type: type as SymbolAnimationType,
          target,
          speed: attr(animEl, 'speed') !== undefined ? numAttr(animEl, 'speed') : undefined,
          duration: attr(animEl, 'duration') !== undefined ? numAttr(animEl, 'duration') : undefined,
          dx: attr(animEl, 'dx') !== undefined ? numAttr(animEl, 'dx') : undefined,
          dy: attr(animEl, 'dy') !== undefined ? numAttr(animEl, 'dy') : undefined,
          pivot:
            pivotXRaw !== undefined && pivotYRaw !== undefined
              ? { x: parseFloat(pivotXRaw), y: parseFloat(pivotYRaw) }
              : undefined,
        };
        specs.push(spec);
      } else {
        issues.push({
          message: `Animation type '${type}' not recognized`,
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
