import { describe, expect, it } from 'vitest';
import {
  buildDualGridTopology,
  projectHorizontalSegmentToPixels,
  projectVerticalLinkToPixels,
  resolveDualGridSelection,
  snapPointerToDualGrid,
} from '../dualGrid';

describe('dualGrid', () => {
  it('snaps vertical placement to integer x and half-step y', () => {
    const snapped = snapPointerToDualGrid({ x: 3.18, y: 4.62 }, 'vertical');

    expect(snapped.point).toEqual({ x: 3, y: 4.5 });
    expect(snapped.distance).toBeGreaterThan(0);
  });

  it('creates an auto junction when a branch drops from a horizontal rung', () => {
    const topology = buildDualGridTopology({
      horizontalSegments: [{ id: 'h-1', xStart: 0, xEnd: 3, y: 1 }],
      verticalLinks: [{ id: 'v-1', x: 1, y: 1.5 }],
    });

    const node = topology.nodes.get('node:1:1');
    expect(node).toBeDefined();
    expect(node?.autoCreated).toBe(true);
    expect(node?.isJunction).toBe(true);
    expect(node?.horizontalSegmentIds).toEqual(['h-1']);
    expect(node?.verticalLinkIds).toEqual(['v-1']);
  });

  it('groups continuous vertical links into one continuity chain', () => {
    const topology = buildDualGridTopology({
      horizontalSegments: [{ id: 'h-0', xStart: 0, xEnd: 2, y: 0 }],
      verticalLinks: [
        { id: 'v-0', x: 1, y: 0.5 },
        { id: 'v-1', x: 1, y: 1.5 },
        { id: 'v-2', x: 1, y: 2.5 },
      ],
    });

    expect(topology.verticalChains).toHaveLength(1);
    expect(topology.verticalChains[0].linkIds).toEqual(['v-0', 'v-1', 'v-2']);
    expect(topology.linkToChainId.get('v-0')).toBe(topology.verticalChains[0].id);
    expect(topology.linkToChainId.get('v-2')).toBe(topology.verticalChains[0].id);
  });

  it('prefers the closer coordinate system during crossing selection', () => {
    const candidates = [
      { id: 'h-1', kind: 'horizontal' as const, segment: { id: 'h-1', xStart: 0, xEnd: 2, y: 1 } },
      { id: 'v-1', kind: 'vertical' as const, link: { id: 'v-1', x: 1, y: 1.5 } },
    ];

    const verticalPick = resolveDualGridSelection({ x: 1.02, y: 1.46 }, candidates);
    const horizontalPick = resolveDualGridSelection({ x: 1.02, y: 1.04 }, candidates);

    expect(verticalPick?.id).toBe('v-1');
    expect(horizontalPick?.id).toBe('h-1');
  });

  it('marks isolated vertical-only chains as invalid paths', () => {
    const topology = buildDualGridTopology({
      verticalLinks: [
        { id: 'v-10', x: 4, y: 2.5 },
        { id: 'v-11', x: 4, y: 3.5 },
      ],
    });

    expect(topology.verticalChains).toHaveLength(1);
    expect(topology.verticalChains[0].valid).toBe(false);
    expect(topology.issues.some((issue) => issue.code === 'ISOLATED_VERTICAL_CHAIN')).toBe(true);
  });

  it('stores top and bottom vertical link lists per row', () => {
    const topology = buildDualGridTopology({
      verticalLinks: [
        { id: 'v-20', x: 2, y: 0.5 },
        { id: 'v-21', x: 2, y: 1.5 },
      ],
    });

    expect(topology.rowStates.get(0)).toEqual({ row: 0, topLinkIds: [], bottomLinkIds: ['v-20'] });
    expect(topology.rowStates.get(1)).toEqual({ row: 1, topLinkIds: ['v-20'], bottomLinkIds: ['v-21'] });
    expect(topology.rowStates.get(2)).toEqual({ row: 2, topLinkIds: ['v-21'], bottomLinkIds: [] });
  });

  it('projects horizontal and vertical geometry with the dual-grid render contract', () => {
    const horizontal = projectHorizontalSegmentToPixels(
      { id: 'h-2', xStart: 1, xEnd: 3, y: 2 },
      { unitWidth: 80, unitHeight: 60 }
    );
    const vertical = projectVerticalLinkToPixels(
      { id: 'v-30', x: 2, y: 2.5 },
      { unitWidth: 80, unitHeight: 60 }
    );

    expect(horizontal).toEqual({
      start: { x: 80, y: 120 },
      end: { x: 240, y: 120 },
    });
    expect(vertical).toEqual({
      start: { x: 160, y: 120 },
      end: { x: 160, y: 180 },
    });
  });
});
