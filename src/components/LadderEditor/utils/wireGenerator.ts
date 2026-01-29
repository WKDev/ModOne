/**
 * Wire Generator Utility
 *
 * Automatically generates wire connections between ladder elements
 * based on their positions and types.
 */

import type {
  LadderElement,
  LadderWire,
  LadderGridConfig,
  GridPosition,
} from '../../../types/ladder';
import { isCoilType, isRailType } from '../../../types/ladder';
import type { WireType as WireComponentType } from '../elements/Wire';

/** Port type for connection validation */
export type PortType = 'input' | 'output' | 'both';

/** Port position for connection points */
export type PortPosition = 'left' | 'right' | 'top' | 'bottom';

/** Connection point on an element */
export interface ConnectionPoint {
  /** Position relative to element (left, right, top, bottom) */
  position: PortPosition;
  /** Type of port (input accepts connections, output provides connections) */
  type: PortType;
  /** Grid position of the element */
  gridPosition: GridPosition;
  /** Element ID */
  elementId: string;
}

/** Wire routing segment */
interface WireSegment {
  type: WireComponentType;
  position: GridPosition;
  isEnergized?: boolean;
}

/**
 * Get connection points for an element based on its type
 */
export function getConnectionPoints(element: LadderElement): ConnectionPoint[] {
  const points: ConnectionPoint[] = [];
  const { id, type, position } = element;

  // Rail elements don't have normal connection points
  if (isRailType(type)) {
    return points;
  }

  // Coil elements have input only (on left)
  if (isCoilType(type)) {
    points.push({
      position: 'left',
      type: 'input',
      gridPosition: position,
      elementId: id,
    });
    return points;
  }

  // Timer and counter elements have multiple connection points
  if (type.startsWith('timer_') || type.startsWith('counter_')) {
    // Left side inputs
    points.push({
      position: 'left',
      type: 'input',
      gridPosition: position,
      elementId: id,
    });
    // Right side output
    points.push({
      position: 'right',
      type: 'output',
      gridPosition: position,
      elementId: id,
    });
    return points;
  }

  // Contact and other elements have both input (left) and output (right)
  points.push(
    {
      position: 'left',
      type: 'input',
      gridPosition: position,
      elementId: id,
    },
    {
      position: 'right',
      type: 'output',
      gridPosition: position,
      elementId: id,
    }
  );

  return points;
}

/**
 * Validate that a connection between two elements is valid
 */
export function validateConnection(
  fromElement: LadderElement,
  toElement: LadderElement,
  fromPort: PortPosition,
  toPort: PortPosition
): { valid: boolean; reason?: string } {
  const fromPoints = getConnectionPoints(fromElement);
  const toPoints = getConnectionPoints(toElement);

  const fromPoint = fromPoints.find(p => p.position === fromPort);
  const toPoint = toPoints.find(p => p.position === toPort);

  if (!fromPoint) {
    return { valid: false, reason: `Source element has no ${fromPort} port` };
  }

  if (!toPoint) {
    return { valid: false, reason: `Target element has no ${toPort} port` };
  }

  // Output to output is invalid
  if (fromPoint.type === 'output' && toPoint.type === 'output') {
    return { valid: false, reason: 'Cannot connect output to output' };
  }

  // Typically we want output -> input connections
  if (fromPoint.type !== 'output' && fromPoint.type !== 'both') {
    return { valid: false, reason: 'Source port must be an output' };
  }

  if (toPoint.type !== 'input' && toPoint.type !== 'both') {
    return { valid: false, reason: 'Target port must be an input' };
  }

  return { valid: true };
}

/**
 * Generate wire segments for a single horizontal connection
 */
function generateHorizontalWire(
  startCol: number,
  endCol: number,
  row: number
): WireSegment[] {
  const segments: WireSegment[] = [];

  for (let col = startCol; col < endCol; col++) {
    segments.push({
      type: 'horizontal',
      position: { row, col },
    });
  }

  return segments;
}

/**
 * Generate wire segments for a vertical connection
 */
export function generateVerticalWire(
  col: number,
  startRow: number,
  endRow: number
): WireSegment[] {
  const segments: WireSegment[] = [];

  const [minRow, maxRow] = startRow < endRow ? [startRow, endRow] : [endRow, startRow];

  for (let row = minRow; row <= maxRow; row++) {
    segments.push({
      type: 'vertical',
      position: { row, col },
    });
  }

  return segments;
}

/**
 * Generate wires to connect elements on the same row
 */
function connectElementsOnRow(
  elements: LadderElement[],
  row: number,
  maxCol: number
): WireSegment[] {
  const segments: WireSegment[] = [];

  // Sort elements by column
  const rowElements = elements
    .filter(e => e.position.row === row && !isRailType(e.type))
    .sort((a, b) => a.position.col - b.position.col);

  if (rowElements.length === 0) return segments;

  // Connect from power rail (col -1) to first element
  const firstElement = rowElements[0];
  if (firstElement.position.col > 0) {
    segments.push(...generateHorizontalWire(0, firstElement.position.col, row));
  }

  // Connect between adjacent elements
  for (let i = 0; i < rowElements.length - 1; i++) {
    const current = rowElements[i];
    const next = rowElements[i + 1];
    const gap = next.position.col - current.position.col;

    if (gap > 1) {
      segments.push(...generateHorizontalWire(
        current.position.col + 1,
        next.position.col,
        row
      ));
    }
  }

  // Connect last element to neutral rail (if it's an output)
  const lastElement = rowElements[rowElements.length - 1];
  if (isCoilType(lastElement.type) && lastElement.position.col < maxCol - 1) {
    segments.push(...generateHorizontalWire(
      lastElement.position.col + 1,
      maxCol,
      row
    ));
  }

  return segments;
}

/**
 * Generate all wires for a set of elements
 */
export function generateWires(
  elements: LadderElement[],
  gridConfig: LadderGridConfig
): LadderWire[] {
  const wires: LadderWire[] = [];
  const wireSegments: WireSegment[] = [];
  const occupiedCells = new Map<string, string>(); // "row-col" -> elementId

  // Build occupied cells map
  elements.forEach(e => {
    if (!isRailType(e.type)) {
      const key = `${e.position.row}-${e.position.col}`;
      occupiedCells.set(key, e.id);
    }
  });

  // Find all unique rows
  const rows = new Set<number>();
  elements.forEach(e => {
    if (!isRailType(e.type)) {
      rows.add(e.position.row);
    }
  });

  // Generate horizontal connections for each row
  rows.forEach(row => {
    const rowSegments = connectElementsOnRow(elements, row, gridConfig.columns);

    // Filter out segments that overlap with elements
    rowSegments.forEach(segment => {
      const key = `${segment.position.row}-${segment.position.col}`;
      if (!occupiedCells.has(key)) {
        wireSegments.push(segment);
      }
    });
  });

  // TODO: Add parallel branch detection and vertical wire generation
  // This would require analyzing the AST structure to identify branches

  // Convert wire segments to LadderWire objects
  wireSegments.forEach((segment, index) => {
    wires.push({
      id: `wire_${index}`,
      from: {
        elementId: 'auto',
        port: 'right',
      },
      to: {
        elementId: 'auto',
        port: 'left',
      },
      type: mapWireSegmentType(segment.type),
      energized: segment.isEnergized,
    });
  });

  return wires;
}

/**
 * Map component wire type to ladder wire type
 */
function mapWireSegmentType(type: WireComponentType): 'horizontal' | 'vertical' | 'corner' {
  if (type === 'horizontal') return 'horizontal';
  if (type === 'vertical') return 'vertical';
  return 'corner';
}

/**
 * Get the appropriate wire type for connecting two positions
 */
export function getWireTypeForConnection(
  from: GridPosition,
  to: GridPosition,
  _prevDirection?: 'horizontal' | 'vertical',
  _nextDirection?: 'horizontal' | 'vertical'
): WireComponentType {
  const isHorizontal = from.row === to.row;
  const isVertical = from.col === to.col;

  if (isHorizontal && isVertical) {
    // Same position - should not happen
    return 'horizontal';
  }

  if (isHorizontal) {
    return 'horizontal';
  }

  if (isVertical) {
    return 'vertical';
  }

  // Diagonal - need corner
  const goingRight = to.col > from.col;
  const goingDown = to.row > from.row;

  if (goingRight && goingDown) return 'corner_tl';
  if (goingRight && !goingDown) return 'corner_bl';
  if (!goingRight && goingDown) return 'corner_tr';
  return 'corner_br';
}

/**
 * Calculate wire segments for a path between two points
 */
export function calculateWirePath(
  from: GridPosition,
  to: GridPosition,
  occupiedCells: Set<string>
): WireSegment[] {
  const segments: WireSegment[] = [];

  // Simple L-shaped routing
  // First go horizontal, then vertical
  const midCol = to.col;

  // Horizontal segment
  if (from.col !== midCol) {
    const direction = from.col < midCol ? 1 : -1;
    for (let col = from.col; col !== midCol; col += direction) {
      const key = `${from.row}-${col}`;
      if (!occupiedCells.has(key)) {
        segments.push({
          type: col === from.col || col === midCol - direction ? 'horizontal' : 'horizontal',
          position: { row: from.row, col },
        });
      }
    }
  }

  // Corner if needed
  if (from.row !== to.row && from.col !== to.col) {
    const goingDown = to.row > from.row;
    segments.push({
      type: goingDown ? 'corner_tl' : 'corner_bl',
      position: { row: from.row, col: midCol },
    });
  }

  // Vertical segment
  if (from.row !== to.row) {
    const direction = from.row < to.row ? 1 : -1;
    for (let row = from.row + direction; row !== to.row; row += direction) {
      const key = `${row}-${midCol}`;
      if (!occupiedCells.has(key)) {
        segments.push({
          type: 'vertical',
          position: { row, col: midCol },
        });
      }
    }
  }

  return segments;
}

export default {
  generateWires,
  getConnectionPoints,
  validateConnection,
  getWireTypeForConnection,
  calculateWirePath,
};
