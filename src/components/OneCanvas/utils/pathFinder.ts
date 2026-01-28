/**
 * Path Finder
 *
 * BFS/DFS-based path finding utilities to discover all current paths
 * from power sources to ground nodes through the circuit graph.
 */

import type { CircuitGraph } from './circuitGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * A current path from a power source to ground.
 */
export interface CurrentPath {
  /** Ordered list of node IDs from power to ground */
  nodes: string[];
  /** Wire IDs traversed in this path */
  wireIds: string[];
  /** Starting power node ID */
  powerSource: string;
  /** Voltage level of this path */
  voltage: number;
  /** True if path reaches ground (complete circuit) */
  isComplete: boolean;
  /** True if this is a short circuit (power to ground with no load) */
  isShortCircuit: boolean;
}

/**
 * Options for path finding.
 */
export interface PathFinderOptions {
  /** Maximum path length to prevent infinite loops (default: 100) */
  maxPathLength?: number;
  /** Whether to detect short circuits (default: true) */
  detectShortCircuits?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_PATH_LENGTH = 100;

// ============================================================================
// Path Finding Implementation
// ============================================================================

/**
 * Find all current paths from a specific power node to any ground node.
 * Uses BFS to find all paths, only traversing conductive edges.
 *
 * @param graph - The circuit graph with switch states applied
 * @param powerNodeId - The starting power source node ID
 * @param options - Path finding options
 * @returns Array of current paths found
 */
export function findCurrentPaths(
  graph: CircuitGraph,
  powerNodeId: string,
  options: PathFinderOptions = {}
): CurrentPath[] {
  const { maxPathLength = DEFAULT_MAX_PATH_LENGTH, detectShortCircuits = true } = options;

  const paths: CurrentPath[] = [];
  const powerNode = graph.nodes.get(powerNodeId);

  if (!powerNode) {
    return paths;
  }

  const voltage = powerNode.sourceVoltage ?? 0;
  const groundNodeSet = new Set(graph.groundNodes);

  // BFS with path tracking
  // Each queue item: [currentNodeId, pathSoFar, wireIdsSoFar, visitedSet, hasLoad]
  type QueueItem = [string, string[], string[], Set<string>, boolean];
  const queue: QueueItem[] = [[powerNodeId, [powerNodeId], [], new Set([powerNodeId]), false]];

  while (queue.length > 0) {
    const [currentNode, pathNodes, pathWires, visited, hasLoad] = queue.shift()!;

    // Check if we've reached a ground node
    if (groundNodeSet.has(currentNode)) {
      const isShortCircuit = detectShortCircuits && !hasLoad;
      paths.push({
        nodes: pathNodes,
        wireIds: pathWires,
        powerSource: powerNodeId,
        voltage,
        isComplete: true,
        isShortCircuit,
      });
      continue; // Found complete path, don't continue from ground
    }

    // Check path length limit
    if (pathNodes.length >= maxPathLength) {
      continue;
    }

    // Get all conductive edges from current node
    const edges = graph.edges.get(currentNode) ?? [];

    for (const edge of edges) {
      // Skip non-conductive edges (open switches)
      if (!edge.conductance) {
        continue;
      }

      // Skip already visited nodes (prevent cycles)
      if (visited.has(edge.to)) {
        continue;
      }

      // Check if this edge passes through a load
      const targetNode = graph.nodes.get(edge.to);
      const newHasLoad = hasLoad || targetNode?.type === 'load';

      // Create new path state
      const newPathNodes = [...pathNodes, edge.to];
      const newPathWires = edge.wireId ? [...pathWires, edge.wireId] : pathWires;
      const newVisited = new Set(visited);
      newVisited.add(edge.to);

      queue.push([edge.to, newPathNodes, newPathWires, newVisited, newHasLoad]);
    }
  }

  return paths;
}

/**
 * Find all current paths from all power sources to ground.
 *
 * @param graph - The circuit graph with switch states applied
 * @param options - Path finding options
 * @returns Array of all current paths found
 */
export function findAllCircuitPaths(
  graph: CircuitGraph,
  options: PathFinderOptions = {}
): CurrentPath[] {
  const allPaths: CurrentPath[] = [];

  for (const powerNodeId of graph.powerNodes) {
    const paths = findCurrentPaths(graph, powerNodeId, options);
    allPaths.push(...paths);
  }

  return allPaths;
}

/**
 * Get all wire IDs that are part of any current path.
 *
 * @param paths - Array of current paths
 * @returns Set of wire IDs that have current flowing through them
 */
export function getPoweredWires(paths: CurrentPath[]): Set<string> {
  const poweredWires = new Set<string>();

  for (const path of paths) {
    if (path.isComplete && !path.isShortCircuit) {
      for (const wireId of path.wireIds) {
        poweredWires.add(wireId);
      }
    }
  }

  return poweredWires;
}

/**
 * Get all node IDs that have voltage (are part of a complete circuit path).
 *
 * @param paths - Array of current paths
 * @returns Map of node ID to voltage level
 */
export function getPoweredNodes(paths: CurrentPath[]): Map<string, number> {
  const poweredNodes = new Map<string, number>();

  for (const path of paths) {
    if (path.isComplete && !path.isShortCircuit) {
      for (const nodeId of path.nodes) {
        // If node already has voltage, keep the higher one
        const existingVoltage = poweredNodes.get(nodeId) ?? 0;
        if (path.voltage > existingVoltage) {
          poweredNodes.set(nodeId, path.voltage);
        }
      }
    }
  }

  return poweredNodes;
}

/**
 * Determine current flow direction for a specific wire.
 * Direction is from power source toward ground.
 *
 * @param paths - Array of current paths
 * @param wireId - The wire ID to check
 * @returns 'forward' if current flows from->to, 'reverse' if to->from, null if no current
 */
export function getWireCurrentDirection(
  paths: CurrentPath[],
  wireId: string,
  graph: CircuitGraph
): 'forward' | 'reverse' | null {
  // Find a path containing this wire
  for (const path of paths) {
    if (!path.isComplete || path.isShortCircuit) {
      continue;
    }

    // Check if this wire is in the path
    if (!path.wireIds.includes(wireId)) {
      continue;
    }

    // Find the edge with this wire to determine direction
    for (let i = 0; i < path.nodes.length - 1; i++) {
      const fromNode = path.nodes[i];
      const toNode = path.nodes[i + 1];
      const edges = graph.edges.get(fromNode) ?? [];
      const edge = edges.find((e) => e.to === toNode && e.wireId === wireId);

      if (edge) {
        // In path order (power to ground), this is the forward direction
        return 'forward';
      }
    }
  }

  return null;
}

/**
 * Build a map of wire directions for animation purposes.
 *
 * @param paths - Array of current paths
 * @param graph - The circuit graph
 * @returns Map of wire ID to direction
 */
export function getWireDirections(
  paths: CurrentPath[],
  graph: CircuitGraph
): Map<string, 'forward' | 'reverse'> {
  const directions = new Map<string, 'forward' | 'reverse'>();
  const poweredWires = getPoweredWires(paths);

  for (const wireId of poweredWires) {
    const direction = getWireCurrentDirection(paths, wireId, graph);
    if (direction) {
      directions.set(wireId, direction);
    }
  }

  return directions;
}

/**
 * Find short circuits in the paths.
 *
 * @param paths - Array of current paths
 * @returns Array of paths that are short circuits
 */
export function findShortCircuits(paths: CurrentPath[]): CurrentPath[] {
  return paths.filter((path) => path.isComplete && path.isShortCircuit);
}

/**
 * Check if a specific component is powered (has a complete path through it).
 *
 * @param paths - Array of current paths
 * @param componentId - The component ID to check
 * @returns True if component is in a complete circuit path
 */
export function isComponentPowered(paths: CurrentPath[], componentId: string): boolean {
  for (const path of paths) {
    if (!path.isComplete || path.isShortCircuit) {
      continue;
    }

    // Check if any node in path belongs to this component
    for (const nodeId of path.nodes) {
      if (nodeId.startsWith(`${componentId}:`)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get all powered component IDs.
 *
 * @param paths - Array of current paths
 * @returns Set of component IDs that are powered
 */
export function getPoweredComponents(paths: CurrentPath[]): Set<string> {
  const powered = new Set<string>();

  for (const path of paths) {
    if (!path.isComplete || path.isShortCircuit) {
      continue;
    }

    for (const nodeId of path.nodes) {
      const [componentId] = nodeId.split(':');
      powered.add(componentId);
    }
  }

  return powered;
}

export default {
  findCurrentPaths,
  findAllCircuitPaths,
  getPoweredWires,
  getPoweredNodes,
  getWireCurrentDirection,
  getWireDirections,
  findShortCircuits,
  isComponentPowered,
  getPoweredComponents,
};
