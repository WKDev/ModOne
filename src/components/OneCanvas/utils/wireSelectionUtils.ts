/**
 * Wire Selection Utilities
 *
 * Utilities for selecting wires via drag-to-select operations.
 * Supports both containment (left-to-right) and intersection (right-to-left) modes.
 */

import type { Position, Wire, Block, Junction } from '../types';
import { isPortEndpoint } from '../types';
import type { SelectionBoxState } from '../components/SelectionBox';
import { isPointInBox } from '../components/SelectionBox';

// ============================================================================
// Path Sampling
// ============================================================================

/**
 * Sample points along an SVG path element.
 * Uses getTotalLength() and getPointAtLength() for accuracy.
 * Sample count adapts to path length:
 * - Short (<100px): 10 samples
 * - Medium (100-500px): 30 samples
 * - Long (>500px): 50-100 samples
 */
export function sampleWirePath(
  pathElement: SVGPathElement,
  adaptiveSampling: boolean = true
): Position[] {
  const length = pathElement.getTotalLength();

  // Handle zero-length paths
  if (length === 0) {
    return [];
  }

  // Determine sample count based on path length
  let sampleCount: number;
  if (adaptiveSampling) {
    if (length < 100) {
      sampleCount = 10;
    } else if (length < 500) {
      sampleCount = 30;
    } else {
      sampleCount = Math.min(Math.floor(length / 10), 100);
    }
  } else {
    sampleCount = 50; // Default fixed sampling
  }

  const points: Position[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount;
    const point = pathElement.getPointAtLength(t * length);
    points.push({ x: point.x, y: point.y });
  }

  return points;
}

// ============================================================================
// Selection Detection
// ============================================================================

/**
 * Check if ALL sampled wire points are inside selection box.
 * Used for left-to-right (containment) selection mode.
 */
export function isWireContainedInBox(
  wirePoints: Position[],
  box: SelectionBoxState
): boolean {
  if (wirePoints.length === 0) return false;
  return wirePoints.every(point => isPointInBox(point, box));
}

/**
 * Check if ANY sampled wire point intersects selection box.
 * Used for right-to-left (intersection) selection mode.
 */
export function doesWireIntersectBox(
  wirePoints: Position[],
  box: SelectionBoxState
): boolean {
  if (wirePoints.length === 0) return false;
  return wirePoints.some(point => isPointInBox(point, box));
}

// ============================================================================
// DOM Queries
// ============================================================================

/**
 * Get wire's SVG path element from DOM.
 * Queries [data-wire-id] and returns main path element.
 */
export function getWirePathElement(wireId: string): SVGPathElement | null {
  const wireGroup = document.querySelector(`[data-wire-id="${wireId}"]`);
  if (!wireGroup) return null;

  // Get the main wire path (second path element - first is hit area)
  const paths = wireGroup.querySelectorAll('path');
  if (paths.length < 2) return null;

  return paths[1] as SVGPathElement; // Main path is second
}

// ============================================================================
// Optimization
// ============================================================================

/**
 * Calculate wire bounding box from endpoints and handles.
 * Quick rejection test before expensive path sampling.
 */
export function getWireBoundingBox(
  wire: Wire,
  components: Map<string, Block>,
  junctions: Map<string, Junction>
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const positions: Position[] = [];

  // Add from position
  if (isPortEndpoint(wire.from)) {
    const component = components.get(wire.from.componentId);
    if (component) {
      positions.push(component.position);
    }
  } else {
    const junction = junctions.get(wire.from.junctionId);
    if (junction) {
      positions.push(junction.position);
    }
  }

  // Add to position
  if (isPortEndpoint(wire.to)) {
    const component = components.get(wire.to.componentId);
    if (component) {
      positions.push(component.position);
    }
  } else {
    const junction = junctions.get(wire.to.junctionId);
    if (junction) {
      positions.push(junction.position);
    }
  }

  // Add control handles if they exist
  if (wire.handles) {
    positions.push(...wire.handles.map(h => h.position));
  }

  if (positions.length === 0) return null;

  // Calculate bounding box
  const xs = positions.map(p => p.x);
  const ys = positions.map(p => p.y);

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}
