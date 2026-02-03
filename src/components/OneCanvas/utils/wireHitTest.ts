/**
 * Wire Hit Test Utilities
 *
 * Utilities for detecting click positions on wire paths.
 */

import type { Position } from '../types';

/**
 * Get the closest point on an SVG path to a given point.
 * Uses binary search along the path for efficiency.
 */
export function getClosestPointOnPath(
  pathElement: SVGPathElement,
  clickPos: Position,
  samples: number = 100
): { point: Position; distance: number; t: number } {
  const totalLength = pathElement.getTotalLength();
  let closestPoint = { x: 0, y: 0 };
  let closestDistance = Infinity;
  let closestT = 0;

  // Initial coarse sampling
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const length = t * totalLength;
    const point = pathElement.getPointAtLength(length);
    const distance = Math.sqrt(
      Math.pow(point.x - clickPos.x, 2) + Math.pow(point.y - clickPos.y, 2)
    );

    if (distance < closestDistance) {
      closestDistance = distance;
      closestPoint = { x: point.x, y: point.y };
      closestT = t;
    }
  }

  // Refine with binary search in the neighborhood
  let tMin = Math.max(0, closestT - 1 / samples);
  let tMax = Math.min(1, closestT + 1 / samples);

  for (let iteration = 0; iteration < 10; iteration++) {
    const tMid = (tMin + tMax) / 2;
    const tLeft = (tMin + tMid) / 2;
    const tRight = (tMid + tMax) / 2;

    const pointLeft = pathElement.getPointAtLength(tLeft * totalLength);
    const pointRight = pathElement.getPointAtLength(tRight * totalLength);

    const distLeft = Math.sqrt(
      Math.pow(pointLeft.x - clickPos.x, 2) + Math.pow(pointLeft.y - clickPos.y, 2)
    );
    const distRight = Math.sqrt(
      Math.pow(pointRight.x - clickPos.x, 2) + Math.pow(pointRight.y - clickPos.y, 2)
    );

    if (distLeft < distRight) {
      tMax = tMid;
      if (distLeft < closestDistance) {
        closestDistance = distLeft;
        closestPoint = { x: pointLeft.x, y: pointLeft.y };
        closestT = tLeft;
      }
    } else {
      tMin = tMid;
      if (distRight < closestDistance) {
        closestDistance = distRight;
        closestPoint = { x: pointRight.x, y: pointRight.y };
        closestT = tRight;
      }
    }
  }

  return {
    point: closestPoint,
    distance: closestDistance,
    t: closestT,
  };
}

/**
 * Calculate click position on wire from mouse event.
 * Converts screen coordinates to SVG canvas coordinates.
 */
export function getClickPositionOnWire(
  event: React.MouseEvent,
  svgElement: SVGSVGElement | null,
  zoom: number = 1,
  pan: Position = { x: 0, y: 0 }
): Position {
  if (!svgElement) {
    return { x: event.clientX, y: event.clientY };
  }

  const rect = svgElement.getBoundingClientRect();
  const x = (event.clientX - rect.left - pan.x) / zoom;
  const y = (event.clientY - rect.top - pan.y) / zoom;

  return { x, y };
}

/**
 * Find the path element within a wire group by wire ID.
 */
export function findWirePathElement(wireId: string): SVGPathElement | null {
  const wireGroup = document.querySelector(`[data-wire-id="${wireId}"]`);
  if (!wireGroup) return null;

  // Get the main path (not the invisible hit area)
  const paths = wireGroup.querySelectorAll('path');
  // Return the second path (main wire), or first if only one exists
  return (paths[1] || paths[0]) as SVGPathElement | null;
}
