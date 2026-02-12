/**
 * Rubber Band Wire Utility
 *
 * Manages rubber-band wire sessions during block drag.
 * Computes draft polylines that show near-end following the block
 * while far-end stays fixed, with orthogonal bridging between them.
 */

import type { GeomApi, Position, Wire, WireEndpoint } from '../types';
import { isPortEndpoint } from '../types';
import { buildWirePolyline, simplifyOrthogonal } from './wireSimplifier';

const LOCAL_ATTACH_LEN = 64;

export interface RubberBandWireSession {
  wireId: string;
  /** Original polyline at drag start (world coords) */
  poly0: Position[];
  /** Whether the 'from' endpoint is in the drag set (its block is being dragged) */
  fromMoves: boolean;
  /** Whether the 'to' endpoint is in the drag set */
  toMoves: boolean;
  /** Boundary index: for one-end-moves, points [0..splitIndex] move with 'from', or [splitIndex..end] move with 'to' */
  splitIndex: number;
  /** Which end is moving (only set when exactly one end moves) */
  movingEnd: 'from' | 'to' | 'both';
  /** Whether this wire is in auto routing mode */
  isAutoWire: boolean;
}

function endpointMoves(endpoint: WireEndpoint, dragIds: Set<string>): boolean {
  if (isPortEndpoint(endpoint)) {
    return dragIds.has(endpoint.componentId);
  }

  return dragIds.has(endpoint.junctionId);
}

function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function translate(pos: Position, delta: Position): Position {
  return {
    x: pos.x + delta.x,
    y: pos.y + delta.y,
  };
}

function pickSplitIndex(poly: Position[], movingEnd: 'from' | 'to'): number {
  let acc = 0;

  if (movingEnd === 'from') {
    for (let i = 0; i < poly.length - 1; i++) {
      acc += manhattan(poly[i], poly[i + 1]);
      if (acc >= LOCAL_ATTACH_LEN) {
        return Math.min(i + 1, poly.length - 2);
      }
    }

    return poly.length - 2;
  }

  for (let i = poly.length - 1; i > 0; i--) {
    acc += manhattan(poly[i], poly[i - 1]);
    if (acc >= LOCAL_ATTACH_LEN) {
      return Math.max(i - 1, 1);
    }
  }

  return 1;
}

function bridgeOrthogonal(a: Position, b: Position): Position[] {
  if (a.x === b.x || a.y === b.y) {
    return [];
  }

  const horizontalFirst = { x: b.x, y: a.y };
  const verticalFirst = { x: a.x, y: b.y };

  if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
    return [horizontalFirst];
  }

  return [verticalFirst];
}

export function createRubberBandSession(
  wire: Wire,
  dragIds: Set<string>,
  geom: GeomApi
): RubberBandWireSession | null {
  const fromMoves = endpointMoves(wire.from, dragIds);
  const toMoves = endpointMoves(wire.to, dragIds);

  if (!fromMoves && !toMoves) {
    return null;
  }

  const poly0 = buildWirePolyline(wire, geom);
  if (!poly0 || poly0.length < 2) {
    return null;
  }

  const movingEnd: RubberBandWireSession['movingEnd'] =
    fromMoves && toMoves ? 'both' : fromMoves ? 'from' : 'to';

  const splitIndex =
    movingEnd === 'both' ? poly0.length - 1 : pickSplitIndex(poly0, movingEnd);

  return {
    wireId: wire.id,
    poly0,
    fromMoves,
    toMoves,
    splitIndex,
    movingEnd,
    isAutoWire: wire.routingMode !== 'manual',
  };
}

export function computeDraftPoly(session: RubberBandWireSession, delta: Position): Position[] {
  const { poly0, fromMoves, toMoves, splitIndex, movingEnd } = session;

  if (movingEnd === 'both' && fromMoves && toMoves) {
    const moved = poly0.map((pt) => translate(pt, delta));
    return simplifyOrthogonal(moved);
  }

  if (movingEnd === 'from' && fromMoves && !toMoves) {
    const movedPrefix = poly0.slice(0, splitIndex + 1).map((pt) => translate(pt, delta));
    const fixedTail = poly0.slice(splitIndex + 1);

    if (fixedTail.length === 0) {
      return simplifyOrthogonal(movedPrefix);
    }

    const bridge = bridgeOrthogonal(movedPrefix[movedPrefix.length - 1], fixedTail[0]);
    return simplifyOrthogonal([...movedPrefix, ...bridge, ...fixedTail]);
  }

  if (movingEnd === 'to' && !fromMoves && toMoves) {
    const fixedHead = poly0.slice(0, splitIndex);
    const movedSuffix = poly0.slice(splitIndex).map((pt) => translate(pt, delta));

    if (fixedHead.length === 0) {
      return simplifyOrthogonal(movedSuffix);
    }

    const bridge = bridgeOrthogonal(fixedHead[fixedHead.length - 1], movedSuffix[0]);
    return simplifyOrthogonal([...fixedHead, ...bridge, ...movedSuffix]);
  }

  return simplifyOrthogonal(poly0.map((pt) => translate(pt, delta)));
}
