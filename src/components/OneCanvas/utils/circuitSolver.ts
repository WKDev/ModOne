// 회로 노드 전압을 푸는 솔버 추상화 — 논리(기본)/아날로그(후속)를 같은 자리에 끼우는 seam
import type { Block, Wire, Junction } from '../types';
import type { CircuitGraph } from './circuitGraph';
import type { CurrentPath } from './pathFinder';

/** Everything a solver may need: topology, powered paths, and the raw circuit. */
export interface SolveContext {
  graph: CircuitGraph;
  paths: CurrentPath[];
  components: Block[];
  wires: Wire[];
  junctions: Junction[];
}

/**
 * Pluggable node-voltage solver. The default LogicSolver wraps the existing
 * boolean power-propagation; the AnalogSolver (MNA DC) implements the same
 * interface so simulateCircuit can swap solvers without touching the rest of
 * the pipeline (graph build, path find, behavior derivation).
 */
export interface CircuitSolver {
  readonly id: 'logic' | 'analog' | (string & {});
  /** Resolve graph node id → voltage. */
  solveNodeVoltages(ctx: SolveContext): Map<string, number>;
}
