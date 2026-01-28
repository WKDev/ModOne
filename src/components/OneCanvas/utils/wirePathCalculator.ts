/**
 * Wire Path Calculator
 *
 * Utilities for calculating wire paths and port positions.
 */

import type { Block, Position, PortPosition } from '../types';

// ============================================================================
// Constants
// ============================================================================

// Default block sizes (can be overridden by block-specific sizes)
const DEFAULT_BLOCK_WIDTH = 60;
const DEFAULT_BLOCK_HEIGHT = 60;

// Block sizes by type
const BLOCK_SIZES: Record<string, { width: number; height: number }> = {
  power_24v: { width: 60, height: 40 },
  power_12v: { width: 60, height: 40 },
  gnd: { width: 40, height: 50 },
  plc_out: { width: 80, height: 50 },
  plc_in: { width: 80, height: 50 },
  led: { width: 40, height: 60 },
  button: { width: 60, height: 60 },
  scope: { width: 100, height: 80 },
};

// ============================================================================
// Position Calculations
// ============================================================================

/**
 * Get block dimensions
 */
export function getBlockSize(blockType: string): { width: number; height: number } {
  return BLOCK_SIZES[blockType] ?? { width: DEFAULT_BLOCK_WIDTH, height: DEFAULT_BLOCK_HEIGHT };
}

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

  const blockSize = getBlockSize(block.type);
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
