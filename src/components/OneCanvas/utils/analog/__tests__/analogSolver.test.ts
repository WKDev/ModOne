// analogSolver가 회로 그래프에서 실제 노드 전압(분압)을 푸는지 + 특이행렬 fallback 검증 (Q1.3)
import { describe, it, expect } from 'vitest';
import { analogSolver } from '../analogSolver';
import type { CircuitGraph, CircuitEdge, CircuitNode } from '../../circuitGraph';
import type { SolveContext } from '../../circuitSolver';

function node(id: string, type: CircuitNode['type'], sourceVoltage?: number): CircuitNode {
  const [componentId, portId] = id.split(':');
  return { id, componentId, portId, type, sourceVoltage };
}
function edge(from: string, to: string, wireId?: string): CircuitEdge {
  return { from, to, wireId, conductance: true, isSwitch: false };
}

/** 24V source → load L1 → load L2 → ground (two equal loads in series). */
function dividerGraph(): CircuitGraph {
  const nodes = new Map<string, CircuitNode>([
    ['P:out', node('P:out', 'power', 24)],
    ['L1:in', node('L1:in', 'load')],
    ['L1:out', node('L1:out', 'load')],
    ['L2:in', node('L2:in', 'load')],
    ['L2:out', node('L2:out', 'load')],
    ['G:in', node('G:in', 'ground')],
  ]);
  const edges = new Map<string, CircuitEdge[]>([
    ['P:out', [edge('P:out', 'L1:in', 'w1')]],
    ['L1:in', [edge('L1:in', 'L1:out')]],          // load internal (resistor)
    ['L1:out', [edge('L1:out', 'L2:in', 'w2')]],
    ['L2:in', [edge('L2:in', 'L2:out')]],          // load internal (resistor)
    ['L2:out', [edge('L2:out', 'G:in', 'w3')]],
  ]);
  return {
    nodes, edges,
    powerNodes: ['P:out'],
    groundNodes: ['G:in'],
    switchNodes: [],
    loadNodes: ['L1:in', 'L1:out', 'L2:in', 'L2:out'],
  };
}

const ctx = (graph: CircuitGraph): SolveContext => ({ graph, paths: [], components: [], wires: [], junctions: [] });

describe('analogSolver — DC resistive', () => {
  it('solves a real voltage divider: 24V → 12V mid → 0V', () => {
    const v = analogSolver.solveNodeVoltages(ctx(dividerGraph()));
    expect(v.get('P:out')).toBeCloseTo(24);
    expect(v.get('L1:out')).toBeCloseTo(12); // midpoint of two equal loads
    expect(v.get('L2:in')).toBeCloseTo(12);
    expect(v.get('G:in')).toBeCloseTo(0);
  });

  it('falls back gracefully (no throw) when there is no ground reference', () => {
    const g = dividerGraph();
    g.groundNodes = []; // remove reference → singular
    expect(() => analogSolver.solveNodeVoltages(ctx(g))).not.toThrow();
  });
});
