/**
 * IFTTT-Style Behavior Rule Engine
 *
 * Evaluates declarative behavior rules defined in XML symbol definitions.
 * Runs alongside the existing archetype-based system — archetype blocks
 * use the hardcoded templates, custom blocks use this rule engine.
 *
 * Integration point: called from circuitSimulator.ts after power propagation
 * to derive visual states and port conductance for rule-based blocks.
 */
import type {
  BehaviorRule,
  BehaviorCondition,
  BehaviorAction,
  BlockDomain,
} from '../../../types/behaviorRules';
import type {
  BehaviorVisualState,
  BlockRuntimeState,
  RuntimeState,
} from '../../../types/behavior';
import type { Block } from '../types';

// ============================================================================
// Evaluation Context
// ============================================================================

/** Context available to the rule engine during evaluation */
export interface RuleEvalContext {
  /** The block being evaluated */
  block: Block;
  /** Block's current properties */
  properties: Record<string, unknown>;
  /** Block's current runtime state */
  runtimeState: BlockRuntimeState;
  /** Set of port IDs that are currently powered (receiving voltage) */
  poweredPorts: ReadonlySet<string>;
  /** Port voltage values (portId → volts) */
  portVoltages: ReadonlyMap<string, number>;
  /** Current visual state name (if any) */
  currentVisualState?: BehaviorVisualState;
  /** Global runtime state (PLC outputs, button states, etc.) */
  globalRuntime: RuntimeState;
  /** Block domain for access control */
  domain: BlockDomain;
}

// ============================================================================
// Rule Evaluation Result
// ============================================================================

export interface RuleEvalResult {
  /** Visual states to set */
  setStates: Set<string>;
  /** Visual states to clear */
  clearStates: Set<string>;
  /** Property mutations */
  propertyUpdates: Record<string, string>;
  /** Ports to energize (conduct power) */
  energizePorts: Set<string>;
  /** Ports to block (stop power) */
  blockPorts: Set<string>;
  /** Events emitted */
  emittedEvents: string[];
}

function createEmptyResult(): RuleEvalResult {
  return {
    setStates: new Set(),
    clearStates: new Set(),
    propertyUpdates: {},
    energizePorts: new Set(),
    blockPorts: new Set(),
    emittedEvents: [],
  };
}

// ============================================================================
// Condition Evaluation
// ============================================================================

function evaluateCondition(cond: BehaviorCondition, ctx: RuleEvalContext): boolean {
  let result: boolean;

  switch (cond.type) {
    case 'always':
      result = true;
      break;

    case 'never':
      result = false;
      break;

    case 'port_powered':
      result = cond.portId ? ctx.poweredPorts.has(cond.portId) : false;
      break;

    case 'port_voltage_above': {
      const voltage = cond.portId ? ctx.portVoltages.get(cond.portId) ?? 0 : 0;
      result = voltage >= (cond.threshold ?? 0);
      break;
    }

    case 'port_voltage_below': {
      const voltage = cond.portId ? ctx.portVoltages.get(cond.portId) ?? 0 : 0;
      result = voltage < (cond.threshold ?? 0);
      break;
    }

    case 'port_current_above':
      // Current sensing not yet implemented in circuit sim
      result = false;
      break;

    case 'property_equals':
      if (cond.propertyKey) {
        const propVal = String(ctx.properties[cond.propertyKey] ?? '');
        result = propVal === (cond.value ?? '');
      } else {
        result = false;
      }
      break;

    case 'state_is':
      result = ctx.currentVisualState === cond.stateName;
      break;

    case 'timer_elapsed':
      // Timer state tracked in runtimeState
      result = ctx.runtimeState['_timer_done'] === true;
      break;

    case 'counter_reached': {
      const current = Number(ctx.runtimeState['_counter_value'] ?? 0);
      const preset = Number(ctx.properties['preset'] ?? 0);
      result = current >= preset;
      break;
    }

    // PLC-only conditions
    case 'register_equals':
    case 'register_above':
    case 'register_below':
    case 'bit_set':
    case 'bit_clear':
      if (ctx.domain !== 'plc') {
        result = false;
        break;
      }
      result = evaluatePlcCondition(cond, ctx);
      break;

    default:
      result = false;
  }

  return cond.negate ? !result : result;
}

function evaluatePlcCondition(cond: BehaviorCondition, ctx: RuleEvalContext): boolean {
  // PLC register/bit conditions would integrate with the PLC runtime
  // For now, check if the block has a PLC address and evaluate via plcOutputs
  const addr = cond.registerAddress;
  if (!addr) return false;

  // Simple boolean PLC output check (coil address)
  // Full register access requires integration with CanonicalRuntimeFacade
  switch (cond.type) {
    case 'bit_set': {
      // Check if a PLC coil output is set
      const addrNum = parseInt(addr, 16);
      return ctx.globalRuntime.plcOutputs.get(addrNum) === true;
    }
    case 'bit_clear': {
      const addrNum = parseInt(addr, 16);
      return ctx.globalRuntime.plcOutputs.get(addrNum) !== true;
    }
    case 'register_equals':
      return false; // Requires word register access
    case 'register_above':
      return false;
    case 'register_below':
      return false;
    default:
      return false;
  }
}

// ============================================================================
// Action Execution
// ============================================================================

function executeAction(action: BehaviorAction, result: RuleEvalResult): void {
  switch (action.type) {
    case 'set_state':
      if (action.stateName) result.setStates.add(action.stateName);
      break;

    case 'clear_state':
      if (action.stateName) result.clearStates.add(action.stateName);
      break;

    case 'set_property':
      if (action.propertyKey && action.value !== undefined) {
        result.propertyUpdates[action.propertyKey] = action.value;
      }
      break;

    case 'energize_port':
      if (action.portId) result.energizePorts.add(action.portId);
      break;

    case 'block_port':
      if (action.portId) result.blockPorts.add(action.portId);
      break;

    case 'emit_event':
      if (action.eventName) result.emittedEvents.push(action.eventName);
      break;

    // PLC write actions — these would be forwarded to the PLC runtime
    case 'write_register':
    case 'set_bit':
    case 'clear_bit':
    case 'read_register':
      // TODO: Integrate with CanonicalRuntimeFacade for PLC register access
      break;

    // Timer/counter actions — update runtime state
    case 'start_timer':
    case 'stop_timer':
    case 'reset_timer':
    case 'increment_counter':
    case 'decrement_counter':
    case 'reset_counter':
      // Timer/counter state management handled by the simulation engine
      break;
  }
}

// ============================================================================
// Main Engine
// ============================================================================

/**
 * Evaluate all behavior rules for a block and return the combined result.
 * Rules are evaluated in priority order (lower number = higher priority).
 */
export function evaluateBehaviorRules(
  rules: BehaviorRule[],
  ctx: RuleEvalContext,
): RuleEvalResult {
  const result = createEmptyResult();

  // Sort by priority (lower = higher priority)
  const sorted = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    const conditionsMet = evaluateRuleConditions(rule, ctx);

    if (conditionsMet) {
      for (const action of rule.thenActions) {
        executeAction(action, result);
      }
    } else {
      for (const action of rule.elseActions) {
        executeAction(action, result);
      }
    }
  }

  return result;
}

function evaluateRuleConditions(rule: BehaviorRule, ctx: RuleEvalContext): boolean {
  if (rule.conditions.length === 0) return true;

  if (rule.conditionLogic === 'any') {
    return rule.conditions.some((c) => evaluateCondition(c, ctx));
  }
  // 'all' (default)
  return rule.conditions.every((c) => evaluateCondition(c, ctx));
}

/**
 * Derive the primary visual state from a rule evaluation result.
 * Prefers set_state over clear_state. Returns the first set state.
 */
export function deriveVisualStateFromRules(
  result: RuleEvalResult,
  fallback: BehaviorVisualState = 'idle',
): BehaviorVisualState {
  // States that were set but not cleared
  for (const s of result.setStates) {
    if (!result.clearStates.has(s)) {
      return s as BehaviorVisualState;
    }
  }
  return fallback;
}

/**
 * Check if a port should conduct based on rule evaluation.
 * If a port is in both energize and block sets, block wins (safety).
 */
export function shouldPortConduct(result: RuleEvalResult, portId: string): boolean | undefined {
  if (result.blockPorts.has(portId)) return false;
  if (result.energizePorts.has(portId)) return true;
  return undefined; // No rule affected this port
}
