/**
 * Circuit Simulator
 *
 * Main simulation engine that combines graph building, switch evaluation,
 * path finding, voltage propagation, and behavior-template-driven live states.
 */

import type { Block, Wire, Junction } from '../types';
import type { ComponentBehaviorState, RuntimeState } from '@/types/behavior';
import {
  buildCircuitGraph,
  getAdjacentNodes,
  type CircuitGraph,
} from './circuitGraph';
import {
  findAllCircuitPaths,
  getPoweredWires,
  getPoweredComponents,
  findShortCircuits,
  getWireDirections,
  type CurrentPath,
} from './pathFinder';
import {
  evaluateSwitchStates,
  applySwitchStatesToGraph,
  type SwitchStateMap,
} from './switchEvaluator';
import { buildNets, type Net } from './netBuilder';
import type { CircuitSolver } from './circuitSolver';
import {
  deriveComponentBehaviorState,
  mergeRuntimeDeviceState,
  resolveBehaviorBinding,
} from '../runtime/behaviorTemplates';

// ============================================================================
// Types
// ============================================================================

export interface ShortCircuit {
  path: string[];
  powerSource: string;
  voltage: number;
}

export interface SimulationResult {
  nodeVoltages: Map<string, number>;
  currentPaths: CurrentPath[];
  poweredComponents: Set<string>;
  poweredWires: Set<string>;
  wireDirections: Map<string, 'forward' | 'reverse'>;
  shortCircuits: ShortCircuit[];
  switchStates: SwitchStateMap;
  nets: Net[];
  graph: CircuitGraph;
  reachableNodes: Set<string>;
  behaviorStates: Map<string, ComponentBehaviorState>;
  resolvedRuntimeState: RuntimeState;
  success: boolean;
  error?: string;
}

export interface SimulationOptions {
  maxPathLength?: number;
  detectShortCircuits?: boolean;
  /** Node-voltage solver. Defaults to the logic-level solver (boolean propagation). */
  solver?: CircuitSolver;
}

// ============================================================================
// Voltage Propagation
// ============================================================================

export function propagateVoltage(
  graph: CircuitGraph,
  paths: CurrentPath[]
): Map<string, number> {
  const nodeVoltages = new Map<string, number>();

  for (const nodeId of graph.nodes.keys()) {
    nodeVoltages.set(nodeId, 0);
  }

  for (const powerNodeId of graph.powerNodes) {
    const node = graph.nodes.get(powerNodeId);
    if (node?.sourceVoltage) {
      nodeVoltages.set(powerNodeId, node.sourceVoltage);
    }
  }

  for (const path of paths) {
    if (!path.isComplete || path.isShortCircuit) {
      continue;
    }

    for (const nodeId of path.nodes) {
      const currentVoltage = nodeVoltages.get(nodeId) ?? 0;
      if (path.voltage > currentVoltage) {
        nodeVoltages.set(nodeId, path.voltage);
      }
    }
  }

  return nodeVoltages;
}

/** Default solver — the existing boolean power-propagation, behind the CircuitSolver seam. */
export const logicSolver: CircuitSolver = {
  id: 'logic',
  solveNodeVoltages: (ctx) => propagateVoltage(ctx.graph, ctx.paths),
};

export function equalizeNetVoltages(
  nodeVoltages: Map<string, number>,
  nets: Net[]
): void {
  for (const net of nets) {
    let maxVoltage = 0;
    for (const memberKey of net.members) {
      const nodeId = memberKey.startsWith('port:')
        ? memberKey.substring(5)
        : memberKey;
      const voltage = nodeVoltages.get(nodeId) ?? 0;
      if (voltage > maxVoltage) {
        maxVoltage = voltage;
      }
    }

    if (maxVoltage > 0) {
      for (const memberKey of net.members) {
        const nodeId = memberKey.startsWith('port:')
          ? memberKey.substring(5)
          : memberKey;
        const currentVoltage = nodeVoltages.get(nodeId) ?? 0;
        if (maxVoltage > currentVoltage) {
          nodeVoltages.set(nodeId, maxVoltage);
        }
      }
      net.voltage = maxVoltage;
    }
  }
}

export function determinePoweredComponents(
  nodeVoltages: Map<string, number>,
  paths: CurrentPath[],
  components: Block[]
): Set<string> {
  const powered = new Set<string>();
  const componentsInPaths = getPoweredComponents(paths);

  for (const component of components) {
    if (component.type === 'powersource' || component.type === 'power_source') {
      continue;
    }

    if (!componentsInPaths.has(component.id)) {
      continue;
    }

    let hasVoltage = false;
    for (const port of component.ports) {
      const nodeId = `${component.id}:${port.id}`;
      const voltage = nodeVoltages.get(nodeId) ?? 0;
      if (voltage > 0) {
        hasVoltage = true;
        break;
      }
    }

    if (hasVoltage) {
      powered.add(component.id);
    }
  }

  return powered;
}

export function detectShortCircuits(paths: CurrentPath[]): ShortCircuit[] {
  const shortCircuits: ShortCircuit[] = [];

  const badPaths = findShortCircuits(paths);
  for (const path of badPaths) {
    shortCircuits.push({
      path: path.nodes,
      powerSource: path.powerSource,
      voltage: path.voltage,
    });
  }

  return shortCircuits;
}

// ============================================================================
// Behavior Helpers
// ============================================================================

export function findReachableNodesFromPower(graph: CircuitGraph): Set<string> {
  const visited = new Set<string>();
  const queue = [...graph.powerNodes];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);

    for (const adjacent of getAdjacentNodes(graph, nodeId, true)) {
      if (!visited.has(adjacent)) {
        queue.push(adjacent);
      }
    }
  }

  return visited;
}

function countReachablePorts(block: Block, reachableNodes: Set<string>): number {
  return block.ports.reduce((count, port) => {
    if (port.id.toLowerCase() === 'pe') {
      return count;
    }
    return reachableNodes.has(`${block.id}:${port.id}`) ? count + 1 : count;
  }, 0);
}

function deriveRuntimeDeviceStates(
  components: Block[],
  poweredComponents: Set<string>,
  reachableNodes: Set<string>,
  runtimeState: RuntimeState
): RuntimeState {
  let nextRuntimeState = runtimeState;

  for (const component of components) {
    const binding = resolveBehaviorBinding(component);
    if (!binding?.deviceId) continue;

    const componentType = String(component.type);
    if (binding.archetype === 'relay' && (componentType === 'relay_coil' || componentType === 'relay')) {
      nextRuntimeState = mergeRuntimeDeviceState(nextRuntimeState, binding.deviceId, {
        energized: poweredComponents.has(component.id),
      });
      continue;
    }

    if (binding.archetype === 'lamp') {
      nextRuntimeState = mergeRuntimeDeviceState(nextRuntimeState, binding.deviceId, {
        lit: poweredComponents.has(component.id),
      });
      continue;
    }

    if (binding.archetype === 'motor') {
      nextRuntimeState = mergeRuntimeDeviceState(nextRuntimeState, binding.deviceId, {
        running: poweredComponents.has(component.id) || countReachablePorts(component, reachableNodes) >= 2,
      });
    }
  }

  return nextRuntimeState;
}

function deriveBehaviorStates(
  components: Block[],
  runtimeState: RuntimeState,
  poweredComponents: Set<string>,
  reachableNodes: Set<string>,
  switchStates: SwitchStateMap,
  nodeVoltages: Map<string, number>
): Map<string, ComponentBehaviorState> {
  const states = new Map<string, ComponentBehaviorState>();

  // Highest solved voltage across a component's ports (0 if none).
  const componentVoltage = (component: Block): number => {
    let max = 0;
    for (const port of component.ports) {
      const v = nodeVoltages.get(`${component.id}:${port.id}`);
      if (v !== undefined && v > max) max = v;
    }
    return max;
  };

  for (const component of components) {
    const switchState = switchStates.states.get(component.id);
    const derived = deriveComponentBehaviorState(
      component,
      runtimeState,
      poweredComponents.has(component.id),
      countReachablePorts(component, reachableNodes) >= 2,
      switchState
        ? {
            componentId: component.id,
            deviceId: component.behavior?.deviceId,
            stateSource: switchState.stateSource,
            energized: switchState.isEnergized,
            isNormallyOpen: switchState.isNormallyOpen,
            conducting: !switchState.isOpen,
            visualState: !switchState.isOpen ? 'closed' : 'open',
          }
        : null
    );

    if (derived) {
      derived.voltage = componentVoltage(component);
      states.set(component.id, derived);
    }
  }

  return states;
}

// ============================================================================
// Main Simulation Function
// ============================================================================

export function simulateCircuit(
  components: Block[],
  wires: Wire[],
  junctions: Junction[],
  runtimeState: RuntimeState,
  options: SimulationOptions = {}
): SimulationResult {
  try {
    const solver = options.solver ?? logicSolver;
    const baseGraph = buildCircuitGraph(components, wires, junctions);

    const switchStatesPre = evaluateSwitchStates(components, runtimeState);
    const graphPre = applySwitchStatesToGraph(baseGraph, switchStatesPre);
    const currentPathsPre = findAllCircuitPaths(graphPre, {
      maxPathLength: options.maxPathLength,
      detectShortCircuits: options.detectShortCircuits,
    });
    const nodeVoltagesPre = solver.solveNodeVoltages({
      graph: graphPre, paths: currentPathsPre, components, wires, junctions,
    });
    const poweredComponentsPre = determinePoweredComponents(
      nodeVoltagesPre,
      currentPathsPre,
      components
    );
    const reachableNodesPre = findReachableNodesFromPower(graphPre);

    const runtimeWithDerivedDevices = deriveRuntimeDeviceStates(
      components,
      poweredComponentsPre,
      reachableNodesPre,
      runtimeState
    );

    const switchStates = evaluateSwitchStates(components, runtimeWithDerivedDevices);
    const graph = applySwitchStatesToGraph(baseGraph, switchStates);
    const currentPaths = findAllCircuitPaths(graph, {
      maxPathLength: options.maxPathLength,
      detectShortCircuits: options.detectShortCircuits,
    });
    const nodeVoltages = solver.solveNodeVoltages({
      graph, paths: currentPaths, components, wires, junctions,
    });

    const componentsMap = new Map(components.map((c) => [c.id, c]));
    const junctionsMap = new Map(junctions.map((j) => [j.id, j]));
    const nets = buildNets(wires, componentsMap, junctionsMap);

    const poweredComponents = determinePoweredComponents(
      nodeVoltages,
      currentPaths,
      components
    );

    const poweredWires = getPoweredWires(currentPaths);
    const wireDirections = getWireDirections(currentPaths, graph);
    const shortCircuits = detectShortCircuits(currentPaths);
    const reachableNodes = findReachableNodesFromPower(graph);
    const resolvedRuntimeState = deriveRuntimeDeviceStates(
      components,
      poweredComponents,
      reachableNodes,
      runtimeWithDerivedDevices
    );
    const behaviorStates = deriveBehaviorStates(
      components,
      resolvedRuntimeState,
      poweredComponents,
      reachableNodes,
      switchStates,
      nodeVoltages
    );

    return {
      nodeVoltages,
      currentPaths,
      poweredComponents,
      poweredWires,
      wireDirections,
      shortCircuits,
      nets,
      switchStates,
      graph,
      reachableNodes,
      behaviorStates,
      resolvedRuntimeState,
      success: true,
    };
  } catch (error) {
    const fallbackGraph = buildCircuitGraph(components, wires, junctions);
    return {
      nodeVoltages: new Map(),
      currentPaths: [],
      poweredComponents: new Set(),
      poweredWires: new Set(),
      wireDirections: new Map(),
      shortCircuits: [],
      nets: [],
      switchStates: { states: new Map() },
      graph: fallbackGraph,
      reachableNodes: new Set(),
      behaviorStates: new Map(),
      resolvedRuntimeState: runtimeState,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}


export default {
  simulateCircuit,
  propagateVoltage,
  equalizeNetVoltages,
  determinePoweredComponents,
  detectShortCircuits,
  findReachableNodesFromPower,
};


