// 아날로그 DC 솔버 — 회로 그래프를 저항 모델로 추출해 MNA로 실제 노드 전압을 푼다 (Q1.3)
import type { CircuitSolver, SolveContext } from '../circuitSolver';
import { propagateVoltage } from '../circuitSimulator';
import { buildResistiveModel } from './buildResistiveModel';
import { solveDc } from './dcAnalysis';

/**
 * DC resistive solver behind the CircuitSolver seam. Extracts a resistor +
 * ideal-source model from the graph and solves real node voltages via MNA.
 * Falls back to the logic-level propagation when the system is singular
 * (e.g. a floating subnet with no ground reference) so the sim never breaks.
 */
export const analogSolver: CircuitSolver = {
  id: 'analog',
  solveNodeVoltages(ctx: SolveContext): Map<string, number> {
    const { model, nodeIndexByGraphNode } = buildResistiveModel(ctx.graph, ctx.components);
    const solved = solveDc(model);
    if (!solved) {
      return propagateVoltage(ctx.graph, ctx.paths);
    }
    const out = new Map<string, number>();
    for (const id of ctx.graph.nodes.keys()) {
      out.set(id, solved[nodeIndexByGraphNode.get(id) ?? 0] ?? 0);
    }
    return out;
  },
};
