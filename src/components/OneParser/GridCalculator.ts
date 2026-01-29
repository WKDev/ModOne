/**
 * GridCalculator - Grid Position Utilities for Ladder Visualization
 *
 * Provides utilities for working with network grid layouts including
 * dimension calculation, node lookup by position, and occupancy checks.
 */

import type { LadderNetwork, LadderNode, GridPosition } from './types';
import { isBlockNode } from './types';

/**
 * Grid calculator for ladder visualization
 *
 * Provides utilities for working with network grid layouts.
 */
export class GridCalculator {
  private gridWidth: number = 0;
  private gridHeight: number = 0;

  /**
   * Recalculate grid dimensions for a network
   * @param network - Network to calculate dimensions for
   * @returns Grid dimensions (width and height in cells)
   */
  recalculate(network: LadderNetwork): { width: number; height: number } {
    this.gridWidth = 0;
    this.gridHeight = 0;

    for (const node of network.nodes) {
      // Skip block containers, only count leaf nodes
      if (!isBlockNode(node)) {
        this.gridWidth = Math.max(this.gridWidth, node.gridPosition.col + 1);
        this.gridHeight = Math.max(this.gridHeight, node.gridPosition.row + 1);
      }
    }

    return { width: this.gridWidth, height: this.gridHeight };
  }

  /**
   * Get all nodes at a specific grid position
   * @param network - Network to search
   * @param row - Row index
   * @param col - Column index
   * @returns Array of nodes at the position (excluding block containers)
   */
  getNodesAt(network: LadderNetwork, row: number, col: number): LadderNode[] {
    return network.nodes.filter(
      (node) =>
        node.gridPosition.row === row &&
        node.gridPosition.col === col &&
        !isBlockNode(node)
    );
  }

  /**
   * Get the first node at a specific grid position
   * @param network - Network to search
   * @param row - Row index
   * @param col - Column index
   * @returns First node at position or undefined
   */
  getNodeAt(network: LadderNetwork, row: number, col: number): LadderNode | undefined {
    return this.getNodesAt(network, row, col)[0];
  }

  /**
   * Check if a grid cell is occupied
   * @param network - Network to check
   * @param row - Row index
   * @param col - Column index
   * @returns True if cell has at least one node
   */
  isOccupied(network: LadderNetwork, row: number, col: number): boolean {
    return this.getNodesAt(network, row, col).length > 0;
  }

  /**
   * Get all unique grid positions in a network
   * @param network - Network to extract positions from
   * @returns Array of unique GridPosition objects
   */
  getAllPositions(network: LadderNetwork): GridPosition[] {
    const positionSet = new Set<string>();
    const positions: GridPosition[] = [];

    for (const node of network.nodes) {
      if (!isBlockNode(node)) {
        const key = `${node.gridPosition.row},${node.gridPosition.col}`;
        if (!positionSet.has(key)) {
          positionSet.add(key);
          positions.push({ ...node.gridPosition });
        }
      }
    }

    return positions;
  }

  /**
   * Get the last calculated grid width
   * @returns Grid width in cells
   */
  getWidth(): number {
    return this.gridWidth;
  }

  /**
   * Get the last calculated grid height
   * @returns Grid height in cells
   */
  getHeight(): number {
    return this.gridHeight;
  }

  /**
   * Find nodes by type
   * @param network - Network to search
   * @param type - Node type to find
   * @returns Array of matching nodes
   */
  getNodesByType(network: LadderNetwork, type: LadderNode['type']): LadderNode[] {
    return network.nodes.filter((node) => node.type === type);
  }

  /**
   * Get all leaf nodes (non-block nodes) from a network
   * @param network - Network to extract from
   * @returns Array of leaf nodes
   */
  getLeafNodes(network: LadderNetwork): LadderNode[] {
    return network.nodes.filter((node) => !isBlockNode(node));
  }

  /**
   * Count nodes by row
   * @param network - Network to analyze
   * @returns Map of row index to node count
   */
  countNodesByRow(network: LadderNetwork): Map<number, number> {
    const counts = new Map<number, number>();

    for (const node of network.nodes) {
      if (!isBlockNode(node)) {
        const row = node.gridPosition.row;
        counts.set(row, (counts.get(row) || 0) + 1);
      }
    }

    return counts;
  }

  /**
   * Count nodes by column
   * @param network - Network to analyze
   * @returns Map of column index to node count
   */
  countNodesByCol(network: LadderNetwork): Map<number, number> {
    const counts = new Map<number, number>();

    for (const node of network.nodes) {
      if (!isBlockNode(node)) {
        const col = node.gridPosition.col;
        counts.set(col, (counts.get(col) || 0) + 1);
      }
    }

    return counts;
  }

  /**
   * Get bounding box for a set of nodes
   * @param nodes - Nodes to calculate bounds for
   * @returns Bounding box { minRow, maxRow, minCol, maxCol }
   */
  getBounds(nodes: LadderNode[]): {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  } {
    if (nodes.length === 0) {
      return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };
    }

    let minRow = Infinity;
    let maxRow = -Infinity;
    let minCol = Infinity;
    let maxCol = -Infinity;

    for (const node of nodes) {
      if (!isBlockNode(node)) {
        minRow = Math.min(minRow, node.gridPosition.row);
        maxRow = Math.max(maxRow, node.gridPosition.row);
        minCol = Math.min(minCol, node.gridPosition.col);
        maxCol = Math.max(maxCol, node.gridPosition.col);
      }
    }

    return {
      minRow: minRow === Infinity ? 0 : minRow,
      maxRow: maxRow === -Infinity ? 0 : maxRow,
      minCol: minCol === Infinity ? 0 : minCol,
      maxCol: maxCol === -Infinity ? 0 : maxCol,
    };
  }
}

export default GridCalculator;
