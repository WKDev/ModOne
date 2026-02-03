/**
 * Circuit Graph Builder
 *
 * Converts canvas components and wires into a traversable graph structure
 * suitable for circuit simulation.
 */

import type { Block, Wire, Port } from '../types';
import { isPortEndpoint } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Types of circuit nodes for simulation purposes.
 */
export type CircuitNodeType = 'power' | 'ground' | 'switch' | 'load' | 'junction' | 'input';

/**
 * A node in the circuit graph, representing a component port.
 */
export interface CircuitNode {
  /** Unique node ID (format: componentId:portId) */
  id: string;
  /** ID of the component this node belongs to */
  componentId: string;
  /** ID of the port on the component */
  portId: string;
  /** Type of node for simulation */
  type: CircuitNodeType;
  /** Voltage at this node (set during simulation) */
  voltage?: number;
  /** Source voltage level for power nodes (24 or 12) */
  sourceVoltage?: number;
}

/**
 * An edge in the circuit graph, representing a wire or internal connection.
 */
export interface CircuitEdge {
  /** ID of the source node */
  from: string;
  /** ID of the target node */
  to: string;
  /** ID of the wire (undefined for internal component connections) */
  wireId?: string;
  /** Whether current can flow through this edge */
  conductance: boolean;
  /** Whether this edge is a switch that can change state */
  isSwitch: boolean;
  /** Component ID if this edge represents a switch */
  switchComponentId?: string;
}

/**
 * The complete circuit graph structure.
 */
export interface CircuitGraph {
  /** All nodes in the graph */
  nodes: Map<string, CircuitNode>;
  /** Adjacency list of edges (nodeId -> array of edges from that node) */
  edges: Map<string, CircuitEdge[]>;
  /** IDs of power source nodes */
  powerNodes: string[];
  /** IDs of ground nodes */
  groundNodes: string[];
  /** IDs of switch component nodes */
  switchNodes: string[];
  /** IDs of load component nodes (LED, etc.) */
  loadNodes: string[];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique node ID from component and port IDs.
 */
export function makeNodeId(componentId: string, portId: string): string {
  return `${componentId}:${portId}`;
}

/**
 * Parse a node ID back into component and port IDs.
 */
export function parseNodeId(nodeId: string): { componentId: string; portId: string } {
  const [componentId, portId] = nodeId.split(':');
  return { componentId, portId };
}

/**
 * Determine the circuit node type based on block type.
 */
function getNodeType(blockType: Block['type'], portType: Port['type']): CircuitNodeType {
  switch (blockType) {
    case 'power_24v':
    case 'power_12v':
      return 'power';
    case 'gnd':
      return 'ground';
    case 'plc_out':
    case 'button':
      return 'switch';
    case 'led':
    case 'scope':
      return 'load';
    case 'plc_in':
      return 'input';
    default:
      return portType === 'input' ? 'load' : 'junction';
  }
}

/**
 * Get the source voltage for power blocks.
 */
function getSourceVoltage(blockType: Block['type']): number | undefined {
  switch (blockType) {
    case 'power_24v':
      return 24;
    case 'power_12v':
      return 12;
    default:
      return undefined;
  }
}

/**
 * Check if a block type represents a switch (can open/close circuit).
 */
export function isSwitchBlock(blockType: Block['type']): boolean {
  return blockType === 'plc_out' || blockType === 'button';
}

// ============================================================================
// Graph Building
// ============================================================================

/**
 * Build a circuit graph from components and wires.
 *
 * @param components - Array of circuit blocks
 * @param wires - Array of wire connections
 * @returns The constructed circuit graph
 */
export function buildCircuitGraph(components: Block[], wires: Wire[]): CircuitGraph {
  const nodes = new Map<string, CircuitNode>();
  const edges = new Map<string, CircuitEdge[]>();
  const powerNodes: string[] = [];
  const groundNodes: string[] = [];
  const switchNodes: string[] = [];
  const loadNodes: string[] = [];

  // Create nodes for each component port
  for (const component of components) {
    for (const port of component.ports) {
      const nodeId = makeNodeId(component.id, port.id);
      const nodeType = getNodeType(component.type, port.type);
      const sourceVoltage = getSourceVoltage(component.type);

      const node: CircuitNode = {
        id: nodeId,
        componentId: component.id,
        portId: port.id,
        type: nodeType,
        sourceVoltage,
      };

      nodes.set(nodeId, node);
      edges.set(nodeId, []);

      // Track special nodes
      if (nodeType === 'power') {
        powerNodes.push(nodeId);
      } else if (nodeType === 'ground') {
        groundNodes.push(nodeId);
      } else if (nodeType === 'switch') {
        switchNodes.push(nodeId);
      } else if (nodeType === 'load') {
        loadNodes.push(nodeId);
      }
    }

    // Create internal edges for switch components (connecting their ports)
    if (isSwitchBlock(component.type) && component.ports.length >= 2) {
      const inputPort = component.ports.find((p) => p.type === 'input');
      const outputPort = component.ports.find((p) => p.type === 'output');

      if (inputPort && outputPort) {
        const fromId = makeNodeId(component.id, inputPort.id);
        const toId = makeNodeId(component.id, outputPort.id);

        // Add bidirectional switch edges (conductance will be set during simulation)
        const forwardEdge: CircuitEdge = {
          from: fromId,
          to: toId,
          conductance: false, // Default to open, evaluated during simulation
          isSwitch: true,
          switchComponentId: component.id,
        };

        const reverseEdge: CircuitEdge = {
          from: toId,
          to: fromId,
          conductance: false,
          isSwitch: true,
          switchComponentId: component.id,
        };

        edges.get(fromId)?.push(forwardEdge);
        edges.get(toId)?.push(reverseEdge);
      }
    }

    // Create internal edges for non-switch components (direct connection between ports)
    if (!isSwitchBlock(component.type) && component.ports.length >= 2) {
      // For components like LEDs, connect input to output internally
      const inputPorts = component.ports.filter((p) => p.type === 'input');
      const outputPorts = component.ports.filter((p) => p.type === 'output');

      for (const inputPort of inputPorts) {
        for (const outputPort of outputPorts) {
          const fromId = makeNodeId(component.id, inputPort.id);
          const toId = makeNodeId(component.id, outputPort.id);

          // Add bidirectional edges (always conductive for non-switches)
          const forwardEdge: CircuitEdge = {
            from: fromId,
            to: toId,
            conductance: true,
            isSwitch: false,
          };

          const reverseEdge: CircuitEdge = {
            from: toId,
            to: fromId,
            conductance: true,
            isSwitch: false,
          };

          edges.get(fromId)?.push(forwardEdge);
          edges.get(toId)?.push(reverseEdge);
        }
      }
    }
  }

  // Create edges from wires
  for (const wire of wires) {
    // Only port-to-port wires create edges (junction wires handled separately in future)
    if (!isPortEndpoint(wire.from) || !isPortEndpoint(wire.to)) continue;

    const fromId = makeNodeId(wire.from.componentId, wire.from.portId);
    const toId = makeNodeId(wire.to.componentId, wire.to.portId);

    // Skip if nodes don't exist (invalid wire)
    if (!nodes.has(fromId) || !nodes.has(toId)) {
      continue;
    }

    // Add bidirectional wire edges (always conductive)
    const forwardEdge: CircuitEdge = {
      from: fromId,
      to: toId,
      wireId: wire.id,
      conductance: true,
      isSwitch: false,
    };

    const reverseEdge: CircuitEdge = {
      from: toId,
      to: fromId,
      wireId: wire.id,
      conductance: true,
      isSwitch: false,
    };

    edges.get(fromId)?.push(forwardEdge);
    edges.get(toId)?.push(reverseEdge);
  }

  return {
    nodes,
    edges,
    powerNodes,
    groundNodes,
    switchNodes,
    loadNodes,
  };
}

/**
 * Get all adjacent nodes from a given node (following conductive edges).
 *
 * @param graph - The circuit graph
 * @param nodeId - The source node ID
 * @param conductiveOnly - Only return nodes connected by conductive edges
 * @returns Array of adjacent node IDs
 */
export function getAdjacentNodes(
  graph: CircuitGraph,
  nodeId: string,
  conductiveOnly: boolean = true
): string[] {
  const edgeList = graph.edges.get(nodeId) ?? [];
  return edgeList
    .filter((edge) => !conductiveOnly || edge.conductance)
    .map((edge) => edge.to);
}

/**
 * Get edge between two nodes if it exists.
 *
 * @param graph - The circuit graph
 * @param fromId - Source node ID
 * @param toId - Target node ID
 * @returns The edge or undefined if not found
 */
export function getEdge(
  graph: CircuitGraph,
  fromId: string,
  toId: string
): CircuitEdge | undefined {
  const edgeList = graph.edges.get(fromId) ?? [];
  return edgeList.find((edge) => edge.to === toId);
}

/**
 * Clone a circuit graph (for applying switch states without modifying original).
 */
export function cloneGraph(graph: CircuitGraph): CircuitGraph {
  const nodes = new Map<string, CircuitNode>();
  const edges = new Map<string, CircuitEdge[]>();

  for (const [id, node] of graph.nodes) {
    nodes.set(id, { ...node });
  }

  for (const [id, edgeList] of graph.edges) {
    edges.set(
      id,
      edgeList.map((edge) => ({ ...edge }))
    );
  }

  return {
    nodes,
    edges,
    powerNodes: [...graph.powerNodes],
    groundNodes: [...graph.groundNodes],
    switchNodes: [...graph.switchNodes],
    loadNodes: [...graph.loadNodes],
  };
}

export default {
  buildCircuitGraph,
  makeNodeId,
  parseNodeId,
  getAdjacentNodes,
  getEdge,
  cloneGraph,
  isSwitchBlock,
};
