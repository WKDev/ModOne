/**
 * Collision Detection Utilities
 *
 * Pure geometric collision detection for selection operations.
 * No DOM dependencies.
 */

import type { Wire, Block, Junction, Position, BoundingBox } from '../types';
import type { WireGeometryCache } from './geometryCache';

/** Selection box state (rectangle) */
export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/**
 * Normalize selection box to ensure min/max are correct
 */
export function normalizeSelectionBox(box: SelectionBox): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  return {
    minX: Math.min(box.startX, box.endX),
    maxX: Math.max(box.startX, box.endX),
    minY: Math.min(box.startY, box.endY),
    maxY: Math.max(box.startY, box.endY),
  };
}

/**
 * Check if two bounding boxes intersect
 */
export function boxIntersectsBox(a: BoundingBox, b: BoundingBox): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

/**
 * Check if a point is inside a bounding box
 */
export function pointInBox(point: Position, box: BoundingBox): boolean {
  return (
    point.x >= box.minX &&
    point.x <= box.maxX &&
    point.y >= box.minY &&
    point.y <= box.maxY
  );
}

/**
 * Check if all points are inside a box (containment test)
 */
export function allPointsInBox(points: Position[], box: BoundingBox): boolean {
  return points.every(p => pointInBox(p, box));
}

/**
 * Check if any point is inside a box (intersection test)
 */
export function anyPointInBox(points: Position[], box: BoundingBox): boolean {
  return points.some(p => pointInBox(p, box));
}

/**
 * Check if a line segment intersects a box
 */
export function segmentIntersectsBox(
  start: Position,
  end: Position,
  box: BoundingBox
): boolean {
  // Check if either endpoint is inside box
  if (pointInBox(start, box) || pointInBox(end, box)) {
    return true;
  }

  // Check if segment crosses any box edge
  // This is a simplified check - could be more precise
  const boxPoints = [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ];

  for (let i = 0; i < boxPoints.length; i++) {
    const edgeStart = boxPoints[i];
    const edgeEnd = boxPoints[(i + 1) % boxPoints.length];

    if (segmentsIntersect(start, end, edgeStart, edgeEnd)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if two line segments intersect
 */
function segmentsIntersect(
  a1: Position,
  a2: Position,
  b1: Position,
  b2: Position
): boolean {
  const det = (a2.x - a1.x) * (b2.y - b1.y) - (b2.x - b1.x) * (a2.y - a1.y);
  if (Math.abs(det) < 1e-10) return false; // Parallel

  const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b2.x - b1.x) * (b1.y - a1.y)) / det;
  const u = ((b1.x - a1.x) * (a2.y - a1.y) - (a2.x - a1.x) * (b1.y - a1.y)) / det;

  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/**
 * Select wires within a selection box
 * @param wires All wires to test
 * @param selectionBox Selection rectangle
 * @param geometryCache Cache for wire geometry
 * @param blocks All blocks (needed for geometry computation)
 * @param junctions All junctions (needed for geometry computation)
 * @param stateVersion Current state version for cache
 * @param mode 'contain' = all points inside, 'intersect' = any point inside
 * @returns IDs of selected wires
 */
export function selectWiresInBox(
  wires: Wire[],
  selectionBox: SelectionBox,
  geometryCache: WireGeometryCache,
  blocks: Map<string, Block>,
  junctions: Map<string, Junction>,
  stateVersion: number,
  mode: 'contain' | 'intersect'
): string[] {
  const normalizedBox = normalizeSelectionBox(selectionBox);
  const selectedWireIds: string[] = [];

  for (const wire of wires) {
    const geometry = geometryCache.get(
      wire.id,
      wire,
      blocks,
      junctions,
      stateVersion
    );

    if (!geometry) continue;

    // Quick rejection: bounding box test
    if (!boxIntersectsBox(geometry.bounds, normalizedBox)) {
      continue;
    }

    // Precise test based on mode
    let selected = false;
    if (mode === 'contain') {
      // All sampled points must be inside box
      selected = allPointsInBox(geometry.samples, normalizedBox);
    } else {
      // Any sampled point inside box, or any segment crosses box
      selected = anyPointInBox(geometry.samples, normalizedBox);

      // Also check if any segment crosses the box
      if (!selected) {
        for (const segment of geometry.segments) {
          if (segmentIntersectsBox(segment.start, segment.end, normalizedBox)) {
            selected = true;
            break;
          }
        }
      }
    }

    if (selected) {
      selectedWireIds.push(wire.id);
    }
  }

  return selectedWireIds;
}

/**
 * Check if a block is inside a selection box
 * @param block Block to test
 * @param selectionBox Selection rectangle
 * @param mode 'contain' = entire block inside, 'intersect' = any part inside
 * @returns true if block should be selected
 */
export function isBlockInBox(
  block: Block,
  selectionBox: SelectionBox,
  mode: 'contain' | 'intersect'
): boolean {
  const normalizedBox = normalizeSelectionBox(selectionBox);
  const blockBounds: BoundingBox = {
    minX: block.position.x,
    maxX: block.position.x + block.size.width,
    minY: block.position.y,
    maxY: block.position.y + block.size.height,
  };

  if (mode === 'contain') {
    // Entire block must be inside selection box
    return (
      blockBounds.minX >= normalizedBox.minX &&
      blockBounds.maxX <= normalizedBox.maxX &&
      blockBounds.minY >= normalizedBox.minY &&
      blockBounds.maxY <= normalizedBox.maxY
    );
  } else {
    // Any part of block inside selection box
    return boxIntersectsBox(blockBounds, normalizedBox);
  }
}

/**
 * Check if a junction is inside a selection box
 * @param junction Junction to test
 * @param selectionBox Selection rectangle
 * @returns true if junction should be selected
 */
export function isJunctionInBox(
  junction: Junction,
  selectionBox: SelectionBox
): boolean {
  const normalizedBox = normalizeSelectionBox(selectionBox);
  return pointInBox(junction.position, normalizedBox);
}
