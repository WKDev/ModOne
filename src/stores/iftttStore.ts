/**
 * IFTTT Store
 *
 * Zustand store for managing IFTTT Action Blocks and their rule evaluation
 * lifecycle within ModOne's simulation runtime.
 *
 * Responsibilities:
 *   - Registry of ActionBlocks (one per canvas block instance that has behavior)
 *   - SimulationContext state kept in sync with the circuit / PLC simulation
 *   - Orchestration of IftttActionEngine.evaluateAll() each tick
 *   - Atomic application of MutationEffects after each tick
 *   - Integration points for Symbol Editor (add/edit/remove rules)
 *
 * Architecture:
 *   This store is intentionally separate from canvasStore and simulationService
 *   to allow independent unit-testing and future extraction into a Web Worker.
 *
 * @module stores/iftttStore
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  ActionBlock,
  BehaviorBinding,
  BlockEvaluationResult,
  BlockDomain,
  IftttRule,
  MutationEffect,
  SimulationContext,
  StateMutation,
  PropertyMutation,
  PortMutation,
  RegisterWrite,
  BitWrite,
  TimerCommand,
  CounterCommand,
} from '../types/ifttt';
import { createEmptyMutationEffect, mergeMutationEffects } from '../types/ifttt';
import { iftttEngine, createEmptySimulationContext } from '../engine/iftttActionEngine';

// ============================================================================
// TIMER / COUNTER RUNTIME STATE
// Managed separately from SimulationContext (which is read-only each tick)
// ============================================================================

interface TimerState {
  blockId: string;
  running: boolean;
  accumulatedMs: number;
  startedAtMs: number | null;
}

interface CounterState {
  blockId: string;
  value: number;
}

// ============================================================================
// STORE STATE SHAPE
// ============================================================================

export interface IftttStoreState {
  // ── Action Block Registry ─────────────────────────────────────────────────
  /** Map of blockId → ActionBlock */
  blocks: Map<string, ActionBlock>;

  // ── Simulation Context ─────────────────────────────────────────────────────
  /** Current simulation context (updated each tick by the simulation engine) */
  context: SimulationContext;

  // ── Timer / Counter runtime ───────────────────────────────────────────────
  timers: Map<string, TimerState>;
  counters: Map<string, CounterState>;

  // ── Last evaluation results ────────────────────────────────────────────────
  /** Results from the most recent evaluateAll() call */
  lastTickResults: BlockEvaluationResult[];
  /** Combined mutations from the most recent tick (for debugging/UI) */
  lastTickMutations: MutationEffect;

  // ── Tick counter ──────────────────────────────────────────────────────────
  tick: number;
  simTimeMs: number;

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Register an ActionBlock from a canvas block.
   * Replaces any existing block with the same blockId.
   */
  registerBlock: (block: ActionBlock) => void;

  /**
   * Unregister an ActionBlock when its canvas block is deleted.
   */
  unregisterBlock: (blockId: string) => void;

  /**
   * Update the behavior binding (rules) for a registered block.
   * Used by the Symbol Editor when the user saves rule changes.
   */
  updateBehavior: (blockId: string, behavior: BehaviorBinding) => void;

  /**
   * Add or replace a single rule in a block's behavior.
   */
  upsertRule: (blockId: string, rule: IftttRule) => void;

  /**
   * Remove a rule by ruleId from a block's behavior.
   */
  removeRule: (blockId: string, ruleId: string) => void;

  /**
   * Enable or disable a rule without removing it.
   */
  setRuleEnabled: (blockId: string, ruleId: string, enabled: boolean) => void;

  /**
   * Reorder rules by providing an ordered array of ruleIds.
   * Rules not in the array are appended at the end in their original order.
   */
  reorderRules: (blockId: string, orderedRuleIds: string[]) => void;

  /**
   * Update the simulation context with new world state from the circuit/PLC engine.
   * Called each tick by the simulation orchestrator before runTick().
   */
  updateContext: (patch: Partial<Omit<SimulationContext, 'tick' | 'simTimeMs'>>) => void;

  /**
   * Update port power state for a single block.
   * Convenience wrapper used by the circuit netlist solver.
   */
  setPortPower: (blockId: string, portId: string, energized: boolean) => void;

  /**
   * Update a PLC register value.
   * Convenience wrapper used by the Modbus / PLC runtime.
   */
  setRegister: (address: string, value: number) => void;

  /**
   * Update a PLC bit state.
   */
  setBit: (address: string, bitIndex: number, value: boolean) => void;

  /**
   * Run one simulation tick: evaluate all blocks, collect mutations, apply them.
   * Returns the combined MutationEffect for the tick (also stored in lastTickMutations).
   */
  runTick: (wallClockMs: number) => MutationEffect;

  /**
   * Reset the store to initial state (called on project close / new).
   */
  reset: () => void;
}

// ============================================================================
// MUTATION APPLICATION HELPERS
// ============================================================================

/**
 * Applies state, property, and port mutations to the blocks map.
 * Timer/counter commands are applied to the timer/counter maps.
 * Register/bit writes update the context for the next tick.
 *
 * This function mutates the Immer draft directly.
 */
function applyMutations(
  draft: IftttStoreState,
  effects: MutationEffect,
  wallClockMs: number
): void {
  // ── State changes ─────────────────────────────────────────────────────────
  for (const change of effects.stateChanges) {
    applyStateChange(draft, change);
  }

  // ── Property changes ──────────────────────────────────────────────────────
  for (const change of effects.propertyChanges) {
    applyPropertyChange(draft, change);
  }

  // ── Port energization ─────────────────────────────────────────────────────
  for (const change of effects.portChanges) {
    applyPortChange(draft, change);
  }

  // ── PLC register writes ───────────────────────────────────────────────────
  for (const write of effects.registerWrites) {
    applyRegisterWrite(draft, write);
  }

  // ── PLC bit writes ────────────────────────────────────────────────────────
  for (const write of effects.bitWrites) {
    applyBitWrite(draft, write);
  }

  // ── Timer commands ────────────────────────────────────────────────────────
  for (const cmd of effects.timerCommands) {
    applyTimerCommand(draft, cmd, wallClockMs);
  }

  // ── Counter commands ──────────────────────────────────────────────────────
  for (const cmd of effects.counterCommands) {
    applyCounterCommand(draft, cmd);
  }

  // Emitted events are not applied to store state; callers observe them
  // via lastTickMutations.emittedEvents.
}

function applyStateChange(draft: IftttStoreState, change: StateMutation): void {
  const block = draft.blocks.get(change.blockId);
  if (!block) return;
  if (change.active) {
    block.activeStates.add(change.stateName);
  } else {
    block.activeStates.delete(change.stateName);
  }
}

function applyPropertyChange(draft: IftttStoreState, change: PropertyMutation): void {
  const block = draft.blocks.get(change.blockId);
  if (!block) return;

  // Resolve __register: sentinel (read_register action)
  if (typeof change.value === 'string' && change.value.startsWith('__register:')) {
    const addr = change.value.slice('__register:'.length);
    const regVal = draft.context.registers.get(addr);
    if (regVal !== undefined) {
      block.properties[change.propertyKey] = regVal;
      // Also update the context snapshot for this block
      const ctxProps = draft.context.blockProperties as Map<string, Record<string, string | number | boolean>>;
      const existing = ctxProps.get(change.blockId) ?? {};
      ctxProps.set(change.blockId, { ...existing, [change.propertyKey]: regVal });
    }
  } else {
    block.properties[change.propertyKey] = change.value;
    const ctxProps = draft.context.blockProperties as Map<string, Record<string, string | number | boolean>>;
    const existing = ctxProps.get(change.blockId) ?? {};
    ctxProps.set(change.blockId, { ...existing, [change.propertyKey]: change.value });
  }
}

function applyPortChange(draft: IftttStoreState, change: PortMutation): void {
  const block = draft.blocks.get(change.blockId);
  if (!block) return;
  block.portEnergized[change.portId] = change.energized;

  // Also update the context portPower map
  const ctxPortPower = draft.context.portPower as Map<string, Map<string, boolean>>;
  let portMap = ctxPortPower.get(change.blockId);
  if (!portMap) {
    portMap = new Map();
    ctxPortPower.set(change.blockId, portMap);
  }
  portMap.set(change.portId, change.energized);
}

function applyRegisterWrite(draft: IftttStoreState, write: RegisterWrite): void {
  (draft.context.registers as Map<string, number>).set(write.address, write.value);
}

function applyBitWrite(draft: IftttStoreState, write: BitWrite): void {
  const key = `${write.address}.${write.bitIndex}`;
  (draft.context.bits as Map<string, boolean>).set(key, write.value);
}

function applyTimerCommand(
  draft: IftttStoreState,
  cmd: TimerCommand,
  wallClockMs: number
): void {
  let timer = draft.timers.get(cmd.blockId);
  if (!timer) {
    timer = { blockId: cmd.blockId, running: false, accumulatedMs: 0, startedAtMs: null };
    draft.timers.set(cmd.blockId, timer);
  }

  switch (cmd.command) {
    case 'start':
      if (!timer.running) {
        timer.running = true;
        timer.startedAtMs = wallClockMs;
      }
      break;
    case 'stop':
      if (timer.running && timer.startedAtMs !== null) {
        timer.accumulatedMs += wallClockMs - timer.startedAtMs;
        timer.startedAtMs = null;
      }
      timer.running = false;
      break;
    case 'reset':
      timer.running = false;
      timer.accumulatedMs = 0;
      timer.startedAtMs = null;
      break;
  }

  // Update context timer snapshots
  const ctxTimerValues = draft.context.timerValues as Map<string, number>;
  const ctxTimerRunning = draft.context.timerRunning as Map<string, boolean>;
  const elapsed = timer.running && timer.startedAtMs !== null
    ? timer.accumulatedMs + (wallClockMs - timer.startedAtMs)
    : timer.accumulatedMs;
  ctxTimerValues.set(cmd.blockId, elapsed);
  ctxTimerRunning.set(cmd.blockId, timer.running);
}

function applyCounterCommand(draft: IftttStoreState, cmd: CounterCommand): void {
  let counter = draft.counters.get(cmd.blockId);
  if (!counter) {
    counter = { blockId: cmd.blockId, value: 0 };
    draft.counters.set(cmd.blockId, counter);
  }

  switch (cmd.command) {
    case 'increment': counter.value += 1; break;
    case 'decrement': counter.value = Math.max(0, counter.value - 1); break;
    case 'reset':     counter.value = 0; break;
  }

  (draft.context.counterValues as Map<string, number>).set(cmd.blockId, counter.value);
}

// ============================================================================
// CONTEXT SYNC HELPERS
// Sync block.activeStates into context.blockActiveStates before each tick
// ============================================================================

function syncContextStates(draft: IftttStoreState): void {
  const ctxStates = draft.context.blockActiveStates as Map<string, Set<string>>;
  for (const [blockId, block] of draft.blocks) {
    ctxStates.set(blockId, new Set(block.activeStates));
  }
}

// ============================================================================
// INITIAL STATE
// ============================================================================

function makeInitialState(): Pick<
  IftttStoreState,
  'blocks' | 'context' | 'timers' | 'counters' | 'lastTickResults' | 'lastTickMutations' | 'tick' | 'simTimeMs'
> {
  return {
    blocks: new Map(),
    context: createEmptySimulationContext(0, 0),
    timers: new Map(),
    counters: new Map(),
    lastTickResults: [],
    lastTickMutations: createEmptyMutationEffect(),
    tick: 0,
    simTimeMs: 0,
  };
}

// ============================================================================
// STORE
// ============================================================================

export const useIftttStore = create<IftttStoreState>()(
  immer((set, get) => ({
    ...makeInitialState(),

    // ── Block registry ─────────────────────────────────────────────────────

    registerBlock(block: ActionBlock) {
      set((draft) => {
        draft.blocks.set(block.blockId, block as unknown as ActionBlock);
        // Initialise context maps for this block
        (draft.context.blockProperties as Map<string, Record<string, string | number | boolean>>)
          .set(block.blockId, { ...block.properties });
        (draft.context.blockActiveStates as Map<string, Set<string>>)
          .set(block.blockId, new Set(block.activeStates));
      });
    },

    unregisterBlock(blockId: string) {
      set((draft) => {
        draft.blocks.delete(blockId);
        (draft.context.blockProperties as Map<string, Record<string, string | number | boolean>>).delete(blockId);
        (draft.context.blockActiveStates as Map<string, Set<string>>).delete(blockId);
        (draft.context.portPower as Map<string, Map<string, boolean>>).delete(blockId);
        draft.timers.delete(blockId);
        draft.counters.delete(blockId);
      });
    },

    // ── Rule management ────────────────────────────────────────────────────

    updateBehavior(blockId: string, behavior: BehaviorBinding) {
      set((draft) => {
        const block = draft.blocks.get(blockId);
        if (!block) return;
        (block as ActionBlock).behavior = behavior;
      });
    },

    upsertRule(blockId: string, rule: IftttRule) {
      set((draft) => {
        const block = draft.blocks.get(blockId);
        if (!block) return;
        const rules = (block as ActionBlock).behavior.rules;
        const existingIdx = rules.findIndex((r) => r.id === rule.id);
        if (existingIdx >= 0) {
          rules[existingIdx] = rule;
        } else {
          rules.push(rule);
        }
        // Re-sort by priority
        rules.sort((a, b) => a.priority - b.priority);
      });
    },

    removeRule(blockId: string, ruleId: string) {
      set((draft) => {
        const block = draft.blocks.get(blockId);
        if (!block) return;
        const behavior = (block as ActionBlock).behavior;
        behavior.rules = behavior.rules.filter((r) => r.id !== ruleId);
      });
    },

    setRuleEnabled(blockId: string, ruleId: string, enabled: boolean) {
      set((draft) => {
        const block = draft.blocks.get(blockId);
        if (!block) return;
        const rule = (block as ActionBlock).behavior.rules.find((r) => r.id === ruleId);
        if (rule) rule.enabled = enabled;
      });
    },

    reorderRules(blockId: string, orderedRuleIds: string[]) {
      set((draft) => {
        const block = draft.blocks.get(blockId);
        if (!block) return;
        const behavior = (block as ActionBlock).behavior;
        const ruleMap = new Map(behavior.rules.map((r) => [r.id, r]));
        const ordered = orderedRuleIds
          .map((id) => ruleMap.get(id))
          .filter((r): r is IftttRule => !!r);
        const remaining = behavior.rules.filter((r) => !orderedRuleIds.includes(r.id));
        behavior.rules = [...ordered, ...remaining];
        // Update priorities to match new order
        behavior.rules.forEach((r, i) => { r.priority = i + 1; });
      });
    },

    // ── Context updates ────────────────────────────────────────────────────

    updateContext(patch: Partial<Omit<SimulationContext, 'tick' | 'simTimeMs'>>) {
      set((draft) => {
        Object.assign(draft.context, patch);
      });
    },

    setPortPower(blockId: string, portId: string, energized: boolean) {
      set((draft) => {
        const ctxPortPower = draft.context.portPower as Map<string, Map<string, boolean>>;
        let portMap = ctxPortPower.get(blockId);
        if (!portMap) {
          portMap = new Map();
          ctxPortPower.set(blockId, portMap);
        }
        portMap.set(portId, energized);

        // Keep block.portEnergized in sync
        const block = draft.blocks.get(blockId);
        if (block) {
          (block as ActionBlock).portEnergized[portId] = energized;
        }
      });
    },

    setRegister(address: string, value: number) {
      set((draft) => {
        (draft.context.registers as Map<string, number>).set(address, value);
      });
    },

    setBit(address: string, bitIndex: number, value: boolean) {
      set((draft) => {
        const key = `${address}.${bitIndex}`;
        (draft.context.bits as Map<string, boolean>).set(key, value);
      });
    },

    // ── Tick execution ─────────────────────────────────────────────────────

    runTick(wallClockMs: number): MutationEffect {
      const state = get();
      const nextTick = state.tick + 1;

      // Build fresh context snapshot with updated tick/time
      const context: SimulationContext = {
        ...state.context,
        tick: nextTick,
        simTimeMs: wallClockMs,
      };

      // Sync block activeStates into context before evaluation
      for (const [blockId, block] of state.blocks) {
        const ctxStates = context.blockActiveStates as Map<string, Set<string>>;
        ctxStates.set(blockId, new Set(block.activeStates));
        const ctxProps = context.blockProperties as Map<string, Record<string, string | number | boolean>>;
        ctxProps.set(blockId, { ...block.properties });
      }

      // Evaluate all blocks (pure, no side effects)
      const allBlocks = Array.from(state.blocks.values());
      const results = iftttEngine.evaluateAll(allBlocks, context);

      // Merge all effects
      const combinedEffects = mergeMutationEffects(
        ...results.map((r) => r.combinedEffects)
      );

      // Apply mutations atomically
      set((draft) => {
        draft.tick = nextTick;
        draft.simTimeMs = wallClockMs;
        draft.context.tick = nextTick;
        draft.context.simTimeMs = wallClockMs;
        draft.lastTickResults = results;
        draft.lastTickMutations = combinedEffects;

        // Sync block states into context before apply
        syncContextStates(draft);

        // Apply all mutations
        applyMutations(draft, combinedEffects, wallClockMs);
      });

      return combinedEffects;
    },

    // ── Reset ──────────────────────────────────────────────────────────────

    reset() {
      set(() => makeInitialState());
    },
  }))
);

// ============================================================================
// SELECTORS (for fine-grained subscriptions)
// ============================================================================

/** Select a single ActionBlock by blockId */
export const selectBlock = (blockId: string) => (state: IftttStoreState) =>
  state.blocks.get(blockId);

/** Select active states for a block */
export const selectBlockActiveStates = (blockId: string) => (state: IftttStoreState) =>
  state.blocks.get(blockId)?.activeStates ?? new Set<string>();

/** Select all rules for a block, sorted by priority */
export const selectBlockRules = (blockId: string) => (state: IftttStoreState) =>
  [...(state.blocks.get(blockId)?.behavior.rules ?? [])].sort(
    (a, b) => a.priority - b.priority
  );

/** Select port energization for a specific port */
export const selectPortEnergized =
  (blockId: string, portId: string) => (state: IftttStoreState) =>
    state.blocks.get(blockId)?.portEnergized[portId] ?? false;

/** Select the last tick's evaluation result for a block */
export const selectLastBlockResult = (blockId: string) => (state: IftttStoreState) =>
  state.lastTickResults.find((r) => r.blockId === blockId);

/** Select all blocks whose domain is 'circuit' */
export const selectCircuitBlocks = (state: IftttStoreState): ActionBlock[] =>
  Array.from(state.blocks.values()).filter((b) => b.domain === 'circuit');

/** Select all blocks whose domain is 'plc' */
export const selectPlcBlocks = (state: IftttStoreState): ActionBlock[] =>
  Array.from(state.blocks.values()).filter((b) => b.domain === 'plc');

/** Select all emitted events from the last tick */
export const selectLastEmittedEvents = (state: IftttStoreState) =>
  state.lastTickMutations.emittedEvents;

/** Check if a specific state is active for a block */
export const selectIsStateActive =
  (blockId: string, stateName: string) => (state: IftttStoreState) =>
    state.blocks.get(blockId)?.activeStates.has(stateName) ?? false;

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

/**
 * Builds an ActionBlock from a symbol definition's parsed behavior.
 * Used by the canvas when placing a new block.
 *
 * @param blockId    Unique block instance identifier
 * @param symbolId   Symbol definition identifier
 * @param blockType  Canonical block type string
 * @param domain     Symbol domain
 * @param behavior   Parsed BehaviorBinding from symbol XML
 * @param properties Initial instance properties
 * @returns          Ready-to-register ActionBlock
 */
export function buildActionBlockFromSymbol(
  blockId: string,
  symbolId: string,
  blockType: string,
  domain: BlockDomain,
  behavior: BehaviorBinding,
  properties: Record<string, string | number | boolean> = {}
): ActionBlock {
  return {
    blockId,
    symbolId,
    blockType,
    domain,
    behavior,
    properties,
    activeStates: new Set(),
    portEnergized: {},
  };
}
