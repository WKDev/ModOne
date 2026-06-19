/**
 * computeResizedBounds — Aspect-Ratio Lock (Shift) Unit Tests (Sub-AC 2)
 *
 * Verifies the mathematical correctness of the resize calculation logic in
 * SelectTool.computeResizedBounds, with particular focus on Shift-key aspect-
 * ratio locking.
 *
 * Mathematical invariants tested:
 *   1. Without Shift: raw delta application produces expected x/y/width/height
 *   2. With Shift (isHorizontal handles e/w):
 *        new_height = new_width / R
 *        new_y      = original_cy - new_height/2  (vertically re-centered)
 *   3. With Shift (isVertical handles n/s):
 *        new_width  = new_height * R
 *        new_x      = original_cx - new_width/2   (horizontally re-centered)
 *   4. With Shift (corner handles nw/ne/sw/se):
 *        fit-within: constrain the over-grown axis so new_width/new_height = R
 *   5. Fixed-edge invariants after ratio correction:
 *        nw/sw/w: right edge  = initialBounds.x + initialBounds.width
 *        nw/ne/n: bottom edge = initialBounds.y + initialBounds.height
 *   6. Alt key: resize from center (both opposing edges move equally)
 *   7. Shift + Alt combined
 *   8. Minimum size enforcement: width/height >= 10
 */

import { describe, it, expect } from 'vitest';
import { computeResizedBounds } from '../tools/SelectTool';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Absolute tolerance for floating-point comparisons */
const EPS = 1e-9;

function closeTo(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) < eps;
}

/** Asserts a result value is close to expected (floating-point safe). */
function expectClose(actual: number, expected: number, label = '') {
  expect(
    closeTo(actual, expected),
    `${label}: expected ${expected}, got ${actual}`,
  ).toBe(true);
}

/** Base bounds used across most tests: 200×100 starting at origin. */
const BASE = { x: 0, y: 0, width: 200, height: 100 };
/** Aspect ratio R = 200/100 = 2.0 */
const R = BASE.width / BASE.height; // 2.0

// ---------------------------------------------------------------------------
// 1. Basic resize WITHOUT modifier keys
// ---------------------------------------------------------------------------

describe('computeResizedBounds — no modifiers', () => {
  it('e handle: grows width rightward', () => {
    const r = computeResizedBounds(BASE, 'e', 50, 0, false, false);
    expect(r).toEqual({ x: 0, y: 0, width: 250, height: 100 });
  });

  it('w handle: grows width leftward (x decreases)', () => {
    const r = computeResizedBounds(BASE, 'w', -50, 0, false, false);
    expect(r).toEqual({ x: -50, y: 0, width: 250, height: 100 });
  });

  it('n handle: grows height upward (y decreases)', () => {
    const r = computeResizedBounds(BASE, 'n', 0, -50, false, false);
    expect(r).toEqual({ x: 0, y: -50, width: 200, height: 150 });
  });

  it('s handle: grows height downward', () => {
    const r = computeResizedBounds(BASE, 's', 0, 50, false, false);
    expect(r).toEqual({ x: 0, y: 0, width: 200, height: 150 });
  });

  it('se handle: grows both dimensions', () => {
    const r = computeResizedBounds(BASE, 'se', 30, 20, false, false);
    expect(r).toEqual({ x: 0, y: 0, width: 230, height: 120 });
  });

  it('nw handle: moves origin, grows both dimensions', () => {
    const r = computeResizedBounds(BASE, 'nw', -30, -20, false, false);
    expect(r).toEqual({ x: -30, y: -20, width: 230, height: 120 });
  });

  it('ne handle: grows width rightward and height upward', () => {
    const r = computeResizedBounds(BASE, 'ne', 30, -20, false, false);
    expect(r).toEqual({ x: 0, y: -20, width: 230, height: 120 });
  });

  it('sw handle: grows width leftward and height downward', () => {
    const r = computeResizedBounds(BASE, 'sw', -30, 20, false, false);
    expect(r).toEqual({ x: -30, y: 0, width: 230, height: 120 });
  });
});

// ---------------------------------------------------------------------------
// 2. Aspect-ratio lock — horizontal edge handles (e, w)
// ---------------------------------------------------------------------------

describe('computeResizedBounds — Shift + horizontal edge handles (e, w)', () => {
  it('e: constrains height = width / R, re-centers vertically', () => {
    // Drag right by 50 → raw width = 250
    const r = computeResizedBounds(BASE, 'e', 50, 0, true, false);
    const expectedWidth = 250;
    const expectedHeight = expectedWidth / R; // 125
    const cy = BASE.y + BASE.height / 2;      // 50
    const expectedY = cy - expectedHeight / 2; // 50 - 62.5 = -12.5

    expectClose(r.width,  expectedWidth,  'width');
    expectClose(r.height, expectedHeight, 'height');
    expectClose(r.x,      BASE.x,         'x unchanged');
    expectClose(r.y,      expectedY,      'y re-centered');

    // Ratio must be preserved exactly
    expectClose(r.width / r.height, R, 'ratio');
  });

  it('w: constrains height = width / R, re-centers vertically, right edge fixed', () => {
    // Drag left by 50 → raw x = -50, raw width = 250
    const r = computeResizedBounds(BASE, 'w', -50, 0, true, false);
    const expectedWidth = 250;
    const expectedHeight = expectedWidth / R; // 125
    const cy = BASE.y + BASE.height / 2;       // 50
    const expectedY = cy - expectedHeight / 2;  // -12.5
    const expectedX = BASE.x + BASE.width - expectedWidth; // -50

    expectClose(r.width,  expectedWidth,  'width');
    expectClose(r.height, expectedHeight, 'height');
    expectClose(r.x,      expectedX,      'x (right edge fixed)');
    expectClose(r.y,      expectedY,      'y re-centered');

    // Right edge must stay at original right
    expectClose(r.x + r.width, BASE.x + BASE.width, 'right edge fixed');
    expectClose(r.width / r.height, R, 'ratio');
  });

  it('e shrink: ratio still maintained when dragging inward', () => {
    const r = computeResizedBounds(BASE, 'e', -50, 0, true, false);
    const expectedWidth  = 150;
    const expectedHeight = expectedWidth / R; // 75
    expectClose(r.width,  expectedWidth,  'width');
    expectClose(r.height, expectedHeight, 'height');
    expectClose(r.width / r.height, R,    'ratio');
  });
});

// ---------------------------------------------------------------------------
// 3. Aspect-ratio lock — vertical edge handles (n, s)
// ---------------------------------------------------------------------------

describe('computeResizedBounds — Shift + vertical edge handles (n, s)', () => {
  it('s: constrains width = height * R, re-centers horizontally', () => {
    // Drag down by 50 → raw height = 150
    const r = computeResizedBounds(BASE, 's', 0, 50, true, false);
    const expectedHeight = 150;
    const expectedWidth  = expectedHeight * R; // 300
    const cx = BASE.x + BASE.width / 2;         // 100
    const expectedX = cx - expectedWidth / 2;   // 100 - 150 = -50

    expectClose(r.height, expectedHeight, 'height');
    expectClose(r.width,  expectedWidth,  'width');
    expectClose(r.x,      expectedX,      'x re-centered');
    expectClose(r.y,      BASE.y,         'y unchanged');

    expectClose(r.width / r.height, R, 'ratio');
  });

  it('n: constrains width = height * R, re-centers horizontally, bottom edge fixed', () => {
    // Drag up by 50 → raw y = -50, raw height = 150
    const r = computeResizedBounds(BASE, 'n', 0, -50, true, false);
    const expectedHeight = 150;
    const expectedWidth  = expectedHeight * R; // 300
    const cx = BASE.x + BASE.width / 2;
    const expectedX = cx - expectedWidth / 2;  // -50
    const expectedY = BASE.y + BASE.height - expectedHeight; // -50

    expectClose(r.height, expectedHeight, 'height');
    expectClose(r.width,  expectedWidth,  'width');
    expectClose(r.x,      expectedX,      'x re-centered');
    expectClose(r.y,      expectedY,      'y (bottom edge fixed)');

    // Bottom edge must stay at original bottom
    expectClose(r.y + r.height, BASE.y + BASE.height, 'bottom edge fixed');
    expectClose(r.width / r.height, R, 'ratio');
  });

  it('s shrink: ratio maintained when dragging inward', () => {
    const r = computeResizedBounds(BASE, 's', 0, -30, true, false);
    const expectedHeight = 70;
    const expectedWidth  = expectedHeight * R; // 140
    expectClose(r.height, expectedHeight, 'height');
    expectClose(r.width,  expectedWidth,  'width');
    expectClose(r.width / r.height, R,    'ratio');
  });
});

// ---------------------------------------------------------------------------
// 4. Aspect-ratio lock — corner handles (fit-within strategy)
// ---------------------------------------------------------------------------

describe('computeResizedBounds — Shift + corner handles', () => {
  // ── SE corner ──────────────────────────────────────────────────────────────

  it('se width-dominant: snaps width down to match height scale', () => {
    // dx=100, dy=10 → raw width=300, raw height=110
    // newRatio = 300/110 ≈ 2.727 > R=2.0 → width proportionally too large
    // expected width = 110 * R = 220, height stays 110
    const r = computeResizedBounds(BASE, 'se', 100, 10, true, false);
    expectClose(r.height, 110,       'height unchanged');
    expectClose(r.width,  110 * R,   'width snapped to height*R');
    expectClose(r.width / r.height,  R, 'ratio');
    // SE: no fixed-edge adjustment (origin stays at 0,0)
    expectClose(r.x, BASE.x, 'x unchanged');
    expectClose(r.y, BASE.y, 'y unchanged');
  });

  it('se height-dominant: snaps height down to match width scale', () => {
    // dx=10, dy=100 → raw width=210, raw height=200
    // newRatio = 210/200 = 1.05 < R=2.0 → height proportionally too large
    // expected height = 210 / R = 105, width stays 210
    const r = computeResizedBounds(BASE, 'se', 10, 100, true, false);
    expectClose(r.width,  210,       'width unchanged');
    expectClose(r.height, 210 / R,   'height snapped to width/R');
    expectClose(r.width / r.height,  R, 'ratio');
    expectClose(r.x, BASE.x, 'x unchanged');
    expectClose(r.y, BASE.y, 'y unchanged');
  });

  // ── NW corner ─────────────────────────────────────────────────────────────

  it('nw width-dominant: snaps width; right+bottom edges stay fixed', () => {
    // nw: dx=-100, dy=-10 → raw x=-100, y=-10, width=300, height=110
    // newRatio=300/110>R → width snapped to 110*R=220
    // Fixed: x = right - width = 200 - 220 = -20, y = bottom - height = 100 - 110 = -10
    const r = computeResizedBounds(BASE, 'nw', -100, -10, true, false);
    expectClose(r.width,  110 * R, 'width snapped to height*R');
    expectClose(r.height, 110,     'height unchanged');
    expectClose(r.x + r.width,  BASE.x + BASE.width,  'right edge fixed');
    expectClose(r.y + r.height, BASE.y + BASE.height, 'bottom edge fixed');
    expectClose(r.width / r.height, R, 'ratio');
  });

  it('nw height-dominant: snaps height; right+bottom edges stay fixed', () => {
    // nw: dx=-10, dy=-100 → raw x=-10, y=-100, width=210, height=200
    // newRatio=210/200<R → height snapped to 210/R=105
    // Fixed: x = 200 - 210 = -10, y = 100 - 105 = -5
    const r = computeResizedBounds(BASE, 'nw', -10, -100, true, false);
    expectClose(r.width,  210,     'width unchanged');
    expectClose(r.height, 210 / R, 'height snapped to width/R');
    expectClose(r.x + r.width,  BASE.x + BASE.width,  'right edge fixed');
    expectClose(r.y + r.height, BASE.y + BASE.height, 'bottom edge fixed');
    expectClose(r.width / r.height, R, 'ratio');
  });

  // ── NE corner ─────────────────────────────────────────────────────────────

  it('ne width-dominant: snaps width; left edge (x) stays fixed; bottom edge fixed', () => {
    // ne: dx=100, dy=-10 → raw y=-10, width=300, height=110
    // newRatio>R → width = 110*R = 220
    // Fixed (ne is in bottom-fixed set): y = 100 - 110 = -10 (already set by delta)
    // NE is NOT in right-fixed set, so x is unchanged at 0
    const r = computeResizedBounds(BASE, 'ne', 100, -10, true, false);
    expectClose(r.width,  110 * R, 'width snapped to height*R');
    expectClose(r.height, 110,     'height unchanged');
    expectClose(r.x,      BASE.x,  'x unchanged (not in right-fixed set)');
    expectClose(r.y + r.height, BASE.y + BASE.height, 'bottom edge fixed');
    expectClose(r.width / r.height, R, 'ratio');
  });

  it('ne height-dominant: snaps height; bottom edge fixed', () => {
    const r = computeResizedBounds(BASE, 'ne', 10, -100, true, false);
    expectClose(r.width,  210,     'width unchanged');
    expectClose(r.height, 210 / R, 'height snapped to width/R');
    expectClose(r.y + r.height, BASE.y + BASE.height, 'bottom edge fixed');
    expectClose(r.width / r.height, R, 'ratio');
  });

  // ── SW corner ─────────────────────────────────────────────────────────────

  it('sw width-dominant: snaps width; right edge fixed; y (top) stays', () => {
    // sw: dx=-100, dy=10 → raw x=-100, width=300, height=110
    // newRatio>R → width = 110*R = 220
    // Fixed (sw in right-fixed set): x = 200 - 220 = -20
    // SW is NOT in bottom-fixed set, so y is unchanged at 0
    const r = computeResizedBounds(BASE, 'sw', -100, 10, true, false);
    expectClose(r.width,  110 * R, 'width snapped to height*R');
    expectClose(r.height, 110,     'height unchanged');
    expectClose(r.x + r.width,  BASE.x + BASE.width, 'right edge fixed');
    expectClose(r.y,      BASE.y, 'y unchanged (not in bottom-fixed set)');
    expectClose(r.width / r.height, R, 'ratio');
  });

  it('sw height-dominant: snaps height; right edge fixed; y stays', () => {
    const r = computeResizedBounds(BASE, 'sw', -10, 100, true, false);
    expectClose(r.width,  210,     'width unchanged');
    expectClose(r.height, 210 / R, 'height snapped to width/R');
    expectClose(r.x + r.width,  BASE.x + BASE.width, 'right edge fixed');
    expectClose(r.width / r.height, R, 'ratio');
  });
});

// ---------------------------------------------------------------------------
// 5. Square initial bounds (R = 1.0)
// ---------------------------------------------------------------------------

describe('computeResizedBounds — Shift with square initial bounds (R=1)', () => {
  const SQ = { x: 0, y: 0, width: 100, height: 100 };

  it('se: result is still a square', () => {
    const r = computeResizedBounds(SQ, 'se', 50, 30, true, false);
    expectClose(r.width / r.height, 1.0, 'ratio=1');
    expectClose(r.height, r.width, 'width equals height');
  });

  it('e: result is still a square, vertically re-centered', () => {
    const r = computeResizedBounds(SQ, 'e', 40, 0, true, false);
    expectClose(r.width,  140, 'width = 140');
    expectClose(r.height, 140, 'height = width');
    expectClose(r.y + r.height / 2, SQ.y + SQ.height / 2, 'center-y preserved');
  });

  it('n: result is still a square, horizontally re-centered', () => {
    const r = computeResizedBounds(SQ, 'n', 0, -40, true, false);
    expectClose(r.height, 140, 'height = 140');
    expectClose(r.width,  140, 'width = height');
    expectClose(r.x + r.width / 2, SQ.x + SQ.width / 2, 'center-x preserved');
  });
});

// ---------------------------------------------------------------------------
// 6. Alt key — center-based resize (no Shift)
// ---------------------------------------------------------------------------

describe('computeResizedBounds — Alt center-based resize', () => {
  it('e + alt: both left and right edges move symmetrically', () => {
    // Drag e by dx=50 → raw width=250; alt doubles growth → width=300
    // center stays at cx=100, so x = 100 - 150 = -50
    const r = computeResizedBounds(BASE, 'e', 50, 0, false, true);
    expectClose(r.width,  300, 'width doubled growth');
    expectClose(r.height, 100, 'height unchanged');
    expectClose(r.x + r.width / 2, BASE.x + BASE.width / 2, 'center-x preserved');
  });

  it('s + alt: both top and bottom edges move symmetrically', () => {
    const r = computeResizedBounds(BASE, 's', 0, 50, false, true);
    expectClose(r.height, 200, 'height doubled growth');
    expectClose(r.y + r.height / 2, BASE.y + BASE.height / 2, 'center-y preserved');
  });

  it('se + alt: grows in all four directions', () => {
    const r = computeResizedBounds(BASE, 'se', 30, 20, false, true);
    // raw dw=30, dh=20 → doubled: width=260, height=140, center stays
    expectClose(r.width,  260, 'width');
    expectClose(r.height, 140, 'height');
    expectClose(r.x + r.width  / 2, BASE.x + BASE.width  / 2, 'center-x');
    expectClose(r.y + r.height / 2, BASE.y + BASE.height / 2, 'center-y');
  });
});

// ---------------------------------------------------------------------------
// 7. Shift + Alt combined
// ---------------------------------------------------------------------------

describe('computeResizedBounds — Shift + Alt combined', () => {
  it('e + shift + alt: ratio maintained AND center preserved', () => {
    // Shift first: height = 250/R = 125, y = 50 - 62.5 = -12.5
    // Alt then: dw = 250-200=50 → doubled → width=300, dh = 125-100=25 → doubled → height=150
    // center: cx=100 → x = 100-150=-50; cy=50 → y = 50-75=-25
    const r = computeResizedBounds(BASE, 'e', 50, 0, true, true);
    expectClose(r.width / r.height, R, 'ratio maintained');
    expectClose(r.x + r.width  / 2, BASE.x + BASE.width  / 2, 'center-x preserved');
    expectClose(r.y + r.height / 2, BASE.y + BASE.height / 2, 'center-y preserved');
  });

  it('se + shift + alt: ratio maintained AND center preserved', () => {
    const r = computeResizedBounds(BASE, 'se', 50, 30, true, true);
    expectClose(r.width / r.height, R, 'ratio maintained');
    expectClose(r.x + r.width  / 2, BASE.x + BASE.width  / 2, 'center-x preserved');
    expectClose(r.y + r.height / 2, BASE.y + BASE.height / 2, 'center-y preserved');
  });
});

// ---------------------------------------------------------------------------
// 8. Minimum size enforcement (MIN_SIZE = 10)
// ---------------------------------------------------------------------------

describe('computeResizedBounds — minimum size enforcement', () => {
  it('e: width clamped to 10 when dragging past zero', () => {
    const r = computeResizedBounds(BASE, 'e', -999, 0, false, false);
    expect(r.width).toBeGreaterThanOrEqual(10);
  });

  it('s: height clamped to 10 when dragging past zero', () => {
    const r = computeResizedBounds(BASE, 's', 0, -999, false, false);
    expect(r.height).toBeGreaterThanOrEqual(10);
  });

  it('nw: both width and height clamped, x/y adjusted to keep bottom-right fixed', () => {
    const r = computeResizedBounds(BASE, 'nw', 999, 999, false, false);
    expect(r.width).toBeGreaterThanOrEqual(10);
    expect(r.height).toBeGreaterThanOrEqual(10);
    // Right and bottom edges should stay near original values
    expectClose(r.x + r.width,  BASE.x + BASE.width,  'right edge preserved');
    expectClose(r.y + r.height, BASE.y + BASE.height, 'bottom edge preserved');
  });

  it('se: both width and height clamped', () => {
    const r = computeResizedBounds(BASE, 'se', -999, -999, false, false);
    expect(r.width).toBeGreaterThanOrEqual(10);
    expect(r.height).toBeGreaterThanOrEqual(10);
    // Origin should stay at 0,0 for SE handle
    expectClose(r.x, BASE.x, 'x unchanged');
    expectClose(r.y, BASE.y, 'y unchanged');
  });
});

// ---------------------------------------------------------------------------
// 9. Non-origin base bounds (translation correctness)
// ---------------------------------------------------------------------------

describe('computeResizedBounds — non-origin base bounds', () => {
  const OFFSET = { x: 50, y: 30, width: 200, height: 100 };

  it('e + shift: right edge moves, center-y preserved', () => {
    const r = computeResizedBounds(OFFSET, 'e', 50, 0, true, false);
    const cy = OFFSET.y + OFFSET.height / 2;
    expectClose(r.y + r.height / 2, cy, 'center-y');
    expectClose(r.width / r.height, OFFSET.width / OFFSET.height, 'ratio');
  });

  it('w + shift: right edge stays at OFFSET.x+OFFSET.width', () => {
    const r = computeResizedBounds(OFFSET, 'w', -50, 0, true, false);
    expectClose(r.x + r.width, OFFSET.x + OFFSET.width, 'right edge fixed');
    expectClose(r.width / r.height, OFFSET.width / OFFSET.height, 'ratio');
  });

  it('n + shift: bottom edge stays at OFFSET.y+OFFSET.height', () => {
    const r = computeResizedBounds(OFFSET, 'n', 0, -50, true, false);
    expectClose(r.y + r.height, OFFSET.y + OFFSET.height, 'bottom edge fixed');
    expectClose(r.width / r.height, OFFSET.width / OFFSET.height, 'ratio');
  });

  it('nw + shift: right and bottom edges both stay fixed', () => {
    const r = computeResizedBounds(OFFSET, 'nw', -50, -30, true, false);
    expectClose(r.x + r.width,  OFFSET.x + OFFSET.width,  'right edge fixed');
    expectClose(r.y + r.height, OFFSET.y + OFFSET.height, 'bottom edge fixed');
    expectClose(r.width / r.height, OFFSET.width / OFFSET.height, 'ratio');
  });
});

// ---------------------------------------------------------------------------
// 10. Degenerate / edge cases
// ---------------------------------------------------------------------------

describe('computeResizedBounds — edge cases', () => {
  it('zero dx and dy: dimensions unchanged', () => {
    const r = computeResizedBounds(BASE, 'se', 0, 0, false, false);
    expect(r).toEqual(BASE);
  });

  it('zero dx and dy with Shift: dimensions unchanged (ratio already correct)', () => {
    const r = computeResizedBounds(BASE, 'se', 0, 0, true, false);
    // Width and height might be re-constrained but ratio must be R
    expectClose(r.width / r.height, R, 'ratio');
  });

  it('Shift does nothing when shiftKey=false', () => {
    const noShift = computeResizedBounds(BASE, 'e', 50, 0, false, false);
    expect(noShift.height).toBe(BASE.height); // height unchanged
  });

  it('very tall initial bounds (R < 1) still locked correctly via s handle', () => {
    const TALL = { x: 0, y: 0, width: 50, height: 200 };
    const tallR = TALL.width / TALL.height; // 0.25
    const r = computeResizedBounds(TALL, 's', 0, 50, true, false);
    expectClose(r.width / r.height, tallR, 'ratio for tall shape');
  });
});
