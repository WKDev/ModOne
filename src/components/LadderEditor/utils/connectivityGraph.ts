import type { LadderElement, LadderGridConfig, GridPosition } from '../../../types/ladder';
import { WireDirection } from '../../../types/ladder';
import { getElementDirections } from './wireGenerator';

type PositionIndex = Map<string, LadderElement>;

const { TOP, BOTTOM, LEFT, RIGHT } = WireDirection;

const DIRECTION_DELTAS = [
  { direction: TOP, opposite: BOTTOM, rowDelta: -1, colDelta: 0 },
  { direction: BOTTOM, opposite: TOP, rowDelta: 1, colDelta: 0 },
  { direction: LEFT, opposite: RIGHT, rowDelta: 0, colDelta: -1 },
  { direction: RIGHT, opposite: LEFT, rowDelta: 0, colDelta: 1 },
] as const;

function posKey(row: number, col: number): string {
  return `${row}-${col}`;
}

function parseKey(key: string): GridPosition {
  const [row, col] = key.split('-').map(Number);
  return { row, col };
}

function getNeighborPositions(position: GridPosition): GridPosition[] {
  return [
    { row: position.row - 1, col: position.col },
    { row: position.row + 1, col: position.col },
    { row: position.row, col: position.col - 1 },
    { row: position.row, col: position.col + 1 },
  ];
}

function buildPositionIndex(elements: Map<string, LadderElement>): PositionIndex {
  const index = new Map<string, LadderElement>();
  for (const element of elements.values()) {
    index.set(posKey(element.position.row, element.position.col), element);
  }
  return index;
}

export interface ConnectivityGraph {
  hasConnection(from: GridPosition, to: GridPosition): boolean;
  getConnected(position: GridPosition): GridPosition[];
  getConnectedDirections(position: GridPosition): number;
}

export class GridConnectivityGraph implements ConnectivityGraph {
  private adjacency = new Map<string, Set<string>>();
  private directionCache = new Map<string, number>();
  private gridConfig: LadderGridConfig;

  constructor(elements: Map<string, LadderElement>, gridConfig: LadderGridConfig) {
    this.gridConfig = gridConfig;
    this.rebuild(elements, gridConfig);
  }

  hasConnection(from: GridPosition, to: GridPosition): boolean {
    const fromKey = posKey(from.row, from.col);
    const toKey = posKey(to.row, to.col);
    return this.adjacency.get(fromKey)?.has(toKey) ?? false;
  }

  getConnected(position: GridPosition): GridPosition[] {
    const key = posKey(position.row, position.col);
    const connected = this.adjacency.get(key);
    if (!connected) {
      return [];
    }
    return Array.from(connected).map(parseKey);
  }

  getConnectedDirections(position: GridPosition): number {
    const key = posKey(position.row, position.col);
    return this.directionCache.get(key) ?? this.getRailDirectionMask(position.col, this.gridConfig);
  }

  rebuild(elements: Map<string, LadderElement>, gridConfig: LadderGridConfig): void {
    this.gridConfig = gridConfig;
    this.adjacency.clear();
    this.directionCache.clear();

    const index = buildPositionIndex(elements);
    const cellsToRecompute = new Map<string, GridPosition>();

    for (const element of index.values()) {
      this.refreshAdjacencyForPosition(element.position, index, gridConfig);

      cellsToRecompute.set(posKey(element.position.row, element.position.col), element.position);
      for (const neighbor of getNeighborPositions(element.position)) {
        if (neighbor.row < 0 || neighbor.col < 0 || neighbor.col >= gridConfig.columns) {
          continue;
        }
        cellsToRecompute.set(posKey(neighbor.row, neighbor.col), neighbor);
      }
    }

    for (const position of cellsToRecompute.values()) {
      this.recomputeDirectionCache(position, index, gridConfig);
    }
  }

  addNode(
    element: LadderElement,
    allElements: Map<string, LadderElement>,
    gridConfig: LadderGridConfig
  ): void {
    this.gridConfig = gridConfig;
    const index = buildPositionIndex(allElements);
    const affected = this.getAffectedPositions(element.position, gridConfig);

    for (const position of affected) {
      this.refreshAdjacencyForPosition(position, index, gridConfig);
    }

    for (const position of affected) {
      this.recomputeDirectionCache(position, index, gridConfig);
    }
  }

  removeNode(
    position: GridPosition,
    allElements: Map<string, LadderElement>,
    gridConfig: LadderGridConfig
  ): void {
    this.gridConfig = gridConfig;
    const index = buildPositionIndex(allElements);
    const affected = this.getAffectedPositions(position, gridConfig);

    for (const affectedPosition of affected) {
      this.refreshAdjacencyForPosition(affectedPosition, index, gridConfig);
    }

    for (const affectedPosition of affected) {
      this.recomputeDirectionCache(affectedPosition, index, gridConfig);
    }
  }

  private getAffectedPositions(center: GridPosition, gridConfig: LadderGridConfig): GridPosition[] {
    const affected = new Map<string, GridPosition>();
    const all = [center, ...getNeighborPositions(center)];

    for (const position of all) {
      if (position.row < 0 || position.col < 0 || position.col >= gridConfig.columns) {
        continue;
      }
      affected.set(posKey(position.row, position.col), position);
    }

    return Array.from(affected.values());
  }

  private refreshAdjacencyForPosition(
    position: GridPosition,
    index: PositionIndex,
    gridConfig: LadderGridConfig
  ): void {
    const key = posKey(position.row, position.col);
    const existingNeighbors = this.adjacency.get(key);

    if (existingNeighbors) {
      for (const neighborKey of existingNeighbors) {
        const neighborSet = this.adjacency.get(neighborKey);
        if (neighborSet) {
          neighborSet.delete(key);
          if (neighborSet.size === 0 && !index.has(neighborKey)) {
            this.adjacency.delete(neighborKey);
          }
        }
      }
    }

    this.adjacency.delete(key);

    const element = index.get(key);
    if (!element) {
      return;
    }

    const elementDirections = getElementDirections(element);
    const currentSet = new Set<string>();
    this.adjacency.set(key, currentSet);

    for (const delta of DIRECTION_DELTAS) {
      if ((elementDirections & delta.direction) === 0) {
        continue;
      }

      const neighborRow = position.row + delta.rowDelta;
      const neighborCol = position.col + delta.colDelta;

      if (neighborRow < 0 || neighborCol < 0 || neighborCol >= gridConfig.columns) {
        continue;
      }

      const neighborKey = posKey(neighborRow, neighborCol);
      const neighborElement = index.get(neighborKey);
      if (!neighborElement) {
        continue;
      }

      const neighborDirections = getElementDirections(neighborElement);
      if ((neighborDirections & delta.opposite) === 0) {
        continue;
      }

      currentSet.add(neighborKey);

      let neighborSet = this.adjacency.get(neighborKey);
      if (!neighborSet) {
        neighborSet = new Set<string>();
        this.adjacency.set(neighborKey, neighborSet);
      }
      neighborSet.add(key);
    }
  }

  private recomputeDirectionCache(
    position: GridPosition,
    index: PositionIndex,
    gridConfig: LadderGridConfig
  ): void {
    const { row, col } = position;
    let result = WireDirection.NONE;

    if (row > 0) {
      const top = index.get(posKey(row - 1, col));
      if (top && (getElementDirections(top) & BOTTOM)) {
        result |= TOP;
      }
    }

    const bottom = index.get(posKey(row + 1, col));
    if (bottom && (getElementDirections(bottom) & TOP)) {
      result |= BOTTOM;
    }

    if (col > 0) {
      const left = index.get(posKey(row, col - 1));
      if (left && (getElementDirections(left) & RIGHT)) {
        result |= LEFT;
      }
    }

    if (col < gridConfig.columns - 1) {
      const right = index.get(posKey(row, col + 1));
      if (right && (getElementDirections(right) & LEFT)) {
        result |= RIGHT;
      }
    }

    result |= this.getRailDirectionMask(col, gridConfig);

    const key = posKey(row, col);
    if (result === WireDirection.NONE) {
      this.directionCache.delete(key);
      return;
    }

    this.directionCache.set(key, result);
  }

  private getRailDirectionMask(col: number, gridConfig: LadderGridConfig): number {
    let result = WireDirection.NONE;
    if (col === 0) {
      result |= LEFT;
    }
    if (col === gridConfig.columns - 1) {
      result |= RIGHT;
    }
    return result;
  }
}
