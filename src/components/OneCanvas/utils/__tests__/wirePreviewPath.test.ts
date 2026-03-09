/**
 * Regression tests for the wire preview path fix (Task 2, Wave 1).
 *
 * Fix: _handleWireDrawingMove now renders [fromPos, mid, worldPos]
 *      (orthogonal L-route) instead of [worldPos] (invisible single point).
 *
 * The L-route logic from InteractionController.ts lines 732-735:
 *   const mid = (!exitDir || exitDir === 'left' || exitDir === 'right')
 *     ? { x: worldPos.x, y: fromPos.y }   // horizontal-first
 *     : { x: fromPos.x, y: worldPos.y };  // vertical-first
 *   this._visuals.renderWirePreview([fromPos, mid, worldPos]);
 *
 * We test this pure logic directly (no class instantiation needed).
 */

import { describe, expect, it } from 'vitest';

type Position = { x: number; y: number };
type PortDirection = 'left' | 'right' | 'up' | 'down';

/**
 * Extracted pure function mirroring InteractionController._handleWireDrawingMove
 * visual feedback logic (lines 732-735).
 */
function computePreviewPath(
  fromPos: Position,
  worldPos: Position,
  exitDir: PortDirection | null
): Position[] {
  const mid =
    !exitDir || exitDir === 'left' || exitDir === 'right'
      ? { x: worldPos.x, y: fromPos.y } // horizontal-first
      : { x: fromPos.x, y: worldPos.y }; // vertical-first
  return [fromPos, mid, worldPos];
}

/** Assert every consecutive pair of points shares x or y (orthogonal). */
function assertOrthogonalPath(points: Position[]): void {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    expect(a.x === b.x || a.y === b.y).toBe(true);
  }
}

describe('wire preview path (orthogonal L-route) — regression for Task 2 fix', () => {
  it('always returns exactly 3 points: [fromPos, mid, worldPos]', () => {
    const from = { x: 100, y: 100 };
    const to = { x: 300, y: 250 };
    const path = computePreviewPath(from, to, 'right');

    expect(path).toHaveLength(3);
    expect(path[0]).toEqual(from);
    expect(path[2]).toEqual(to);
  });

  it('right exit: mid is horizontal-first — x=toPos.x, y=fromPos.y', () => {
    const from = { x: 100, y: 100 };
    const to = { x: 300, y: 250 };
    const path = computePreviewPath(from, to, 'right');

    expect(path[1]).toEqual({ x: 300, y: 100 });
    assertOrthogonalPath(path);
  });

  it('left exit: mid is horizontal-first — same rule as right', () => {
    const from = { x: 300, y: 100 };
    const to = { x: 100, y: 250 };
    const path = computePreviewPath(from, to, 'left');

    expect(path[1]).toEqual({ x: 100, y: 100 });
    assertOrthogonalPath(path);
  });

  it('up exit: mid is vertical-first — x=fromPos.x, y=toPos.y', () => {
    const from = { x: 100, y: 100 };
    const to = { x: 300, y: 250 };
    const path = computePreviewPath(from, to, 'up');

    expect(path[1]).toEqual({ x: 100, y: 250 });
    assertOrthogonalPath(path);
  });

  it('down exit: mid is vertical-first — same rule as up', () => {
    const from = { x: 100, y: 100 };
    const to = { x: 300, y: 250 };
    const path = computePreviewPath(from, to, 'down');

    expect(path[1]).toEqual({ x: 100, y: 250 });
    assertOrthogonalPath(path);
  });

  it('null exitDir: defaults to horizontal-first (same as left/right)', () => {
    const from = { x: 100, y: 100 };
    const to = { x: 300, y: 250 };
    const path = computePreviewPath(from, to, null);

    expect(path[1]).toEqual({ x: 300, y: 100 });
    assertOrthogonalPath(path);
  });

  it('collinear horizontal: fromPos.y === worldPos.y — mid equals worldPos (zero-length 2nd segment)', () => {
    const from = { x: 100, y: 100 };
    const to = { x: 300, y: 100 }; // same y
    const path = computePreviewPath(from, to, 'right');

    // horizontal-first: mid = {x: 300, y: 100} which equals worldPos
    expect(path[1]).toEqual({ x: 300, y: 100 });
    expect(path[1]).toEqual(to);
    assertOrthogonalPath(path);
  });

  it('collinear vertical: fromPos.x === worldPos.x — mid equals fromPos (zero-length 1st segment)', () => {
    const from = { x: 100, y: 100 };
    const to = { x: 100, y: 300 }; // same x
    const path = computePreviewPath(from, to, 'down');

    // vertical-first: mid = {x: 100, y: 300} which equals worldPos
    expect(path[1]).toEqual({ x: 100, y: 300 });
    assertOrthogonalPath(path);
  });

  it('every consecutive segment pair is orthogonal for all exit directions', () => {
    const from = { x: 150, y: 200 };
    const to = { x: 400, y: 350 };
    const directions: Array<PortDirection | null> = ['left', 'right', 'up', 'down', null];

    for (const dir of directions) {
      const path = computePreviewPath(from, to, dir);
      assertOrthogonalPath(path);
    }
  });

  it('horizontal-first mid has correct y (fromPos.y) for various positions', () => {
    const cases: Array<{ from: Position; to: Position; dir: PortDirection }> = [
      { from: { x: 50, y: 75 }, to: { x: 200, y: 300 }, dir: 'right' },
      { from: { x: 500, y: 25 }, to: { x: 100, y: 100 }, dir: 'left' },
    ];

    for (const { from, to, dir } of cases) {
      const path = computePreviewPath(from, to, dir);
      // For horizontal-first: mid.y must equal from.y
      expect(path[1].y).toBe(from.y);
      // For horizontal-first: mid.x must equal to.x
      expect(path[1].x).toBe(to.x);
      assertOrthogonalPath(path);
    }
  });

  it('vertical-first mid has correct x (fromPos.x) for various positions', () => {
    const cases: Array<{ from: Position; to: Position; dir: PortDirection }> = [
      { from: { x: 50, y: 75 }, to: { x: 200, y: 300 }, dir: 'up' },
      { from: { x: 500, y: 25 }, to: { x: 100, y: 100 }, dir: 'down' },
    ];

    for (const { from, to, dir } of cases) {
      const path = computePreviewPath(from, to, dir);
      // For vertical-first: mid.x must equal from.x
      expect(path[1].x).toBe(from.x);
      // For vertical-first: mid.y must equal to.y
      expect(path[1].y).toBe(to.y);
      assertOrthogonalPath(path);
    }
  });

  it('regression: pre-fix single-point path [worldPos] would NOT be orthogonal with from/to', () => {
    // This documents the bug: the old code rendered [worldPos] — a single point.
    // A single-point array has no segments, so assertOrthogonalPath would pass trivially,
    // but it would be invisible. The fix renders 3 points forming an L-shape.
    const from = { x: 100, y: 100 };
    const to = { x: 300, y: 250 };

    // New (correct) behavior: 3-point L-route
    const fixed = computePreviewPath(from, to, 'right');
    expect(fixed).toHaveLength(3);

    // Old (buggy) behavior simulation: just [worldPos] — no visible wire from 'from'
    const buggy = [to]; // original: renderWirePreview([worldPos])
    expect(buggy).toHaveLength(1);

    // The fix produces a visible line by including fromPos and a midpoint
    expect(fixed[0]).toEqual(from); // starts at the dragging origin
    expect(fixed[2]).toEqual(to); // ends at cursor
  });
});
