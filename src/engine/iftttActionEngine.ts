/**
 * IFTTT Action Engine
 *
 * Stateless evaluation engine for IFTTT-style symbol behavior rules.
 * Each simulation tick, the engine:
 *   1. Evaluates all conditions for each rule in priority order
 *   2. Collects MutationEffects from Then / Else action branches
 *   3. Returns the effects without applying them (caller applies atomically)
 *
 * Domain enforcement is applied per-condition and per-action.
 * Cross-domain violations produce console warnings and are skipped silently.
 *
 * Design references:
 *   - AutomationML / IEC 62714 CAEX — BehaviorRuleType evaluation
 *   - IFTTT paradigm — trigger-action binding
 *
 * @module engine/iftttActionEngine
 */

import type {
  ActionBlock,
  Action,
  ActionType,
  BlockEvaluationResult,
  Condition,
  ConditionType,
  IIftttActionEngine,
  IftttRule,
  MutationEffect,
  RuleEvaluationResult,
  SimulationContext,
} from '../types/ifttt';
import {
  createEmptyMutationEffect,
  isActionAllowedInDomain,
  isConditionAllowedInDomain,
  mergeMutationEffects,
} from '../types/ifttt';

// ============================================================================
// CONDITION EVALUATORS
// Each evaluator receives the condition spec + context and returns boolean.
// ============================================================================

type ConditionEvaluator = (
  cond: Condition,
  block: ActionBlock,
  ctx: SimulationContext
) => boolean;

const CONDITION_EVALUATORS: Record<ConditionType, ConditionEvaluator> = {
  // ── Circuit ────────────────────────────────────────────────────────────────
  port_powered(cond, block, ctx) {
    if (!cond.portId) return false;
    return ctx.portPower.get(block.blockId)?.get(cond.portId) ?? false;
  },

  port_voltage_above(cond, block, ctx) {
    if (!cond.portId || cond.threshold === undefined) return false;
    const voltage = ctx.portVoltage.get(block.blockId)?.get(cond.portId) ?? 0;
    return voltage >= cond.threshold;
  },

  port_voltage_below(cond, block, ctx) {
    if (!cond.portId || cond.threshold === undefined) return false;
    const voltage = ctx.portVoltage.get(block.blockId)?.get(cond.portId) ?? 0;
    return voltage < cond.threshold;
  },

  port_current_above(cond, block, ctx) {
    if (!cond.portId || cond.threshold === undefined) return false;
    const current = ctx.portCurrent.get(block.blockId)?.get(cond.portId) ?? 0;
    return current >= cond.threshold;
  },

  // ── PLC ────────────────────────────────────────────────────────────────────
  register_equals(cond, _block, ctx) {
    if (!cond.registerAddress || cond.value === undefined) return false;
    const regVal = ctx.registers.get(cond.registerAddress) ?? 0;
    return regVal === Number(cond.value);
  },

  register_above(cond, _block, ctx) {
    if (!cond.registerAddress || cond.value === undefined) return false;
    const regVal = ctx.registers.get(cond.registerAddress) ?? 0;
    return regVal > Number(cond.value);
  },

  register_below(cond, _block, ctx) {
    if (!cond.registerAddress || cond.value === undefined) return false;
    const regVal = ctx.registers.get(cond.registerAddress) ?? 0;
    return regVal < Number(cond.value);
  },

  bit_set(cond, _block, ctx) {
    if (!cond.registerAddress || cond.bitIndex === undefined) return false;
    const key = `${cond.registerAddress}.${cond.bitIndex}`;
    return ctx.bits.get(key) ?? false;
  },

  bit_clear(cond, _block, ctx) {
    if (!cond.registerAddress || cond.bitIndex === undefined) return false;
    const key = `${cond.registerAddress}.${cond.bitIndex}`;
    return !(ctx.bits.get(key) ?? false);
  },

  // ── State / Property ───────────────────────────────────────────────────────
  property_equals(cond, block, ctx) {
    if (!cond.propertyKey || cond.value === undefined) return false;
    const props = ctx.blockProperties.get(block.blockId) ?? block.properties;
    const rawProp = props[cond.propertyKey];
    return String(rawProp) === cond.value;
  },

  state_is(cond, block, ctx) {
    if (!cond.stateName) return false;
    const states = ctx.blockActiveStates.get(block.blockId) ?? block.activeStates;
    return states.has(cond.stateName);
  },

  // ── Timer / Counter ────────────────────────────────────────────────────────
  timer_elapsed(cond, block, ctx) {
    // Timer is considered elapsed when it is NOT running (has fired / reset)
    // Caller may also check timerValues if a threshold is needed.
    const isRunning = ctx.timerRunning.get(block.blockId) ?? false;
    if (cond.threshold !== undefined) {
      const elapsed = ctx.timerValues.get(block.blockId) ?? 0;
      return elapsed >= cond.threshold;
    }
    return !isRunning && (ctx.timerValues.get(block.blockId) ?? 0) > 0;
  },

  counter_reached(cond, block, ctx) {
    const count = ctx.counterValues.get(block.blockId) ?? 0;
    const preset = cond.threshold ?? 0;
    return count >= preset;
  },

  // ── Sentinel ───────────────────────────────────────────────────────────────
  always() {
    return true;
  },

  never() {
    return false;
  },
};

// ============================================================================
// ACTION EXECUTORS
// Each executor builds and appends MutationEffects; does NOT mutate state.
// ============================================================================

type ActionExecutor = (
  action: Action,
  block: ActionBlock,
  effect: MutationEffect
) => void;

const ACTION_EXECUTORS: Record<ActionType, ActionExecutor> = {
  // ── Visual state ──────────────────────────────────────────────────────────
  set_state(action, block, effect) {
    if (!action.stateName) return;
    effect.stateChanges.push({ blockId: block.blockId, stateName: action.stateName, active: true });
  },

  clear_state(action, block, effect) {
    if (!action.stateName) return;
    effect.stateChanges.push({ blockId: block.blockId, stateName: action.stateName, active: false });
  },

  // ── Property ─────────────────────────────────────────────────────────────
  set_property(action, block, effect) {
    if (!action.propertyKey || action.value === undefined) return;
    // Coerce value to the current property type if possible
    const currentVal = block.properties[action.propertyKey];
    let coerced: string | number | boolean = action.value;
    if (typeof currentVal === 'number') {
      const num = Number(action.value);
      if (!Number.isNaN(num)) coerced = num;
    } else if (typeof currentVal === 'boolean') {
      coerced = action.value === 'true' || action.value === '1';
    }
    effect.propertyChanges.push({ blockId: block.blockId, propertyKey: action.propertyKey, value: coerced });
  },

  // ── Circuit port ──────────────────────────────────────────────────────────
  energize_port(action, block, effect) {
    if (!action.portId) return;
    effect.portChanges.push({ blockId: block.blockId, portId: action.portId, energized: true });
  },

  block_port(action, block, effect) {
    if (!action.portId) return;
    effect.portChanges.push({ blockId: block.blockId, portId: action.portId, energized: false });
  },

  // ── PLC register ──────────────────────────────────────────────────────────
  write_register(action, _block, effect) {
    if (!action.registerAddress || action.value === undefined) return;
    const num = Number(action.value);
    if (!Number.isNaN(num)) {
      effect.registerWrites.push({ address: action.registerAddress, value: num });
    }
  },

  read_register(action, block, effect) {
    // read_register semantics: emit a "read" write with NaN as sentinel so
    // the simulation runtime knows to copy the current register value into the
    // block property. The runtime resolves the actual value.
    if (!action.registerAddress || !action.targetProperty) return;
    effect.propertyChanges.push({
      blockId: block.blockId,
      propertyKey: action.targetProperty,
      // Sentinel: use the register address as a placeholder; runtime resolves
      value: `__register:${action.registerAddress}`,
    });
  },

  set_bit(action, _block, effect) {
    if (!action.registerAddress || action.bitIndex === undefined) return;
    effect.bitWrites.push({ address: action.registerAddress, bitIndex: action.bitIndex, value: true });
  },

  clear_bit(action, _block, effect) {
    if (!action.registerAddress || action.bitIndex === undefined) return;
    effect.bitWrites.push({ address: action.registerAddress, bitIndex: action.bitIndex, value: false });
  },

  // ── Timer ─────────────────────────────────────────────────────────────────
  start_timer(_, block, effect) {
    effect.timerCommands.push({ blockId: block.blockId, command: 'start' });
  },

  stop_timer(_, block, effect) {
    effect.timerCommands.push({ blockId: block.blockId, command: 'stop' });
  },

  reset_timer(_, block, effect) {
    effect.timerCommands.push({ blockId: block.blockId, command: 'reset' });
  },

  // ── Counter ───────────────────────────────────────────────────────────────
  increment_counter(_, block, effect) {
    effect.counterCommands.push({ blockId: block.blockId, command: 'increment' });
  },

  decrement_counter(_, block, effect) {
    effect.counterCommands.push({ blockId: block.blockId, command: 'decrement' });
  },

  reset_counter(_, block, effect) {
    effect.counterCommands.push({ blockId: block.blockId, command: 'reset' });
  },

  // ── Event ─────────────────────────────────────────────────────────────────
  emit_event(action, block, effect) {
    if (!action.eventName) return;
    effect.emittedEvents.push({ name: action.eventName, sourceBlockId: block.blockId });
  },
};

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Evaluates a single condition clause.
 * Applies domain validation and negate flag.
 */
function evaluateCondition(
  cond: Condition,
  block: ActionBlock,
  ctx: SimulationContext
): boolean {
  // Domain guard
  if (!isConditionAllowedInDomain(cond.type as ConditionType, block.domain)) {
    console.warn(
      `[IftttEngine] Condition "${cond.type}" not allowed in domain "${block.domain}" ` +
        `(block: ${block.blockId}). Treating as false.`
    );
    return false;
  }

  const evaluator = CONDITION_EVALUATORS[cond.type as ConditionType];
  if (!evaluator) {
    console.warn(`[IftttEngine] Unknown condition type "${cond.type}". Treating as false.`);
    return false;
  }

  const result = evaluator(cond, block, ctx);
  return cond.negate ? !result : result;
}

/**
 * Evaluates all conditions in a rule using conditionLogic (AND / OR).
 */
function evaluateRuleConditions(
  rule: IftttRule,
  block: ActionBlock,
  ctx: SimulationContext
): boolean {
  if (rule.conditions.length === 0) return false;

  if (rule.conditionLogic === 'any') {
    return rule.conditions.some((c) => evaluateCondition(c, block, ctx));
  }
  // Default: 'all' (AND)
  return rule.conditions.every((c) => evaluateCondition(c, block, ctx));
}

/**
 * Executes a list of actions, collecting mutation effects.
 * Skips actions violating domain constraints (with a warning).
 */
function executeActions(
  actions: Action[],
  block: ActionBlock,
  effect: MutationEffect
): void {
  for (const action of actions) {
    if (!isActionAllowedInDomain(action.type as ActionType, block.domain)) {
      console.warn(
        `[IftttEngine] Action "${action.type}" not allowed in domain "${block.domain}" ` +
          `(block: ${block.blockId}). Skipping.`
      );
      continue;
    }

    const executor = ACTION_EXECUTORS[action.type as ActionType];
    if (!executor) {
      console.warn(`[IftttEngine] Unknown action type "${action.type}". Skipping.`);
      continue;
    }

    executor(action, block, effect);
  }
}

/**
 * Evaluates a single IftttRule against the simulation context.
 */
function evaluateRule(
  rule: IftttRule,
  block: ActionBlock,
  ctx: SimulationContext
): RuleEvaluationResult {
  if (!rule.enabled) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      conditionMet: false,
      branch: 'skipped',
      effects: createEmptyMutationEffect(),
    };
  }

  const conditionMet = evaluateRuleConditions(rule, block, ctx);
  const effect = createEmptyMutationEffect();

  if (conditionMet) {
    executeActions(rule.thenActions, block, effect);
  } else {
    executeActions(rule.elseActions, block, effect);
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    conditionMet,
    branch: conditionMet ? 'then' : 'else',
    effects: effect,
  };
}

// ============================================================================
// ENGINE IMPLEMENTATION
// ============================================================================

/**
 * IftttActionEngine — stateless IFTTT rule evaluation engine.
 *
 * Thread-safety: This class holds no mutable state; instances can be shared
 * across React components and simulation workers.
 *
 * Usage:
 * ```ts
 * const engine = new IftttActionEngine();
 * const result = engine.evaluate(block, ctx);
 * applyMutations(result.combinedEffects);
 * ```
 */
export class IftttActionEngine implements IIftttActionEngine {
  /**
   * Evaluate all rules for one ActionBlock given the current SimulationContext.
   *
   * Rules are evaluated in ascending priority order (priority=1 first).
   * Each rule is independent; a rule's effects do NOT influence subsequent
   * rules within the same tick (effects are applied atomically after all ticks).
   *
   * @param block   The ActionBlock whose rules are to be evaluated
   * @param context Read-only simulation world state
   * @returns       Aggregated evaluation results and merged mutation effects
   */
  evaluate(block: ActionBlock, context: SimulationContext): BlockEvaluationResult {
    if (block.domain === 'annotation') {
      return {
        blockId: block.blockId,
        tick: context.tick,
        ruleResults: [],
        combinedEffects: createEmptyMutationEffect(),
      };
    }

    // Sort rules by priority ascending (lower number = higher priority)
    const sortedRules = [...block.behavior.rules].sort(
      (a, b) => a.priority - b.priority
    );

    const ruleResults: RuleEvaluationResult[] = sortedRules.map((rule) =>
      evaluateRule(rule, block, context)
    );

    const combinedEffects = mergeMutationEffects(
      ...ruleResults.map((r) => r.effects)
    );

    return {
      blockId: block.blockId,
      tick: context.tick,
      ruleResults,
      combinedEffects,
    };
  }

  /**
   * Evaluate ALL blocks in deterministic order (sorted by blockId).
   *
   * This is the main entry point for the simulation runtime.
   * Caller is responsible for applying the returned effects atomically.
   *
   * @param blocks  Read-only array of all registered ActionBlocks
   * @param context Read-only simulation world state
   * @returns       Per-block evaluation results
   */
  evaluateAll(
    blocks: readonly ActionBlock[],
    context: SimulationContext
  ): BlockEvaluationResult[] {
    // Deterministic order prevents block-order-dependent behavior bugs
    const sorted = [...blocks].sort((a, b) => a.blockId.localeCompare(b.blockId));
    return sorted.map((block) => this.evaluate(block, context));
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

/**
 * Shared singleton engine instance.
 * Import and use this in services/stores to avoid redundant instantiation.
 *
 * @example
 * ```ts
 * import { iftttEngine } from '../engine/iftttActionEngine';
 * const results = iftttEngine.evaluateAll(blocks, ctx);
 * ```
 */
export const iftttEngine = new IftttActionEngine();

// ============================================================================
// CONTEXT BUILDER HELPERS
// ============================================================================

/**
 * Creates an empty SimulationContext for testing or initial state.
 */
export function createEmptySimulationContext(tick = 0, simTimeMs = 0): SimulationContext {
  return {
    tick,
    simTimeMs,
    portPower: new Map(),
    portVoltage: new Map(),
    portCurrent: new Map(),
    registers: new Map(),
    bits: new Map(),
    timerValues: new Map(),
    timerRunning: new Map(),
    counterValues: new Map(),
    blockProperties: new Map(),
    blockActiveStates: new Map(),
  };
}

/**
 * Creates an ActionBlock with sensible defaults, suitable for testing
 * or constructing new blocks from symbol definitions.
 */
export function createActionBlock(
  blockId: string,
  symbolId: string,
  blockType: string,
  domain: ActionBlock['domain'] = 'circuit'
): ActionBlock {
  return {
    blockId,
    symbolId,
    blockType,
    domain,
    behavior: {
      interactionMode: 'none',
      deviceScoped: false,
      terminalRoles: [],
      rules: [],
    },
    properties: {},
    activeStates: new Set(),
    portEnergized: {},
  };
}
