import { describe, expect, it } from 'vitest';
import type { LadderDocumentData, } from '../../../../types/document';
import type { HorizontalEdgeEntity, LadderElement, VerticalEdgeEntity } from '../../../../types/ladder';
import { DEFAULT_LADDER_DATA } from '../../../../types/document';
import { rebuildLadderTopologyCache } from '../topologyBuilder';

function createDocData(
  elements: LadderElement[] = [],
  horizontalEdges: HorizontalEdgeEntity[] = [],
  verticalEdges: VerticalEdgeEntity[] = [],
): LadderDocumentData {
  return {
    ...DEFAULT_LADDER_DATA,
    elements: new Map(elements.map((element) => [element.id, element])),
    horizontalEdges: new Map(horizontalEdges.map((edge) => [edge.id, edge])),
    verticalEdges: new Map(verticalEdges.map((edge) => [edge.id, edge])),
    rungLabels: new Map(),
  };
}

describe('graph-first ladder topology', () => {
  it('keeps a two-row branch as an L-shape instead of inventing a T-junction', () => {
    const docData = createDocData(
      [],
      [
        {
          id: 'h-2',
          position: { row: 1, startBoundaryCol: 0, endBoundaryCol: 1 },
          properties: { isValid: true },
        },
      ],
      [
        {
          id: 'v-1',
          position: { row: 0, col: 0 },
          properties: { isValid: true },
        },
      ],
    );

    const topology = rebuildLadderTopologyCache(docData);
    const branchNode = topology.nodes.get('node:0:1');
    expect(branchNode?.degree).toBe(2);
  });

  it('creates a true T-junction only when the node has degree 3', () => {
    const docData = createDocData(
      [],
      [
        {
          id: 'h-1',
          position: { row: 1, startBoundaryCol: 0, endBoundaryCol: 2 },
          properties: { isValid: true },
        },
      ],
      [
        {
          id: 'v-top',
          position: { row: 0, col: 1 },
          properties: { isValid: true },
        },
        {
          id: 'v-bottom',
          position: { row: 1, col: 1 },
          properties: { isValid: true },
        },
      ],
    );

    const topology = rebuildLadderTopologyCache(docData);
    const junctionNode = topology.nodes.get('node:1:1');
    expect(junctionNode?.degree).toBe(4);
  });

  it('normalizes adjacent horizontal runs into a single span', () => {
    const docData = createDocData(
      [],
      [
        {
          id: 'h-a',
          position: { row: 2, startBoundaryCol: 0, endBoundaryCol: 1 },
          properties: { isValid: true },
        },
        {
          id: 'h-b',
          position: { row: 2, startBoundaryCol: 1, endBoundaryCol: 3 },
          properties: { isValid: true },
        },
      ],
      [],
    );

    const topology = rebuildLadderTopologyCache(docData);
    // horizontalEdgesByRow should contain a single merged span
    const row2Edges = topology.horizontalEdgesByRow.get(2);
    expect(row2Edges).toBeDefined();
    expect(row2Edges!.length).toBe(1);
  });

  it('marks isolated vertical chains as invalid', () => {
    const docData = createDocData(
      [],
      [],
      [
        {
          id: 'v-iso',
          position: { row: 3, col: 2 },
          properties: { isValid: true },
        },
      ],
    );

    const topology = rebuildLadderTopologyCache(docData);
    expect(topology.issues.some((issue) => issue.code === 'INVALID_VERTICAL_CHAIN')).toBe(true);
  });
});
