/**
 * Shared interaction rules for vertical-link edge hit-testing and highlighting.
 */

export interface VerticalWireHitTarget {
  targetCol: number;
  targetRow: number;
  isEdgeClick: boolean;
}

const MIN_VERTICAL_WIRE_HIT_SLOP = 12;
const MAX_VERTICAL_WIRE_HIT_SLOP = 20;
const VERTICAL_WIRE_HIT_RATIO = 0.24;
const VERTICAL_WIRE_HIGHLIGHT_WIDTH = 12;
const VERTICAL_WIRE_MIDLINE_RATIO = 0.65;

export function getVerticalWireHitSlop(cellWidth: number): number {
  const computed = Math.round(cellWidth * VERTICAL_WIRE_HIT_RATIO);
  return Math.max(MIN_VERTICAL_WIRE_HIT_SLOP, Math.min(MAX_VERTICAL_WIRE_HIT_SLOP, computed));
}

export function getVerticalWireHighlightWidth(): number {
  return VERTICAL_WIRE_HIGHLIGHT_WIDTH;
}

export function getVerticalWireMidline(cellHeight: number): number {
  return cellHeight * VERTICAL_WIRE_MIDLINE_RATIO;
}

export function resolveVerticalWireHitTarget(
  worldX: number,
  worldY: number,
  gridCol: number,
  gridRow: number,
  cellWidth: number,
  cellHeight: number
): VerticalWireHitTarget {
  const edgeThreshold = getVerticalWireHitSlop(cellWidth);
  const distToLeft = worldX - gridCol * cellWidth;
  const distToRight = (gridCol + 1) * cellWidth - worldX;

  let targetCol = gridCol;
  let isEdgeClick = false;

  if (distToLeft <= edgeThreshold) {
    targetCol = gridCol;
    isEdgeClick = true;
  } else if (distToRight <= edgeThreshold) {
    targetCol = gridCol + 1;
    isEdgeClick = true;
  }

  const localY = worldY - gridRow * cellHeight;
  const midY = getVerticalWireMidline(cellHeight);
  const targetRow = Math.max(1, localY >= midY ? gridRow + 1 : gridRow);

  return { targetCol, targetRow, isEdgeClick };
}

export function getVerticalWireSegmentDistance(
  worldY: number,
  wireRow: number,
  cellHeight: number,
): number {
  const centerY = (wireRow - 1) * cellHeight + getVerticalWireMidline(cellHeight);
  return distanceToRange(worldY, centerY, centerY + cellHeight);
}

function distanceToRange(value: number, start: number, end: number): number {
  if (value < start) return start - value;
  if (value > end) return value - end;
  return 0;
}
