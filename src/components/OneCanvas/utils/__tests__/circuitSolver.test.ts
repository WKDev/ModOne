// CircuitSolver seam — 기본 LogicSolver와 주입 솔버 사용을 검증 (Q1.1, 회귀 0)
import { describe, it, expect, vi } from 'vitest';
import { simulateCircuit, logicSolver } from '../circuitSimulator';
import type { CircuitSolver } from '../circuitSolver';
import type { RuntimeState } from '@/types/behavior';
import type { Block } from '../../types';

const emptyRuntime: RuntimeState = {
  plcOutputs: new Map(),
  buttonStates: new Map(),
  manualOverrides: new Map(),
  deviceStates: new Map(),
};

describe('CircuitSolver seam', () => {
  it('logicSolver is the default solver (logic-level)', () => {
    expect(logicSolver.id).toBe('logic');
    expect(typeof logicSolver.solveNodeVoltages).toBe('function');
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

  it('threads solved node voltages into per-component behaviorState.voltage', () => {
    const motor = {
      id: 'M1',
      type: 'motor',
      position: { x: 0, y: 0 },
      size: { width: 40, height: 40 },
      ports: [
        { id: 'u', type: 'input', label: 'U', position: 'left' },
        { id: 'pe', type: 'input', label: 'PE', position: 'bottom' },
      ],
    } as unknown as Block;
    const solver: CircuitSolver = { id: 'test', solveNodeVoltages: () => new Map([['M1:u', 24]]) };

    const result = simulateCircuit([motor], [], [], emptyRuntime, { solver });

    expect(result.behaviorStates.get('M1')?.voltage).toBe(24);
  });
});
