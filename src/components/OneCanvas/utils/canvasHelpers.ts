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

/**
 * Find where to insert a new handle in the handles array based on path order.
 * Uses distance from the wire's from-port to determine ordering along the path.
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

  // Calculate distance from fromPort for each existing handle and the new position
  const distFromStart = (p: Position) =>
    Math.sqrt(Math.pow(p.x - fromPos.x, 2) + Math.pow(p.y - fromPos.y, 2));

  const newDist = distFromStart(position);

  // Find the correct insertion index to maintain order by distance from start
  for (let i = 0; i < wire.handles.length; i++) {
    if (newDist < distFromStart(wire.handles[i].position)) {
      return i;
    }
  }

  return wire.handles.length;
}

/**
 * Compute auto-generated bend points for a wire based on port directions.
 * Returns the handles array, or undefined if no bends needed.
 */
export function computeWireBendPoints(
  from: WireEndpoint,
  to: WireEndpoint,
  components: Map<string, Block>,
  fromExitDirection?: PortPosition,
  toExitDirection?: PortPosition
): WireHandle[] | undefined {
  // Only compute bend points for port-to-port wires
  if (!isPortEndpoint(from) || !isPortEndpoint(to)) return undefined;

  const fromBlock = components.get(from.componentId);
  const toBlock = components.get(to.componentId);
  if (!fromBlock || !toBlock) return undefined;

  const fromPort = fromBlock.ports.find((p) => p.id === from.portId);
  const toPort = toBlock.ports.find((p) => p.id === to.portId);
  if (!fromPort || !toPort) return undefined;

  const fromSize = fromBlock.size;
  const toSize = toBlock.size;

  const fromRelPos = getPortRelativePosition(fromPort.position, fromPort.offset ?? 0.5, fromSize);
  const toRelPos = getPortRelativePosition(toPort.position, toPort.offset ?? 0.5, toSize);

  const fromPos = { x: fromBlock.position.x + fromRelPos.x, y: fromBlock.position.y + fromRelPos.y };
  const toPos = { x: toBlock.position.x + toRelPos.x, y: toBlock.position.y + toRelPos.y };

  const fromDir = fromExitDirection || fromPort.position;
  const toDir = toExitDirection || toPort.position;

  const result = calculateWireBendPoints(fromPos, toPos, fromDir, toDir);
  if (result.points.length === 0) return undefined;

  return result.points.map((p, i) => ({
    position: p,
    constraint: result.constraints[i],
    source: 'auto' as const,
  }));
}
