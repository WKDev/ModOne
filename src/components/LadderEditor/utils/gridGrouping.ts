import type { LadderElement, LadderWire } from "../../../types/ladder";

/** Find a grid element by id across all row groups (shared by parallel-group
 *  detection here and AST reconstruction in gridToAst). */
export function findElementByWireEndpoint(
  elementId: string,
  rowGroups: RowGroups,
): LadderElement | null {
  for (const elements of rowGroups.values()) {
    const element = elements.find((e) => e.id === elementId);
    if (element) return element;
  }
  return null;
}

// ============================================================================
// Grid to AST Conversion Types
// ============================================================================

/** Parallel group detected from wire topology */
export interface ParallelGroup {
  /** Starting column of the parallel group */
  startColumn: number;
  /** Ending column of the parallel group */
  endColumn: number;
  /** Rows that are part of this parallel group */
  rows: number[];
}

/** Row groups - elements grouped by row and sorted by column */
export type RowGroups = Map<number, LadderElement[]>;

// ============================================================================
// Grid to AST Conversion Functions
// ============================================================================

/**
 * Group elements by row and sort by column within each row
 */
export function groupElementsByRow(
  elements: Map<string, LadderElement>
): RowGroups {
  const rows = new Map<number, LadderElement[]>();

  for (const element of Array.from(elements.values())) {
    // Skip wire and rail elements
    if (
      element.type.startsWith('wire_') ||
      element.type === 'power_rail' ||
      element.type === 'neutral_rail'
    ) {
      continue;
    }

    const row = element.position.row;
    if (!rows.has(row)) {
      rows.set(row, []);
    }
    rows.get(row)!.push(element);
  }

  // Sort elements in each row by column
  for (const [, elements] of rows) {
    elements.sort((a, b) => a.position.col - b.position.col);
  }

  return rows;
}

/**
 * Detect parallel groups from wire topology.
 * Accepts an optional `allElements` map to scan for wire_v/wire_junction elements
 * that are filtered out of `rowGroups` by `groupElementsByRow()`.
 */
export function detectParallelGroups(
  rowGroups: RowGroups,
  wires: LadderWire[],
  allElements?: Map<string, LadderElement>
): ParallelGroup[] {
  const groups: ParallelGroup[] = [];

  // Find vertical wires that indicate parallel connections
  const verticalWires = wires.filter((w) => w.type === 'vertical');

  // Phase 3.6: Also scan elements for wire_v and wire_junction types
  // This handles cases where vertical connections exist as grid elements
  // rather than LadderWire objects.
  // NOTE: We scan `allElements` (the full elements Map) because `rowGroups`
  // has wire_* elements filtered out by `groupElementsByRow()`.
  const columnWiresFromElements = new Map<number, Set<number>>();
  const elementsToScan = allElements ? allElements.values() : [];
  for (const el of elementsToScan) {
    if (el.type === 'wire_v' || el.type === 'wire_junction') {
      const col = el.position.col;
      const row = el.position.row;
      if (!columnWiresFromElements.has(col)) {
        columnWiresFromElements.set(col, new Set());
      }
      const s = columnWiresFromElements.get(col)!;
      // A vertical wire at (row, col) implies connections to row-1 and row+1
      s.add(row);
      if (row > 0) s.add(row - 1);
      s.add(row + 1);
    }
  }

  if ((verticalWires.length === 0 && columnWiresFromElements.size === 0) || rowGroups.size <= 1) {
    return groups;
  }

  // Get all rows from rowGroups
  const allRows = Array.from(rowGroups.keys()).sort((a, b) => a - b);

  if (allRows.length <= 1) {
    return groups;
  }

  // Build column-based wire map to find branching points
  const columnWires = new Map<number, Set<number>>();

  for (const wire of verticalWires) {
    // Find the column where this vertical wire exists by looking at connected elements
    // This is approximate - we look at element positions
    const fromElement = findElementByWireEndpoint(
      wire.from.elementId,
      rowGroups
    );
    const toElement = findElementByWireEndpoint(wire.to.elementId, rowGroups);

    if (fromElement && toElement) {
      const col = Math.min(fromElement.position.col, toElement.position.col);
      if (!columnWires.has(col)) {
        columnWires.set(col, new Set());
      }
      columnWires.get(col)!.add(fromElement.position.row);
      columnWires.get(col)!.add(toElement.position.row);
    }
  }

  // Phase 3.6: Merge element-based wire info into columnWires
  for (const [col, rows] of columnWiresFromElements) {
    if (!columnWires.has(col)) {
      columnWires.set(col, new Set());
    }
    const target = columnWires.get(col)!;
    for (const row of rows) {
      target.add(row);
    }
  }

  // Create parallel groups from connected rows
  for (const [col, connectedRows] of columnWires) {
    if (connectedRows.size >= 2) {
      const rowArray = Array.from(connectedRows).sort((a, b) => a - b);

      // Find the end column for this group (next branching point or max column)
      let endCol = col;
      for (const [otherCol] of columnWires) {
        if (otherCol > col) {
          endCol = otherCol;
          break;
        }
      }

      // Get max column from elements if no other branch point
      if (endCol === col) {
        for (const row of rowArray) {
          const elements = rowGroups.get(row);
          if (elements) {
            const maxElemCol = Math.max(...elements.map((e) => e.position.col));
            endCol = Math.max(endCol, maxElemCol);
          }
        }
      }

      groups.push({
        startColumn: col,
        endColumn: endCol,
        rows: rowArray,
      });
    }
  }

  return groups;
}

/**
 * Find element by wire endpoint element ID
 */
