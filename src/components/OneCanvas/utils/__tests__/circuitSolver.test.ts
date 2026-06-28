// CircuitSolver seam — 기본 LogicSolver와 주입 솔버 사용을 검증 (Q1.1, 회귀 0)
import { describe, it, expect, vi } from 'vitest';
import { simulateCircuit, logicSolver, propagateVoltage } from '../circuitSimulator';
import type { CircuitSolver } from '../circuitSolver';
import type { RuntimeState } from '@/types/behavior';

const emptyRuntime: RuntimeState = {
  plcOutputs: new Map(),
  buttonStates: new Map(),
  manualOverrides: new Map(),
  deviceStates: new Map(),
};

describe('CircuitSolver seam', () => {
  it('logicSolver is the default solver and delegates to propagateVoltage', () => {
    expect(logicSolver.id).toBe('logic');
    expect(logicSolver.solveNodeVoltages).toBe(propagateVoltage);
  });

  it('simulateCircuit uses an injected solver for node voltages', () => {
    const sentinel = new Map<string, number>([['n1', 42]]);
    const spy = vi.fn(() => sentinel);
    const solver: CircuitSolver = { id: 'test', solveNodeVoltages: spy };

    const result = simulateCircuit([], [], [], emptyRuntime, { solver });

    expect(spy).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.nodeVoltages).toBe(sentinel);
  });

  it('falls back to logic-level results when no solver is given', () => {
    const result = simulateCircuit([], [], [], emptyRuntime);
    expect(result.success).toBe(true);
    expect(result.nodeVoltages instanceof Map).toBe(true);
  });
});
