/**
 * SpatialIndex — R-Tree Based Spatial Lookup
 *
 * Wraps rbush for efficient spatial queries (point, rect, nearest).
 * Used by the HitTester for O(log n) hit detection on large schematics.
 *
 * Supports 1,000+ blocks at interactive speeds by avoiding O(n)
 * iteration over all elements for every pointer event.
 */

import RBush from 'rbush';
import type { Position, Rect, Block, Wire, Junction } from '../types';
import { isFloatingEndpoint } from '../types';

// ============================================================================
// R-Tree Item Types
// ============================================================================

/** The type of entity stored in the spatial index */
export type SpatialItemType = 'block' | 'wire' | 'junction' | 'port';

/** An item stored in the R-tree */
export interface SpatialItem {
  /** R-tree bounding box (required by rbush) */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Entity type */
  type: SpatialItemType;
  /** Entity ID */
  id: string;
  /** Optional sub-index (e.g., port index within a block) */
  subIndex?: number;
  /** Optional parent ID (e.g., block ID for a port) */
  parentId?: string;
}

// ============================================================================
// Spatial Index
// ============================================================================

/**
 * R-tree based spatial index for fast hit testing.
 *
 * Maintains a separate R-tree that is rebuilt or incrementally updated
 * when the circuit state changes. Supports:
 * - Point queries (what's at this position?)
 * - Rectangle queries (what's in this selection box?)
 * - Nearest queries (what's closest to this position?)
 */
export class SpatialIndex {
  private _tree: RBush<SpatialItem>;
  private _items: Map<string, SpatialItem> = new Map();

  constructor() {
    this._tree = new RBush<SpatialItem>();
  }

  /** Total number of items in the index */
  get size(): number {
    return this._items.size;
  }

  // --------------------------------------------------------------------------
  // Bulk Operations
  // --------------------------------------------------------------------------

  /**
   * Clear the index and rebuild from scratch.
   * Most efficient when many things change at once.
   */
  rebuild(
    blocks: Record<string, Block>,
    wires: Record<string, Wire>,
    junctions: Record<string, Junction>
  ): void {
    this._items.clear();
    const items: SpatialItem[] = [];

    // Index blocks
    for (const block of Object.values(blocks)) {
      if (block.visible === false) continue;
      const item: SpatialItem = {
        minX: block.position.x,
        minY: block.position.y,
        maxX: block.position.x + block.size.width,
        maxY: block.position.y + block.size.height,
        type: 'block',
        id: block.id,
      };
      items.push(item);
      this._items.set(`block:${block.id}`, item);

      // Index ports
      for (let i = 0; i < block.ports.length; i++) {
        const port = block.ports[i];
        const portX = block.position.x + (port.absolutePosition?.x ?? 0);
        const portY = block.position.y + (port.absolutePosition?.y ?? 0);
        const portItem: SpatialItem = {
          minX: portX - 6,
          minY: portY - 6,
          maxX: portX + 6,
          maxY: portY + 6,
          type: 'port',
          id: port.id,
          subIndex: i,
          parentId: block.id,
        };
        items.push(portItem);
        this._items.set(`port:${block.id}:${port.id}`, portItem);
      }
    }

    // Index wires (bounding box of all handles + endpoints)
    for (const wire of Object.values(wires)) {
      const bounds = this._computeWireBounds(wire);
      if (!bounds) continue;
      const item: SpatialItem = {
        ...bounds,
        type: 'wire',
        id: wire.id,
      };
      items.push(item);
      this._items.set(`wire:${wire.id}`, item);
    }

    // Index junctions
    for (const junction of Object.values(junctions)) {
      const r = 5; // junction visual radius
      const item: SpatialItem = {
        minX: junction.position.x - r,
        minY: junction.position.y - r,
        maxX: junction.position.x + r,
        maxY: junction.position.y + r,
        type: 'junction',
        id: junction.id,
      };
      items.push(item);
      this._items.set(`junction:${junction.id}`, item);
    }

    // Bulk load is much faster than individual inserts
    this._tree.clear();
    this._tree.load(items);
  }

  // --------------------------------------------------------------------------
  // Incremental Updates
  // --------------------------------------------------------------------------

  /**
   * Update a single block's position in the index.
   */
  updateBlock(block: Block): void {
    const key = `block:${block.id}`;
    const existing = this._items.get(key);
    if (existing) {
      this._tree.remove(existing);
    }

    if (!block.visible) {
      this._items.delete(key);
      return;
    }

    const item: SpatialItem = {
      minX: block.position.x,
      minY: block.position.y,
      maxX: block.position.x + block.size.width,
      maxY: block.position.y + block.size.height,
      type: 'block',
      id: block.id,
    };
    this._items.set(key, item);
    this._tree.insert(item);

     // Update ports
     for (let i = 0; i < block.ports.length; i++) {
       const port = block.ports[i];
       const portKey = `port:${block.id}:${port.id}`;
       const existingPort = this._items.get(portKey);
       if (existingPort) {
         this._tree.remove(existingPort);
       }

       const portX = block.position.x + (port.absolutePosition?.x ?? 0);
       const portY = block.position.y + (port.absolutePosition?.y ?? 0);
      const portItem: SpatialItem = {
        minX: portX - 6,
        minY: portY - 6,
        maxX: portX + 6,
        maxY: portY + 6,
        type: 'port',
        id: port.id,
        subIndex: i,
        parentId: block.id,
      };
      this._items.set(portKey, portItem);
      this._tree.insert(portItem);
    }
  }

  /**
   * Remove a block and its ports from the index.
   */
  removeBlock(blockId: string): void {
    const key = `block:${blockId}`;
    const existing = this._items.get(key);
    if (existing) {
      this._tree.remove(existing);
      this._items.delete(key);
    }

    // Remove associated ports
    for (const [portKey, portItem] of this._items) {
      if (portItem.type === 'port' && portItem.parentId === blockId) {
        this._tree.remove(portItem);
        this._items.delete(portKey);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /**
   * Find all items within a bounding rectangle.
   */
  queryRect(rect: Rect): SpatialItem[] {
    return this._tree.search({
      minX: rect.x,
      minY: rect.y,
      maxX: rect.x + rect.width,
      maxY: rect.y + rect.height,
    });
  }

  /**
   * Find all items near a point within a radius.
   */
  queryPoint(pos: Position, radius: number = 10): SpatialItem[] {
    return this._tree.search({
      minX: pos.x - radius,
      minY: pos.y - radius,
      maxX: pos.x + radius,
      maxY: pos.y + radius,
    });
  }

  /**
   * Find the single nearest item to a point, optionally filtered by type.
   */
  queryNearest(
    pos: Position,
    radius: number = 20,
    typeFilter?: SpatialItemType
  ): SpatialItem | null {
    const candidates = this.queryPoint(pos, radius);
    const filtered = typeFilter
      ? candidates.filter((c) => c.type === typeFilter)
      : candidates;

    if (filtered.length === 0) return null;

    let nearest: SpatialItem | null = null;
    let nearestDist = Infinity;

    for (const item of filtered) {
      const cx = (item.minX + item.maxX) / 2;
      const cy = (item.minY + item.maxY) / 2;
      const dist = Math.hypot(pos.x - cx, pos.y - cy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = item;
      }
    }

    return nearest;
  }

  /**
   * Clear the entire index.
   */
  clear(): void {
    this._tree.clear();
    this._items.clear();
  }

  /**
   * Destroy the index.
   */
  destroy(): void {
    this.clear();
  }

  // --------------------------------------------------------------------------
  // Internal Helpers
  // --------------------------------------------------------------------------

  private _computeWireBounds(
    wire: Wire
  ): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const points: Position[] = [];

    // Collect all relevant positions
    if (isFloatingEndpoint(wire.from)) {
      points.push(wire.from.position);
    }
    if (isFloatingEndpoint(wire.to)) {
      points.push(wire.to.position);
    }
    for (const handle of (wire.handles ?? [])) {
      points.push(handle.position);
    }

    if (points.length === 0) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    // Add a small padding for wire thickness
    const pad = 4;
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
    };
  }
}
