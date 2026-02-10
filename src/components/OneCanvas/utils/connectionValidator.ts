/**
 * Connection Validation Utilities
 *
 * Validates wire connections between ports following circuit rules.
 */

import type {
  Block,
  Junction,
  Wire,
  WireEndpoint,
  PortEndpoint,
  PortType,
} from '../types';
import { isJunctionEndpoint, isPortEndpoint } from '../types';
import {
  endpointKey,
  isValidEndpoint,
  wireExists as wireExistsHelper,
} from './canvasHelpers';

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  /** Whether the connection is valid */
  valid: boolean;
  /** Reason for invalid connection */
  reason?: string;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Get port direction from a block
 */
export function getPortType(
  block: Block,
  portId: string
): PortType | undefined {
  const port = block.ports.find((p) => p.id === portId);
  return port?.type;
}

/**
 * Check if two ports can connect based on their types
 */
export function arePortTypesCompatible(
  fromType: PortType,
  toType: PortType
): boolean {
  // Bidirectional ports can connect to anything
  if (fromType === 'bidirectional' || toType === 'bidirectional') {
    return true;
  }

  // Output can connect to input
  if (fromType === 'output' && toType === 'input') {
    return true;
  }

  // Input can connect to output
  if (fromType === 'input' && toType === 'output') {
    return true;
  }

  // Same types cannot connect (output-output, input-input)
  return false;
}

/**
 * Check if a wire already exists between two endpoints
 */
export function wireExists(
  wires: Wire[],
  from: WireEndpoint,
  to: WireEndpoint
): boolean {
  return wireExistsHelper(wires, from, to);
}

/**
 * Detect whether adding a wire between from and to would create a cycle.
 * Wires are bidirectional (undirected), so we build an undirected adjacency
 * list and BFS from `to` to see if `from` is already reachable.
 */
export function detectCycle(
  from: WireEndpoint,
  to: WireEndpoint,
  existingWires: Wire[] = []
): boolean {
  const fromKey = endpointKey(from);
  const toKey = endpointKey(to);

  // Self-loop is a trivial cycle
  if (fromKey === toKey) {
    return true;
  }

  // Build undirected adjacency list
  const adjacency = new Map<string, Set<string>>();

  const addEdge = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set<string>());
    adjacency.get(a)!.add(b);
  };

  for (const wire of existingWires) {
    const wireFromKey = endpointKey(wire.from);
    const wireToKey = endpointKey(wire.to);
    addEdge(wireFromKey, wireToKey);
    addEdge(wireToKey, wireFromKey);
  }

  // BFS from `to` — if we can reach `from`, adding this wire creates a cycle
  const queue: string[] = [toKey];
  const visited = new Set<string>([toKey]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === fromKey) {
      return true;
    }

    const neighbors = adjacency.get(current);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return false;
}

/**
 * Validate a wire connection between two endpoints.
 * Currently only validates port-to-port connections.
 */
export function isValidConnection(
  from: WireEndpoint,
  to: WireEndpoint,
  blocks: Map<string, Block>,
  existingWires: Wire[] = [],
  junctions?: Map<string, Junction>
): ValidationResult {
  // Check 1: Endpoints must exist
  if (!isValidEndpoint(from, blocks, junctions)) {
    return { valid: false, reason: 'Source endpoint not found' };
  }

  if (!isValidEndpoint(to, blocks, junctions)) {
    return { valid: false, reason: 'Target endpoint not found' };
  }

  // Check 2: Cannot connect an endpoint to itself
  if (isPortEndpoint(from) && isPortEndpoint(to)) {
    if (from.componentId === to.componentId && from.portId === to.portId) {
      return {
        valid: false,
        reason: 'Cannot connect a port to itself',
      };
    }
  }

  if (isJunctionEndpoint(from) && isJunctionEndpoint(to)) {
    if (from.junctionId === to.junctionId) {
      return {
        valid: false,
        reason: 'Cannot connect a junction to itself',
      };
    }
  }

  if (isPortEndpoint(from) && isPortEndpoint(to)) {
    // Check 3: Cannot connect two ports on the same component
    if (from.componentId === to.componentId) {
      return {
        valid: false,
        reason: 'Cannot connect ports on the same component',
      };
    }

    // Check 4: Both components must exist
    const fromBlock = blocks.get(from.componentId);
    const toBlock = blocks.get(to.componentId);

    if (!fromBlock) {
      return {
        valid: false,
        reason: `Source component not found: ${from.componentId}`,
      };
    }

    if (!toBlock) {
      return {
        valid: false,
        reason: `Target component not found: ${to.componentId}`,
      };
    }

    // Check 5: Both ports must exist
    const fromPortType = getPortType(fromBlock, from.portId);
    const toPortType = getPortType(toBlock, to.portId);

    if (!fromPortType) {
      return {
        valid: false,
        reason: `Source port not found: ${from.portId}`,
      };
    }

    if (!toPortType) {
      return {
        valid: false,
        reason: `Target port not found: ${to.portId}`,
      };
    }

    // Check 6: Port types must be compatible
    if (!arePortTypesCompatible(fromPortType, toPortType)) {
      return {
        valid: false,
        reason: `Incompatible port types: ${fromPortType} cannot connect to ${toPortType}`,
      };
    }

    // Check 6.5: Port capacity limits
    const fromPort = fromBlock.ports.find(p => p.id === from.portId);
    const toPort = toBlock.ports.find(p => p.id === to.portId);

    if (fromPort?.maxConnections !== undefined) {
      const fromConnectionCount = existingWires.filter(w =>
        (isPortEndpoint(w.from) && w.from.componentId === from.componentId && w.from.portId === from.portId) ||
        (isPortEndpoint(w.to) && w.to.componentId === from.componentId && w.to.portId === from.portId)
      ).length;
      if (fromConnectionCount >= fromPort.maxConnections) {
        return {
          valid: false,
          reason: `Source port "${fromPort.label}" has reached its connection limit (${fromPort.maxConnections})`,
        };
      }
    }

    if (toPort?.maxConnections !== undefined) {
      const toConnectionCount = existingWires.filter(w =>
        (isPortEndpoint(w.from) && w.from.componentId === to.componentId && w.from.portId === to.portId) ||
        (isPortEndpoint(w.to) && w.to.componentId === to.componentId && w.to.portId === to.portId)
      ).length;
      if (toConnectionCount >= toPort.maxConnections) {
        return {
          valid: false,
          reason: `Target port "${toPort.label}" has reached its connection limit (${toPort.maxConnections})`,
        };
      }
    }
  }

  // Check 7: Wire must not already exist
  if (wireExists(existingWires, from, to)) {
    return {
      valid: false,
      reason: 'Wire already exists between these ports',
    };
  }

  // Check 8: New wire must not create a cycle
  if (detectCycle(from, to, existingWires)) {
    return {
      valid: false,
      reason: 'Connection would create a cycle',
    };
  }

  return { valid: true };
}

/**
 * Get all valid target ports for a wire from a given source
 */
export function getValidTargets(
  from: WireEndpoint,
  blocks: Map<string, Block>,
  existingWires: Wire[],
  junctions?: Map<string, Junction>
): WireEndpoint[] {
  const validTargets: WireEndpoint[] = [];

  blocks.forEach((block) => {
    block.ports.forEach((port) => {
      const to: PortEndpoint = { componentId: block.id, portId: port.id };
      const validation = isValidConnection(from, to, blocks, existingWires, junctions);

      if (validation.valid) {
        validTargets.push(to);
      }
    });
  });

  return validTargets;
}
