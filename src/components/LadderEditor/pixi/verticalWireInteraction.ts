/**
 * Shared hit-testing and highlight geometry for the dual-lattice ladder editor.
 */

export interface VerticalWireHitTarget {
  targetCol: number;
  targetRow: number;
  isEdgeClick: boolean;
}

export interface HorizontalWireHitTarget {
  row: number;
  col: number;
  isEdgeClick: boolean;
}

const MIN_VERTICAL_WIRE_HIT_SLOP = 12;
const MAX_VERTICAL_WIRE_HIT_SLOP = 20;
const VERTICAL_WIRE_HIT_RATIO = 0.24;
const VERTICAL_WIRE_HIGHLIGHT_WIDTH = 12;
const HORIZONTAL_WIRE_HIT_SLOP = 10;
const HORIZONTAL_WIRE_HIGHLIGHT_HEIGHT = 10;
const MIDLINE_RATIO = 0.65;

export function getVerticalWireHitSlop(cellWidth: number): number {
  const computed = Math.round(cellWidth * VERTICAL_WIRE_HIT_RATIO);
  return Math.max(MIN_VERTICAL_WIRE_HIT_SLOP, Math.min(MAX_VERTICAL_WIRE_HIT_SLOP, computed));
}

export function getVerticalWireHighlightWidth(): number {
  return VERTICAL_WIRE_HIGHLIGHT_WIDTH;
}

export function getHorizontalWireHighlightHeight(): number {
  return HORIZONTAL_WIRE_HIGHLIGHT_HEIGHT;
}

export function getVerticalWireMidline(cellHeight: number): number {
  return cellHeight * MIDLINE_RATIO;
}

export function getHorizontalWireMidline(cellHeight: number): number {
  return cellHeight * MIDLINE_RATIO;
}

export function resolveVerticalWireHitTarget(
  worldX: number,
  worldY: number,
  gridCol: number,
  gridRow: number,
  cellWidth: number,
  cellHeight: number,
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
  const targetRow = Math.max(0, localY >= midY ? gridRow : gridRow - 1);

  return { targetCol, targetRow, isEdgeClick };
}

export function resolveHorizontalWireHitTarget(
  worldY: number,
  _gridCol: number,
  gridRow: number,
  cellHeight: number,
): HorizontalWireHitTarget {
  const localY = worldY - gridRow * cellHeight;
  const midY = getHorizontalWireMidline(cellHeight);
  const isEdgeClick = Math.abs(localY - midY) <= HORIZONTAL_WIRE_HIT_SLOP;
  return {
    row: gridRow,
    col: _gridCol,
    isEdgeClick,
  };
}

export function getVerticalWireSegmentDistance(
  worldY: number,
  wireRow: number,
  cellHeight: number,
): number {
  const centerY = wireRow * cellHeight + getVerticalWireMidline(cellHeight);
  return distanceToRange(worldY, centerY, centerY + cellHeight);
}

export function getHorizontalWireSegmentDistance(
  worldX: number,
  cellCol: number,
  cellWidth: number,
): number {
  return distanceToRange(worldX, cellCol * cellWidth, (cellCol + 1) * cellWidth);
}

function distanceToRange(value: number, start: number, end: number): number {
  if (value < start) return start - value;
  if (value > end) return value - end;
  return 0;
}
