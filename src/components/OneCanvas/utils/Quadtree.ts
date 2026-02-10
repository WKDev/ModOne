/**
 * Quadtree Spatial Index
 *
 * Generic quadtree for fast rectangle intersection queries and nearest-item lookup.
 * Items are indexed by bounding boxes and can be updated incrementally as they move.
 */

import type { BoundingBox, Position } from '../types';

const DEFAULT_MAX_ITEMS = 8;
const DEFAULT_MAX_DEPTH = 8;

const CHILD_NE = 0;
const CHILD_NW = 1;
const CHILD_SE = 2;
const CHILD_SW = 3;

/**
 * Minimum shape required for items stored in the quadtree.
 */
export interface QuadtreeItem {
  id: string;
  bounds: BoundingBox;
}

interface QuadtreeNode<T extends QuadtreeItem> {
  bounds: BoundingBox;
  depth: number;
  items: T[];
  children: QuadtreeChildren<T> | null;
}

type QuadtreeChildren<T extends QuadtreeItem> = [
  QuadtreeNode<T>,
  QuadtreeNode<T>,
  QuadtreeNode<T>,
  QuadtreeNode<T>,
];

/**
 * Spatial index based on a quadtree.
 *
 * - Average insertion/query complexity is O(log N)
 * - Items that cross quadrant boundaries remain in parent nodes
 * - Nearest queries use squared distance (no square root)
 */
export class Quadtree<T extends QuadtreeItem> {
  private readonly root: QuadtreeNode<T>;
  private readonly maxItems: number;
  private readonly maxDepth: number;
  private readonly itemNodes: Map<string, QuadtreeNode<T>>;

  /**
   * Create a quadtree for the provided canvas bounds.
   * @param bounds - Spatial extent of the root node
   * @param maxItems - Maximum items per node before subdivision (default: 8)
   * @param maxDepth - Maximum subdivision depth (default: 8)
   */
  constructor(bounds: BoundingBox, maxItems: number = DEFAULT_MAX_ITEMS, maxDepth: number = DEFAULT_MAX_DEPTH) {
    this.maxItems = Math.max(1, Math.floor(maxItems));
    this.maxDepth = Math.max(0, Math.floor(maxDepth));
    this.root = createNode({
      minX: bounds.minX,
      maxX: bounds.maxX,
      minY: bounds.minY,
      maxY: bounds.maxY,
    }, 0);
    this.itemNodes = new Map<string, QuadtreeNode<T>>();
  }

  /**
   * Insert or replace an item in the index.
   * @param item - Item to insert
   */
  insert(item: T): void {
    if (this.itemNodes.has(item.id)) {
      this.remove(item.id);
    }

    this.insertIntoNode(this.root, item);
  }

  /**
   * Remove an item from the index by ID.
   * @param id - Item ID
   * @returns true if an item was removed
   */
  remove(id: string): boolean {
    const node = this.itemNodes.get(id);
    if (!node) {
      return false;
    }

    const index = node.items.findIndex((item) => item.id === id);
    if (index < 0) {
      this.itemNodes.delete(id);
      return false;
    }

    node.items.splice(index, 1);
    this.itemNodes.delete(id);
    return true;
  }

  /**
   * Update an item position/shape by replacing the previous entry.
   * @param item - Updated item
   */
  update(item: T): void {
    this.remove(item.id);
    this.insert(item);
  }

  /**
   * Query all items whose bounds intersect the provided range.
   * @param range - Query rectangle
   * @returns Matching items
   */
  query(range: BoundingBox): T[] {
    const results: T[] = [];
    this.queryNode(this.root, range, results);
    return results;
  }

  /**
   * Find the closest item to a point within a maximum distance.
   * Uses squared distances internally to avoid expensive square roots.
   * @param point - Search origin
   * @param maxDistance - Maximum allowed distance from the point
   * @param filter - Optional predicate to include/exclude items
   * @returns Closest item or null when no match is within range
   */
  findClosest(point: Position, maxDistance: number, filter?: (item: T) => boolean): T | null {
    if (maxDistance < 0) {
      return null;
    }

    let bestItem: T | null = null;
    let bestDistanceSq = maxDistance * maxDistance;

    const searchNode = (node: QuadtreeNode<T>): void => {
      for (const item of node.items) {
        if (filter && !filter(item)) {
          continue;
        }

        const distanceSq = squaredDistanceToBounds(point, item.bounds);
        if (distanceSq <= bestDistanceSq) {
          bestDistanceSq = distanceSq;
          bestItem = item;
        }
      }

      if (!node.children) {
        return;
      }

      const childCandidates: Array<{ node: QuadtreeNode<T>; distanceSq: number }> = [];

      for (const child of node.children) {
        const distanceSq = squaredDistanceToBounds(point, child.bounds);
        if (distanceSq <= bestDistanceSq) {
          childCandidates.push({ node: child, distanceSq });
        }
      }

      childCandidates.sort((a, b) => a.distanceSq - b.distanceSq);

      for (const candidate of childCandidates) {
        if (candidate.distanceSq > bestDistanceSq) {
          continue;
        }
        searchNode(candidate.node);
      }
    };

    searchNode(this.root);
    return bestItem;
  }

  /**
   * Remove all items and reset the tree structure.
   */
  clear(): void {
    this.root.items = [];
    this.root.children = null;
    this.itemNodes.clear();
  }

  /**
   * Total number of indexed items.
   */
  get size(): number {
    return this.itemNodes.size;
  }

  /**
   * Rebuild the index from scratch using a full item set.
   * @param items - Full collection of items to index
   */
  rebuild(items: T[]): void {
    this.clear();

    for (const item of items) {
      this.insertIntoNode(this.root, item);
    }
  }

  private insertIntoNode(node: QuadtreeNode<T>, item: T): void {
    if (node.children) {
      const childIndex = getChildIndex(node.bounds, item.bounds);
      if (childIndex >= 0) {
        this.insertIntoNode(node.children[childIndex], item);
        return;
      }
    }

    node.items.push(item);
    this.itemNodes.set(item.id, node);

    if (!node.children && node.items.length > this.maxItems && node.depth < this.maxDepth) {
      node.children = createChildren(node.bounds, node.depth + 1);
      this.redistributeNodeItems(node);
    }
  }

  private redistributeNodeItems(node: QuadtreeNode<T>): void {
    if (!node.children) {
      return;
    }

    let index = 0;
    while (index < node.items.length) {
      const item = node.items[index];
      const childIndex = getChildIndex(node.bounds, item.bounds);

      if (childIndex < 0) {
        index += 1;
        continue;
      }

      node.items.splice(index, 1);
      this.insertIntoNode(node.children[childIndex], item);
    }
  }

  private queryNode(node: QuadtreeNode<T>, range: BoundingBox, results: T[]): void {
    for (const item of node.items) {
      if (boundsIntersect(item.bounds, range)) {
        results.push(item);
      }
    }

    if (!node.children || !boundsIntersect(node.bounds, range)) {
      return;
    }

    for (const child of node.children) {
      if (boundsIntersect(child.bounds, range)) {
        this.queryNode(child, range, results);
      }
    }
  }
}

/**
 * Create a quadtree spatial index with default tuning.
 * @param canvasBounds - Root bounds for the index
 * @returns A quadtree ready to index rectangular items
 */
export function createSpatialIndex(canvasBounds: BoundingBox): Quadtree<QuadtreeItem> {
  return new Quadtree<QuadtreeItem>(canvasBounds);
}

function createNode<T extends QuadtreeItem>(bounds: BoundingBox, depth: number): QuadtreeNode<T> {
  return {
    bounds,
    depth,
    items: [],
    children: null,
  };
}

function createChildren<T extends QuadtreeItem>(bounds: BoundingBox, depth: number): QuadtreeChildren<T> {
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;

  // Order: NE, NW, SE, SW
  return [
    createNode({ minX: midX, maxX: bounds.maxX, minY: bounds.minY, maxY: midY }, depth),
    createNode({ minX: bounds.minX, maxX: midX, minY: bounds.minY, maxY: midY }, depth),
    createNode({ minX: midX, maxX: bounds.maxX, minY: midY, maxY: bounds.maxY }, depth),
    createNode({ minX: bounds.minX, maxX: midX, minY: midY, maxY: bounds.maxY }, depth),
  ];
}

function getChildIndex(nodeBounds: BoundingBox, itemBounds: BoundingBox): number {
  const midX = (nodeBounds.minX + nodeBounds.maxX) / 2;
  const midY = (nodeBounds.minY + nodeBounds.maxY) / 2;

  const fitsNorth = itemBounds.maxY <= midY;
  const fitsSouth = itemBounds.minY >= midY;
  const fitsWest = itemBounds.maxX <= midX;
  const fitsEast = itemBounds.minX >= midX;

  if (fitsNorth && fitsEast) {
    return CHILD_NE;
  }

  if (fitsNorth && fitsWest) {
    return CHILD_NW;
  }

  if (fitsSouth && fitsEast) {
    return CHILD_SE;
  }

  if (fitsSouth && fitsWest) {
    return CHILD_SW;
  }

  return -1;
}

function boundsIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

function squaredDistanceToBounds(point: Position, bounds: BoundingBox): number {
  const dx = point.x < bounds.minX
    ? bounds.minX - point.x
    : point.x > bounds.maxX
      ? point.x - bounds.maxX
      : 0;

  const dy = point.y < bounds.minY
    ? bounds.minY - point.y
    : point.y > bounds.maxY
      ? point.y - bounds.maxY
      : 0;

  return dx * dx + dy * dy;
}
