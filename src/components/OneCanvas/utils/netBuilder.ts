/**
 * Net Builder — Union-Find based net grouping
 *
 * Groups electrically connected ports and junctions into "nets".
 * A net represents a set of endpoints that share the same electrical potential.
 */

import type { Wire, Block, Junction } from '../types';
import { isPortEndpoint } from '../types';
import { endpointKey } from './canvasHelpers';

// ============================================================================
// Types
// ============================================================================

/** A net: a group of electrically connected endpoints */
export interface Net {
  /** Unique net identifier (the union-find root key) */
  id: string;
  /** All endpoint keys in this net ("port:comp:portId" | "junction:juncId") */
  members: Set<string>;
  /** Assigned voltage (set during simulation) */
  voltage?: number;
}

// ============================================================================
// Union-Find
// ============================================================================

export class UnionFind {
  parent: Map<string, string>;
  rank: Map<string, number>;

  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  /** Ensure element exists in the structure */
  private makeSet(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  /** Find the root representative of x (with path compression) */
  find(x: string): string {
    this.makeSet(x);
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let current = x;
    while (current !== root) {
      const next = this.parent.get(current)!;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  /** Union two elements into the same set (union by rank) */
  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;

    const rankX = this.rank.get(rootX)!;
    const rankY = this.rank.get(rootY)!;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }
}

// ============================================================================
// Net Building
// ============================================================================

/**
 * Build nets from wires, components, and junctions.
 *
 * Iterates all wires and unions the `from` and `to` endpoints.
 * After processing, groups endpoints with the same root into Net objects.
 *
 * @param wires - All wire connections
 * @param components - Component map (for validation)
 * @param junctions - Junction map (for validation)
 * @returns Array of nets
 */
export function buildNets(
  wires: Wire[],
  components: Map<string, Block>,
  junctions: Map<string, Junction>
): Net[] {
  const uf = new UnionFind();

  // Register all component port endpoints
  for (const [, component] of components) {
    for (const port of component.ports) {
      const key = `port:${component.id}:${port.id}`;
      uf.find(key); // ensure it exists in the structure
    }
  }

  // Register all junction endpoints
  for (const [, junction] of junctions) {
    const key = `junction:${junction.id}`;
    uf.find(key);
  }

  // Union wire endpoints
  for (const wire of wires) {
    const fromKey = endpointKey(wire.from);
    const toKey = endpointKey(wire.to);

    // Validate endpoints exist
    const fromValid = isPortEndpoint(wire.from)
      ? components.has(wire.from.componentId)
      : junctions.has(wire.from.junctionId);
    const toValid = isPortEndpoint(wire.to)
      ? components.has(wire.to.componentId)
      : junctions.has(wire.to.junctionId);

    if (fromValid && toValid) {
      uf.union(fromKey, toKey);
    }
  }

  // Group by root
  const netMap = new Map<string, Set<string>>();
  for (const key of uf.parent.keys()) {
    const root = uf.find(key);
    if (!netMap.has(root)) {
      netMap.set(root, new Set());
    }
    netMap.get(root)!.add(key);
  }

  // Convert to Net array (only nets with 2+ members are meaningful)
  const nets: Net[] = [];
  for (const [id, members] of netMap) {
    if (members.size >= 2) {
      nets.push({ id, members });
    }
  }

  return nets;
}
