/**
 * Connection Validation Utilities
 *
 * Validates wire connections between ports following circuit rules.
 */

import type { Block, Wire, WireEndpoint, PortType } from '../types';

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
  return wires.some(
    (wire) =>
      // Check both directions
      (wire.from.componentId === from.componentId &&
        wire.from.portId === from.portId &&
        wire.to.componentId === to.componentId &&
        wire.to.portId === to.portId) ||
      (wire.from.componentId === to.componentId &&
        wire.from.portId === to.portId &&
        wire.to.componentId === from.componentId &&
        wire.to.portId === from.portId)
  );
}

/**
 * Validate a wire connection between two endpoints
 */
export function isValidConnection(
  from: WireEndpoint,
  to: WireEndpoint,
  blocks: Map<string, Block>,
  existingWires: Wire[] = []
): ValidationResult {
  // Check 1: Cannot connect same port to itself
  if (from.componentId === to.componentId && from.portId === to.portId) {
    return {
      valid: false,
      reason: 'Cannot connect a port to itself',
    };
  }

  // Check 2: Cannot connect two ports on the same component
  if (from.componentId === to.componentId) {
    return {
      valid: false,
      reason: 'Cannot connect ports on the same component',
    };
  }

  // Check 3: Both components must exist
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

  // Check 4: Both ports must exist
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

  // Check 5: Port types must be compatible
  if (!arePortTypesCompatible(fromPortType, toPortType)) {
    return {
      valid: false,
      reason: `Incompatible port types: ${fromPortType} cannot connect to ${toPortType}`,
    };
  }

  // Check 6: Wire must not already exist
  if (wireExists(existingWires, from, to)) {
    return {
      valid: false,
      reason: 'Wire already exists between these ports',
    };
  }

  return { valid: true };
}

/**
 * Check if a port can accept more connections
 */
export function canAcceptConnection(
  block: Block,
  portId: string,
  existingWires: Wire[]
): boolean {
  const port = block.ports.find((p) => p.id === portId);
  if (!port) return false;

  // Count existing connections to this port
  const connectionCount = existingWires.filter(
    (wire) =>
      (wire.from.componentId === block.id && wire.from.portId === portId) ||
      (wire.to.componentId === block.id && wire.to.portId === portId)
  ).length;

  // For now, allow unlimited connections (branching)
  // In future, could limit based on port configuration
  return connectionCount < 100; // Reasonable limit
}

/**
 * Get all valid target ports for a wire from a given source
 */
export function getValidTargets(
  from: WireEndpoint,
  blocks: Map<string, Block>,
  existingWires: Wire[]
): WireEndpoint[] {
  const validTargets: WireEndpoint[] = [];

  blocks.forEach((block) => {
    block.ports.forEach((port) => {
      const to: WireEndpoint = { componentId: block.id, portId: port.id };
      const validation = isValidConnection(from, to, blocks, existingWires);

      if (validation.valid) {
        validTargets.push(to);
      }
    });
  });

  return validTargets;
}
