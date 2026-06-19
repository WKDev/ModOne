import type { LadderDocumentData } from '../../../types/document';
import type {
  DerivedTopology,
  HorizontalEdgeEntity,
  LadderElement,
  TopologyIssue,
  TopologyNode,
  VerticalContinuityChain,
} from '../../../types/ladder';
import { isLogicElement } from '../../../types/ladder';
import { buildDualGridTopology } from './dualGrid';

function nodeId(boundaryCol: number, row: number): string {
  return `node:${boundaryCol}:${row}`;
}

export function buildCellCoordKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function buildVerticalEdgeCoordKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function findHorizontalEdgeContainingCell(
  horizontalEdges: Map<string, HorizontalEdgeEntity>,
  row: number,
  col: number,
): HorizontalEdgeEntity | undefined {
  for (const edge of horizontalEdges.values()) {
    if (edge.position.row !== row) continue;
    if (edge.position.startBoundaryCol <= col && edge.position.endBoundaryCol >= col + 1) {
      return edge;
    }
  }

  return undefined;
}

export function normalizeHorizontalEdges(
  horizontalEdges: Map<string, HorizontalEdgeEntity>,
): Map<string, HorizontalEdgeEntity> {
  const byRow = new Map<number, HorizontalEdgeEntity[]>();

  for (const edge of horizontalEdges.values()) {
    const sanitizedStart = Math.min(edge.position.startBoundaryCol, edge.position.endBoundaryCol);
    const sanitizedEnd = Math.max(edge.position.startBoundaryCol, edge.position.endBoundaryCol);
    if (sanitizedEnd <= sanitizedStart) continue;

    const copy: HorizontalEdgeEntity = {
      ...edge,
      position: {
        row: edge.position.row,
        startBoundaryCol: sanitizedStart,
        endBoundaryCol: sanitizedEnd,
      },
      properties: { ...edge.properties },
    };

    const bucket = byRow.get(copy.position.row);
    if (bucket) {
      bucket.push(copy);
    } else {
      byRow.set(copy.position.row, [copy]);
    }
  }

  const normalized = new Map<string, HorizontalEdgeEntity>();
  for (const [row, edges] of byRow) {
    edges.sort((a, b) => a.position.startBoundaryCol - b.position.startBoundaryCol);

    let current: HorizontalEdgeEntity | null = null;
    for (const edge of edges) {
      if (!current) {
        current = edge;
        continue;
      }

      if (edge.position.startBoundaryCol <= current.position.endBoundaryCol) {
        current = {
          ...current,
          position: {
            row,
            startBoundaryCol: current.position.startBoundaryCol,
            endBoundaryCol: Math.max(current.position.endBoundaryCol, edge.position.endBoundaryCol),
          },
          properties: {
            isValid: current.properties.isValid !== false && edge.properties.isValid !== false,
          },
        };
        continue;
      }

      normalized.set(current.id, current);
      current = edge;
    }

    if (current) {
      normalized.set(current.id, current);
    }
  }

  return normalized;
}

export function rebuildLadderTopologyCache(data: LadderDocumentData): DerivedTopology {
  const logicalElements = new Map<string, LadderElement>();
  for (const [id, element] of data.elements) {
    if (isLogicElement(element)) {
      logicalElements.set(id, element);
    }
  }
  const elements = logicalElements;
  const horizontalEdges = normalizeHorizontalEdges(data.horizontalEdges);

  const dualGrid = buildDualGridTopology({
    components: Array.from(elements.values()).map((element) => ({
      id: element.id,
      x: element.position.col,
      y: element.position.row,
      width: 1,
    })),
    horizontalSegments: Array.from(horizontalEdges.values()).map((edge) => ({
      id: edge.id,
      xStart: edge.position.startBoundaryCol,
      xEnd: edge.position.endBoundaryCol,
      y: edge.position.row,
    })),
    verticalLinks: Array.from(data.verticalEdges.values()).map((edge) => ({
      id: edge.id,
      x: edge.position.col,
      y: edge.position.row + 0.5,
    })),
  });

  const cellsByCoord = new Map<string, string>();
  for (const element of elements.values()) {
    cellsByCoord.set(buildCellCoordKey(element.position.row, element.position.col), element.id);
  }

  const horizontalEdgesByRow = new Map<number, string[]>();
  for (const edge of horizontalEdges.values()) {
    const rowEdges = horizontalEdgesByRow.get(edge.position.row);
    if (rowEdges) {
      rowEdges.push(edge.id);
    } else {
      horizontalEdgesByRow.set(edge.position.row, [edge.id]);
    }
  }

  const verticalEdgesByCoord = new Map<string, string>();
  for (const edge of data.verticalEdges.values()) {
    verticalEdgesByCoord.set(buildVerticalEdgeCoordKey(edge.position.row, edge.position.col), edge.id);
  }

  const adjacency = new Map<string, string[]>();
  for (const [nodeKey, neighbors] of dualGrid.adjacency) {
    adjacency.set(nodeKey, [...neighbors]);
  }

  const nodeNetIds = new Map<string, string>();
  let nextNet = 1;
  const visited = new Set<string>();
  for (const node of dualGrid.nodes.values()) {
    if (visited.has(node.id)) continue;

    const queue = [node.id];
    const currentNetId = `net-${nextNet++}`;
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      nodeNetIds.set(current, currentNetId);

      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
  }

  const nodes = new Map<string, TopologyNode>();
  const netIdsByElementId = new Map<string, string>();
  const netIdsByEdgeId = new Map<string, string>();

  for (const node of dualGrid.nodes.values()) {
    const netId = nodeNetIds.get(node.id) ?? 'net-0';
    const attachedElementIds = node.terminalIds.map((terminalId) => terminalId.split(':')[0]);
    const incidentEdgeIds = Array.from(new Set([...node.horizontalSegmentIds, ...node.verticalLinkIds]));
    nodes.set(node.id, {
      id: node.id,
      boundaryCol: node.point.x,
      row: node.point.y,
      incidentEdgeIds,
      attachedElementIds,
      degree: adjacency.get(node.id)?.length ?? 0,
      netId,
    });

    for (const elementId of attachedElementIds) {
      netIdsByElementId.set(elementId, netId);
    }
    for (const edgeId of incidentEdgeIds) {
      netIdsByEdgeId.set(edgeId, netId);
    }
  }

  const issues: TopologyIssue[] = [];
  for (const issue of dualGrid.issues) {
    issues.push({
      id: issue.sourceId,
      severity: 'warning',
      code: issue.code === 'ISOLATED_VERTICAL_CHAIN'
        ? 'INVALID_VERTICAL_CHAIN'
        : 'INVALID_VERTICAL_CHAIN',
      message: issue.message,
    });
  }

  const nodesByNet = new Map<string, TopologyNode[]>();
  for (const topologyNode of nodes.values()) {
    const bucket = nodesByNet.get(topologyNode.netId);
    if (bucket) {
      bucket.push(topologyNode);
    } else {
      nodesByNet.set(topologyNode.netId, [topologyNode]);
    }
  }

  for (const [netId, netNodes] of nodesByNet) {
    const touchesRail = netNodes.some((node) =>
      node.boundaryCol === 0 || node.boundaryCol === data.gridConfig.columns,
    );
    const hasTerminal = netNodes.some((node) => node.attachedElementIds.length > 0);
    if (!touchesRail && !hasTerminal) {
      issues.push({
        id: netId,
        severity: 'warning',
        code: 'ISOLATED_NET',
        message: 'Net is isolated from both rails and any logic element terminal.',
      });
    }
  }

  for (const verticalEdge of data.verticalEdges.values()) {
    const top = nodes.get(nodeId(verticalEdge.position.col, verticalEdge.position.row));
    const bottom = nodes.get(nodeId(verticalEdge.position.col, verticalEdge.position.row + 1));
    const hasTopAttachment = (top?.degree ?? 0) > 1 || (top?.attachedElementIds.length ?? 0) > 0;
    const hasBottomAttachment = (bottom?.degree ?? 0) > 1 || (bottom?.attachedElementIds.length ?? 0) > 0;
    if (!hasTopAttachment || !hasBottomAttachment) {
      issues.push({
        id: verticalEdge.id,
        severity: 'warning',
        code: 'DANGLING_VERTICAL_EDGE',
        message: 'Vertical edge is only attached on one side.',
      });
    }
  }

  const verticalChains: VerticalContinuityChain[] = dualGrid.verticalChains.map((chain) => ({
    id: chain.id,
    edgeIds: [...chain.linkIds],
    boundaryCol: chain.x,
    gapRows: chain.yValues.map((value) => Math.floor(value)),
    valid: chain.valid,
    reason: chain.reason,
  }));

  const topology: DerivedTopology = {
    nodes,
    adjacency,
    netIdsByEdgeId,
    netIdsByElementId,
    cellsByCoord,
    horizontalEdgesByRow,
    verticalEdgesByCoord,
    verticalChains,
    issues,
  };

  return topology;
}
