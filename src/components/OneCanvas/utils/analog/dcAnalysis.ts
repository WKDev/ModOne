// 저항·이상 전압원 회로의 DC 노드 전압을 MNA(modified nodal analysis)로 푸는 솔버
import { linearSolve } from './linearSolve';

/** Abstract resistive DC model. Node 0 is the ground reference (0 V). */
export interface DcModel {
  /** Total node count; node index 0 is ground (V = 0). */
  nodeCount: number;
  /** Resistor branches between two node indices. */
  resistors: Array<{ a: number; b: number; r: number }>;
  /** Ideal voltage sources: enforces V(a) - V(b) = v. */
  vSources: Array<{ a: number; b: number; v: number }>;
}

/**
 * Solve node voltages via MNA. Returns an array of length nodeCount where
 * index 0 is ground (0). Returns null if the system is singular (e.g. floating
 * subnet with no reference).
 */
export function solveDc(model: DcModel): number[] | null {
  const n = model.nodeCount;
  if (n <= 0) return [];
  const nodeUnknowns = n - 1;           // nodes 1..n-1
  const m = model.vSources.length;
  const size = nodeUnknowns + m;
  if (size === 0) return new Array(n).fill(0);

  const A: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const z: number[] = new Array(size).fill(0);
  const ni = (node: number) => node - 1; // matrix index for a non-ground node

  // Conductance stamps (skip ground node 0).
  for (const { a, b, r } of model.resistors) {
    if (r <= 0) continue;
    const g = 1 / r;
    if (a !== 0) A[ni(a)][ni(a)] += g;
    if (b !== 0) A[ni(b)][ni(b)] += g;
    if (a !== 0 && b !== 0) {
      A[ni(a)][ni(b)] -= g;
      A[ni(b)][ni(a)] -= g;
    }
  }

  // Voltage source stamps (B/C blocks + RHS).
  model.vSources.forEach((src, k) => {
    const s = nodeUnknowns + k;
    if (src.a !== 0) { A[ni(src.a)][s] += 1; A[s][ni(src.a)] += 1; }
    if (src.b !== 0) { A[ni(src.b)][s] -= 1; A[s][ni(src.b)] -= 1; }
    z[s] += src.v;
  });

  const x = linearSolve(A, z);
  if (!x) return null;

  const voltages = new Array(n).fill(0);
  for (let i = 1; i < n; i++) voltages[i] = x[ni(i)];
  return voltages;
}
