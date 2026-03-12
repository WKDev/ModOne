/**
 * Switch State Evaluator
 *
 * Determines whether conductive components are open or closed based on PLC outputs,
 * button states, relay device states, and manual overrides.
 */

import type { Block } from '../types';
import type { CircuitGraph } from './circuitGraph';
import { cloneGraph } from './circuitGraph';
import {
  createEmptyRuntimeState,
  type BehaviorStateSource,
  type RuntimeDeviceState,
  type RuntimeState,
} from '@/types/behavior';
import { evaluateBehaviorSwitch } from '../runtime/behaviorTemplates';

// ============================================================================
// Types
// ============================================================================

export type SwitchStateSource = BehaviorStateSource;

export interface SwitchState {
  componentId: string;
  isOpen: boolean;
  stateSource: SwitchStateSource;
  isNormallyOpen: boolean;
  isEnergized: boolean;
}

export interface SwitchStateMap {
  states: Map<string, SwitchState>;
}

// ============================================================================
// Factory Functions
// ============================================================================

export { createEmptyRuntimeState };

export function createEmptySwitchStateMap(): SwitchStateMap {
  return {
    states: new Map(),
  };
}

// ============================================================================
// Switch State Evaluation
// ============================================================================

export function evaluateSwitchStates(
  components: Block[],
  runtimeState: RuntimeState
): SwitchStateMap {
  const states = new Map<string, SwitchState>();

  for (const component of components) {
    const evaluation = evaluateBehaviorSwitch(component, runtimeState);
    if (!evaluation) continue;

    states.set(component.id, {
      componentId: component.id,
      isOpen: !evaluation.conducting,
      stateSource: evaluation.stateSource,
      isNormallyOpen: evaluation.isNormallyOpen,
      isEnergized: evaluation.energized,
    });
  }

  return { states };
}

export function applySwitchStatesToGraph(
  graph: CircuitGraph,
  switchStates: SwitchStateMap
): CircuitGraph {
  const newGraph = cloneGraph(graph);

  for (const [componentId, switchState] of switchStates.states) {
    for (const edgeList of newGraph.edges.values()) {
      for (const edge of edgeList) {
        if (edge.isSwitch && edge.switchComponentId === componentId) {
          edge.conductance = !switchState.isOpen;
        }
      }
    }
  }

  return newGraph;
}

export function getSwitchConductance(
  switchStates: SwitchStateMap,
  componentId: string
): boolean {
  const state = switchStates.states.get(componentId);
  return state ? !state.isOpen : false;
}

export function isSwitchEnergized(
  switchStates: SwitchStateMap,
  componentId: string
): boolean {
  const state = switchStates.states.get(componentId);
  return state?.isEnergized ?? false;
}

// ============================================================================
// Runtime State Mutation Helpers
// ============================================================================

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

export function setDeviceState(
  runtimeState: RuntimeState,
  deviceId: string,
  value: RuntimeDeviceState
): RuntimeState {
  const nextDeviceStates = new Map(runtimeState.deviceStates);
  nextDeviceStates.set(deviceId, {
    ...(nextDeviceStates.get(deviceId) ?? {}),
    ...value,
  });

  return {
    ...runtimeState,
    deviceStates: nextDeviceStates,
  };
}

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
  setDeviceState,
  syncFromModbus,
};
