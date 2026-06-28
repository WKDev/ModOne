// 회로 그래프 → MNA용 저항 DC 모델 추출 (전원=전압원, 부하=저항, 접지=기준 0V, 와이어/닫힌스위치=단락)
import type { Block } from '../../types';
import type { CircuitGraph, CircuitNode } from '../circuitGraph';
import type { DcModel } from './dcAnalysis';

/** Default load resistance per block type (Ω); falls back to GENERIC. */
const GENERIC_LOAD_R = 1000;
const LOAD_R_BY_TYPE: Record<string, number> = {
  led: 200,
  pilot_lamp: 300,
  relay: 200,
  relay_coil: 200,
  motor: 50,
  solenoid_valve: 100,
  resistor: 1000,
};

export interface ResistiveModelBuild {
  model: DcModel;
  /** graph node id → MNA node index (ground reps → 0). */
  nodeIndexByGraphNode: Map<string, number>;
}

// ── Union-Find over graph node ids ──
class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    let p = this.parent.get(x);
    if (p === undefined) { this.parent.set(x, x); return x; }
    if (p !== x) { p = this.find(p); this.parent.set(x, p); }
    return p;
  }
  union(a: string, b: string): void {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/**
 * Extract a resistive DC model from the (switch-resolved) circuit graph.
 * - Wires and closed switches are ideal shorts → merged into one MNA node.
 * - Ground nodes are tied to the reference (index 0).
 * - Power nodes (sourceVoltage) become ideal voltage sources to ground.
 * - Two-terminal load components become resistors (archetype default R).
 */
export function buildResistiveModel(graph: CircuitGraph, components: Block[] = []): ResistiveModelBuild {
  const typeById = new Map(components.map((c) => [c.id, c.type as string]));
  const uf = new UnionFind();
  for (const id of graph.nodes.keys()) uf.find(id); // seed

  // Merge ideal shorts: wires + closed switches.
  for (const edges of graph.edges.values()) {
    for (const e of edges) {
      const isWire = e.wireId !== undefined;
      const isClosedSwitch = e.isSwitch && e.conductance;
      if (isWire || isClosedSwitch) uf.union(e.from, e.to);
    }
  }

  // Ground reps → forced to MNA index 0.
  const groundReps = new Set(graph.groundNodes.map((id) => uf.find(id)));

  // Assign MNA indices: 0 for ground, then 1.. for the rest.
  const indexByRep = new Map<string, number>();
  for (const rep of groundReps) indexByRep.set(rep, 0);
  let next = 1;
  const nodeIndexByGraphNode = new Map<string, number>();
  for (const id of graph.nodes.keys()) {
    const rep = uf.find(id);
    let idx = indexByRep.get(rep);
    if (idx === undefined) { idx = next++; indexByRep.set(rep, idx); }
    nodeIndexByGraphNode.set(id, idx);
  }
  const nodeCount = next; // indices 0..next-1

  const idx = (id: string) => nodeIndexByGraphNode.get(id) ?? 0;

  // Voltage sources: each power node (with sourceVoltage) vs ground.
  const vSources: DcModel['vSources'] = [];
  for (const id of graph.powerNodes) {
    const node = graph.nodes.get(id);
    const v = node?.sourceVoltage;
    if (v && idx(id) !== 0) vSources.push({ a: idx(id), b: 0, v });
  }

  // Resistors: two-terminal load components (not power/ground/switch).
  const byComponent = new Map<string, CircuitNode[]>();
  for (const node of graph.nodes.values()) {
    const arr = byComponent.get(node.componentId) ?? [];
    arr.push(node);
    byComponent.set(node.componentId, arr);
  }
  const resistors: DcModel['resistors'] = [];
  for (const [, nodes] of byComponent) {
    const types = new Set(nodes.map((n) => n.type));
    if (types.has('power') || types.has('ground') || types.has('switch')) continue;
    if (nodes.length < 2) continue;
    const a = idx(nodes[0].id);
    const b = idx(nodes[1].id);
    if (a === b) continue; // shorted (e.g. merged) — no branch
    const blockType = typeById.get(nodes[0].componentId) ?? '';
    const r = LOAD_R_BY_TYPE[blockType] ?? GENERIC_LOAD_R;
    resistors.push({ a, b, r });
  }

  return { model: { nodeCount, resistors, vSources }, nodeIndexByGraphNode };
}
