/**
 * Circuit Simulator
 *
 * Main simulation engine that combines graph building, switch evaluation,
 * path finding, and voltage propagation to determine which components are powered.
 */

import type { Block, Wire, Junction } from '../types';
import {
  buildCircuitGraph,
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
  type RuntimeState,
  type SwitchStateMap,
} from './switchEvaluator';
import { buildNets, type Net } from './netBuilder';

// ============================================================================
// Types
// ============================================================================

/**
 * A detected short circuit in the simulation.
 */
export interface ShortCircuit {
  /** Path from power to ground */
  path: string[];
  /** Power source node ID */
  powerSource: string;
  /** Voltage level */
  voltage: number;
}

/**
 * Complete simulation result.
 */
export interface SimulationResult {
  /** Voltage at each node (nodeId -> voltage) */
  nodeVoltages: Map<string, number>;
  /** All current paths found */
  currentPaths: CurrentPath[];
  /** Component IDs that are powered */
  poweredComponents: Set<string>;
  /** Wire IDs that have current flowing */
  poweredWires: Set<string>;
  /** Wire directions for animation (wireId -> direction) */
  wireDirections: Map<string, 'forward' | 'reverse'>;
  /** Detected short circuits */
  shortCircuits: ShortCircuit[];
  /** Switch states used in this simulation */
  switchStates: SwitchStateMap;
  /** Electrical nets (groups of connected endpoints) */
  nets: Net[];
  /** The circuit graph used */
  graph: CircuitGraph;
  /** Whether simulation completed successfully */
  success: boolean;
  /** Error message if simulation failed */
  error?: string;
}

/**
 * Options for simulation.
 */
export interface SimulationOptions {
  /** Maximum path length (default: 100) */
  maxPathLength?: number;
  /** Whether to detect short circuits (default: true) */
  detectShortCircuits?: boolean;
}

// ============================================================================
// Voltage Propagation
// ============================================================================

/**
 * Propagate voltage through the circuit based on current paths.
 * Each node in a complete path gets voltage from its power source.
 *
 * @param graph - The circuit graph
 * @param paths - Current paths found
 * @returns Map of node ID to voltage
 */
export function propagateVoltage(
  graph: CircuitGraph,
  paths: CurrentPath[]
): Map<string, number> {
  const nodeVoltages = new Map<string, number>();

  // Initialize all nodes to 0V
  for (const nodeId of graph.nodes.keys()) {
    nodeVoltages.set(nodeId, 0);
  }

  // Set power source voltages
  for (const powerNodeId of graph.powerNodes) {
    const node = graph.nodes.get(powerNodeId);
    if (node?.sourceVoltage) {
      nodeVoltages.set(powerNodeId, node.sourceVoltage);
    }
  }

  // Propagate voltage through complete paths
  for (const path of paths) {
    if (!path.isComplete || path.isShortCircuit) {
      continue;
    }

    // Each node in the path gets the path voltage
    for (const nodeId of path.nodes) {
      const currentVoltage = nodeVoltages.get(nodeId) ?? 0;
      // Keep the higher voltage if multiple paths converge
      if (path.voltage > currentVoltage) {
        nodeVoltages.set(nodeId, path.voltage);
      }
    }
  }

  return nodeVoltages;
}

/**
 * Determine which load components are actually powered.
 * A component is powered if it has voltage on input AND is part of a complete path.
 *
 * @param nodeVoltages - Voltage at each node
 * @param paths - Current paths found
 * @param components - All components
 * @returns Set of powered component IDs
 */
export function determinePoweredComponents(
  nodeVoltages: Map<string, number>,
  paths: CurrentPath[],
  components: Block[]
): Set<string> {
  const powered = new Set<string>();

  // Get components that are in complete paths
  const componentsInPaths = getPoweredComponents(paths);

  // For load components, verify they have voltage and are in a path
  for (const component of components) {
    // Skip non-load components for powered check
    if (
      component.type === 'power_24v' ||
      component.type === 'power_12v' ||
      component.type === 'gnd'
    ) {
      continue;
    }

    // Check if component is in a complete path
    if (!componentsInPaths.has(component.id)) {
      continue;
    }

    // Check if component has voltage on any port
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

/**
 * Detect short circuits from current paths.
 *
 * @param paths - Current paths found
 * @returns Array of short circuit info
 */
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
// Main Simulation Function
// ============================================================================

/**
 * Run a complete circuit simulation.
 *
 * @param components - Array of circuit blocks
 * @param wires - Array of wire connections
 * @param junctions - Array of junction points
 * @param runtimeState - Runtime state from PLC and user interaction
 * @param options - Simulation options
 * @returns Complete simulation result
 */
export function simulateCircuit(
  components: Block[],
  wires: Wire[],
  junctions: Junction[],
  runtimeState: RuntimeState,
  options: SimulationOptions = {}
): SimulationResult {
  try {
    // 1. Build the circuit graph (including junction nodes)
    const baseGraph = buildCircuitGraph(components, wires, junctions);

    // 2. Evaluate switch states
    const switchStates = evaluateSwitchStates(components, runtimeState);

    // 3. Apply switch states to graph (update edge conductance)
    const graph = applySwitchStatesToGraph(baseGraph, switchStates);

    // 4. Find all current paths
    const currentPaths = findAllCircuitPaths(graph, {
      maxPathLength: options.maxPathLength,
      detectShortCircuits: options.detectShortCircuits,
    });

    // 5. Propagate voltage
    const nodeVoltages = propagateVoltage(graph, currentPaths);

    // 6. Determine powered components
    const poweredComponents = determinePoweredComponents(
      nodeVoltages,
      currentPaths,
      components
    );

    // 7. Get powered wires and directions
    const poweredWires = getPoweredWires(currentPaths);
    const wireDirections = getWireDirections(currentPaths, graph);

    // 8. Detect short circuits
    const shortCircuits = detectShortCircuits(currentPaths);

    // 9. Build nets (union-find grouping of connected endpoints)
    const componentsMap = new Map(components.map((c) => [c.id, c]));
    const junctionsMap = new Map(junctions.map((j) => [j.id, j]));
    const nets = buildNets(wires, componentsMap, junctionsMap);

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
      success: true,
    };
  } catch (error) {
    // Return error result
    return {
      nodeVoltages: new Map(),
      currentPaths: [],
      poweredComponents: new Set(),
      poweredWires: new Set(),
      wireDirections: new Map(),
      shortCircuits: [],
      nets: [],
      switchStates: { states: new Map() },
      graph: {
        nodes: new Map(),
        edges: new Map(),
        powerNodes: [],
        groundNodes: [],
        switchNodes: [],
        loadNodes: [],
      },
      success: false,
      error: error instanceof Error ? error.message : 'Unknown simulation error',
    };
  }
}

/**
 * Get the voltage at a specific component's port.
 *
 * @param result - Simulation result
 * @param componentId - Component ID
 * @param portId - Port ID
 * @returns Voltage at the port, or 0 if not found
 */
export function getPortVoltage(
  result: SimulationResult,
  componentId: string,
  portId: string
): number {
  const nodeId = `${componentId}:${portId}`;
  return result.nodeVoltages.get(nodeId) ?? 0;
}

/**
 * Check if a specific component is powered.
 *
 * @param result - Simulation result
 * @param componentId - Component ID
 * @returns True if component is powered
 */
export function checkComponentPowered(
  result: SimulationResult,
  componentId: string
): boolean {
  return result.poweredComponents.has(componentId);
}

/**
 * Check if a specific wire has current flowing.
 *
 * @param result - Simulation result
 * @param wireId - Wire ID
 * @returns True if wire has current
 */
export function isWirePowered(result: SimulationResult, wireId: string): boolean {
  return result.poweredWires.has(wireId);
}

/**
 * Get the current direction for a wire.
 *
 * @param result - Simulation result
 * @param wireId - Wire ID
 * @returns Direction or null if not powered
 */
export function getWireDirection(
  result: SimulationResult,
  wireId: string
): 'forward' | 'reverse' | null {
  return result.wireDirections.get(wireId) ?? null;
}

/**
 * Get all voltages for a component's ports.
 *
 * @param result - Simulation result
 * @param componentId - Component ID
 * @param component - The component block
 * @returns Map of port ID to voltage
 */
export function getComponentVoltages(
  result: SimulationResult,
  componentId: string,
  component: Block
): Map<string, number> {
  const voltages = new Map<string, number>();

  for (const port of component.ports) {
    const nodeId = `${componentId}:${port.id}`;
    voltages.set(port.id, result.nodeVoltages.get(nodeId) ?? 0);
  }

  return voltages;
}

export default {
  simulateCircuit,
  propagateVoltage,
  determinePoweredComponents,
  detectShortCircuits,
  getPortVoltage,
  checkComponentPowered,
  isWirePowered,
  getWireDirection,
  getComponentVoltages,
};
