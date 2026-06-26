import type {
  LadderElement, LadderGridConfig, GridPosition, WireType, WireProperties, VerticalLinkEntity,
} from "../../../types/ladder";
import { isRailType, isWireType } from "../../../types/ladder";
import type { ConnectivityGraph } from "./connectivityGraph";
import {
  getElementAtPosition, analyzeNeighborDirections, getElementDirections, DIRECTION_TO_WIRE_TYPE,
} from "./wireDirections";
import { getBaseWireDirections, componentTypeToWireType } from "./wireTypeResolution";
import type { ResolvedWireType } from "./wireTypeResolution";

// ============================================================================
// Phase 3.1: findParallelBranches()
// ============================================================================

/** A detected parallel branch region */
export interface ParallelBranch {
  /** Column where parallel elements are aligned */
  column: number;
  /** First row of the branch region */
  startRow: number;
  /** Last row of the branch region */
  endRow: number;
  /** Rows that have elements in this column */
  branchRows: number[];
}

/**
 * Check whether two rows share a common horizontal wire path,
 * indicating they belong to the same rung group (not independent rungs).
 * Rows are considered connected if there exists a column where both rows
 * have elements that share horizontal connectivity (either directly adjacent
 * or connected through horizontal wires).
 */
export function rowsShareHorizontalPath(
  row1: number,
  row2: number,
  elements: LadderElement[],
  targetCol: number
): boolean {
  // Check if there's a vertical wire or junction connecting these rows at the target column
  for (const el of elements) {
    if (!isWireType(el.type)) continue;
    if (el.position.col !== targetCol) continue;

    // A vertical wire between the two rows indicates a connection
    if (el.type === 'wire_v' || el.type === 'wire_junction') {
      const minRow = Math.min(row1, row2);
      const maxRow = Math.max(row1, row2);
      if (el.position.row > minRow && el.position.row < maxRow) {
        return true;
      }
    }
  }

  // Check adjacent columns for shared structure
  // If elements on both rows exist and share a common adjacent column, they're related
  const row1Cols = new Set<number>();
  const row2Cols = new Set<number>();
  for (const el of elements) {
    if (isRailType(el.type) || isWireType(el.type)) continue;
    if (el.position.row === row1) row1Cols.add(el.position.col);
    if (el.position.row === row2) row2Cols.add(el.position.col);
  }

  // If both rows have elements in multiple shared columns, they're likely parallel branches
  let sharedColCount = 0;
  for (const col of row1Cols) {
    if (row2Cols.has(col)) sharedColCount++;
  }
  return sharedColCount >= 2;
}

/**
 * Detect columns where multiple logic elements are vertically aligned,
 * indicating parallel branches that need vertical wire connections.
 * Includes connectivity verification to avoid false positives from
 * unrelated rungs sharing the same column.
 */
export function findParallelBranches(
  elements: LadderElement[],
  _gridConfig: LadderGridConfig
): ParallelBranch[] {
  // Group logic elements by column
  const columnMap = new Map<number, number[]>(); // col → rows[]

  for (const el of elements) {
    if (isRailType(el.type) || isWireType(el.type)) continue;
    const col = el.position.col;
    if (!columnMap.has(col)) {
      columnMap.set(col, []);
    }
    columnMap.get(col)!.push(el.position.row);
  }

  const branches: ParallelBranch[] = [];

  for (const [col, rows] of columnMap) {
    if (rows.length < 2) continue;

    const sorted = rows.sort((a, b) => a - b);

    // Verify connectivity: check that rows are actually part of the same
    // parallel branch structure, not independent rungs at the same column
    const connectedRows: number[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prevRow = sorted[i - 1];
      const currRow = sorted[i];

      // Adjacent rows (gap ≤ 1) are assumed connected
      // Rows with gap > 1 must have verified connectivity
      if (currRow - prevRow <= 1 || rowsShareHorizontalPath(prevRow, currRow, elements, col)) {
        connectedRows.push(currRow);
      }
    }

    if (connectedRows.length >= 2) {
      branches.push({
        column: col,
        startRow: connectedRows[0],
        endRow: connectedRows[connectedRows.length - 1],
        branchRows: connectedRows,
      });
    }
  }

  return branches;
}

// ============================================================================
// Phase 3.2: generateVerticalWireSegments()
// ============================================================================

/** A wire segment to be placed on the grid */
export interface WirePlacement {
  type: WireType;
  position: GridPosition;
  direction?: string;
}

/**
 * Generate vertical wire segments to fill gaps between parallel branch rows.
 * Only generates segments for empty cells.
 */
export function generateVerticalWireSegments(
  branch: ParallelBranch,
  existingElements: Map<string, LadderElement>
): WirePlacement[] {
  const placements: WirePlacement[] = [];

  for (let row = branch.startRow; row <= branch.endRow; row++) {
    // Skip rows that already have elements
    if (branch.branchRows.includes(row)) continue;

    const existing = getElementAtPosition(row, branch.column, existingElements);
    if (existing) continue;

    placements.push({
      type: 'wire_v',
      position: { row, col: branch.column },
    });
  }

  return placements;
}

// ============================================================================
// Phase 3.3: generateJunctionAtBranchPoint()
// ============================================================================

/**
 * Determine if a branch point needs a junction element, and if so what kind.
 * Returns the wire type/direction to use, or null if no change needed.
 */
export function generateJunctionAtBranchPoint(
  branchPoint: GridPosition,
  elements: Map<string, LadderElement>,
  gridConfig: LadderGridConfig,
  graph?: ConnectivityGraph,
  verticalLinks?: Map<string, VerticalLinkEntity>
): ResolvedWireType | null {
  const existing = getElementAtPosition(branchPoint.row, branchPoint.col, elements);

  // Analyze what directions connect at this point
  const neighborDirs = analyzeNeighborDirections(branchPoint, elements, gridConfig, graph, verticalLinks);

  // If the cell has an existing element, combine its base directions with neighbors
  let combined: number;
  if (existing && isWireType(existing.type)) {
    combined = getBaseWireDirections(existing.type) | neighborDirs;
  } else if (existing) {
    // Logic element — combine its directions with neighbors
    combined = getElementDirections(existing) | neighborDirs;
  } else {
    // Empty cell — just use neighbor directions
    combined = neighborDirs;
  }

  const newComponentType = DIRECTION_TO_WIRE_TYPE[combined];
  if (!newComponentType) return null;

  const resolved = componentTypeToWireType(newComponentType);

  // Check if already correct
  if (existing && isWireType(existing.type)) {
    const currentDirection = (existing.properties as WireProperties).direction;
    if (resolved.type === existing.type && resolved.direction === currentDirection) {
      return null; // No change needed
    }
  }

  return resolved;
}

