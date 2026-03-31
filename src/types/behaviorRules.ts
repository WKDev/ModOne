/**
 * IFTTT-Style Behavior Rules Type System
 *
 * Defines the types for declarative behavior rules that can be specified
 * in XML symbol definitions. These rules complement the existing archetype
 * system by allowing custom blocks to define their own behavior logic.
 *
 * Domain constraints:
 *   circuit: port_powered, port_voltage_*, energize_port, block_port
 *   plc:     all circuit + register_*, bit_*
 *   annotation: no behavior rules allowed
 */

// ============================================================================
// Condition Types
// ============================================================================

export type ConditionType =
  // Circuit domain
  | 'port_powered'
  | 'port_voltage_above'
  | 'port_voltage_below'
  | 'port_current_above'
  // PLC domain (plc only)
  | 'register_equals'
  | 'register_above'
  | 'register_below'
  | 'bit_set'
  | 'bit_clear'
  // State / property
  | 'property_equals'
  | 'state_is'
  // Time / counter
  | 'timer_elapsed'
  | 'counter_reached'
  // Always / never
  | 'always'
  | 'never';

export interface BehaviorCondition {
  type: ConditionType;
  /** Port to evaluate (for port_* conditions) */
  portId?: string;
  /** Voltage/current threshold value */
  threshold?: number;
  /** PLC register address (for register/bit conditions) */
  registerAddress?: string;
  /** Bit index within register (for bit_set/bit_clear) */
  bitIndex?: number;
  /** Property key for property_equals */
  propertyKey?: string;
  /** Value to compare against */
  value?: string;
  /** State name (for state_is) */
  stateName?: string;
  /** Negate this condition */
  negate?: boolean;
}

// ============================================================================
// Action Types
// ============================================================================

export type ActionType =
  // Visual state
  | 'set_state'
  | 'clear_state'
  // Property mutation
  | 'set_property'
  // Circuit domain
  | 'energize_port'
  | 'block_port'
  // PLC domain (plc only)
  | 'write_register'
  | 'read_register'
  | 'set_bit'
  | 'clear_bit'
  // Timer
  | 'start_timer'
  | 'stop_timer'
  | 'reset_timer'
  // Counter
  | 'increment_counter'
  | 'decrement_counter'
  | 'reset_counter'
  // Event
  | 'emit_event';

export interface BehaviorAction {
  type: ActionType;
  /** Target port (for port-related actions) */
  portId?: string;
  /** State name (for set_state/clear_state) */
  stateName?: string;
  /** Property key (for set_property) */
  propertyKey?: string;
  /** Value to set/write */
  value?: string;
  /** PLC register address */
  registerAddress?: string;
  /** Bit index */
  bitIndex?: number;
  /** Event name (for emit_event) */
  eventName?: string;
  /** Target property (for read_register) */
  targetProperty?: string;
}

// ============================================================================
// Behavior Rule
// ============================================================================

export type ConditionLogic = 'all' | 'any';

export interface BehaviorRule {
  /** Optional stable identifier */
  id?: string;
  /** Human-readable rule name */
  name?: string;
  /** Evaluation priority (1 = highest) */
  priority: number;
  /** How multiple conditions are combined */
  conditionLogic: ConditionLogic;
  /** Whether this rule is active */
  enabled: boolean;
  /** Conditions (IF) */
  conditions: BehaviorCondition[];
  /** Actions when conditions are met (THEN) */
  thenActions: BehaviorAction[];
  /** Actions when conditions are NOT met (ELSE) */
  elseActions: BehaviorAction[];
}

// ============================================================================
// Block Domain
// ============================================================================

export type BlockDomain = 'circuit' | 'plc' | 'annotation';

/** PLC-domain condition types that are restricted */
export const PLC_ONLY_CONDITIONS: ReadonlySet<ConditionType> = new Set([
  'register_equals', 'register_above', 'register_below',
  'bit_set', 'bit_clear',
]);

/** PLC-domain action types that are restricted */
export const PLC_ONLY_ACTIONS: ReadonlySet<ActionType> = new Set([
  'write_register', 'read_register', 'set_bit', 'clear_bit',
]);

/**
 * Validate that a rule's conditions and actions are compatible with its domain.
 */
export function validateRuleDomain(rule: BehaviorRule, domain: BlockDomain): string[] {
  const errors: string[] = [];
  if (domain === 'annotation') {
    errors.push('Annotation blocks cannot have behavior rules');
    return errors;
  }
  if (domain === 'circuit') {
    for (const c of rule.conditions) {
      if (PLC_ONLY_CONDITIONS.has(c.type)) {
        errors.push(`Condition "${c.type}" requires domain="plc" (found domain="circuit")`);
      }
    }
    for (const a of [...rule.thenActions, ...rule.elseActions]) {
      if (PLC_ONLY_ACTIONS.has(a.type)) {
        errors.push(`Action "${a.type}" requires domain="plc" (found domain="circuit")`);
      }
    }
  }
  return errors;
}
