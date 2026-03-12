/**
 * Dual-grid utilities for high-precision ladder editing.
 *
 * The editor operates on two coordinate systems at once:
 * - Component grid: integer cell coordinates for logic elements and horizontal rails
 * - Link grid: half-step Y coordinates for vertical links between adjacent rows
 *
 * This module is intentionally renderer-agnostic so the same topology can drive
 * snapping, hit-testing, selection, validation, and future power-flow animation.
 */

export interface UnitPoint {
  x: number;
  y: number;
}

export interface DualGridConfig {
  unitWidth: number;
  unitHeight: number;
  snapTolerance?: number;
  selectionTolerance?: number;
}

export const DEFAULT_DUAL_GRID_CONFIG: DualGridConfig = {
  unitWidth: 80,
  unitHeight: 60,
  snapTolerance: 0.35,
  selectionTolerance: 0.4,
};

export interface ComponentCell {
  id: string;
  x: number;
  y: number;
  width?: number;
}

export interface HorizontalSegment {
  id: string;
  xStart: number;
  xEnd: number;
  y: number;
}

export interface VerticalLink {
  id: string;
  x: number;
  y: number;
}

export interface DualGridTopologyInput {
  components?: ComponentCell[];
  horizontalSegments?: HorizontalSegment[];
  verticalLinks?: VerticalLink[];
}

export interface RowLinkState {
  row: number;
  topLinkIds: string[];
  bottomLinkIds: string[];
}

export interface DualGridNode {
  id: string;
  point: UnitPoint;
  horizontalSegmentIds: string[];
  verticalLinkIds: string[];
  terminalIds: string[];
  autoCreated: boolean;
  isJunction: boolean;
}

export interface DualGridEdge {
  id: string;
  kind: 'horizontal' | 'vertical';
  sourceId: string;
  targetId: string;
  ownerId: string;
}

export interface VerticalContinuityChain {
  id: string;
  x: number;
  linkIds: string[];
  yValues: number[];
  nodeIds: string[];
  valid: boolean;
  reason?: string;
}

export interface DualGridIssue {
  code:
    | 'INVALID_COMPONENT_COORDINATE'
    | 'INVALID_HORIZONTAL_SEGMENT'
    | 'INVALID_VERTICAL_LINK'
    | 'ISOLATED_VERTICAL_CHAIN';
  message: string;
  sourceId: string;
}

export interface DualGridTopology {
  nodes: Map<string, DualGridNode>;
  edges: DualGridEdge[];
  adjacency: Map<string, string[]>;
  rowStates: Map<number, RowLinkState>;
  verticalChains: VerticalContinuityChain[];
  linkToChainId: Map<string, string>;
  issues: DualGridIssue[];
}

export type SelectableDualGridEntity =
  | { id: string; kind: 'horizontal'; segment: HorizontalSegment }
  | { id: string; kind: 'vertical'; link: VerticalLink }
  | { id: string; kind: 'node'; point: UnitPoint };

export interface DualGridSelection {
  id: string;
  kind: SelectableDualGridEntity['kind'];
  distance: number;
}

export interface SnapResult<TPoint extends UnitPoint> {
  point: TPoint;
  distance: number;
}

export function isIntegerCoordinate(value: number): boolean {
  return Number.isInteger(value);
}

export function isHalfStepCoordinate(value: number): boolean {
  return Number.isInteger(value * 2) && !Number.isInteger(value);
}

export function snapToComponentGrid(point: UnitPoint): SnapResult<UnitPoint> {
  const snapped = {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };

  return {
    point: snapped,
    distance: distanceBetweenPoints(point, snapped),
  };
}

export function snapToVerticalLinkGrid(point: UnitPoint): SnapResult<UnitPoint> {
  const snapped = {
    x: Math.round(point.x),
    y: getNearestHalfStep(point.y),
  };

  return {
    point: snapped,
    distance: distanceBetweenPoints(point, snapped),
  };
}

export function snapPointerToDualGrid(
  point: UnitPoint,
  mode: 'component' | 'vertical'
): SnapResult<UnitPoint> {
  return mode === 'component'
    ? snapToComponentGrid(point)
    : snapToVerticalLinkGrid(point);
}

export function projectPointToPixels(point: UnitPoint, config: DualGridConfig): UnitPoint {
  return {
    x: point.x * config.unitWidth,
    y: point.y * config.unitHeight,
  };
}

export function projectHorizontalSegmentToPixels(
  segment: HorizontalSegment,
  config: DualGridConfig
): { start: UnitPoint; end: UnitPoint } {
  return {
    start: projectPointToPixels({ x: segment.xStart, y: segment.y }, config),
    end: projectPointToPixels({ x: segment.xEnd, y: segment.y }, config),
  };
}

export function projectVerticalLinkToPixels(
  link: VerticalLink,
  config: DualGridConfig
): { start: UnitPoint; end: UnitPoint } {
  return {
    start: projectPointToPixels({ x: link.x, y: link.y - 0.5 }, config),
    end: projectPointToPixels({ x: link.x, y: link.y + 0.5 }, config),
  };
}

export function buildDualGridTopology(input: DualGridTopologyInput): DualGridTopology {
  const nodes = new Map<string, DualGridNode>();
  const edges: DualGridEdge[] = [];
  const adjacency = new Map<string, Set<string>>();
  const rowStates = new Map<number, RowLinkState>();
  const issues: DualGridIssue[] = [];

  const components = input.components ?? [];
  const horizontalSegments = input.horizontalSegments ?? [];
  const verticalLinks = input.verticalLinks ?? [];

  const ensureNode = (point: UnitPoint): DualGridNode => {
    const id = toNodeId(point);
    const existing = nodes.get(id);
    if (existing) {
      return existing;
    }

    const created: DualGridNode = {
      id,
      point,
      horizontalSegmentIds: [],
      verticalLinkIds: [],
      terminalIds: [],
      autoCreated: false,
      isJunction: false,
    };
    nodes.set(id, created);
    return created;
  };

  const addAdjacency = (sourceId: string, targetId: string): void => {
    let sourceSet = adjacency.get(sourceId);
    if (!sourceSet) {
      sourceSet = new Set<string>();
      adjacency.set(sourceId, sourceSet);
    }
    sourceSet.add(targetId);

    let targetSet = adjacency.get(targetId);
    if (!targetSet) {
      targetSet = new Set<string>();
      adjacency.set(targetId, targetSet);
    }
    targetSet.add(sourceId);
  };

  for (const component of components) {
    const width = component.width ?? 1;
    if (!isIntegerCoordinate(component.x) || !isIntegerCoordinate(component.y) || width < 1 || !Number.isInteger(width)) {
      issues.push({
        code: 'INVALID_COMPONENT_COORDINATE',
        message: 'Component cells must use integer coordinates and integer width.',
        sourceId: component.id,
      });
      continue;
    }

    const leftNode = ensureNode({ x: component.x, y: component.y });
    const rightNode = ensureNode({ x: component.x + width, y: component.y });
    pushUnique(leftNode.terminalIds, `${component.id}:left`);
    pushUnique(rightNode.terminalIds, `${component.id}:right`);
  }

  for (const segment of horizontalSegments) {
    if (
      !isIntegerCoordinate(segment.xStart) ||
      !isIntegerCoordinate(segment.xEnd) ||
      !isIntegerCoordinate(segment.y) ||
      segment.xEnd <= segment.xStart
    ) {
      issues.push({
        code: 'INVALID_HORIZONTAL_SEGMENT',
        message: 'Horizontal segments must run on integer rows with xEnd > xStart.',
        sourceId: segment.id,
      });
      continue;
    }

    for (let x = segment.xStart; x <= segment.xEnd; x++) {
      const node = ensureNode({ x, y: segment.y });
      pushUnique(node.horizontalSegmentIds, segment.id);
    }

    for (let x = segment.xStart; x < segment.xEnd; x++) {
      const source = ensureNode({ x, y: segment.y });
      const target = ensureNode({ x: x + 1, y: segment.y });
      edges.push({
        id: `${segment.id}:${x}`,
        kind: 'horizontal',
        sourceId: source.id,
        targetId: target.id,
        ownerId: segment.id,
      });
      addAdjacency(source.id, target.id);
    }
  }

  for (const link of verticalLinks) {
    if (!isIntegerCoordinate(link.x) || !isHalfStepCoordinate(link.y)) {
      issues.push({
        code: 'INVALID_VERTICAL_LINK',
        message: 'Vertical links must use integer x and half-step y coordinates.',
        sourceId: link.id,
      });
      continue;
    }

    const topRow = Math.floor(link.y);
    const bottomRow = Math.ceil(link.y);

    const topState = ensureRowState(rowStates, topRow);
    const bottomState = ensureRowState(rowStates, bottomRow);
    pushUnique(topState.bottomLinkIds, link.id);
    pushUnique(bottomState.topLinkIds, link.id);

    const source = ensureNode({ x: link.x, y: topRow });
    const target = ensureNode({ x: link.x, y: bottomRow });
    pushUnique(source.verticalLinkIds, link.id);
    pushUnique(target.verticalLinkIds, link.id);

    edges.push({
      id: `${link.id}:${topRow}-${bottomRow}`,
      kind: 'vertical',
      sourceId: source.id,
      targetId: target.id,
      ownerId: link.id,
    });
    addAdjacency(source.id, target.id);
  }

  const finalizedAdjacency = new Map<string, string[]>();
  for (const [nodeId, neighbors] of adjacency) {
    finalizedAdjacency.set(nodeId, Array.from(neighbors));
  }

  for (const node of nodes.values()) {
    const incidentCount = finalizedAdjacency.get(node.id)?.length ?? 0;
    const hasVertical = node.verticalLinkIds.length > 0;
    const hasHorizontal = node.horizontalSegmentIds.length > 0;
    const hasTerminals = node.terminalIds.length > 0;

    node.autoCreated = hasVertical && (hasHorizontal || hasTerminals);
    node.isJunction = incidentCount >= 3 || node.autoCreated;
  }

  const { chains, linkToChainId } = buildVerticalChains(verticalLinks, nodes);
  for (const chain of chains) {
    if (!chain.valid) {
      issues.push({
        code: 'ISOLATED_VERTICAL_CHAIN',
        message: chain.reason ?? 'Vertical chain is electrically isolated.',
        sourceId: chain.id,
      });
    }
  }

  return {
    nodes,
    edges,
    adjacency: finalizedAdjacency,
    rowStates,
    verticalChains: chains,
    linkToChainId,
    issues,
  };
}

export function resolveDualGridSelection(
  point: UnitPoint,
  candidates: SelectableDualGridEntity[],
  tolerance = DEFAULT_DUAL_GRID_CONFIG.selectionTolerance ?? 0.4
): DualGridSelection | null {
  let best: DualGridSelection | null = null;

  for (const candidate of candidates) {
    const geometryDistance = getCandidateDistance(point, candidate);
    const alignmentPenalty = candidate.kind === 'vertical'
      ? distanceToNearestHalfStep(point.y)
      : distanceToNearestInteger(point.y);
    const totalDistance = geometryDistance + alignmentPenalty * 0.2;

    if (totalDistance > tolerance) {
      continue;
    }

    if (!best || totalDistance < best.distance) {
      best = {
        id: candidate.id,
        kind: candidate.kind,
        distance: totalDistance,
      };
    }
  }

  return best;
}

function buildVerticalChains(
  verticalLinks: VerticalLink[],
  nodes: Map<string, DualGridNode>
): { chains: VerticalContinuityChain[]; linkToChainId: Map<string, string> } {
  const validLinks = verticalLinks.filter((link) => isIntegerCoordinate(link.x) && isHalfStepCoordinate(link.y));
  const linksByX = new Map<number, VerticalLink[]>();
  const linkToChainId = new Map<string, string>();
  const chains: VerticalContinuityChain[] = [];

  for (const link of validLinks) {
    let list = linksByX.get(link.x);
    if (!list) {
      list = [];
      linksByX.set(link.x, list);
    }
    list.push(link);
  }

  for (const [x, links] of linksByX) {
    links.sort((a, b) => a.y - b.y);

    let bucket: VerticalLink[] = [];
    const flushBucket = (): void => {
      if (bucket.length === 0) {
        return;
      }

      const chainId = `chain:${x}:${bucket[0].y}-${bucket[bucket.length - 1].y}`;
      const nodeIds = new Set<string>();
      let hasNonVerticalAttachment = false;

      for (const link of bucket) {
        const topNodeId = toNodeId({ x, y: Math.floor(link.y) });
        const bottomNodeId = toNodeId({ x, y: Math.ceil(link.y) });
        nodeIds.add(topNodeId);
        nodeIds.add(bottomNodeId);

        const topNode = nodes.get(topNodeId);
        const bottomNode = nodes.get(bottomNodeId);
        if (nodeHasExternalAttachment(topNode) || nodeHasExternalAttachment(bottomNode)) {
          hasNonVerticalAttachment = true;
        }

        linkToChainId.set(link.id, chainId);
      }

      chains.push({
        id: chainId,
        x,
        linkIds: bucket.map((link) => link.id),
        yValues: bucket.map((link) => link.y),
        nodeIds: Array.from(nodeIds),
        valid: hasNonVerticalAttachment,
        reason: hasNonVerticalAttachment
          ? undefined
          : 'Vertical chain has no horizontal segment or component terminal attachment.',
      });

      bucket = [];
    };

    for (const link of links) {
      const last = bucket[bucket.length - 1];
      if (!last || Math.abs(link.y - last.y - 1) < Number.EPSILON) {
        bucket.push(link);
        continue;
      }

      flushBucket();
      bucket.push(link);
    }

    flushBucket();
  }

  return { chains, linkToChainId };
}

function nodeHasExternalAttachment(node: DualGridNode | undefined): boolean {
  if (!node) {
    return false;
  }

  return node.horizontalSegmentIds.length > 0 || node.terminalIds.length > 0;
}

function getCandidateDistance(point: UnitPoint, candidate: SelectableDualGridEntity): number {
  if (candidate.kind === 'horizontal') {
    return distanceToHorizontalSegment(point, candidate.segment);
  }

  if (candidate.kind === 'vertical') {
    return distanceToVerticalSegment(point, candidate.link);
  }

  return distanceBetweenPoints(point, candidate.point);
}

function distanceToHorizontalSegment(point: UnitPoint, segment: HorizontalSegment): number {
  const clampedX = clamp(point.x, segment.xStart, segment.xEnd);
  return distanceBetweenPoints(point, { x: clampedX, y: segment.y });
}

function distanceToVerticalSegment(point: UnitPoint, link: VerticalLink): number {
  const clampedY = clamp(point.y, link.y - 0.5, link.y + 0.5);
  return distanceBetweenPoints(point, { x: link.x, y: clampedY });
}

function ensureRowState(states: Map<number, RowLinkState>, row: number): RowLinkState {
  const existing = states.get(row);
  if (existing) {
    return existing;
  }

  const created: RowLinkState = {
    row,
    topLinkIds: [],
    bottomLinkIds: [],
  };
  states.set(row, created);
  return created;
}

function toNodeId(point: UnitPoint): string {
  return `node:${point.x}:${point.y}`;
}

function getNearestHalfStep(value: number): number {
  const floorHalf = Math.floor(value) + 0.5;
  const ceilHalf = Math.ceil(value) + 0.5;
  return Math.abs(value - floorHalf) <= Math.abs(value - ceilHalf) ? floorHalf : ceilHalf;
}

function distanceToNearestHalfStep(value: number): number {
  return Math.abs(value - getNearestHalfStep(value));
}

function distanceToNearestInteger(value: number): number {
  return Math.abs(value - Math.round(value));
}

function distanceBetweenPoints(a: UnitPoint, b: UnitPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function pushUnique(list: string[], value: string): void {
  if (!list.includes(value)) {
    list.push(value);
  }
}
