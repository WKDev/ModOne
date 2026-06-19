/**
 * IFTTT Action Block Core Type System
 *
 * Defines the complete data model for the trigger-action binding system used
 * in ModOne's symbol behavior engine. Inspired by:
 *   - AutomationML / IEC 62714 (CAEX) — SupportedRoleClass + MappingObject
 *   - IEC 62714-4 PCE RoleClass library
 *   - IFTTT (If This Then That) rule paradigm
 *
 * Domain constraints:
 *   circuit  — may only use port_* conditions and energize/block port actions
 *   plc      — may use register_*, bit_* conditions and write/read register actions
 *   annotation — no behavior; rules should not be present
 *
 * @module ifttt
 */

import type { BehaviorVisualState } from './behavior';

// ============================================================================
// DOMAIN CONSTRAINT
// ============================================================================

/** Simulation domain for a symbol block — enforced at parse-time and runtime */
export type BlockDomain = 'circuit' | 'plc' | 'annotation';

// ============================================================================
// TRIGGER CONDITIONS
// (CAEX analog: BehaviorConditionType attributes defined in the XSD schema)
// ============================================================================

/** All supported condition type identifiers */
export type ConditionType =
  // ── Circuit domain ─────────────────────────────────────────────────────────
  | 'port_powered'         // Port receives voltage from netlist solver
  | 'port_voltage_above'   // Port voltage ≥ threshold
  | 'port_voltage_below'   // Port voltage < threshold
  | 'port_current_above'   // Port current ≥ threshold (reserved for future use)
  // ── PLC domain ─────────────────────────────────────────────────────────────
  | 'register_equals'      // PLC register value == val
  | 'register_above'       // PLC register value > val
  | 'register_below'       // PLC register value < val
  | 'bit_set'              // Register bit N is 1
  | 'bit_clear'            // Register bit N is 0
  // ── State / property ───────────────────────────────────────────────────────
  | 'property_equals'      // Block instance property == val
  | 'state_is'             // Current visual/behavior state == name
  // ── Time / counter ─────────────────────────────────────────────────────────
  | 'timer_elapsed'        // On-delay or off-delay timer has expired
  | 'counter_reached'      // Counter accumulated value >= preset
  // ── Sentinel ───────────────────────────────────────────────────────────────
  | 'always'               // Always true (unconditional trigger)
  | 'never';               // Always false (disabled condition)

/**
 * A single condition clause within an IFTTT rule.
 *
 * CAEX analog: BehaviorConditionType (ExternalInterface evaluation)
 */
export interface Condition {
  /** Condition type discriminant */
  type: ConditionType;

  // ── Port-based (circuit domain) ────────────────────────────────────────────
  /** ID of the port to evaluate (for port_* conditions) */
  portId?: string;
  /** Voltage or current threshold value */
  threshold?: number;

  // ── PLC register (plc domain) ──────────────────────────────────────────────
  /** PLC register address, e.g. "MW100", "DB1.DBX0.0", "H100" */
  registerAddress?: string;
  /** Bit index within register (for bit_set / bit_clear) */
  bitIndex?: number;

  // ── Property / state ──────────────────────────────────────────────────────
  /** Block instance property key (for property_equals) */
  propertyKey?: string;
  /** Value to compare against (string representation; parsed to correct type) */
  value?: string;
  /** State name to compare against (for state_is) */
  stateName?: string;

  // ── Negate ────────────────────────────────────────────────────────────────
  /** When true, the condition result is logically inverted */
  negate?: boolean;
}

// ============================================================================
// ACTIONS
// (CAEX analog: BehaviorActionType attributes defined in the XSD schema)
// ============================================================================

/** All supported action type identifiers */
export type ActionType =
  // ── Visual state ──────────────────────────────────────────────────────────
  | 'set_state'            // Activate a named visual/behavior state
  | 'clear_state'          // Deactivate a named visual/behavior state
  // ── Property mutation ─────────────────────────────────────────────────────
  | 'set_property'         // Set a block instance property value
  // ── Circuit domain ─────────────────────────────────────────────────────────
  | 'energize_port'        // Pass power through port (close contact)
  | 'block_port'           // Block power at port (open contact)
  // ── PLC domain ─────────────────────────────────────────────────────────────
  | 'write_register'       // Write a value to PLC register
  | 'read_register'        // Read PLC register into block property
  | 'set_bit'              // Set a specific bit in PLC register
  | 'clear_bit'            // Clear a specific bit in PLC register
  // ── Timer ──────────────────────────────────────────────────────────────────
  | 'start_timer'          // Start on/off-delay timer
  | 'stop_timer'           // Stop timer
  | 'reset_timer'          // Reset timer accumulator to 0
  // ── Counter ────────────────────────────────────────────────────────────────
  | 'increment_counter'    // Add 1 to counter accumulated value
  | 'decrement_counter'    // Subtract 1 from counter accumulated value
  | 'reset_counter'        // Reset counter accumulated value to 0
  // ── Event bus ──────────────────────────────────────────────────────────────
  | 'emit_event';          // Emit a named event to the simulation event bus

/**
 * A single action executed when a rule's conditions are satisfied (Then) or
 * not satisfied (Else).
 *
 * CAEX analog: BehaviorActionType (state mutation or I/O write)
 */
export interface Action {
  /** Action type discriminant */
  type: ActionType;

  // ── State ────────────────────────────────────────────────────────────────
  /** State name (for set_state / clear_state) */
  stateName?: string;

  // ── Port (circuit domain) ─────────────────────────────────────────────────
  /** Target port ID (for energize_port / block_port) */
  portId?: string;

  // ── Property ─────────────────────────────────────────────────────────────
  /** Property key (for set_property / read_register target) */
  propertyKey?: string;
  /** Value to set / write (string; parsed to correct type by runtime) */
  value?: string;

  // ── PLC register (plc domain) ─────────────────────────────────────────────
  /** PLC register address (for write_register / read_register / bit ops) */
  registerAddress?: string;
  /** Bit index within register (for set_bit / clear_bit) */
  bitIndex?: number;
  /** Target block property to write register value into (for read_register) */
  targetProperty?: string;

  // ── Event ─────────────────────────────────────────────────────────────────
  /** Event name to emit (for emit_event) */
  eventName?: string;
}

// ============================================================================
// IFTTT RULE
// (CAEX analog: BehaviorRuleType — one discrete evaluation unit)
// ============================================================================

/** How multiple condition clauses within one rule are logically combined */
export type ConditionLogic = 'all' | 'any';

/**
 * A complete IFTTT-style behavior rule.
 *
 * Evaluation per simulation tick:
 *   1. Evaluate all `conditions` using `conditionLogic` (AND / OR)
 *   2. If combined result is TRUE  → execute all `thenActions`
 *   3. If combined result is FALSE → execute all `elseActions`
 *
 * CAEX analog: BehaviorRuleType (Rule element in BehaviorType/Rules)
 */
export interface IftttRule {
  /** Stable identifier for this rule within the symbol (xs:NCName) */
  id: string;
  /** Human-readable rule name shown in the Symbol Editor UI */
  name: string;
  /** Evaluation priority — lower numbers evaluated first (1 = highest) */
  priority: number;
  /** How multiple condition clauses are combined */
  conditionLogic: ConditionLogic;
  /** Whether this rule is active; disabled rules are skipped */
  enabled: boolean;

  /** One or more condition clauses (minimum 1) */
  conditions: Condition[];
  /** Actions executed when conditions are satisfied */
  thenActions: Action[];
  /** Actions executed when conditions are NOT satisfied */
  elseActions: Action[];
}

// ============================================================================
// TERMINAL ROLE MAPPING
// (CAEX analog: TerminalRoleType — MappingObject / ExternalInterfaceProxy)
// ============================================================================

/**
 * Maps a symbol port (by id) to a named role in a behavior archetype.
 * Example: portId="coil_in" role="A1" means 'coil_in' port fulfills the
 * A1 terminal role in the relay archetype.
 *
 * CAEX analog: MappingObject
 */
export interface TerminalRoleMapping {
  /** Port identifier in the symbol definition */
  portId: string;
  /** Named terminal role in the behavior archetype */
  role: string;
}

// ============================================================================
// BEHAVIOR BINDING (Symbol ↔ Archetype + Rules)
// (CAEX analog: BehaviorType — SupportedRoleClass + MappingObject + Rules)
// ============================================================================

/** Well-known behavior template identifiers */
export type BehaviorTemplateId =
  | 'archetype:relay'
  | 'archetype:lamp'
  | 'archetype:motor'
  | 'archetype:switch_no'
  | 'archetype:switch_nc'
  | 'archetype:switch_co'
  | 'archetype:plc_input'
  | 'archetype:plc_output'
  | 'archetype:timer_on'
  | 'archetype:timer_off'
  | 'archetype:counter_up'
  | 'archetype:counter_down'
  | (string & Record<never, never>); // allow custom archetype IDs

/** User interaction mode during simulation */
export type InteractionMode = 'none' | 'click' | 'toggle' | 'drag';

/**
 * Complete behavior binding for one symbol definition.
 *
 * Supports two modes (can be combined):
 *   1. Archetype mode — reference a registered archetype; engine uses built-in logic
 *   2. Rules mode    — define IFTTT rules directly; engine evaluates them each tick
 *
 * CAEX analog: BehaviorType (SupportedRoleClass + inline Rules)
 */
export interface BehaviorBinding {
  /** Reference to a registered behavior template (archetype mode) */
  templateId?: BehaviorTemplateId;
  /** Well-known archetype name (relay, motor, switch_no, plc_input, …) */
  archetype?: string;
  /** User interaction mode during simulation */
  interactionMode: InteractionMode;
  /** True if behavior is scoped to a specific PLC device instance */
  deviceScoped: boolean;
  /** Simulation domain override (inherits from symbol domain if omitted) */
  domain?: BlockDomain;
  /** Port-to-archetype-role mappings (archetype mode) */
  terminalRoles: TerminalRoleMapping[];
  /** Direct IFTTT behavior rules (rules mode) */
  rules: IftttRule[];
}

// ============================================================================
// ACTION BLOCK
// (Top-level unit of IFTTT execution — one symbol instance on the canvas)
// ============================================================================

/**
 * An ActionBlock represents one symbol instance's full IFTTT configuration,
 * ready for evaluation by the IftttActionEngine each simulation tick.
 *
 * CAEX analog: SystemUnitClass instance with SupportedRoleClass resolved
 */
export interface ActionBlock {
  /** Unique block instance identifier on the canvas */
  blockId: string;
  /** Symbol definition identifier this block was created from */
  symbolId: string;
  /** Canonical block type (e.g., 'relay_coil', 'custom_symbol') */
  blockType: string;
  /** Simulation domain — controls which conditions/actions are permitted */
  domain: BlockDomain;
  /** Behavior binding resolved from symbol definition */
  behavior: BehaviorBinding;
  /** Current instance property values */
  properties: Record<string, string | number | boolean>;
  /** Current active visual/behavior states (set names) */
  activeStates: Set<BehaviorVisualState | string>;
  /** Current energization status per port (true = energized/conducting) */
  portEnergized: Record<string, boolean>;
}

// ============================================================================
// SIMULATION CONTEXT
// (Read-only snapshot of world state passed to condition evaluators)
// ============================================================================

/**
 * Read-only snapshot of simulation world state passed to condition evaluators
 * each tick. Condition evaluators must NOT mutate this object.
 */
export interface SimulationContext {
  /** Simulation tick number (monotonically increasing) */
  tick: number;
  /** Wall-clock simulation time in milliseconds */
  simTimeMs: number;

  // ── Circuit domain ─────────────────────────────────────────────────────────
  /** Port energization map: blockId → portId → energized */
  portPower: Readonly<Map<string, Readonly<Map<string, boolean>>>>;
  /** Port voltage readings: blockId → portId → voltage (V) */
  portVoltage: Readonly<Map<string, Readonly<Map<string, number>>>>;
  /** Port current readings: blockId → portId → current (A) */
  portCurrent: Readonly<Map<string, Readonly<Map<string, number>>>>;

  // ── PLC domain ─────────────────────────────────────────────────────────────
  /** PLC register values: address string → numeric value */
  registers: Readonly<Map<string, number>>;
  /** PLC bit states: "address.bitIndex" → boolean */
  bits: Readonly<Map<string, boolean>>;

  // ── Timers / counters ──────────────────────────────────────────────────────
  /** Timer accumulated values: blockId → elapsed ms */
  timerValues: Readonly<Map<string, number>>;
  /** Timer running states: blockId → isRunning */
  timerRunning: Readonly<Map<string, boolean>>;
  /** Counter accumulated values: blockId → count */
  counterValues: Readonly<Map<string, number>>;

  // ── Block state ────────────────────────────────────────────────────────────
  /** Block instance property snapshots: blockId → key → value */
  blockProperties: Readonly<Map<string, Readonly<Record<string, string | number | boolean>>>>;
  /** Active states per block: blockId → Set<stateName> */
  blockActiveStates: Readonly<Map<string, Readonly<Set<string>>>>;
}

// ============================================================================
// MUTATION EFFECTS
// (Collected side-effects produced by action execution; applied atomically)
// ============================================================================

/** Describes a visual/behavior state change to apply to a block */
export interface StateMutation {
  blockId: string;
  stateName: string;
  active: boolean;
}

/** Describes a property value change to apply to a block */
export interface PropertyMutation {
  blockId: string;
  propertyKey: string;
  value: string | number | boolean;
}

/** Describes a port energization change in the circuit */
export interface PortMutation {
  blockId: string;
  portId: string;
  energized: boolean;
}

/** Describes a PLC register write */
export interface RegisterWrite {
  address: string;
  value: number;
}

/** Describes a PLC bit write */
export interface BitWrite {
  address: string;
  bitIndex: number;
  value: boolean;
}

/** Describes a timer control command */
export interface TimerCommand {
  blockId: string;
  command: 'start' | 'stop' | 'reset';
}

/** Describes a counter control command */
export interface CounterCommand {
  blockId: string;
  command: 'increment' | 'decrement' | 'reset';
}

/** Describes an event emitted to the simulation event bus */
export interface EmittedEvent {
  name: string;
  sourceBlockId: string;
  payload?: Record<string, unknown>;
}

/**
 * Aggregated set of side-effects produced by evaluating one ActionBlock's
 * rules during a simulation tick. Applied atomically after all blocks in the
 * tick have been evaluated, to avoid ordering artifacts.
 */
export interface MutationEffect {
  /** Block-state activations / deactivations */
  stateChanges: StateMutation[];
  /** Block property updates */
  propertyChanges: PropertyMutation[];
  /** Port energization changes (circuit domain) */
  portChanges: PortMutation[];
  /** PLC register writes (plc domain) */
  registerWrites: RegisterWrite[];
  /** PLC bit writes (plc domain) */
  bitWrites: BitWrite[];
  /** Timer control commands */
  timerCommands: TimerCommand[];
  /** Counter control commands */
  counterCommands: CounterCommand[];
  /** Events emitted to the simulation bus */
  emittedEvents: EmittedEvent[];
}

// ============================================================================
// RULE EVALUATION RESULT
// ============================================================================

/** Result of evaluating a single IftttRule for one ActionBlock */
export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  conditionMet: boolean;
  /** Executed action branch: 'then', 'else', or 'skipped' (rule disabled) */
  branch: 'then' | 'else' | 'skipped';
  /** Mutation effects produced by the executed actions */
  effects: MutationEffect;
}

/** Result of evaluating ALL rules for one ActionBlock in one tick */
export interface BlockEvaluationResult {
  blockId: string;
  tick: number;
  ruleResults: RuleEvaluationResult[];
  /** Combined mutation effects across all rules (merged) */
  combinedEffects: MutationEffect;
}

// ============================================================================
// ENGINE INTERFACE
// ============================================================================

/**
 * Interface for the IFTTT action engine.
 * Implementations must be stateless with respect to the simulation context —
 * all state is carried in ActionBlock.activeStates / portEnergized / properties.
 */
export interface IIftttActionEngine {
  /**
   * Evaluate all rules for one ActionBlock given the current SimulationContext.
   * Returns aggregated MutationEffects; does NOT modify any state directly.
   */
  evaluate(block: ActionBlock, context: SimulationContext): BlockEvaluationResult;

  /**
   * Evaluate ALL blocks registered in one batch, returning their combined effects.
   * Blocks are evaluated in deterministic order (sorted by blockId).
   */
  evaluateAll(
    blocks: readonly ActionBlock[],
    context: SimulationContext
  ): BlockEvaluationResult[];
}

// ============================================================================
// CAEX/XML SERIALISATION HELPERS
// ============================================================================

/**
 * Raw deserialized form of a Behavior XML element before validation.
 * Used internally by IftttXmlParser; consumers should use BehaviorBinding.
 */
export interface RawBehaviorXml {
  templateId?: string;
  archetype?: string;
  interactionMode?: string;
  deviceScoped?: string;
  domain?: string;
  terminalRoles: Array<{ portId: string; role: string }>;
  rules: RawRuleXml[];
}

/** Raw deserialized form of a Rule XML element */
export interface RawRuleXml {
  id: string;
  name?: string;
  priority?: string;
  conditionLogic?: string;
  enabled?: string;
  conditions: RawConditionXml[];
  thenActions: RawActionXml[];
  elseActions: RawActionXml[];
}

/** Raw deserialized form of a Condition (If) XML element */
export interface RawConditionXml {
  type: string;
  portId?: string;
  threshold?: string;
  registerAddress?: string;
  bitIndex?: string;
  propertyKey?: string;
  value?: string;
  stateName?: string;
  negate?: string;
}

/** Raw deserialized form of an Action (Then/Else) XML element */
export interface RawActionXml {
  type: string;
  stateName?: string;
  portId?: string;
  propertyKey?: string;
  value?: string;
  registerAddress?: string;
  bitIndex?: string;
  targetProperty?: string;
  eventName?: string;
}

// ============================================================================
// DOMAIN VALIDATION HELPERS
// ============================================================================

/** Condition types that are only valid in the 'circuit' domain */
export const CIRCUIT_ONLY_CONDITIONS: ReadonlySet<ConditionType> = new Set([
  'port_powered',
  'port_voltage_above',
  'port_voltage_below',
  'port_current_above',
]);

/** Condition types that are only valid in the 'plc' domain */
export const PLC_ONLY_CONDITIONS: ReadonlySet<ConditionType> = new Set([
  'register_equals',
  'register_above',
  'register_below',
  'bit_set',
  'bit_clear',
]);

/** Action types that are only valid in the 'circuit' domain */
export const CIRCUIT_ONLY_ACTIONS: ReadonlySet<ActionType> = new Set([
  'energize_port',
  'block_port',
]);

/** Action types that are only valid in the 'plc' domain */
export const PLC_ONLY_ACTIONS: ReadonlySet<ActionType> = new Set([
  'write_register',
  'read_register',
  'set_bit',
  'clear_bit',
]);

/**
 * Validates that a condition type is permitted in a given domain.
 * Returns true if the condition is allowed.
 */
export function isConditionAllowedInDomain(
  condType: ConditionType,
  domain: BlockDomain
): boolean {
  if (domain === 'annotation') return false;
  if (CIRCUIT_ONLY_CONDITIONS.has(condType)) return domain === 'circuit';
  if (PLC_ONLY_CONDITIONS.has(condType)) return domain === 'plc';
  return true; // property_equals, state_is, timer_elapsed, counter_reached, always, never
}

/**
 * Validates that an action type is permitted in a given domain.
 * Returns true if the action is allowed.
 */
export function isActionAllowedInDomain(
  actionType: ActionType,
  domain: BlockDomain
): boolean {
  if (domain === 'annotation') return false;
  if (CIRCUIT_ONLY_ACTIONS.has(actionType)) return domain === 'circuit';
  if (PLC_ONLY_ACTIONS.has(actionType)) return domain === 'plc';
  return true; // state/property/timer/counter/event actions are domain-agnostic
}

/** Creates an empty MutationEffect with all arrays initialized */
export function createEmptyMutationEffect(): MutationEffect {
  return {
    stateChanges: [],
    propertyChanges: [],
    portChanges: [],
    registerWrites: [],
    bitWrites: [],
    timerCommands: [],
    counterCommands: [],
    emittedEvents: [],
  };
}

/** Merges multiple MutationEffects into one (for aggregating rule results) */
export function mergeMutationEffects(...effects: MutationEffect[]): MutationEffect {
  const merged = createEmptyMutationEffect();
  for (const effect of effects) {
    merged.stateChanges.push(...effect.stateChanges);
    merged.propertyChanges.push(...effect.propertyChanges);
    merged.portChanges.push(...effect.portChanges);
    merged.registerWrites.push(...effect.registerWrites);
    merged.bitWrites.push(...effect.bitWrites);
    merged.timerCommands.push(...effect.timerCommands);
    merged.counterCommands.push(...effect.counterCommands);
    merged.emittedEvents.push(...effect.emittedEvents);
  }
  return merged;
}
