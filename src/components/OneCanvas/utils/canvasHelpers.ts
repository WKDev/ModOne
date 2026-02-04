/**
 * Canvas Helpers
 *
 * Shared utility functions used by canvasStore and useCanvasDocument.
 * Extracted to eliminate duplication between the two state management paths.
 */

import type {
  Block,
  Wire,
  WireEndpoint,
  WireHandle,
  Junction,
  Position,
  PortPosition,
} from '../types';
import { isPortEndpoint } from '../types';
import {
  getPortRelativePosition,
  calculateWireBendPoints,
} from './wirePathCalculator';

// ============================================================================
// ID Generation
// ============================================================================

/** Generate a unique ID with type prefix */
export function generateId(type: string): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Grid Snapping
// ============================================================================

/** Snap position to grid */
export function snapToGridPosition(position: Position, gridSize: number): Position {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  };
}

// ============================================================================
// Wire Endpoint Utilities
// ============================================================================

/** Get a unique key for a wire endpoint for comparison */
export function endpointKey(ep: WireEndpoint): string {
  if (isPortEndpoint(ep)) {
    return `port:${ep.componentId}:${ep.portId}`;
  }
  return `junction:${ep.junctionId}`;
}

/** Validate wire endpoint exists in the given maps */
export function isValidEndpoint(
  endpoint: WireEndpoint,
  components: Map<string, Block>,
  junctions?: Map<string, Junction>
): boolean {
  if (isPortEndpoint(endpoint)) {
    const component = components.get(endpoint.componentId);
    if (!component) return false;
    return component.ports.some((port) => port.id === endpoint.portId);
  } else {
    return junctions ? junctions.has(endpoint.junctionId) : false;
  }
}

/** Check if wire already exists between two endpoints (in either direction) */
export function wireExists(wires: Wire[], from: WireEndpoint, to: WireEndpoint): boolean {
  const fromKey = endpointKey(from);
  const toKey = endpointKey(to);
  return wires.some(
    (wire) =>
      (endpointKey(wire.from) === fromKey && endpointKey(wire.to) === toKey) ||
      (endpointKey(wire.from) === toKey && endpointKey(wire.to) === fromKey)
  );
}

// ============================================================================
// Wire Connection Queries
// ============================================================================

/**
 * Get all wires connected to a component (where either endpoint references the component).
 */
export function getWiresConnectedToComponent(wires: Wire[], componentId: string): Wire[] {
  return wires.filter(
    (wire) =>
      (isPortEndpoint(wire.from) && wire.from.componentId === componentId) ||
      (isPortEndpoint(wire.to) && wire.to.componentId === componentId)
  );
}

/**
 * Get all wires connected to a junction.
 */
export function getWiresConnectedToJunction(wires: Wire[], junctionId: string): Wire[] {
  return wires.filter(
    (wire) =>
      (!isPortEndpoint(wire.from) && wire.from.junctionId === junctionId) ||
      (!isPortEndpoint(wire.to) && wire.to.junctionId === junctionId)
  );
}

/**
 * Recalculate auto-generated handles for a wire.
 * - If any user handle exists, remove all auto handles (user is manually controlling routing).
 * - Otherwise, recompute auto handles via computeWireBendPoints.
 * Returns the new handles array, or undefined if no handles needed.
 */
export function recalculateAutoHandles(
  wire: Wire,
  components: Map<string, Block>,
  junctions?: Map<string, Junction>
): WireHandle[] | undefined {
  const hasUserHandles = wire.handles?.some((h) => h.source === 'user') ?? false;

  if (hasUserHandles) {
    // Preserve only user handles; discard auto handles
    const userHandles = wire.handles!.filter((h) => h.source === 'user');
    return userHandles.length > 0 ? userHandles : undefined;
  }

  // Recompute auto handles from scratch
  return computeWireBendPoints(
    wire.from,
    wire.to,
    components,
    wire.fromExitDirection,
    wire.toExitDirection,
    junctions
  );
}

// ============================================================================
// Wire Handle Utilities
// ============================================================================

/** Helper to get port relative position */
function getPortRelativePos(
  portPosition: PortPosition,
  portOffset: number,
  blockSize: { width: number; height: number }
): Position {
  switch (portPosition) {
    case 'top': return { x: blockSize.width * portOffset, y: 0 };
    case 'bottom': return { x: blockSize.width * portOffset, y: blockSize.height };
    case 'left': return { x: 0, y: blockSize.height * portOffset };
    case 'right': return { x: blockSize.width, y: blockSize.height * portOffset };
    default: return { x: blockSize.width / 2, y: blockSize.height / 2 };
  }
}

/** Euclidean distance between two points */
function dist(a: Position, b: Position): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Find the cumulative path distance from the start of the polyline to the
 * closest point on the polyline for a given position.
 */
function pathDistanceToPoint(polyline: Position[], position: Position): number {
  let bestDist = Infinity;
  let bestPathDist = 0;
  let cumulativeDist = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const segLen = dist(a, b);

    // Project position onto segment a→b
    let t = 0;
    if (segLen > 0) {
      t = ((position.x - a.x) * (b.x - a.x) + (position.y - a.y) * (b.y - a.y)) / (segLen * segLen);
      t = Math.max(0, Math.min(1, t));
    }
    const proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    const d = dist(position, proj);

    if (d < bestDist) {
      bestDist = d;
      bestPathDist = cumulativeDist + t * segLen;
    }

    cumulativeDist += segLen;
  }

  return bestPathDist;
}

/**
 * Find where to insert a new handle in the handles array based on path order.
 * Uses distance along the wire path (not Euclidean) to determine ordering.
 */
export function findHandleInsertIndex(
  wire: Wire,
  position: Position,
  components: Map<string, Block>
): number {
  if (!wire.handles || wire.handles.length === 0) {
    return 0;
  }

  // Get from port position as reference point for ordering
  let fromPos: Position = { x: 0, y: 0 };
  const wireFrom = wire.from;
  const fromBlock = isPortEndpoint(wireFrom) ? components.get(wireFrom.componentId) : undefined;
  if (fromBlock && isPortEndpoint(wireFrom)) {
    const fromPort = fromBlock.ports.find((p) => p.id === wireFrom.portId);
    if (fromPort) {
      const blockSize = fromBlock.size;
      const relPos = getPortRelativePos(fromPort.position, fromPort.offset ?? 0.5, blockSize);
      fromPos = { x: fromBlock.position.x + relPos.x, y: fromBlock.position.y + relPos.y };
    }
  }

  // Build polyline: fromPos → handle positions → (implicit toPos, not needed for ordering)
  const polyline = [fromPos, ...wire.handles.map((h) => h.position)];

  // Find path distance for the new position
  const newPathDist = pathDistanceToPoint(polyline, position);

  // Find the correct insertion index by comparing cumulative path distances to each handle
  let cumulative = 0;
  for (let i = 0; i < wire.handles.length; i++) {
    cumulative += dist(polyline[i], polyline[i + 1]);
    if (newPathDist < cumulative) {
      return i;
    }
  }

  return wire.handles.length;
}

/**
 * Infer an exit direction for a junction based on the angle to the other endpoint.
 * Uses the dominant axis to pick the closest cardinal direction.
 */
function inferJunctionDirection(junctionPos: Position, otherPos: Position): PortPosition {
  const dx = otherPos.x - junctionPos.x;
  const dy = otherPos.y - junctionPos.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'bottom' : 'top';
}

/**
 * Resolve an endpoint to its absolute position and exit direction.
 * Works for both port endpoints and junction endpoints.
 */
function resolveEndpoint(
  endpoint: WireEndpoint,
  components: Map<string, Block>,
  junctions?: Map<string, Junction>,
  exitDirection?: PortPosition,
  otherPos?: Position
): { pos: Position; dir: PortPosition } | undefined {
  if (isPortEndpoint(endpoint)) {
    const block = components.get(endpoint.componentId);
    if (!block) return undefined;
    const port = block.ports.find((p) => p.id === endpoint.portId);
    if (!port) return undefined;
    const relPos = getPortRelativePosition(port.position, port.offset ?? 0.5, block.size);
    return {
      pos: { x: block.position.x + relPos.x, y: block.position.y + relPos.y },
      dir: exitDirection || port.position,
    };
  } else {
    const junction = junctions?.get(endpoint.junctionId);
    if (!junction) return undefined;
    const pos = junction.position;
    const dir = exitDirection || (otherPos ? inferJunctionDirection(pos, otherPos) : 'right');
    return { pos, dir };
  }
}

/**
 * Compute auto-generated bend points for a wire based on port/junction directions.
 * Returns the handles array, or undefined if no bends needed.
 */
export function computeWireBendPoints(
  from: WireEndpoint,
  to: WireEndpoint,
  components: Map<string, Block>,
  fromExitDirection?: PortPosition,
  toExitDirection?: PortPosition,
  junctions?: Map<string, Junction>
): WireHandle[] | undefined {
  // First pass: resolve what we can to get positions for direction inference
  const fromResolved = resolveEndpoint(from, components, junctions, fromExitDirection);
  const toResolved = resolveEndpoint(to, components, junctions, toExitDirection);

  // If either endpoint can't be resolved at all, bail
  if (!fromResolved && !toResolved) return undefined;

  // Second pass: re-resolve with the other endpoint's position for junction direction inference
  const fromFinal = fromResolved || resolveEndpoint(from, components, junctions, fromExitDirection, toResolved?.pos);
  const toFinal = toResolved || resolveEndpoint(to, components, junctions, toExitDirection, fromFinal?.pos);

  // If junction direction needed the other position, re-resolve with it
  const fromComplete = !isPortEndpoint(from) && fromFinal && toFinal && !fromExitDirection
    ? resolveEndpoint(from, components, junctions, fromExitDirection, toFinal.pos)
    : fromFinal;
  const toComplete = !isPortEndpoint(to) && toFinal && fromFinal && !toExitDirection
    ? resolveEndpoint(to, components, junctions, toExitDirection, fromFinal.pos)
    : toFinal;

  if (!fromComplete || !toComplete) return undefined;

  const result = calculateWireBendPoints(fromComplete.pos, toComplete.pos, fromComplete.dir, toComplete.dir);
  if (result.points.length === 0) return undefined;

  return result.points.map((p, i) => ({
    position: p,
    constraint: result.constraints[i],
    source: 'auto' as const,
  }));
}
