/**
 * Wire Path Calculator
 *
 * Utilities for calculating wire paths and port positions.
 */

import type { Block, Position, PortPosition, HandleConstraint } from '../types';

// ============================================================================
// Position Calculations
// ============================================================================

/**
 * Calculate port position relative to block origin
 */
export function getPortRelativePosition(
  portPosition: PortPosition,
  portOffset: number = 0.5,
  blockSize: { width: number; height: number }
): Position {
  const { width, height } = blockSize;

  switch (portPosition) {
    case 'top':
      return { x: width * portOffset, y: 0 };
    case 'bottom':
      return { x: width * portOffset, y: height };
    case 'left':
      return { x: 0, y: height * portOffset };
    case 'right':
      return { x: width, y: height * portOffset };
    default:
      return { x: width / 2, y: height / 2 };
  }
}

/**
 * Get absolute position of a port on a block
 */
export function getPortAbsolutePosition(
  block: Block,
  portId: string
): Position | null {
  const port = block.ports.find((p) => p.id === portId);
  if (!port) return null;

  const blockSize = block.size;
  const relativePos = getPortRelativePosition(
    port.position,
    port.offset ?? 0.5,
    blockSize
  );

  return {
    x: block.position.x + relativePos.x,
    y: block.position.y + relativePos.y,
  };
}

/**
 * Get wire endpoints from wire definition and blocks
 */
export function getWireEndpoints(
  from: { componentId: string; portId: string },
  to: { componentId: string; portId: string },
  blocks: Map<string, Block>
): { fromPos: Position; toPos: Position } | null {
  const fromBlock = blocks.get(from.componentId);
  const toBlock = blocks.get(to.componentId);

  if (!fromBlock || !toBlock) return null;

  const fromPos = getPortAbsolutePosition(fromBlock, from.portId);
  const toPos = getPortAbsolutePosition(toBlock, to.portId);

  if (!fromPos || !toPos) return null;

  return { fromPos, toPos };
}

// ============================================================================
// Path Generation
// ============================================================================

/** Exit distance from port before routing */
const PORT_EXIT_DISTANCE = 20;

/**
 * Generate a port-direction aware orthogonal wire path with rounded corners.
 * Routes wire to exit in the direction the port faces, then routes to target.
 */
export function calculateOrthogonalPath(
  from: Position,
  to: Position,
  fromDirection?: PortPosition,
  toDirection?: PortPosition,
  cornerRadius: number = 8
): string {
  // If no direction info, fall back to simple straight path
  if (!fromDirection || !toDirection) {
    return calculateStraightPath(from, to, cornerRadius);
  }

  // Calculate exit points based on port directions
  const fromExit = getExitPoint(from, fromDirection, PORT_EXIT_DISTANCE);
  const toExit = getExitPoint(to, toDirection, PORT_EXIT_DISTANCE);

  // Build path segments
  const segments: Position[] = [from, fromExit];

  // Route between exit points with orthogonal lines
  const routePoints = calculateOrthogonalRoute(fromExit, toExit, fromDirection, toDirection);
  segments.push(...routePoints);

  segments.push(toExit, to);

  // Convert segments to SVG path with rounded corners
  return segmentsToPath(segments, cornerRadius);
}

/**
 * Calculate exit point from port position in given direction
 */
function getExitPoint(pos: Position, direction: PortPosition, distance: number): Position {
  switch (direction) {
    case 'top':
      return { x: pos.x, y: pos.y - distance };
    case 'bottom':
      return { x: pos.x, y: pos.y + distance };
    case 'left':
      return { x: pos.x - distance, y: pos.y };
    case 'right':
      return { x: pos.x + distance, y: pos.y };
    default:
      return pos;
  }
}

/**
 * Calculate intermediate routing points between two exit points
 */
function calculateOrthogonalRoute(
  fromExit: Position,
  toExit: Position,
  fromDirection: PortPosition,
  toDirection: PortPosition
): Position[] {
  const dx = toExit.x - fromExit.x;
  const dy = toExit.y - fromExit.y;

  // If already aligned, no intermediate points needed
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
    return [];
  }
  if (Math.abs(dx) < 1 || Math.abs(dy) < 1) {
    return [];
  }

  // Determine routing strategy based on port directions
  const fromIsHorizontal = fromDirection === 'left' || fromDirection === 'right';
  const toIsHorizontal = toDirection === 'left' || toDirection === 'right';

  if (fromIsHorizontal && toIsHorizontal) {
    // Both horizontal: route vertically in the middle
    const midX = fromExit.x + dx / 2;
    return [
      { x: midX, y: fromExit.y },
      { x: midX, y: toExit.y },
    ];
  } else if (!fromIsHorizontal && !toIsHorizontal) {
    // Both vertical: route horizontally in the middle
    const midY = fromExit.y + dy / 2;
    return [
      { x: fromExit.x, y: midY },
      { x: toExit.x, y: midY },
    ];
  } else if (fromIsHorizontal && !toIsHorizontal) {
    // From horizontal, to vertical: single corner
    return [{ x: toExit.x, y: fromExit.y }];
  } else {
    // From vertical, to horizontal: single corner
    return [{ x: fromExit.x, y: toExit.y }];
  }
}

/**
 * Convert position segments to SVG path with rounded corners
 */
export function segmentsToPath(segments: Position[], cornerRadius: number): string {
  if (segments.length < 2) return '';
  if (segments.length === 2) {
    return `M ${segments[0].x} ${segments[0].y} L ${segments[1].x} ${segments[1].y}`;
  }

  const parts: string[] = [`M ${segments[0].x} ${segments[0].y}`];

  for (let i = 1; i < segments.length - 1; i++) {
    const prev = segments[i - 1];
    const curr = segments[i];
    const next = segments[i + 1];

    // Calculate distances to prev and next
    const toPrev = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
    const toNext = Math.sqrt(Math.pow(next.x - curr.x, 2) + Math.pow(next.y - curr.y, 2));

    // Limit corner radius to half the shortest segment
    const maxRadius = Math.min(toPrev, toNext) / 2;
    const r = Math.min(cornerRadius, maxRadius);

    if (r < 1) {
      // Too short for curve, just line to
      parts.push(`L ${curr.x} ${curr.y}`);
    } else {
      // Calculate corner start and end points
      const dirFromPrev = {
        x: (curr.x - prev.x) / toPrev,
        y: (curr.y - prev.y) / toPrev,
      };
      const dirToNext = {
        x: (next.x - curr.x) / toNext,
        y: (next.y - curr.y) / toNext,
      };

      const cornerStart = {
        x: curr.x - dirFromPrev.x * r,
        y: curr.y - dirFromPrev.y * r,
      };
      const cornerEnd = {
        x: curr.x + dirToNext.x * r,
        y: curr.y + dirToNext.y * r,
      };

      parts.push(`L ${cornerStart.x} ${cornerStart.y}`);
      parts.push(`Q ${curr.x} ${curr.y} ${cornerEnd.x} ${cornerEnd.y}`);
    }
  }

  // Final line to last point
  const last = segments[segments.length - 1];
  parts.push(`L ${last.x} ${last.y}`);

  return parts.join(' ');
}

/**
 * Generate a straight (orthogonal) wire path with rounded corners
 */
export function calculateStraightPath(
  from: Position,
  to: Position,
  cornerRadius: number = 5
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // Simple case: direct vertical or horizontal
  if (Math.abs(dx) < 1) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }
  if (Math.abs(dy) < 1) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }

  // Route through midpoint
  const midX = from.x + dx / 2;

  // Calculate corner positions
  const r = Math.min(cornerRadius, Math.abs(dx) / 4, Math.abs(dy) / 2);
  const dirX = dx > 0 ? 1 : -1;
  const dirY = dy > 0 ? 1 : -1;

  // Path: start -> horizontal to mid -> vertical -> horizontal to end
  // Using quadratic bezier for corners
  return [
    `M ${from.x} ${from.y}`,
    `L ${midX - r * dirX} ${from.y}`,
    `Q ${midX} ${from.y} ${midX} ${from.y + r * dirY}`,
    `L ${midX} ${to.y - r * dirY}`,
    `Q ${midX} ${to.y} ${midX + r * dirX} ${to.y}`,
    `L ${to.x} ${to.y}`,
  ].join(' ');
}

/**
 * Generate a bezier curve wire path
 */
export function calculateBezierPath(
  from: Position,
  to: Position,
  tension: number = 0.5
): string {
  const dx = to.x - from.x;
  const controlOffset = Math.abs(dx) * tension;

  // Control points for smooth S-curve
  const cp1x = from.x + controlOffset;
  const cp1y = from.y;
  const cp2x = to.x - controlOffset;
  const cp2y = to.y;

  return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
}

/**
 * Generate wire path based on mode
 */
export function calculateWirePath(
  from: Position,
  to: Position,
  mode: 'straight' | 'bezier' = 'bezier'
): string {
  if (mode === 'straight') {
    return calculateStraightPath(from, to);
  }
  return calculateBezierPath(from, to);
}

/**
 * Get direction vector from port position
 */
export function getPortDirection(portPosition: PortPosition): Position {
  switch (portPosition) {
    case 'top':
      return { x: 0, y: -1 };
    case 'bottom':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Calculate orthogonal path through user-defined handles.
 * Handles are intermediate control points that the wire must pass through.
 *
 * @param from - Start position
 * @param to - End position
 * @param handles - Array of handle positions (control points)
 * @param fromDirection - Direction wire exits from source
 * @param toDirection - Direction wire enters target
 * @param cornerRadius - Radius for rounded corners
 * @returns SVG path string
 */
export function calculatePathWithHandles(
  from: Position,
  to: Position,
  handles: Position[],
  fromDirection?: PortPosition,
  toDirection?: PortPosition,
  cornerRadius: number = 8
): string {
  // If no handles, use standard orthogonal path
  if (!handles || handles.length === 0) {
    return calculateOrthogonalPath(from, to, fromDirection, toDirection, cornerRadius);
  }

  // Build path segments: from -> exit point -> handles -> entry point -> to
  const segments: Position[] = [];

  // Add start point
  segments.push(from);

  // Add exit point if we have direction
  if (fromDirection) {
    const fromExit = getExitPoint(from, fromDirection, PORT_EXIT_DISTANCE);
    segments.push(fromExit);
  }

  // Add all handles
  segments.push(...handles);

  // Add entry point if we have direction
  if (toDirection) {
    const toExit = getExitPoint(to, toDirection, PORT_EXIT_DISTANCE);
    segments.push(toExit);
  }

  // Add end point
  segments.push(to);

  // Convert segments to SVG path with rounded corners
  return segmentsToPath(segments, cornerRadius);
}

/**
 * Calculate path with user-specified exit directions (from drag).
 * Uses the user's drag direction to determine how the wire exits the port.
 */
export function calculatePathWithExitDirections(
  from: Position,
  to: Position,
  fromExitDirection?: PortPosition,
  toExitDirection?: PortPosition,
  defaultFromDirection?: PortPosition,
  defaultToDirection?: PortPosition,
  cornerRadius: number = 8
): string {
  // Use user-specified directions if available, otherwise fall back to defaults
  const fromDir = fromExitDirection || defaultFromDirection;
  const toDir = toExitDirection || defaultToDirection;

  return calculateOrthogonalPath(from, to, fromDir, toDir, cornerRadius);
}

// ============================================================================
// Auto-Generated Bend Points
// ============================================================================

/**
 * Calculate wire bend points for auto-generated control handles.
 * Reuses existing routing logic to compute intermediate bend positions
 * and their movement constraints.
 *
 * @param from - Source port absolute position
 * @param to - Target port absolute position
 * @param fromDirection - Direction wire exits source port
 * @param toDirection - Direction wire enters target port
 * @returns Bend points and their constraints, or empty arrays if no bends needed
 */
export function calculateWireBendPoints(
  from: Position,
  to: Position,
  fromDirection?: PortPosition,
  toDirection?: PortPosition
): { points: Position[]; constraints: HandleConstraint[] } {
  if (!fromDirection || !toDirection) {
    return { points: [], constraints: [] };
  }

  const fromExit = getExitPoint(from, fromDirection, PORT_EXIT_DISTANCE);
  const toExit = getExitPoint(to, toDirection, PORT_EXIT_DISTANCE);

  const routePoints = calculateOrthogonalRoute(fromExit, toExit, fromDirection, toDirection);

  if (routePoints.length === 0) {
    return { points: [], constraints: [] };
  }

  // Determine constraint for each route point:
  // Build full segment sequence: [fromExit, ...routePoints, toExit]
  const allPoints = [fromExit, ...routePoints, toExit];
  const constraints: HandleConstraint[] = [];

  for (let i = 0; i < routePoints.length; i++) {
    // Route point is at index i+1 in allPoints
    const prev = allPoints[i];
    const curr = allPoints[i + 1];

    // The incoming segment direction determines the constraint:
    // If incoming segment is horizontal (same y), handle moves vertically (shifts segment up/down)
    // If incoming segment is vertical (same x), handle moves horizontally
    const dx = Math.abs(curr.x - prev.x);
    const dy = Math.abs(curr.y - prev.y);

    constraints.push(dx >= dy ? 'vertical' : 'horizontal');
  }

  return { points: routePoints, constraints };
}
