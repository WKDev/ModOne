import { GridConfig } from '../types/panel';
import { DropPosition } from '../types/dnd';

/**
 * Parse a CSS grid-area value into its components
 * Format: "row-start / col-start / row-end / col-end"
 */
export function parseGridArea(gridArea: string): {
  rowStart: number;
  colStart: number;
  rowEnd: number;
  colEnd: number;
} {
  const parts = gridArea.split('/').map((p) => parseInt(p.trim(), 10));
  return {
    rowStart: parts[0] || 1,
    colStart: parts[1] || 1,
    rowEnd: parts[2] || 2,
    colEnd: parts[3] || 2,
  };
}

/**
 * Create a CSS grid-area value from components
 */
export function createGridArea(
  rowStart: number,
  colStart: number,
  rowEnd: number,
  colEnd: number
): string {
  return `${rowStart} / ${colStart} / ${rowEnd} / ${colEnd}`;
}

/**
 * Split a grid horizontally (creates new row)
 */
export function splitGridHorizontal(
  gridConfig: GridConfig,
  targetArea: string,
  position: 'top' | 'bottom'
): {
  newGridConfig: GridConfig;
  newArea: string;
  updatedTargetArea: string;
} {
  const target = parseGridArea(targetArea);
  const newRows = [...gridConfig.rows];

  // Insert new row
  const insertIndex = position === 'top' ? target.rowStart - 1 : target.rowEnd - 1;
  newRows.splice(insertIndex, 0, '1fr');

  // Calculate new areas
  let newArea: string;
  let updatedTargetArea: string;

  if (position === 'top') {
    // New panel goes above, target moves down
    newArea = createGridArea(target.rowStart, target.colStart, target.rowStart + 1, target.colEnd);
    updatedTargetArea = createGridArea(target.rowStart + 1, target.colStart, target.rowEnd + 1, target.colEnd);
  } else {
    // New panel goes below
    newArea = createGridArea(target.rowEnd, target.colStart, target.rowEnd + 1, target.colEnd);
    updatedTargetArea = targetArea; // Target stays in place
  }

  return {
    newGridConfig: {
      ...gridConfig,
      rows: newRows,
    },
    newArea,
    updatedTargetArea,
  };
}

/**
 * Split a grid vertically (creates new column)
 */
export function splitGridVertical(
  gridConfig: GridConfig,
  targetArea: string,
  position: 'left' | 'right'
): {
  newGridConfig: GridConfig;
  newArea: string;
  updatedTargetArea: string;
} {
  const target = parseGridArea(targetArea);
  const newColumns = [...gridConfig.columns];

  // Insert new column
  const insertIndex = position === 'left' ? target.colStart - 1 : target.colEnd - 1;
  newColumns.splice(insertIndex, 0, '1fr');

  // Calculate new areas
  let newArea: string;
  let updatedTargetArea: string;

  if (position === 'left') {
    // New panel goes left, target moves right
    newArea = createGridArea(target.rowStart, target.colStart, target.rowEnd, target.colStart + 1);
    updatedTargetArea = createGridArea(target.rowStart, target.colStart + 1, target.rowEnd, target.colEnd + 1);
  } else {
    // New panel goes right
    newArea = createGridArea(target.rowStart, target.colEnd, target.rowEnd, target.colEnd + 1);
    updatedTargetArea = targetArea; // Target stays in place
  }

  return {
    newGridConfig: {
      ...gridConfig,
      columns: newColumns,
    },
    newArea,
    updatedTargetArea,
  };
}

/**
 * Split grid based on drop position
 */
export function splitGrid(
  gridConfig: GridConfig,
  targetArea: string,
  dropPosition: DropPosition
): {
  newGridConfig: GridConfig;
  newArea: string;
  updatedTargetArea: string;
} | null {
  switch (dropPosition) {
    case 'top':
    case 'bottom':
      return splitGridHorizontal(gridConfig, targetArea, dropPosition);
    case 'left':
    case 'right':
      return splitGridVertical(gridConfig, targetArea, dropPosition);
    case 'center':
      // Center means merge as tabs, not a grid split
      return null;
    default:
      return null;
  }
}

/**
 * Update all panel grid areas after a grid modification
 * Shifts areas that are affected by the insertion
 */
export function shiftGridAreas(
  areas: string[],
  insertType: 'row' | 'column',
  insertIndex: number
): string[] {
  return areas.map((area) => {
    const parsed = parseGridArea(area);

    if (insertType === 'row') {
      // Shift rows at or after insertIndex
      const rowStart = parsed.rowStart > insertIndex ? parsed.rowStart + 1 : parsed.rowStart;
      const rowEnd = parsed.rowEnd > insertIndex ? parsed.rowEnd + 1 : parsed.rowEnd;
      return createGridArea(rowStart, parsed.colStart, rowEnd, parsed.colEnd);
    } else {
      // Shift columns at or after insertIndex
      const colStart = parsed.colStart > insertIndex ? parsed.colStart + 1 : parsed.colStart;
      const colEnd = parsed.colEnd > insertIndex ? parsed.colEnd + 1 : parsed.colEnd;
      return createGridArea(parsed.rowStart, colStart, parsed.rowEnd, colEnd);
    }
  });
}

/**
 * Remove empty rows/columns from grid config after panel removal
 */
export function collapseEmptyGridAreas(
  gridConfig: GridConfig,
  usedAreas: string[]
): GridConfig {
  const usedRows = new Set<number>();
  const usedCols = new Set<number>();

  // Find all used rows and columns
  usedAreas.forEach((area) => {
    const parsed = parseGridArea(area);
    for (let r = parsed.rowStart; r < parsed.rowEnd; r++) {
      usedRows.add(r);
    }
    for (let c = parsed.colStart; c < parsed.colEnd; c++) {
      usedCols.add(c);
    }
  });

  // Keep only used rows and columns
  const newRows = gridConfig.rows.filter((_, i) => usedRows.has(i + 1));
  const newColumns = gridConfig.columns.filter((_, i) => usedCols.has(i + 1));

  return {
    rows: newRows.length > 0 ? newRows : ['1fr'],
    columns: newColumns.length > 0 ? newColumns : ['1fr'],
  };
}

/**
 * Calculate minimum panel size check
 */
export function canSplit(
  containerSize: { width: number; height: number },
  gridConfig: GridConfig,
  dropPosition: DropPosition,
  minPanelSize: number = 150
): boolean {
  const rowCount = gridConfig.rows.length + (dropPosition === 'top' || dropPosition === 'bottom' ? 1 : 0);
  const colCount = gridConfig.columns.length + (dropPosition === 'left' || dropPosition === 'right' ? 1 : 0);

  const avgRowHeight = containerSize.height / rowCount;
  const avgColWidth = containerSize.width / colCount;

  return avgRowHeight >= minPanelSize && avgColWidth >= minPanelSize;
}
