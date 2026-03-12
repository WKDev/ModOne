import { describe, expect, it } from 'vitest';
import {
  getVerticalWireHighlightWidth,
  getVerticalWireHitSlop,
  getVerticalWireSegmentDistance,
  resolveVerticalWireHitTarget,
} from '../verticalWireInteraction';

describe('verticalWireInteraction', () => {
  it('expands vertical wire hit slop beyond the old 12px baseline on standard cells', () => {
    expect(getVerticalWireHitSlop(80)).toBe(19);
  });

  it('maps edge clicks to boundary columns and dedicated vertical-grid rows', () => {
    expect(resolveVerticalWireHitTarget(14, 20, 0, 0, 80, 60)).toEqual({
      targetCol: 0,
      targetRow: 1,
      isEdgeClick: true,
    });

    expect(resolveVerticalWireHitTarget(67, 90, 0, 1, 80, 60)).toEqual({
      targetCol: 1,
      targetRow: 1,
      isEdgeClick: true,
    });
  });

  it('keeps center clicks on the current cell while still resolving a vertical-grid row', () => {
    expect(resolveVerticalWireHitTarget(40, 110, 0, 1, 80, 60)).toEqual({
      targetCol: 0,
      targetRow: 2,
      isEdgeClick: false,
    });
  });

  it('uses a wider highlight stripe for selected vertical wires', () => {
    expect(getVerticalWireHighlightWidth()).toBe(12);
  });

  it('measures distance against a dedicated vertical-link segment', () => {
    expect(getVerticalWireSegmentDistance(95, 1, 60)).toBe(0);
    expect(getVerticalWireSegmentDistance(170, 1, 60)).toBeGreaterThan(0);
    expect(getVerticalWireSegmentDistance(150, 2, 60)).toBe(0);
  });
});
