/**
 * IFTTT XML / CAEX Parser
 *
 * Parses the <ms:Behavior> element from ModOne Symbol XML (modone-symbol.xsd)
 * into strongly-typed BehaviorBinding / IftttRule data structures.
 *
 * Design references:
 *   - modone-symbol.xsd — BehaviorType, BehaviorRuleType, BehaviorConditionType,
 *                          BehaviorActionType, TerminalRoleType
 *   - AutomationML / IEC 62714 CAEX — SupportedRoleClass + MappingObject
 *   - relay.symbol.xml  — reference implementation
 *
 * Parsing strategy:
 *   Browser / Tauri WebView: uses the built-in DOMParser (XML mode).
 *   Node/test environments: falls back to a lightweight regex-free attribute
 *   extraction approach over the already-parsed XMLDocument.
 *
 * Error handling:
 *   - Unknown enum values → logged warning, field omitted / defaulted
 *   - Missing required attributes → logged warning, rule/condition/action skipped
 *   - Domain violations in parsed data → logged warning (not an error;
 *     the engine enforces at evaluation time)
 *
 * @module engine/iftttXmlParser
 */

import type {
  Action,
  ActionType,
  BehaviorBinding,
  BehaviorTemplateId,
  BlockDomain,
  Condition,
  ConditionLogic,
  ConditionType,
  IftttRule,
  InteractionMode,
  RawActionXml,
  RawBehaviorXml,
  RawConditionXml,
  RawRuleXml,
  TerminalRoleMapping,
} from '../types/ifttt';

// ── XSD namespace used in ModOne symbol XML ────────────────────────────────
const MS_NS = 'http://modone.io/schema/symbol/1.0';

// ============================================================================
// VALID ENUM SETS (mirrors XSD simple type restrictions)
// ============================================================================

const VALID_CONDITION_TYPES = new Set<ConditionType>([
  'port_powered', 'port_voltage_above', 'port_voltage_below', 'port_current_above',
  'register_equals', 'register_above', 'register_below', 'bit_set', 'bit_clear',
  'property_equals', 'state_is', 'timer_elapsed', 'counter_reached',
  'always', 'never',
]);

const VALID_ACTION_TYPES = new Set<ActionType>([
  'set_state', 'clear_state', 'set_property',
  'energize_port', 'block_port',
  'write_register', 'read_register', 'set_bit', 'clear_bit',
  'start_timer', 'stop_timer', 'reset_timer',
  'increment_counter', 'decrement_counter', 'reset_counter',
  'emit_event',
]);

const VALID_INTERACTION_MODES = new Set<InteractionMode>(['none', 'click', 'toggle', 'drag']);
const VALID_DOMAINS = new Set<BlockDomain>(['circuit', 'plc', 'annotation']);
const VALID_CONDITION_LOGIC = new Set<ConditionLogic>(['all', 'any']);

// ============================================================================
// DOM HELPERS
// ============================================================================

/**
 * Gets all direct child elements with a given local name in the given namespace.
 */
function childElements(parent: Element, localName: string, ns = MS_NS): Element[] {
  return Array.from(parent.children).filter(
    (el) => el.localName === localName && (el.namespaceURI === ns || !el.namespaceURI)
  );
}

/**
 * Gets an attribute value; returns undefined if missing or empty.
 */
function attr(el: Element, name: string): string | undefined {
  const val = el.getAttribute(name);
  return val !== null && val !== '' ? val : undefined;
}

// ============================================================================
// RAW → TYPED COERCIONS
// ============================================================================

function parseConditionType(raw: string | undefined): ConditionType | undefined {
  if (!raw) return undefined;
  if (VALID_CONDITION_TYPES.has(raw as ConditionType)) return raw as ConditionType;
  console.warn(`[IftttXmlParser] Unknown condition type "${raw}" — skipping condition.`);
  return undefined;
}

function parseActionType(raw: string | undefined): ActionType | undefined {
  if (!raw) return undefined;
  if (VALID_ACTION_TYPES.has(raw as ActionType)) return raw as ActionType;
  console.warn(`[IftttXmlParser] Unknown action type "${raw}" — skipping action.`);
  return undefined;
}

function parseInteractionMode(raw: string | undefined): InteractionMode {
  if (raw && VALID_INTERACTION_MODES.has(raw as InteractionMode)) return raw as InteractionMode;
  return 'none';
}

function parseDomain(raw: string | undefined): BlockDomain | undefined {
  if (raw && VALID_DOMAINS.has(raw as BlockDomain)) return raw as BlockDomain;
  return undefined;
}

function parseConditionLogic(raw: string | undefined): ConditionLogic {
  if (raw && VALID_CONDITION_LOGIC.has(raw as ConditionLogic)) return raw as ConditionLogic;
  return 'all';
}

function parseBoolean(raw: string | undefined, defaultVal = false): boolean {
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return defaultVal;
}

function parsePositiveInt(raw: string | undefined, defaultVal: number): number {
  if (!raw) return defaultVal;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultVal;
}

// ============================================================================
// RAW CONDITION PARSING
// ============================================================================

/** Extracts a raw condition from an <If> element */
function parseRawCondition(el: Element): RawConditionXml {
  return {
    type:            attr(el, 'type') ?? '',
    portId:          attr(el, 'portId'),
    threshold:       attr(el, 'threshold'),
    registerAddress: attr(el, 'registerAddress'),
    bitIndex:        attr(el, 'bitIndex'),
    propertyKey:     attr(el, 'propertyKey'),
    value:           attr(el, 'value'),
    stateName:       attr(el, 'stateName'),
    negate:          attr(el, 'negate'),
  };
}

/** Converts a RawConditionXml into a typed Condition */
function coerceCondition(raw: RawConditionXml): Condition | null {
  const type = parseConditionType(raw.type);
  if (!type) return null;

  return {
    type,
    portId:          raw.portId,
    threshold:       raw.threshold !== undefined ? Number(raw.threshold) : undefined,
    registerAddress: raw.registerAddress,
    bitIndex:        raw.bitIndex !== undefined ? parseInt(raw.bitIndex, 10) : undefined,
    propertyKey:     raw.propertyKey,
    value:           raw.value,
    stateName:       raw.stateName,
    negate:          parseBoolean(raw.negate, false),
  };
}

// ============================================================================
// RAW ACTION PARSING
// ============================================================================

/** Extracts a raw action from a <Then> or <Else> element */
function parseRawAction(el: Element): RawActionXml {
  return {
    type:            attr(el, 'type') ?? '',
    stateName:       attr(el, 'stateName'),
    portId:          attr(el, 'portId'),
    propertyKey:     attr(el, 'propertyKey'),
    value:           attr(el, 'value'),
    registerAddress: attr(el, 'registerAddress'),
    bitIndex:        attr(el, 'bitIndex'),
    targetProperty:  attr(el, 'targetProperty'),
    eventName:       attr(el, 'eventName'),
  };
}

/** Converts a RawActionXml into a typed Action */
function coerceAction(raw: RawActionXml): Action | null {
  const type = parseActionType(raw.type);
  if (!type) return null;

  return {
    type,
    stateName:       raw.stateName,
    portId:          raw.portId,
    propertyKey:     raw.propertyKey,
    value:           raw.value,
    registerAddress: raw.registerAddress,
    bitIndex:        raw.bitIndex !== undefined ? parseInt(raw.bitIndex, 10) : undefined,
    targetProperty:  raw.targetProperty,
    eventName:       raw.eventName,
  };
}

// ============================================================================
// RAW RULE PARSING
// ============================================================================

/** Extracts a raw rule from a <Rule> element */
function parseRawRule(el: Element): RawRuleXml {
  return {
    id:             attr(el, 'id') ?? `rule_${Math.random().toString(36).slice(2, 8)}`,
    name:           attr(el, 'name'),
    priority:       attr(el, 'priority'),
    conditionLogic: attr(el, 'conditionLogic'),
    enabled:        attr(el, 'enabled'),
    conditions:     childElements(el, 'If').map(parseRawCondition),
    thenActions:    childElements(el, 'Then').map(parseRawAction),
    elseActions:    childElements(el, 'Else').map(parseRawAction),
  };
}

/** Converts a RawRuleXml into a typed IftttRule */
function coerceRule(raw: RawRuleXml): IftttRule | null {
  if (raw.conditions.length === 0) {
    console.warn(`[IftttXmlParser] Rule "${raw.id}" has no conditions — skipping.`);
    return null;
  }
  if (raw.thenActions.length === 0) {
    console.warn(`[IftttXmlParser] Rule "${raw.id}" has no Then actions — skipping.`);
    return null;
  }

  const conditions = raw.conditions.map(coerceCondition).filter((c): c is Condition => c !== null);
  const thenActions = raw.thenActions.map(coerceAction).filter((a): a is Action => a !== null);
  const elseActions = raw.elseActions.map(coerceAction).filter((a): a is Action => a !== null);

  if (conditions.length === 0) {
    console.warn(`[IftttXmlParser] Rule "${raw.id}" had only invalid conditions — skipping.`);
    return null;
  }

  return {
    id:             raw.id,
    name:           raw.name ?? raw.id,
    priority:       parsePositiveInt(raw.priority, 1),
    conditionLogic: parseConditionLogic(raw.conditionLogic),
    enabled:        parseBoolean(raw.enabled, true),
    conditions,
    thenActions,
    elseActions,
  };
}

// ============================================================================
// BEHAVIOR ELEMENT PARSING
// ============================================================================

/**
 * Parses a <ms:Behavior> XML element into a RawBehaviorXml.
 *
 * @param behaviorEl The <ms:Behavior> DOM element
 * @returns          Loosely-typed raw behavior data
 */
function parseBehaviorElementRaw(behaviorEl: Element): RawBehaviorXml {
  // Parse TerminalRoles
  const terminalRolesContainer = childElements(behaviorEl, 'TerminalRoles')[0];
  const terminalRoles = terminalRolesContainer
    ? childElements(terminalRolesContainer, 'TerminalRole').map((el) => ({
        portId: attr(el, 'portId') ?? '',
        role:   attr(el, 'role') ?? '',
      }))
    : [];

  // Parse Rules
  const rulesContainer = childElements(behaviorEl, 'Rules')[0];
  const rules = rulesContainer
    ? childElements(rulesContainer, 'Rule').map(parseRawRule)
    : [];

  return {
    templateId:      attr(behaviorEl, 'templateId'),
    archetype:       attr(behaviorEl, 'archetype'),
    interactionMode: attr(behaviorEl, 'interactionMode'),
    deviceScoped:    attr(behaviorEl, 'deviceScoped'),
    domain:          attr(behaviorEl, 'domain'),
    terminalRoles,
    rules,
  };
}

/**
 * Converts a RawBehaviorXml into a strongly-typed BehaviorBinding.
 */
function coerceBehavior(raw: RawBehaviorXml): BehaviorBinding {
  const terminalRoles = raw.terminalRoles
    .map((r) => (r.portId && r.role ? ({ portId: r.portId, role: r.role } as TerminalRoleMapping) : null))
    .filter((r): r is TerminalRoleMapping => r !== null);

  const rules = raw.rules
    .map(coerceRule)
    .filter((r): r is IftttRule => r !== null);

  return {
    templateId:      raw.templateId as BehaviorTemplateId | undefined,
    archetype:       raw.archetype,
    interactionMode: parseInteractionMode(raw.interactionMode),
    deviceScoped:    parseBoolean(raw.deviceScoped, false),
    domain:          parseDomain(raw.domain),
    terminalRoles,
    rules,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Parses the <ms:Behavior> element from a parsed SymbolDefinition XML document.
 *
 * @param doc        The XML Document produced by DOMParser from a .symbol.xml file
 * @returns          Typed BehaviorBinding, or null if no <Behavior> element found
 */
export function parseBehaviorFromDocument(doc: Document): BehaviorBinding | null {
  // The root may be <ms:SymbolDefinition> — look for Behavior anywhere
  const behaviorEl =
    doc.getElementsByTagNameNS(MS_NS, 'Behavior')[0] ??
    doc.getElementsByTagName('Behavior')[0] ??
    null;

  if (!behaviorEl) return null;

  const raw = parseBehaviorElementRaw(behaviorEl);
  return coerceBehavior(raw);
}

/**
 * Parses a <ms:Behavior> element that is already in hand (e.g., obtained via
 * querySelector from a larger composite document).
 *
 * @param behaviorEl The <ms:Behavior> DOM element
 * @returns          Typed BehaviorBinding
 */
export function parseBehaviorFromElement(behaviorEl: Element): BehaviorBinding {
  const raw = parseBehaviorElementRaw(behaviorEl);
  return coerceBehavior(raw);
}

/**
 * Parses a symbol XML string directly.
 *
 * @param xmlString Raw XML text of a .symbol.xml file
 * @returns         Typed BehaviorBinding, or null if no <Behavior> element found
 */
export function parseBehaviorFromXmlString(xmlString: string): BehaviorBinding | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  // Check for parse errors (Firefox style)
  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    console.error('[IftttXmlParser] XML parse error:', parseError.textContent);
    return null;
  }

  return parseBehaviorFromDocument(doc);
}

/**
 * Parses ALL <ms:Rule> elements within a <ms:Rules> container element into
 * typed IftttRule objects. Useful for incremental rule editing in the Symbol Editor.
 *
 * @param rulesEl The <ms:Rules> DOM element
 * @returns       Array of valid typed IftttRule objects (invalid rules omitted)
 */
export function parseRulesFromElement(rulesEl: Element): IftttRule[] {
  return childElements(rulesEl, 'Rule')
    .map(parseRawRule)
    .map(coerceRule)
    .filter((r): r is IftttRule => r !== null);
}

/**
 * Parses a single <ms:Rule> element into a typed IftttRule.
 *
 * @param ruleEl The <ms:Rule> DOM element
 * @returns      Typed IftttRule or null if invalid
 */
export function parseRuleFromElement(ruleEl: Element): IftttRule | null {
  return coerceRule(parseRawRule(ruleEl));
}

/**
 * Serialises a BehaviorBinding back to XML string (for saving user-defined rules).
 *
 * Produces a <ms:Behavior> element with all attributes and nested children,
 * ready to be embedded in a .symbol.xml file.
 *
 * @param binding   The BehaviorBinding to serialise
 * @param nsPrefix  XML namespace prefix (default: 'ms')
 * @returns         XML string fragment (not a full document)
 */
export function serialiseBehaviorToXml(
  binding: BehaviorBinding,
  nsPrefix = 'ms'
): string {
  const p = nsPrefix ? `${nsPrefix}:` : '';

  const attrs: string[] = [];
  if (binding.templateId) attrs.push(`templateId="${escapeXml(binding.templateId)}"`);
  if (binding.archetype) attrs.push(`archetype="${escapeXml(binding.archetype)}"`);
  attrs.push(`interactionMode="${binding.interactionMode}"`);
  attrs.push(`deviceScoped="${binding.deviceScoped}"`);
  if (binding.domain) attrs.push(`domain="${binding.domain}"`);

  const lines: string[] = [`<${p}Behavior ${attrs.join(' ')}>`];

  // TerminalRoles
  if (binding.terminalRoles.length > 0) {
    lines.push(`  <${p}TerminalRoles>`);
    for (const tr of binding.terminalRoles) {
      lines.push(
        `    <${p}TerminalRole portId="${escapeXml(tr.portId)}" role="${escapeXml(tr.role)}"/>`
      );
    }
    lines.push(`  </${p}TerminalRoles>`);
  }

  // Rules
  if (binding.rules.length > 0) {
    lines.push(`  <${p}Rules>`);
    for (const rule of binding.rules) {
      lines.push(...serialiseRule(rule, p, '    '));
    }
    lines.push(`  </${p}Rules>`);
  }

  lines.push(`</${p}Behavior>`);
  return lines.join('\n');
}

// ── Internal XML serialisation helpers ─────────────────────────────────────

function serialiseRule(rule: IftttRule, p: string, indent: string): string[] {
  const attrs = [
    `id="${escapeXml(rule.id)}"`,
    `name="${escapeXml(rule.name)}"`,
    `priority="${rule.priority}"`,
    `conditionLogic="${rule.conditionLogic}"`,
    `enabled="${rule.enabled}"`,
  ];
  const lines: string[] = [`${indent}<${p}Rule ${attrs.join(' ')}>`];

  for (const cond of rule.conditions) {
    lines.push(serialiseCondition(cond, p, indent + '  '));
  }
  for (const action of rule.thenActions) {
    lines.push(serialiseAction(action, 'Then', p, indent + '  '));
  }
  for (const action of rule.elseActions) {
    lines.push(serialiseAction(action, 'Else', p, indent + '  '));
  }

  lines.push(`${indent}</${p}Rule>`);
  return lines;
}

function serialiseCondition(cond: Condition, p: string, indent: string): string {
  const attrs: string[] = [`type="${cond.type}"`];
  if (cond.portId)          attrs.push(`portId="${escapeXml(cond.portId)}"`);
  if (cond.threshold !== undefined) attrs.push(`threshold="${cond.threshold}"`);
  if (cond.registerAddress) attrs.push(`registerAddress="${escapeXml(cond.registerAddress)}"`);
  if (cond.bitIndex !== undefined) attrs.push(`bitIndex="${cond.bitIndex}"`);
  if (cond.propertyKey)     attrs.push(`propertyKey="${escapeXml(cond.propertyKey)}"`);
  if (cond.value !== undefined) attrs.push(`value="${escapeXml(cond.value)}"`);
  if (cond.stateName)       attrs.push(`stateName="${escapeXml(cond.stateName)}"`);
  if (cond.negate)          attrs.push(`negate="true"`);
  return `${indent}<${p}If ${attrs.join(' ')}/>`;
}

function serialiseAction(action: Action, tag: 'Then' | 'Else', p: string, indent: string): string {
  const attrs: string[] = [`type="${action.type}"`];
  if (action.stateName)       attrs.push(`stateName="${escapeXml(action.stateName)}"`);
  if (action.portId)          attrs.push(`portId="${escapeXml(action.portId)}"`);
  if (action.propertyKey)     attrs.push(`propertyKey="${escapeXml(action.propertyKey)}"`);
  if (action.value !== undefined) attrs.push(`value="${escapeXml(String(action.value))}"`);
  if (action.registerAddress) attrs.push(`registerAddress="${escapeXml(action.registerAddress)}"`);
  if (action.bitIndex !== undefined) attrs.push(`bitIndex="${action.bitIndex}"`);
  if (action.targetProperty)  attrs.push(`targetProperty="${escapeXml(action.targetProperty)}"`);
  if (action.eventName)       attrs.push(`eventName="${escapeXml(action.eventName)}"`);
  return `${indent}<${p}${tag} ${attrs.join(' ')}/>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================================================
// SCHEMA VALIDATION HELPERS
// ============================================================================

/** Domain-validates a BehaviorBinding's rules and returns a list of violations */
export interface ValidationViolation {
  ruleId: string;
  itemType: 'condition' | 'action';
  itemKind: string;
  domain: BlockDomain;
  message: string;
}

/**
 * Validates that all conditions and actions in a BehaviorBinding are
 * compatible with the given symbol domain. Returns an array of violations
 * (empty array = valid).
 *
 * This is called by the Symbol Editor to show real-time feedback when
 * a user assigns cross-domain operations.
 */
export function validateBehaviorDomain(
  binding: BehaviorBinding,
  symbolDomain: BlockDomain
): ValidationViolation[] {
  // Import helpers lazily to avoid circular imports in testing
  const { isConditionAllowedInDomain, isActionAllowedInDomain } =
    require('../types/ifttt') as typeof import('../types/ifttt');

  const violations: ValidationViolation[] = [];
  const effectiveDomain = binding.domain ?? symbolDomain;

  for (const rule of binding.rules) {
    for (const cond of rule.conditions) {
      if (!isConditionAllowedInDomain(cond.type, effectiveDomain)) {
        violations.push({
          ruleId:   rule.id,
          itemType: 'condition',
          itemKind: cond.type,
          domain:   effectiveDomain,
          message:  `Condition "${cond.type}" is not allowed in domain "${effectiveDomain}"`,
        });
      }
    }
    for (const action of [...rule.thenActions, ...rule.elseActions]) {
      if (!isActionAllowedInDomain(action.type, effectiveDomain)) {
        violations.push({
          ruleId:   rule.id,
          itemType: 'action',
          itemKind: action.type,
          domain:   effectiveDomain,
          message:  `Action "${action.type}" is not allowed in domain "${effectiveDomain}"`,
        });
      }
    }
  }

  return violations;
}
