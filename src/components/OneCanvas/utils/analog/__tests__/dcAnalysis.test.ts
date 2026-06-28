// MNA DC 솔버를 정준 회로(분압·직렬·병렬)로 검증 (Q1.3)
import { describe, it, expect } from 'vitest';
import { linearSolve } from '../linearSolve';
import { solveDc } from '../dcAnalysis';

describe('linearSolve', () => {
  it('solves a 2x2 system', () => {
    // x + y = 3 ; x - y = 1  → x=2, y=1
    const x = linearSolve([[1, 1], [1, -1]], [3, 1]);
    expect(x).not.toBeNull();
    expect(x![0]).toBeCloseTo(2);
    expect(x![1]).toBeCloseTo(1);
  });

  it('returns null for a singular system', () => {
    expect(linearSolve([[1, 1], [2, 2]], [1, 2])).toBeNull();
  });
});

describe('solveDc — MNA', () => {
  it('voltage divider: 10V across two equal resistors → 5V midpoint', () => {
    // node0=gnd, node1=source+, node2=mid
    const v = solveDc({
      nodeCount: 3,
      resistors: [{ a: 1, b: 2, r: 1000 }, { a: 2, b: 0, r: 1000 }],
      vSources: [{ a: 1, b: 0, v: 10 }],
    })!;
    expect(v[1]).toBeCloseTo(10);
    expect(v[2]).toBeCloseTo(5);
  });

  it('series divider 1k + 2k from 12V → 8V at the tap', () => {
    const v = solveDc({
      nodeCount: 3,
      resistors: [{ a: 1, b: 2, r: 1000 }, { a: 2, b: 0, r: 2000 }],
      vSources: [{ a: 1, b: 0, v: 12 }],
    })!;
    expect(v[2]).toBeCloseTo(8);
  });

  it('two equal resistors in parallel halve to one — divider still 5V', () => {
    // node2 to gnd via two 2k in parallel (=1k); top 1k → 5V
    const v = solveDc({
      nodeCount: 3,
      resistors: [
        { a: 1, b: 2, r: 1000 },
        { a: 2, b: 0, r: 2000 },
        { a: 2, b: 0, r: 2000 },
      ],
      vSources: [{ a: 1, b: 0, v: 10 }],
    })!;
    expect(v[2]).toBeCloseTo(5);
  });

  it('returns null for a floating subnet with no ground reference', () => {
    // two nodes joined by a resistor, no source, no ground tie → singular
    const v = solveDc({ nodeCount: 2, resistors: [{ a: 1, b: 1, r: 1000 }], vSources: [] });
    expect(v).toBeNull();
  });
});
