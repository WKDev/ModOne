/**
 * Wire Simplifier
 *
 * Pure utility functions for simplifying orthogonal wire polylines.
 * Used by wire cleanup, segment drag, and rubber-band features.
 */

import type { GeomApi, Poly, Position, Wire, WireEndpoint, WireHandle } from '../types';
import { isPortEndpoint } from '../types';
import { generateId } from './canvasHelpers';
import { getPortAbsolutePosition } from './wirePathCalculator';

function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function clonePosition(p: Position): Position {
  return { x: p.x, y: p.y };
}

function resolveEndpointPosition(endpoint: WireEndpoint, geom: GeomApi): Position | null {
  if (isPortEndpoint(endpoint)) {
    const block = geom.components.get(endpoint.componentId);
    if (!block) return null;
    const portPos = getPortAbsolutePosition(block, endpoint.portId);
    return portPos ? clonePosition(portPos) : null;
  }

  const junction = geom.junctions.get(endpoint.junctionId);
  return junction ? clonePosition(junction.position) : null;
}

export function simplifyOrthogonal(poly: Poly, eps: number = 0.5): Position[] {
  if (poly.length === 0) return [];
  if (poly.length === 1) return [clonePosition(poly[0])];

  const originalFirst = clonePosition(poly[0]);
  const originalLast = clonePosition(poly[poly.length - 1]);
  let points: Position[] = poly.map(clonePosition);

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    if (Math.abs(a.x - b.x) <= eps) {
      const avgX = (a.x + b.x) / 2;
      a.x = avgX;
      b.x = avgX;
    }

    if (Math.abs(a.y - b.y) <= eps) {
      const avgY = (a.y + b.y) / 2;
      a.y = avgY;
      b.y = avgY;
    }
  }

  for (let iteration = 0; iteration < 10; iteration++) {
    let removedInPass = false;

    const deduped: Position[] = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const current = points[i];
      const previous = deduped[deduped.length - 1];
      if (manhattan(previous, current) <= eps) {
        removedInPass = true;
        continue;
      }
      deduped.push(current);
    }

    let collapsed: Position[];
    if (deduped.length <= 2) {
      collapsed = deduped;
    } else {
      collapsed = [deduped[0], deduped[1]];
      for (let i = 2; i < deduped.length; i++) {
        const curr = deduped[i];
        const prev = collapsed[collapsed.length - 1];
        const prevPrev = collapsed[collapsed.length - 2];

        const sameX =
          Math.abs(prevPrev.x - prev.x) <= eps &&
          Math.abs(prev.x - curr.x) <= eps;
        const sameY =
          Math.abs(prevPrev.y - prev.y) <= eps &&
          Math.abs(prev.y - curr.y) <= eps;

        if (sameX || sameY) {
          collapsed[collapsed.length - 1] = curr;
          removedInPass = true;
        } else {
          collapsed.push(curr);
        }
      }
    }

    points = collapsed;
    if (!removedInPass) {
      break;
    }
  }

  if (points.length < 2) {
    return [originalFirst, originalLast];
  }

  points[0] = originalFirst;
  points[points.length - 1] = originalLast;
  return points;
}

export function buildWirePolyline(wire: Wire, geom: GeomApi): Position[] | null {
  const fromPos = resolveEndpointPosition(wire.from, geom);
  const toPos = resolveEndpointPosition(wire.to, geom);

  if (!fromPos || !toPos) {
    return null;
  }

  const handlePositions = (wire.handles ?? []).map((handle) => clonePosition(handle.position));
  return [fromPos, ...handlePositions, toPos];
}

export function polylineToHandles(
  poly: readonly Position[],
  prevHandles: WireHandle[] | undefined,
  defaultSource: 'auto' | 'user'
): WireHandle[] {
  const interior = poly.slice(1, -1);
  if (interior.length === 0) {
    return [];
  }

  return interior.map((currPt, i) => {
    const prevPt = poly[i];

    let constraint: WireHandle['constraint'] = 'free';
    if (Math.abs(prevPt.y - currPt.y) < 1) {
      constraint = 'vertical';
    } else if (Math.abs(prevPt.x - currPt.x) < 1) {
      constraint = 'horizontal';
    }

    const matchedPrevious = prevHandles?.find((handle) => manhattan(handle.position, currPt) < 3);
    const id = matchedPrevious?.id ?? generateId('wh');
    const source = matchedPrevious?.source ?? defaultSource;

    return {
      id,
      position: clonePosition(currPt),
      constraint,
      source,
    };
  });
}

export function simplifyWireHandles(
  wire: Wire,
  geom: GeomApi,
  defaultSource: 'auto' | 'user' = 'auto'
): WireHandle[] | undefined {
  const poly = buildWirePolyline(wire, geom);
  if (!poly || poly.length < 2) return wire.handles;
  const simplified = simplifyOrthogonal(poly);
  const handles = polylineToHandles(simplified, wire.handles, defaultSource);
  return handles.length > 0 ? handles : undefined;
}

function insertStubAfterStart(
  poly: Position[],
  axis: 'horizontal' | 'vertical',
  stubLen: number
): Position[] {
  const start = poly[0];
  const next = poly[1];

  if (!start || !next) {
    return poly.map(clonePosition);
  }

  const stub =
    axis === 'horizontal'
      ? { x: start.x + (Math.sign(next.x - start.x) || 1) * stubLen, y: start.y }
      : { x: start.x, y: start.y + (Math.sign(next.y - start.y) || 1) * stubLen };

  return [start, stub, ...poly.slice(1)];
}

function insertStubBeforeEnd(
  poly: Position[],
  segEndIndex: number,
  axis: 'horizontal' | 'vertical',
  stubLen: number
): Position[] {
  const end = poly[poly.length - 1];
  const prev = poly[segEndIndex];

  if (!end || !prev) {
    return poly.map(clonePosition);
  }

  const stub =
    axis === 'horizontal'
      ? { x: end.x + (Math.sign(prev.x - end.x) || 1) * stubLen, y: end.y }
      : { x: end.x, y: end.y + (Math.sign(prev.y - end.y) || 1) * stubLen };

  return [...poly.slice(0, -1), stub, end];
}

export function getSegmentOrientation(
  poly: readonly Position[],
  segIndex: number
): 'horizontal' | 'vertical' {
  const a = poly[segIndex];
  const b = poly[segIndex + 1];

  if (!a || !b) {
    throw new Error('Invalid segment index for polyline');
  }

  return Math.abs(a.y - b.y) < Math.abs(a.x - b.x) ? 'horizontal' : 'vertical';
}

export function ensureMovableSegment(
  poly: readonly Position[],
  segIndex: number,
  stubLen: number = 16
): { poly: Position[]; segIndex: number } {
  if (poly.length < 2) {
    return { poly: poly.map(clonePosition), segIndex };
  }

  if (poly.length === 2) {
    const start = clonePosition(poly[0]);
    const end = clonePosition(poly[1]);
    const axis = getSegmentOrientation(poly, 0);
    const midA =
      axis === 'horizontal'
        ? { x: start.x + (Math.sign(end.x - start.x) || 1) * stubLen, y: start.y }
        : { x: start.x, y: start.y + (Math.sign(end.y - start.y) || 1) * stubLen };
    const midB =
      axis === 'horizontal'
        ? { x: end.x + (Math.sign(start.x - end.x) || 1) * stubLen, y: end.y }
        : { x: end.x, y: end.y + (Math.sign(start.y - end.y) || 1) * stubLen };

    return { poly: [start, midA, midB, end], segIndex: 1 };
  }

  let nextPoly = poly.map(clonePosition);
  let nextSegIndex = segIndex;
  const axis = getSegmentOrientation(nextPoly, nextSegIndex);

  if (nextSegIndex === 0) {
    nextPoly = insertStubAfterStart(nextPoly, axis, stubLen);
    nextSegIndex += 1;
  }

  if (nextSegIndex + 1 === nextPoly.length - 1) {
    nextPoly = insertStubBeforeEnd(nextPoly, nextSegIndex, axis, stubLen);
  }

  return { poly: nextPoly, segIndex: nextSegIndex };
}

export function dragSegment(
  poly: readonly Position[],
  segIndex: number,
  perpDelta: number
): Position[] {
  const result = poly.map(clonePosition);
  const orientation = getSegmentOrientation(poly, segIndex);

  if (!result[segIndex] || !result[segIndex + 1]) {
    return result;
  }

  if (orientation === 'horizontal') {
    result[segIndex].y += perpDelta;
    result[segIndex + 1].y += perpDelta;
  } else {
    result[segIndex].x += perpDelta;
    result[segIndex + 1].x += perpDelta;
  }

  return result;
}
