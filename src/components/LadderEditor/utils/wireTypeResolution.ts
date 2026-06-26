import type {
  LadderElement, LadderGridConfig, GridPosition, WireType, WireProperties, VerticalLinkEntity,
} from "../../../types/ladder";
import { isWireType, WireDirection } from "../../../types/ladder";
import type { WireType as WireComponentType } from "../elements/Wire";
import type { ConnectivityGraph } from "./connectivityGraph";
import {
  DIRECTION_TO_WIRE_TYPE, WIRE_DIRECTION_PROPERTY_MAP, buildPositionIndex,
  getElementAtPosition, analyzeNeighborDirections, TOP, BOTTOM, LEFT, RIGHT,
} from "./wireDirections";

// ============================================================================
// Phase 1.5: resolveWireElementType()
// ============================================================================

/** Result of resolving the wire element type during placement */
export interface ResolvedWireType {
  type: WireType;
  direction?: string;
  directions: number;
}

/**
 * Determines the correct wire element type when a user places a wire.
 * Combines the user's intended type (wire_h or wire_v) with
 * the directions coming from neighboring cells.
 */
export function resolveWireElementType(
  position: GridPosition,
  intendedType: 'wire_h' | 'wire_v',
  elements: Map<string, LadderElement>,
  gridConfig: LadderGridConfig,
  graph?: ConnectivityGraph,
  verticalLinks?: Map<string, VerticalLinkEntity>
): ResolvedWireType {
  const intendedDirections = intendedType === 'wire_h'
    ? (WireDirection.LEFT | WireDirection.RIGHT)
    : (WireDirection.TOP | WireDirection.BOTTOM);

  const neighborDirections = analyzeNeighborDirections(position, elements, gridConfig, graph, verticalLinks);
  const combined = intendedDirections | neighborDirections;
  const bitCount = countBits(combined);

  if (bitCount <= 1) {
    return { type: intendedType, directions: combined };
  }

  const wireComponentType = DIRECTION_TO_WIRE_TYPE[combined];

  if (!wireComponentType) {
    return { type: intendedType, directions: combined };
  }

  if (wireComponentType === 'horizontal') return { type: 'wire_h', directions: combined };
  if (wireComponentType === 'vertical') return { type: 'wire_v', directions: combined };
  if (wireComponentType.startsWith('corner_')) return { type: 'wire_corner', direction: wireComponentType, directions: combined };
  if (wireComponentType.startsWith('junction_') || wireComponentType === 'cross') {
    return { type: 'wire_junction', direction: wireComponentType, directions: combined };
  }

  return { type: intendedType, directions: combined };
}

/** Count set bits in a number */
export function countBits(n: number): number {
  let count = 0;
  let v = n;
  while (v) {
    count += v & 1;
    v >>= 1;
  }
  return count;
}

// ============================================================================
// Phase 1.6: updateAdjacentWires()
// ============================================================================

/** Description of a wire element that needs its type updated */
export interface WireTypeUpdate {
  elementId: string;
  newType: WireType;
  newDirection?: string;
  newDirections?: number;
}

/**
 * After placing or removing an element, recalculate the wire type
 * of adjacent wire elements and return any needed updates.
 *
 * Only returns updates for wire-type elements (wire_h, wire_v, wire_corner, wire_junction).
 * Logic elements (contact, coil, etc.) are never modified.
 *
 * Uses a position index internally for O(1) lookups instead of O(n) scans.
 */
export function updateAdjacentWires(
  position: GridPosition,
  elements: Map<string, LadderElement>,
  gridConfig: LadderGridConfig,
  graph?: ConnectivityGraph,
  verticalLinks?: Map<string, VerticalLinkEntity>
): WireTypeUpdate[] {
  const updates: WireTypeUpdate[] = [];
  const { row, col } = position;

  // Build position index for O(1) lookups during neighbor analysis
  const posIndex = buildPositionIndex(elements);

  // Check all 4 neighbors
  const neighbors: Array<{ r: number; c: number }> = [
    { r: row - 1, c: col },  // top
    { r: row + 1, c: col },  // bottom
    { r: row, c: col - 1 },  // left
    { r: row, c: col + 1 },  // right
  ];

  for (const { r, c } of neighbors) {
    // Skip out of bounds
    if (r < 0 || c < 0 || c >= gridConfig.columns) continue;

    const neighbor = getElementAtPosition(r, c, posIndex);
    if (!neighbor) continue;

    // Recalculate what this neighbor's directions should be
    const neighborDirs = analyzeNeighborDirections(
      { row: r, col: c },
      elements,
      gridConfig,
      graph,
      verticalLinks
    );

    if (isWireType(neighbor.type)) {
      // Combine with the wire's own intended base directions
      const ownBase = getBaseWireDirections(neighbor.type as WireType);
      const combined = ownBase | neighborDirs;

      const newComponentType = DIRECTION_TO_WIRE_TYPE[combined];
      if (!newComponentType) continue;

      // Determine the new WireType + direction
      const resolved = componentTypeToWireType(newComponentType);

      // Check if it actually changed
      const currentDirection = (neighbor.properties as WireProperties).direction;
      const currentDirs = neighbor.properties?.connectedDirections;

      if (resolved.type === neighbor.type &&
        resolved.direction === currentDirection &&
        combined === currentDirs) {
        continue;
      }

      updates.push({
        elementId: neighbor.id,
        newType: resolved.type,
        newDirection: resolved.direction,
        newDirections: combined,
      });
    } else {
      // For logic elements, only track connectedDirections
      const currentDirs = neighbor.properties?.connectedDirections;
      if (neighborDirs !== currentDirs) {
        updates.push({
          elementId: neighbor.id,
          newType: neighbor.type as WireType, // Type remains same
          newDirections: neighborDirs,
        });
      }
    }
  }


  return updates;
}

/**
 * Get the base (intended) directions for a wire type, ignoring
 * the current direction property. This represents what the wire
 * "wants" to be before neighbor influence.
 */
export function getBaseWireDirections(wireType: WireType): number {
  switch (wireType) {
    case 'wire_h': return LEFT | RIGHT;
    case 'wire_v': return TOP | BOTTOM;
    case 'wire_corner': return LEFT | BOTTOM; // default corner direction
    case 'wire_junction': return LEFT | RIGHT | BOTTOM; // default junction direction
    default: return LEFT | RIGHT;
  }
}

/**
 * Convert a WireComponentType back to a WireType + optional direction property.
 */
export function componentTypeToWireType(componentType: WireComponentType): ResolvedWireType {
  if (componentType === 'horizontal') return { type: 'wire_h', directions: LEFT | RIGHT };
  if (componentType === 'vertical') return { type: 'wire_v', directions: TOP | BOTTOM };
  if (componentType.startsWith('corner_')) {
    return {
      type: 'wire_corner',
      direction: componentType,
      directions: WIRE_DIRECTION_PROPERTY_MAP[componentType as keyof typeof WIRE_DIRECTION_PROPERTY_MAP] ?? (LEFT | BOTTOM),
    };
  }
  if (componentType.startsWith('junction_') || componentType === 'cross') {
    return {
      type: 'wire_junction',
      direction: componentType,
      directions: WIRE_DIRECTION_PROPERTY_MAP[componentType as keyof typeof WIRE_DIRECTION_PROPERTY_MAP] ?? (LEFT | RIGHT | BOTTOM),
    };
  }
  return { type: 'wire_h', directions: LEFT | RIGHT };
}

