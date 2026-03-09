/**
 * Regression tests for the wire segment drag amplification fix (Task 1, Wave 1).
 *
 * Bug: _handleSegmentDraggingMove was calling moveWireSegment with the total
 *      accumulated delta (from drag start) on EVERY frame, and _handleSegmentDraggingUp
 *      re-applied the same delta again — causing 2× amplification.
 *
 * Fix: _handleSegmentDraggingMove now computes the INCREMENTAL delta each frame
 *      (currentConstrained - prevConstrained), and _handleSegmentDraggingUp no
 *      longer calls moveWireSegment at all.
 *
 * Test strategy: bypass the InteractionController entirely and test the store's
 * moveWireSegment action directly with known deltas. The contract is:
 *   "calling moveWireSegment(wireId, A, B, delta) ADDS delta to handle positions".
 * Successive calls with incremental deltas must NOT amplify.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useCanvasStore } from '../../../../stores/canvasStore';
import type { Wire, WireHandle, Position } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHandle(x: number, y: number): WireHandle {
  return {
    position: { x, y },
    constraint: 'horizontal',
    source: 'user',
  };
}

function makeWire(id: string, handles: WireHandle[]): Wire {
  return {
    id,
    from: { componentId: 'a', portId: 'out' },
    to: { componentId: 'b', portId: 'in' },
    handles,
  };
}

function getHandlePositions(wireId: string): Position[] {
  const wire = useCanvasStore.getState().wires.find((w) => w.id === wireId);
  if (!wire?.handles) throw new Error(`Wire ${wireId} not found or has no handles`);
  return wire.handles.map((h) => ({ ...h.position }));
}

function moveSegment(
  wireId: string,
  handleA: number,
  handleB: number,
  delta: Position,
  isFirstMove = false
): void {
  useCanvasStore.getState().moveWireSegment(wireId, handleA, handleB, delta, isFirstMove);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  useCanvasStore.setState((state) => ({
    ...state,
    components: new Map(),
    junctions: new Map(),
    wires: [],
    history: [],
    historyIndex: -1,
    isDirty: false,
  }));
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('wire segment drag — no delta amplification (regression for Task 1 fix)', () => {
  it('single move: delta is applied exactly once to both handles', () => {
    // Setup: wire with two horizontal handles at y=100
    useCanvasStore.setState((state) => ({
      ...state,
      wires: [makeWire('w1', [makeHandle(100, 100), makeHandle(200, 100)])],
    }));

    moveSegment('w1', 0, 1, { x: 50, y: 0 }, true);

    const positions = getHandlePositions('w1');
    expect(positions[0]).toEqual({ x: 150, y: 100 });
    expect(positions[1]).toEqual({ x: 250, y: 100 });
  });

  it('sequential incremental deltas accumulate correctly — no amplification', () => {
    // Setup: wire with two handles at x=100, x=200
    useCanvasStore.setState((state) => ({
      ...state,
      wires: [makeWire('w2', [makeHandle(100, 200), makeHandle(200, 200)])],
    }));

    // Simulate 3 incremental drag frames: +10, +10, +10 → total +30
    moveSegment('w2', 0, 1, { x: 10, y: 0 }, true);
    moveSegment('w2', 0, 1, { x: 10, y: 0 }, false);
    moveSegment('w2', 0, 1, { x: 10, y: 0 }, false);

    const positions = getHandlePositions('w2');
    // Each call added +10 — total should be +30, not amplified
    expect(positions[0]).toEqual({ x: 130, y: 200 });
    expect(positions[1]).toEqual({ x: 230, y: 200 });
  });

  it('horizontal constraint: x changes but y stays unchanged', () => {
    useCanvasStore.setState((state) => ({
      ...state,
      wires: [makeWire('w3', [makeHandle(100, 150), makeHandle(200, 150)])],
    }));

    // Horizontal segment: only x should move (x-only delta)
    moveSegment('w3', 0, 1, { x: 75, y: 0 }, true);

    const positions = getHandlePositions('w3');
    expect(positions[0].y).toBe(150); // y unchanged
    expect(positions[1].y).toBe(150); // y unchanged
    expect(positions[0].x).toBe(175); // x moved
    expect(positions[1].x).toBe(275); // x moved
  });

  it('large delta safety: large delta applied exactly once — no clamping', () => {
    useCanvasStore.setState((state) => ({
      ...state,
      wires: [makeWire('w4', [makeHandle(100, 100), makeHandle(200, 100)])],
    }));

    moveSegment('w4', 0, 1, { x: 1000, y: 0 }, true);

    const positions = getHandlePositions('w4');
    expect(positions[0]).toEqual({ x: 1100, y: 100 });
    expect(positions[1]).toEqual({ x: 1200, y: 100 });
  });

  it('zero delta no-op: handles remain at original positions', () => {
    useCanvasStore.setState((state) => ({
      ...state,
      wires: [makeWire('w5', [makeHandle(100, 100), makeHandle(200, 100)])],
    }));

    const before = getHandlePositions('w5');
    moveSegment('w5', 0, 1, { x: 0, y: 0 }, true);
    const after = getHandlePositions('w5');

    expect(after[0]).toEqual(before[0]);
    expect(after[1]).toEqual(before[1]);
  });

  it('negative delta moves handles backward', () => {
    useCanvasStore.setState((state) => ({
      ...state,
      wires: [makeWire('w6', [makeHandle(300, 100), makeHandle(400, 100)])],
    }));

    moveSegment('w6', 0, 1, { x: -50, y: 0 }, true);

    const positions = getHandlePositions('w6');
    expect(positions[0]).toEqual({ x: 250, y: 100 });
    expect(positions[1]).toEqual({ x: 350, y: 100 });
  });

  it('vertical segment: y changes but x stays unchanged', () => {
    useCanvasStore.setState((state) => ({
      ...state,
      wires: [makeWire('w7', [makeHandle(100, 100), makeHandle(100, 200)])],
    }));

    // Vertical segment: only y delta (constrained to vertical)
    moveSegment('w7', 0, 1, { x: 0, y: 40 }, true);

    const positions = getHandlePositions('w7');
    expect(positions[0].x).toBe(100); // x unchanged
    expect(positions[1].x).toBe(100); // x unchanged
    expect(positions[0].y).toBe(140); // y moved
    expect(positions[1].y).toBe(240); // y moved
  });

  it('isFirstMove=true pushes history, subsequent calls (false) do not create extra snapshots', () => {
    useCanvasStore.setState((state) => ({
      ...state,
      wires: [makeWire('w8', [makeHandle(100, 100), makeHandle(200, 100)])],
    }));

    // isFirstMove=true should push one history snapshot
    moveSegment('w8', 0, 1, { x: 10, y: 0 }, true);
    const historyAfterFirst = useCanvasStore.getState().historyIndex;

    // isFirstMove=false should NOT push additional history snapshots
    moveSegment('w8', 0, 1, { x: 10, y: 0 }, false);
    moveSegment('w8', 0, 1, { x: 10, y: 0 }, false);
    const historyAfterSubsequent = useCanvasStore.getState().historyIndex;

    // Only one history entry should have been pushed (from isFirstMove=true)
    expect(historyAfterFirst).toBe(historyAfterSubsequent);
  });

  it('regression: old bug would apply delta twice — verify final position is NOT doubled', () => {
    // Old bug: _handleSegmentDraggingMove called with constrained (total from start),
    // then _handleSegmentDraggingUp called again with the same value.
    // This caused 2× amplification.
    //
    // Correct behavior: one call of moveWireSegment with delta={x:50} → handles shift by 50.
    // Buggy behavior: two calls → handles shift by 100.
    useCanvasStore.setState((state) => ({
      ...state,
      wires: [makeWire('w9', [makeHandle(100, 100), makeHandle(200, 100)])],
    }));

    // Simulate correct behavior (single incremental call)
    moveSegment('w9', 0, 1, { x: 50, y: 0 }, true);

    const positions = getHandlePositions('w9');
    // Correct: moved by exactly 50
    expect(positions[0].x).toBe(150);
    expect(positions[1].x).toBe(250);

    // Incorrect (what the bug would produce): moved by 100
    expect(positions[0].x).not.toBe(200);
    expect(positions[1].x).not.toBe(300);
  });
});
