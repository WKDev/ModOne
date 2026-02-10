import { describe, expect, it } from 'vitest';

import type { Block } from '../../types';
import { alignComponents, distributeComponents, flipComponents } from '../canvas-commands';

function makeBlock(id: string, x: number, y: number, w: number, h: number): Block {
  return {
    id,
    type: 'led',
    position: { x, y },
    size: { width: w, height: h },
    ports: [],
    color: 'red',
    forwardVoltage: 2,
  };
}

describe('canvas-commands', () => {
  it("alignComponents('left') aligns all x to minimum x", () => {
    const components = new Map<string, Block>([
      ['a', makeBlock('a', 100, 0, 10, 10)],
      ['b', makeBlock('b', 40, 10, 20, 10)],
      ['c', makeBlock('c', 70, 20, 30, 10)],
    ]);

    const result = alignComponents(components, new Set(['a', 'b', 'c']), 'left');

    expect(result.get('a')?.position.x).toBe(40);
    expect(result.get('b')?.position.x).toBe(40);
    expect(result.get('c')?.position.x).toBe(40);
  });

  it("alignComponents('right') aligns right edges to maximum", () => {
    const components = new Map<string, Block>([
      ['a', makeBlock('a', 0, 0, 20, 10)],
      ['b', makeBlock('b', 30, 0, 10, 10)],
      ['c', makeBlock('c', 60, 0, 30, 10)],
    ]);

    const result = alignComponents(components, new Set(['a', 'b', 'c']), 'right');
    const rightEdge = 90;

    expect((result.get('a')?.position.x ?? 0) + (result.get('a')?.size.width ?? 0)).toBe(rightEdge);
    expect((result.get('b')?.position.x ?? 0) + (result.get('b')?.size.width ?? 0)).toBe(rightEdge);
    expect((result.get('c')?.position.x ?? 0) + (result.get('c')?.size.width ?? 0)).toBe(rightEdge);
  });

  it("alignComponents('top') aligns all y to minimum y", () => {
    const components = new Map<string, Block>([
      ['a', makeBlock('a', 0, 100, 10, 10)],
      ['b', makeBlock('b', 0, 20, 10, 20)],
      ['c', makeBlock('c', 0, 60, 10, 30)],
    ]);

    const result = alignComponents(components, new Set(['a', 'b', 'c']), 'top');

    expect(result.get('a')?.position.y).toBe(20);
    expect(result.get('b')?.position.y).toBe(20);
    expect(result.get('c')?.position.y).toBe(20);
  });

  it("alignComponents('bottom') aligns bottom edges to maximum", () => {
    const components = new Map<string, Block>([
      ['a', makeBlock('a', 0, 10, 10, 20)],
      ['b', makeBlock('b', 0, 50, 10, 10)],
      ['c', makeBlock('c', 0, 70, 10, 30)],
    ]);

    const result = alignComponents(components, new Set(['a', 'b', 'c']), 'bottom');
    const bottomEdge = 100;

    expect((result.get('a')?.position.y ?? 0) + (result.get('a')?.size.height ?? 0)).toBe(bottomEdge);
    expect((result.get('b')?.position.y ?? 0) + (result.get('b')?.size.height ?? 0)).toBe(bottomEdge);
    expect((result.get('c')?.position.y ?? 0) + (result.get('c')?.size.height ?? 0)).toBe(bottomEdge);
  });

  it("alignComponents('centerH') aligns center X to average center", () => {
    const components = new Map<string, Block>([
      ['a', makeBlock('a', 0, 0, 10, 10)],
      ['b', makeBlock('b', 30, 0, 20, 10)],
      ['c', makeBlock('c', 80, 0, 30, 10)],
    ]);

    const result = alignComponents(components, new Set(['a', 'b', 'c']), 'centerH');
    const expectedCenter = (5 + 40 + 95) / 3;

    expect((result.get('a')?.position.x ?? 0) + 5).toBeCloseTo(expectedCenter);
    expect((result.get('b')?.position.x ?? 0) + 10).toBeCloseTo(expectedCenter);
    expect((result.get('c')?.position.x ?? 0) + 15).toBeCloseTo(expectedCenter);
  });

  it("alignComponents('centerV') aligns center Y to average center", () => {
    const components = new Map<string, Block>([
      ['a', makeBlock('a', 0, 0, 10, 10)],
      ['b', makeBlock('b', 0, 20, 10, 20)],
      ['c', makeBlock('c', 0, 60, 10, 30)],
    ]);

    const result = alignComponents(components, new Set(['a', 'b', 'c']), 'centerV');
    const expectedCenter = (5 + 30 + 75) / 3;

    expect((result.get('a')?.position.y ?? 0) + 5).toBeCloseTo(expectedCenter);
    expect((result.get('b')?.position.y ?? 0) + 10).toBeCloseTo(expectedCenter);
    expect((result.get('c')?.position.y ?? 0) + 15).toBeCloseTo(expectedCenter);
  });

  it("distributeComponents('horizontal') creates even gaps", () => {
    const components = new Map<string, Block>([
      ['a', makeBlock('a', 0, 0, 20, 10)],
      ['b', makeBlock('b', 40, 0, 20, 10)],
      ['c', makeBlock('c', 100, 0, 20, 10)],
    ]);

    const result = distributeComponents(components, new Set(['a', 'b', 'c']), 'horizontal');

    expect(result.get('a')?.position.x).toBe(0);
    expect(result.get('b')?.position.x).toBe(50);
    expect(result.get('c')?.position.x).toBe(100);
  });

  it("distributeComponents('horizontal') with 2 items returns unchanged positions", () => {
    const components = new Map<string, Block>([
      ['a', makeBlock('a', 5, 0, 10, 10)],
      ['b', makeBlock('b', 50, 0, 10, 10)],
    ]);

    const result = distributeComponents(components, new Set(['a', 'b']), 'horizontal');

    expect(result.get('a')?.position.x).toBe(5);
    expect(result.get('b')?.position.x).toBe(50);
  });

  it("flipComponents('horizontal') mirrors x around selection center", () => {
    const components = new Map<string, Block>([
      ['a', makeBlock('a', 0, 0, 20, 10)],
      ['b', makeBlock('b', 30, 0, 10, 10)],
      ['c', makeBlock('c', 50, 0, 30, 10)],
    ]);

    const result = flipComponents(components, new Set(['a', 'b', 'c']), 'horizontal');

    expect(result.get('a')?.position.x).toBe(60);
    expect(result.get('b')?.position.x).toBe(40);
    expect(result.get('c')?.position.x).toBe(0);
  });

  it("flipComponents('vertical') mirrors y around selection center", () => {
    const components = new Map<string, Block>([
      ['a', makeBlock('a', 0, 0, 10, 10)],
      ['b', makeBlock('b', 0, 20, 10, 20)],
      ['c', makeBlock('c', 0, 60, 10, 30)],
    ]);

    const result = flipComponents(components, new Set(['a', 'b', 'c']), 'vertical');

    expect(result.get('a')?.position.y).toBe(80);
    expect(result.get('b')?.position.y).toBe(50);
    expect(result.get('c')?.position.y).toBe(0);
  });

  it('filters missing selected IDs and ignores non-existent blocks', () => {
    const components = new Map<string, Block>([
      ['a', makeBlock('a', 20, 10, 10, 10)],
      ['b', makeBlock('b', 40, 50, 10, 10)],
      ['c', makeBlock('c', 60, 30, 10, 10)],
    ]);

    const result = alignComponents(components, new Set(['a', 'b', 'missing']), 'left');

    expect(result.get('a')?.position.x).toBe(20);
    expect(result.get('b')?.position.x).toBe(20);
    expect(result.get('c')?.position.x).toBe(60);
  });

  it('returns a new Map without mutating input map entries', () => {
    const components = new Map<string, Block>([
      ['a', makeBlock('a', 10, 10, 10, 10)],
      ['b', makeBlock('b', 30, 10, 10, 10)],
      ['c', makeBlock('c', 50, 10, 10, 10)],
    ]);

    const originalA = components.get('a');
    const result = flipComponents(components, new Set(['a', 'b', 'c']), 'horizontal');

    expect(result).not.toBe(components);
    expect(components.get('a')).toBe(originalA);
    expect(components.get('a')?.position.x).toBe(10);
  });
});
