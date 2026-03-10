/**
 * HitTester — High-Level Hit Testing API
 *
 * Provides semantic hit testing for pointer interactions.
 * Uses the SpatialIndex for fast candidate lookup, then performs
 * precise geometric tests for accurate hit detection.
 *
 * Priority order for overlapping hits:
 *   port > junction > block > wire segment > none
 */

import type { Position, Block, Wire, Junction, WireEndpoint } from '../types';
import type { HitTestResult } from '../types';
import { isPortEndpoint, isFloatingEndpoint, isJunctionEndpoint } from '../types';
import { SpatialIndex } from './SpatialIndex';
import type { SpatialItem } from './SpatialIndex';

/** Hit test configuration */
export interface HitTestConfig {
  /** Maximum distance for port snapping (world units) */
  portSnapRadius: number;
  /** Maximum distance for wire segment hit (world units) */
  wireHitRadius: number;
  /** Maximum distance for junction hit (world units) */
  junctionHitRadius: number;
  /** Maximum distance for block hit (world units) */
  blockHitRadius: number;
}

const DEFAULT_HIT_CONFIG: HitTestConfig = {
  portSnapRadius: 12,
  wireHitRadius: 8,
  junctionHitRadius: 8,
  blockHitRadius: 0, // Blocks use bounds check, not radius
};

/** No-hit result singleton */
const NO_HIT: HitTestResult = {
  type: 'none',
  id: '',
  position: { x: 0, y: 0 },
  distance: Infinity,
};

/**
 * Performs semantic hit testing against circuit elements.
 *
 * Hit priority (highest to lowest):
 * 1. Ports — for wire connection
 * 2. Junctions — for junction selection
 * 3. Blocks — for block selection/dragging
 * 4. Wire segments — for wire selection/segment dragging
 *
 * Note: Wire handles (corners) are not directly draggable.
 * Users drag wire segments instead, preserving Manhattan routing.
 */
export class HitTester {
  private _spatialIndex: SpatialIndex;
  private _config: HitTestConfig;
  private _blocks: Record<string, Block> = {};
  private _wires: Record<string, Wire> = {};
  private _junctions: Record<string, Junction> = {};

  constructor(spatialIndex: SpatialIndex, config?: Partial<HitTestConfig>) {
    this._spatialIndex = spatialIndex;
    this._config = { ...DEFAULT_HIT_CONFIG, ...config };
  }

  /**
   * Update the data references used for precise geometric tests.
   * Call this when the circuit state changes.
   */
  updateData(
    blocks: Record<string, Block>,
    wires: Record<string, Wire>,
    junctions: Record<string, Junction>
  ): void {
    this._blocks = blocks;
    this._wires = wires;
    this._junctions = junctions;
  }

  /**
   * Perform a hit test at the given world position.
   * Returns the highest-priority hit.
   */
  hitTest(worldPos: Position): HitTestResult {
    // Use the largest radius for spatial index query
    const searchRadius = Math.max(
      this._config.portSnapRadius,
      this._config.wireHitRadius,
      this._config.junctionHitRadius,
      20 // minimum search radius
    );

    const candidates = this._spatialIndex.queryPoint(worldPos, searchRadius);
    if (candidates.length === 0) return NO_HIT;

    // Test in priority order

    // 1. Ports
    const portHit = this._testPorts(worldPos, candidates);
    if (portHit) return portHit;

    // 2. Junctions
    const junctionHit = this._testJunctions(worldPos, candidates);
    if (junctionHit) return junctionHit;

    // 3. Blocks
    const blockHit = this._testBlocks(worldPos, candidates);
    if (blockHit) return blockHit;

    // 4. Wire segments (handles are not directly draggable — drag segments instead)
    const wireHit = this._testWireSegments(worldPos, candidates);
    if (wireHit) return wireHit;

    return NO_HIT;
  }

  /**
   * Find the nearest port to a position (for wire connection snapping).
   */
  findNearestPort(worldPos: Position, excludeBlockId?: string): HitTestResult | null {
    const candidates = this._spatialIndex.queryPoint(worldPos, this._config.portSnapRadius);
    const ports = candidates.filter(
      (c) => c.type === 'port' && c.parentId !== excludeBlockId
    );

    if (ports.length === 0) return null;

    let nearest: SpatialItem | null = null;
    let nearestDist = Infinity;

    for (const port of ports) {
      const cx = (port.minX + port.maxX) / 2;
      const cy = (port.minY + port.maxY) / 2;
      const dist = Math.hypot(worldPos.x - cx, worldPos.y - cy);
      if (dist < nearestDist && dist <= this._config.portSnapRadius) {
        nearestDist = dist;
        nearest = port;
      }
    }

    if (!nearest) return null;

    return {
      type: 'port',
      id: nearest.id,
      parentId: nearest.parentId,
      subIndex: nearest.subIndex,
      position: {
        x: (nearest.minX + nearest.maxX) / 2,
        y: (nearest.minY + nearest.maxY) / 2,
      },
      distance: nearestDist,
    };
  }

  // --------------------------------------------------------------------------
  // Private: Precise Geometric Tests
  // --------------------------------------------------------------------------

  private _testPorts(
    pos: Position,
    candidates: SpatialItem[]
  ): HitTestResult | null {
    const ports = candidates.filter((c) => c.type === 'port');
    let nearest: SpatialItem | null = null;
    let nearestDist = this._config.portSnapRadius;

    for (const port of ports) {
      const cx = (port.minX + port.maxX) / 2;
      const cy = (port.minY + port.maxY) / 2;
      const dist = Math.hypot(pos.x - cx, pos.y - cy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = port;
      }
    }

    if (!nearest) return null;

    return {
      type: 'port',
      id: nearest.id,
      parentId: nearest.parentId,
      subIndex: nearest.subIndex,
      position: {
        x: (nearest.minX + nearest.maxX) / 2,
        y: (nearest.minY + nearest.maxY) / 2,
      },
      distance: nearestDist,
    };
  }

  private _testJunctions(
    pos: Position,
    candidates: SpatialItem[]
  ): HitTestResult | null {
    const junctions = candidates.filter((c) => c.type === 'junction');
    let nearest: SpatialItem | null = null;
    let nearestDist = this._config.junctionHitRadius;

    for (const j of junctions) {
      const cx = (j.minX + j.maxX) / 2;
      const cy = (j.minY + j.maxY) / 2;
      const dist = Math.hypot(pos.x - cx, pos.y - cy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = j;
      }
    }

    if (!nearest) return null;

    return {
      type: 'junction',
      id: nearest.id,
      position: {
        x: (nearest.minX + nearest.maxX) / 2,
        y: (nearest.minY + nearest.maxY) / 2,
      },
      distance: nearestDist,
    };
  }

  private _testBlocks(
    pos: Position,
    candidates: SpatialItem[]
  ): HitTestResult | null {
    const blocks = candidates.filter((c) => c.type === 'block');
    let nearest: SpatialItem | null = null;
    let nearestDist = Infinity;

    for (const b of blocks) {
      // Point-in-rect test
      if (pos.x >= b.minX && pos.x <= b.maxX && pos.y >= b.minY && pos.y <= b.maxY) {
        // Distance to center for priority
        const cx = (b.minX + b.maxX) / 2;
        const cy = (b.minY + b.maxY) / 2;
        const dist = Math.hypot(pos.x - cx, pos.y - cy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = b;
        }
      }
    }

    if (!nearest) return null;

    return {
      type: 'block',
      id: nearest.id,
      position: pos,
      distance: nearestDist,
    };
  }

  /**
   * Test wire segments including endpoint-to-handle segments.
   * Builds full polyline [fromPos, ...handles, toPos] and tests all segments.
   * subIndex = polyline segment index (0 = from→first handle, etc.)
   */
  private _testWireSegments(
    pos: Position,
    candidates: SpatialItem[]
  ): HitTestResult | null {
    const wireCandidates = candidates.filter((c) => c.type === 'wire');
    let nearestWireId = '';
    let nearestSegIndex = -1;
    let nearestDist = this._config.wireHitRadius;
    let nearestPos: Position = { x: 0, y: 0 };

    for (const wc of wireCandidates) {
      const wire = this._wires[wc.id];
      if (!wire) continue;

      // Build full polyline: [fromPos, ...handles, toPos]
      const polyline = this._buildWirePolyline(wire);
      if (!polyline || polyline.length < 2) continue;

      for (let i = 0; i < polyline.length - 1; i++) {
        const a = polyline[i];
        const b = polyline[i + 1];
        const { distance, point } = pointToSegmentDistance(pos, a, b);

        if (distance < nearestDist) {
          nearestDist = distance;
          nearestWireId = wire.id;
          nearestSegIndex = i;
          nearestPos = point;
        }
      }
    }

    if (nearestSegIndex < 0) return null;

    return {
      type: 'segment',
      id: nearestWireId,
      subIndex: nearestSegIndex,
      position: nearestPos,
      distance: nearestDist,
    };
  }

  /**
   * Build the full polyline for a wire: [fromPos, ...handles, toPos]
   */
  private _buildWirePolyline(wire: Wire): Position[] | null {
    const fromPos = this._resolveEndpoint(wire.from);
    if (!fromPos) return null;

    const toPos = this._resolveEndpoint(wire.to);
    if (!toPos) return null;

    const points: Position[] = [fromPos];
    for (const handle of wire.handles ?? []) {
      points.push(handle.position);
    }
    points.push(toPos);

    return points;
  }

  /**
   * Resolve a wire endpoint to a world position.
   */
  private _resolveEndpoint(ep: WireEndpoint): Position | null {
    if (isFloatingEndpoint(ep)) {
      return ep.position;
    }
    if (isPortEndpoint(ep)) {
      const block = this._blocks[ep.componentId];
      if (!block) return null;
      const port = block.ports.find((p) => p.id === ep.portId);
      if (!port) return null;
      return {
        x: block.position.x + (port.absolutePosition?.x ?? 0),
        y: block.position.y + (port.absolutePosition?.y ?? 0),
      };
    }
    if (isJunctionEndpoint(ep)) {
      const junction = this._junctions[ep.junctionId];
      if (!junction) return null;
      return junction.position;
    }
    return null;
  }

  destroy(): void {
    this._blocks = {};
    this._wires = {};
    this._junctions = {};
  }
}

// ============================================================================
// Geometry Helpers
// ============================================================================

/**
 * Compute the shortest distance from a point to a line segment.
 * Returns the distance and the closest point on the segment.
 */
function pointToSegmentDistance(
  p: Position,
  a: Position,
  b: Position
): { distance: number; point: Position } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Segment is a point
    const dist = Math.hypot(p.x - a.x, p.y - a.y);
    return { distance: dist, point: a };
  }

  // Project p onto line ab, clamping t to [0, 1]
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closest: Position = {
    x: a.x + t * dx,
    y: a.y + t * dy,
  };
  const dist = Math.hypot(p.x - closest.x, p.y - closest.y);

  return { distance: dist, point: closest };
}
