/**
 * Wire Geometry Cache
 *
 * Caches computed wire geometry with versioning to avoid redundant calculations.
 * Invalidates cache when state changes.
 */

import type { Wire, WireGeometry, Block, Junction } from '../types';
import { computeWireGeometry } from './wireGeometry';

interface CacheEntry {
  geometry: WireGeometry;
  /** Version when this geometry was computed */
  version: number;
}

/**
 * Cache for wire geometry with version-based invalidation
 */
export class WireGeometryCache {
  private cache = new Map<string, CacheEntry>();
  private currentVersion = 0;

  /**
   * Get wire geometry, computing if not cached or stale
   * @param wireId Wire identifier
   * @param wire Wire definition
   * @param blocks All blocks in canvas
   * @param junctions All junctions in canvas
   * @param stateVersion Current state version (increment on any state change)
   * @returns Cached or freshly computed geometry
   */
  get(
    wireId: string,
    wire: Wire,
    blocks: Map<string, Block>,
    junctions: Map<string, Junction>,
    stateVersion: number
  ): WireGeometry | null {
    // Update current version
    this.currentVersion = stateVersion;

    // Check cache
    const cached = this.cache.get(wireId);
    if (cached && cached.version === stateVersion) {
      return cached.geometry;
    }

    // Compute fresh geometry
    const geometry = computeWireGeometry(wire, blocks, junctions);
    if (geometry) {
      this.cache.set(wireId, { geometry, version: stateVersion });
    }

    return geometry;
  }

  /**
   * Invalidate a specific wire's cached geometry
   */
  invalidate(wireId: string): void {
    this.cache.delete(wireId);
  }

  /**
   * Invalidate all cached geometry
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics (for debugging)
   */
  getStats(): { size: number; version: number } {
    return {
      size: this.cache.size,
      version: this.currentVersion,
    };
  }
}
