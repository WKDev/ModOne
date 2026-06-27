// 애니메이션 재생 헬퍼(applyAnimationFrame/resetAnimationFrame)의 타입별 동작 검증
import { describe, it, expect } from 'vitest';
import {
  applyAnimationFrame,
  resetAnimationFrame,
  captureAnimationBase,
  type AnimatableTarget,
  type AnimationBase,
} from '../symbolAnimation';

function makeTarget(over: Partial<{ rotation: number; alpha: number; x: number; y: number }> = {}): AnimatableTarget {
  return {
    rotation: over.rotation ?? 0,
    alpha: over.alpha ?? 1,
    position: { x: over.x ?? 0, y: over.y ?? 0 },
  };
}

const BASE: AnimationBase = { rotation: 0, alpha: 1, x: 0, y: 0 };

describe('captureAnimationBase', () => {
  it('captures rotation/alpha/position from the target', () => {
    const t = makeTarget({ rotation: 1.5, alpha: 0.4, x: 10, y: 20 });
    expect(captureAnimationBase(t)).toEqual({ rotation: 1.5, alpha: 0.4, x: 10, y: 20 });
  });

  it('defaults missing fields (alpha→1, others→0) for minimal targets', () => {
    const minimal = { rotation: undefined, position: undefined } as unknown as AnimatableTarget;
    expect(captureAnimationBase(minimal)).toEqual({ rotation: 0, alpha: 1, x: 0, y: 0 });
  });
});

describe('applyAnimationFrame', () => {
  it('rotate: rotation grows by speed·time from base', () => {
    const t = makeTarget();
    applyAnimationFrame(t, { type: 'rotate', target: 'g', speed: 180 }, 1000, BASE);
    expect(t.rotation).toBeCloseTo(Math.PI, 5); // 180°/s · 1s
  });

  it('rotate: default speed is 120°/s', () => {
    const t = makeTarget();
    applyAnimationFrame(t, { type: 'rotate', target: 'g' }, 1000, BASE);
    expect(t.rotation).toBeCloseTo((120 * Math.PI) / 180, 5);
  });

  it('fade-in: alpha ramps 0→1 over duration then holds', () => {
    const t = makeTarget();
    applyAnimationFrame(t, { type: 'fade-in', target: 'g', duration: 1000 }, 0, BASE);
    expect(t.alpha).toBeCloseTo(0, 5);
    applyAnimationFrame(t, { type: 'fade-in', target: 'g', duration: 1000 }, 500, BASE);
    expect(t.alpha).toBeCloseTo(0.5, 5);
    applyAnimationFrame(t, { type: 'fade-in', target: 'g', duration: 1000 }, 2000, BASE);
    expect(t.alpha).toBeCloseTo(1, 5); // clamped
  });

  it('fade-out: alpha ramps 1→0 over duration then holds', () => {
    const t = makeTarget();
    applyAnimationFrame(t, { type: 'fade-out', target: 'g', duration: 1000 }, 0, BASE);
    expect(t.alpha).toBeCloseTo(1, 5);
    applyAnimationFrame(t, { type: 'fade-out', target: 'g', duration: 1000 }, 250, BASE);
    expect(t.alpha).toBeCloseTo(0.75, 5);
    applyAnimationFrame(t, { type: 'fade-out', target: 'g', duration: 1000 }, 5000, BASE);
    expect(t.alpha).toBeCloseTo(0, 5);
  });

  it('blink: square wave — on for first half of the cycle, off for the second', () => {
    const t = makeTarget();
    const spec = { type: 'blink' as const, target: 'g', duration: 1000 };
    applyAnimationFrame(t, spec, 100, BASE);
    expect(t.alpha).toBe(1);
    applyAnimationFrame(t, spec, 700, BASE);
    expect(t.alpha).toBe(0);
    applyAnimationFrame(t, spec, 1100, BASE); // wraps → on again
    expect(t.alpha).toBe(1);
  });

  it('move: position oscillates ±offset around base (sine)', () => {
    const t = makeTarget({ x: 5, y: 5 });
    const base: AnimationBase = { rotation: 0, alpha: 1, x: 5, y: 5 };
    const spec = { type: 'move' as const, target: 'g', dx: 10, dy: 4, duration: 1000 };
    applyAnimationFrame(t, spec, 0, base);
    expect(t.position.x).toBeCloseTo(5, 5);
    expect(t.position.y).toBeCloseTo(5, 5);
    applyAnimationFrame(t, spec, 250, base); // quarter cycle → sin = 1 → peak +offset
    expect(t.position.x).toBeCloseTo(15, 5);
    expect(t.position.y).toBeCloseTo(9, 5);
    applyAnimationFrame(t, spec, 750, base); // three-quarter → sin = -1 → -offset
    expect(t.position.x).toBeCloseTo(-5, 5);
    expect(t.position.y).toBeCloseTo(1, 5);
  });

  it('zero duration does not divide by zero', () => {
    const t = makeTarget();
    expect(() => applyAnimationFrame(t, { type: 'blink', target: 'g', duration: 0 }, 100, BASE)).not.toThrow();
    expect(() => applyAnimationFrame(t, { type: 'move', target: 'g', dx: 5, duration: 0 }, 100, BASE)).not.toThrow();
  });
});

describe('resetAnimationFrame', () => {
  it('rotate: restores only rotation', () => {
    const t = makeTarget({ rotation: 2, alpha: 0.3, x: 9 });
    resetAnimationFrame(t, { type: 'rotate', target: 'g' }, BASE);
    expect(t.rotation).toBe(BASE.rotation);
    expect(t.alpha).toBe(0.3); // untouched
    expect(t.position.x).toBe(9); // untouched
  });

  it('fade/blink: restores only alpha', () => {
    const t = makeTarget({ rotation: 2, alpha: 0 });
    resetAnimationFrame(t, { type: 'fade-out', target: 'g' }, BASE);
    expect(t.alpha).toBe(BASE.alpha);
    expect(t.rotation).toBe(2); // untouched
  });

  it('move: restores only position', () => {
    const t = makeTarget({ x: 99, y: 99, alpha: 0.2 });
    const base: AnimationBase = { rotation: 0, alpha: 1, x: 5, y: 6 };
    resetAnimationFrame(t, { type: 'move', target: 'g' }, base);
    expect(t.position.x).toBe(5);
    expect(t.position.y).toBe(6);
    expect(t.alpha).toBe(0.2); // untouched
  });
});
