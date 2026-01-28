/**
 * Switch State Evaluator
 *
 * Determines whether switches are open or closed based on PLC outputs,
 * button states, and other component states.
 */

import type { Block, PlcOutBlock, ButtonBlock, ContactConfig } from '../types';
import type { CircuitGraph } from './circuitGraph';
import { cloneGraph } from './circuitGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * Source of switch state determination.
 */
export type SwitchStateSource = 'plc' | 'button' | 'relay' | 'manual';

/**
 * State of a single switch.
 */
export interface SwitchState {
  /** Component ID of the switch */
  componentId: string;
  /** True = switch is open (no current flow), False = switch is closed (current flows) */
  isOpen: boolean;
  /** Source of this state */
  stateSource: SwitchStateSource;
  /** Whether this is a normally open (NO) or normally closed (NC) contact */
  isNormallyOpen: boolean;
  /** The raw energized state before NO/NC logic */
  isEnergized: boolean;
}

/**
 * Collection of switch states.
 */
export interface SwitchStateMap {
  /** Map of component ID to switch state */
  states: Map<string, SwitchState>;
}

/**
 * Runtime state from external sources (PLC, user interaction).
 */
export interface RuntimeState {
  /** PLC coil/output states (address -> ON/OFF) */
  plcOutputs: Map<number, boolean>;
  /** Button press states (componentId -> pressed) */
  buttonStates: Map<string, boolean>;
  /** Manual overrides for testing (componentId -> forced state) */
  manualOverrides: Map<string, boolean>;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an empty runtime state.
 */
export function createEmptyRuntimeState(): RuntimeState {
  return {
    plcOutputs: new Map(),
    buttonStates: new Map(),
    manualOverrides: new Map(),
  };
}

/**
 * Create an empty switch state map.
 */
export function createEmptySwitchStateMap(): SwitchStateMap {
  return {
    states: new Map(),
  };
}

// ============================================================================
// Switch State Evaluation
// ============================================================================

/**
 * Evaluate switch state for a PLC output block.
 */
function evaluatePlcOutSwitch(
  block: PlcOutBlock,
  runtimeState: RuntimeState
): SwitchState {
  // Check for manual override first
  if (runtimeState.manualOverrides.has(block.id)) {
    const overrideValue = runtimeState.manualOverrides.get(block.id)!;
    return {
      componentId: block.id,
      isOpen: !overrideValue,
      stateSource: 'manual',
      isNormallyOpen: block.normallyOpen,
      isEnergized: overrideValue,
    };
  }

  // Parse address from block (assuming numeric address or parsed from string)
  const address = typeof block.address === 'string'
    ? parseInt(block.address.replace(/[^0-9]/g, ''), 10) || 0
    : block.address;

  // Get PLC output state
  const plcState = runtimeState.plcOutputs.get(address) ?? false;

  // Apply inverted logic if configured
  const effectiveState = block.inverted ? !plcState : plcState;

  // Apply NO/NC logic
  // NO: closed when energized
  // NC: open when energized
  const isOpen = block.normallyOpen ? !effectiveState : effectiveState;

  return {
    componentId: block.id,
    isOpen,
    stateSource: 'plc',
    isNormallyOpen: block.normallyOpen,
    isEnergized: effectiveState,
  };
}

/**
 * Determine if a contact config represents normally open behavior.
 * '1a', '2a', '3a' types are normally open (NO)
 * '1b', '2b', '3b' types are normally closed (NC)
 */
function isNormallyOpenContact(config: ContactConfig): boolean {
  // 'a' suffix = normally open, 'b' suffix = normally closed
  // Combined configs like '1a1b' are treated as NO for primary behavior
  return config.includes('a');
}

/**
 * Evaluate switch state for a button block.
 */
function evaluateButtonSwitch(
  block: ButtonBlock,
  runtimeState: RuntimeState
): SwitchState {
  const isNormallyOpen = isNormallyOpenContact(block.contactConfig);

  // Check for manual override first
  if (runtimeState.manualOverrides.has(block.id)) {
    const overrideValue = runtimeState.manualOverrides.get(block.id)!;
    return {
      componentId: block.id,
      isOpen: !overrideValue,
      stateSource: 'manual',
      isNormallyOpen,
      isEnergized: overrideValue,
    };
  }

  // Get button press state
  const isPressed = runtimeState.buttonStates.get(block.id) ?? block.pressed ?? false;

  // Apply NO/NC logic
  // NO button: closed when pressed
  // NC button: open when pressed
  const isOpen = isNormallyOpen ? !isPressed : isPressed;

  return {
    componentId: block.id,
    isOpen,
    stateSource: 'button',
    isNormallyOpen,
    isEnergized: isPressed,
  };
}

/**
 * Evaluate switch states for all switch components.
 *
 * @param components - Array of all blocks
 * @param runtimeState - Current runtime state from PLC and user interaction
 * @returns Switch state map for all switch components
 */
export function evaluateSwitchStates(
  components: Block[],
  runtimeState: RuntimeState
): SwitchStateMap {
  const states = new Map<string, SwitchState>();

  for (const component of components) {
    switch (component.type) {
      case 'plc_out': {
        const state = evaluatePlcOutSwitch(component as PlcOutBlock, runtimeState);
        states.set(component.id, state);
        break;
      }
      case 'button': {
        const state = evaluateButtonSwitch(component as ButtonBlock, runtimeState);
        states.set(component.id, state);
        break;
      }
      // Add more switch types as needed (relay, toggle_switch, etc.)
    }
  }

  return { states };
}

/**
 * Apply switch states to a circuit graph, updating edge conductance.
 *
 * @param graph - The original circuit graph
 * @param switchStates - Evaluated switch states
 * @returns New graph with updated edge conductance based on switch states
 */
export function applySwitchStatesToGraph(
  graph: CircuitGraph,
  switchStates: SwitchStateMap
): CircuitGraph {
  // Clone the graph to avoid mutation
  const newGraph = cloneGraph(graph);

  // Update conductance for each switch
  for (const [componentId, switchState] of switchStates.states) {
    // Find all edges that belong to this switch component
    for (const edgeList of newGraph.edges.values()) {
      for (const edge of edgeList) {
        if (edge.isSwitch && edge.switchComponentId === componentId) {
          // Set conductance based on switch state
          // isOpen = true means no current flow (conductance = false)
          edge.conductance = !switchState.isOpen;
        }
      }
    }
  }

  return newGraph;
}

/**
 * Get the conductance (closed/open) state for a specific switch.
 *
 * @param switchStates - Switch state map
 * @param componentId - Switch component ID
 * @returns True if switch is closed (current can flow), false if open
 */
export function getSwitchConductance(
  switchStates: SwitchStateMap,
  componentId: string
): boolean {
  const state = switchStates.states.get(componentId);
  return state ? !state.isOpen : false;
}

/**
 * Check if a switch is energized (coil/button activated).
 *
 * @param switchStates - Switch state map
 * @param componentId - Switch component ID
 * @returns True if switch is energized
 */
export function isSwitchEnergized(
  switchStates: SwitchStateMap,
  componentId: string
): boolean {
  const state = switchStates.states.get(componentId);
  return state?.isEnergized ?? false;
}

/**
 * Update a single button state in the runtime state.
 *
 * @param runtimeState - Current runtime state
 * @param componentId - Button component ID
 * @param pressed - Whether button is pressed
 * @returns New runtime state with updated button state
 */
export function setButtonState(
  runtimeState: RuntimeState,
  componentId: string,
  pressed: boolean
): RuntimeState {
  const newButtonStates = new Map(runtimeState.buttonStates);
  newButtonStates.set(componentId, pressed);

  return {
    ...runtimeState,
    buttonStates: newButtonStates,
  };
}

/**
 * Update a PLC output state in the runtime state.
 *
 * @param runtimeState - Current runtime state
 * @param address - PLC output address
 * @param value - Output state
 * @returns New runtime state with updated PLC output
 */
export function setPlcOutput(
  runtimeState: RuntimeState,
  address: number,
  value: boolean
): RuntimeState {
  const newPlcOutputs = new Map(runtimeState.plcOutputs);
  newPlcOutputs.set(address, value);

  return {
    ...runtimeState,
    plcOutputs: newPlcOutputs,
  };
}

/**
 * Set a manual override for a switch component.
 *
 * @param runtimeState - Current runtime state
 * @param componentId - Switch component ID
 * @param value - Forced state (true = closed, false = open), or undefined to remove override
 * @returns New runtime state with updated manual override
 */
export function setManualOverride(
  runtimeState: RuntimeState,
  componentId: string,
  value: boolean | undefined
): RuntimeState {
  const newOverrides = new Map(runtimeState.manualOverrides);

  if (value === undefined) {
    newOverrides.delete(componentId);
  } else {
    newOverrides.set(componentId, value);
  }

  return {
    ...runtimeState,
    manualOverrides: newOverrides,
  };
}

/**
 * Sync runtime state with Modbus store coil values.
 *
 * @param runtimeState - Current runtime state
 * @param coilValues - Map of coil addresses to values from Modbus store
 * @returns New runtime state with synced PLC outputs
 */
export function syncFromModbus(
  runtimeState: RuntimeState,
  coilValues: Map<number, boolean>
): RuntimeState {
  return {
    ...runtimeState,
    plcOutputs: new Map(coilValues),
  };
}

export default {
  createEmptyRuntimeState,
  createEmptySwitchStateMap,
  evaluateSwitchStates,
  applySwitchStatesToGraph,
  getSwitchConductance,
  isSwitchEnergized,
  setButtonState,
  setPlcOutput,
  setManualOverride,
  syncFromModbus,
};
