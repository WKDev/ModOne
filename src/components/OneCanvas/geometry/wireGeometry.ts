/**
 * Wire Geometry Computation
 *
 * Pure geometric calculations for wire paths without DOM dependencies.
 * Computes Bezier curve samples and bounding boxes for collision detection.
 */

import type {
  Wire,
  WireGeometry,
  BoundingBox,
  Position,
  Block,
  Junction,
  WireEndpoint,
} from '../types';
import { isPortEndpoint } from '../types';

/**
 * Sample a cubic Bezier curve at regular intervals
 * @param p0 Start point
 * @param p1 First control point
 * @param p2 Second control point
 * @param p3 End point
 * @param samples Number of samples (including start and end)
 * @returns Array of sampled positions
 */
export function sampleCubicBezier(
  p0: Position,
  p1: Position,
  p2: Position,
  p3: Position,
  samples: number = 50
): Position[] {
  const points: Position[] = [];

  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    // Cubic Bezier formula: B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
    const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
    const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;

    points.push({ x, y });
  }

  return points;
}

/**
 * Compute bounding box from a set of positions
 */
export function computeBoundingBox(positions: Position[]): BoundingBox {
  if (positions.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  let minX = positions[0].x;
  let maxX = positions[0].x;
  let minY = positions[0].y;
  let maxY = positions[0].y;

  for (const pos of positions) {
    if (pos.x < minX) minX = pos.x;
    if (pos.x > maxX) maxX = pos.x;
    if (pos.y < minY) minY = pos.y;
    if (pos.y > maxY) maxY = pos.y;
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Get position of an endpoint (port or junction)
 */
function getEndpointPosition(
  endpoint: WireEndpoint,
  blocks: Map<string, Block>,
  junctions: Map<string, Junction>
): Position | null {
  if (isPortEndpoint(endpoint)) {
    const block = blocks.get(endpoint.componentId);
    if (!block) return null;
    // For now, return block position (will be refined with port offsets)
    return block.position;
  } else {
    const junction = junctions.get(endpoint.junctionId);
    return junction ? junction.position : null;
  }
}

/**
 * Compute wire geometry from application state (no DOM access)
 * @param wire Wire definition
 * @param blocks All blocks in canvas
 * @param junctions All junctions in canvas
 * @returns Pre-computed geometry for collision detection
 */
export function computeWireGeometry(
  wire: Wire,
  blocks: Map<string, Block>,
  junctions: Map<string, Junction>
): WireGeometry | null {
  // Get endpoint positions
  const startPos = getEndpointPosition(wire.from, blocks, junctions);
  const endPos = getEndpointPosition(wire.to, blocks, junctions);

  if (!startPos || !endPos) {
    return null; // Wire has invalid endpoints
  }

  // If wire has no handles, it's a straight line
  if (!wire.handles || wire.handles.length === 0) {
    const samples = [startPos, endPos];
    const segments = [{ start: startPos, end: endPos }];
    const bounds = computeBoundingBox(samples);

    return {
      wireId: wire.id,
      bounds,
      samples,
      segments,
    };
  }

  // Wire has handles - compute Bezier curve through all control points
  const allPoints: Position[] = [];
  const segments: Array<{ start: Position; end: Position }> = [];

  // For simplicity, sample between each pair of consecutive points
  const controlPoints = [
    startPos,
    ...wire.handles.map(h => h.position),
    endPos,
  ];

  for (let i = 0; i < controlPoints.length - 1; i++) {
    const p0 = controlPoints[i];
    const p3 = controlPoints[i + 1];

    // Create simple cubic Bezier with control points slightly offset
    // (This is a simplification - could be improved with actual tangent calculation)
    const dx = p3.x - p0.x;
    const dy = p3.y - p0.y;
    const p1 = { x: p0.x + dx * 0.33, y: p0.y + dy * 0.33 };
    const p2 = { x: p0.x + dx * 0.67, y: p0.y + dy * 0.67 };

    const segmentSamples = sampleCubicBezier(p0, p1, p2, p3, 20);
    allPoints.push(...segmentSamples);

    // Create line segments from samples
    for (let j = 0; j < segmentSamples.length - 1; j++) {
      segments.push({
        start: segmentSamples[j],
        end: segmentSamples[j + 1],
      });
    }
  }

  const bounds = computeBoundingBox(allPoints);

  return {
    wireId: wire.id,
    bounds,
    samples: allPoints,
    segments,
  };
}
