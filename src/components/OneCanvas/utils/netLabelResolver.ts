/**
 * Net Label Resolver
 *
 * Resolves net labels to create virtual electrical connections.
 * All net labels with the same name are electrically connected,
 * even without physical wires between them.
 */

import type { Block, Wire, WireEndpoint } from '../types';

// ============================================================================
// Types
// ============================================================================

/** Net group containing all blocks connected to a named net */
export interface NetGroup {
  /** Net name (e.g., "+24V", "GND") */
  name: string;
  /** Block IDs that are part of this net via net labels */
  blockIds: string[];
  /** Port IDs for each block (format: "blockId:portId") */
  portEndpoints: string[];
}

/** Map of net name -> NetGroup */
export type NetMap = Map<string, NetGroup>;

/** Virtual wire representing a net label connection */
export interface VirtualWire {
  /** Source endpoint */
  from: WireEndpoint;
  /** Target endpoint */
  to: WireEndpoint;
  /** Net name this wire belongs to */
  netName: string;
  /** Flag to identify as virtual (not physical) */
  isVirtual: true;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Build a map of net names to their connected components.
 *
 * @param components - Map of all circuit components
 * @returns Map of net name -> NetGroup
 */
export function buildNetMap(components: Map<string, Block>): NetMap {
  const netMap: NetMap = new Map();

  for (const [id, block] of components) {
    if (block.type !== 'net_label') continue;

    const netName = (block as any).netName?.toUpperCase().trim();
    if (!netName) continue;

    const portId = block.ports[0]?.id || 'conn';
    const endpoint = `${id}:${portId}`;

    const existing = netMap.get(netName);
    if (existing) {
      existing.blockIds.push(id);
      existing.portEndpoints.push(endpoint);
    } else {
      netMap.set(netName, {
        name: netName,
        blockIds: [id],
        portEndpoints: [endpoint],
      });
    }
  }

  return netMap;
}

/**
 * Get all virtual wires that should be created from net labels.
 *
 * For each net with multiple labels, creates virtual connections
 * between all the labels (star topology from first label).
 *
 * @param components - Map of all circuit components
 * @returns Array of virtual wires
 */
export function getVirtualWiresFromNetLabels(
  components: Map<string, Block>
): VirtualWire[] {
  const netMap = buildNetMap(components);
  const virtualWires: VirtualWire[] = [];

  for (const [netName, group] of netMap) {
    // Only create virtual wires if there are 2+ labels with same name
    if (group.blockIds.length < 2) continue;

    // Create star topology: first label connects to all others
    const primaryId = group.blockIds[0];
    const primaryBlock = components.get(primaryId);
    if (!primaryBlock) continue;

    const primaryPortId = primaryBlock.ports[0]?.id || 'conn';

    for (let i = 1; i < group.blockIds.length; i++) {
      const secondaryId = group.blockIds[i];
      const secondaryBlock = components.get(secondaryId);
      if (!secondaryBlock) continue;

      const secondaryPortId = secondaryBlock.ports[0]?.id || 'conn';

      virtualWires.push({
        from: { componentId: primaryId, portId: primaryPortId },
        to: { componentId: secondaryId, portId: secondaryPortId },
        netName,
        isVirtual: true,
      });
    }
  }

  return virtualWires;
}

/**
 * Find all endpoints that are electrically connected via net labels.
 *
 * @param endpoint - Starting endpoint to find connections for
 * @param components - Map of all circuit components
 * @returns Array of connected endpoint strings ("blockId:portId")
 */
export function findNetConnectedEndpoints(
  endpoint: string,
  components: Map<string, Block>
): string[] {
  const [blockId] = endpoint.split(':');
  const block = components.get(blockId);

  if (!block || block.type !== 'net_label') {
    return [];
  }

  const netName = (block as any).netName?.toUpperCase().trim();
  if (!netName) {
    return [];
  }

  const netMap = buildNetMap(components);
  const group = netMap.get(netName);

  if (!group) {
    return [];
  }

  // Return all endpoints except the queried one
  return group.portEndpoints.filter((ep) => ep !== endpoint);
}

/**
 * Get all unique net names used in the circuit.
 *
 * @param components - Map of all circuit components
 * @returns Sorted array of net names
 */
export function getAllNetNames(components: Map<string, Block>): string[] {
  const netMap = buildNetMap(components);
  return Array.from(netMap.keys()).sort();
}

/**
 * Check if a net name has multiple labels (actual net connections).
 *
 * @param netName - Net name to check
 * @param components - Map of all circuit components
 * @returns True if net has 2+ labels
 */
export function hasMultipleLabels(
  netName: string,
  components: Map<string, Block>
): boolean {
  const netMap = buildNetMap(components);
  const group = netMap.get(netName.toUpperCase().trim());
  return group ? group.blockIds.length >= 2 : false;
}

/**
 * Merge physical wires with virtual wires from net labels.
 *
 * This creates a complete wire list that includes both physical
 * connections and virtual net label connections for circuit analysis.
 *
 * @param physicalWires - Array of physical wires
 * @param components - Map of all circuit components
 * @returns Combined array of wires (physical + virtual)
 */
export function mergePhysicalAndVirtualWires(
  physicalWires: Wire[],
  components: Map<string, Block>
): Array<Wire | VirtualWire> {
  const virtualWires = getVirtualWiresFromNetLabels(components);
  return [...physicalWires, ...virtualWires];
}
