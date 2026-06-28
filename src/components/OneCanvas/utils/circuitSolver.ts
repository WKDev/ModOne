// 회로 노드 전압을 푸는 솔버 추상화 — 논리(기본)/아날로그(후속)를 같은 자리에 끼우는 seam
import type { CircuitGraph } from './circuitGraph';
import type { CurrentPath } from './pathFinder';

/**
 * Pluggable node-voltage solver. The default LogicSolver wraps the existing
 * boolean power-propagation; a future AnalogSolver (MNA) implements the same
 * interface so simulateCircuit can swap solvers without touching the rest of
 * the pipeline (graph build, path find, behavior derivation).
 */
export interface CircuitSolver {
  readonly id: 'logic' | 'analog' | (string & {});
  /** Resolve node id → voltage from the circuit graph and the powered paths. */
  solveNodeVoltages(graph: CircuitGraph, paths: CurrentPath[]): Map<string, number>;
}
