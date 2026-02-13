/**
 * Wire Generator Utility
 *
 * Automatically generates wire connections between ladder elements
 * based on their positions and types.
 */

import type {
  LadderElement,
  LadderElementType,
  LadderWire,
  LadderGridConfig,
  GridPosition,
  WireType,
  WireProperties,
} from '../../../types/ladder';
import { isCoilType, isRailType, isWireType, WireDirection } from '../../../types/ladder';
import type { WireType as WireComponentType } from '../elements/Wire';
import type { ConnectivityGraph } from './connectivityGraph';

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
 * Generate all wires for a set of elements.
 *
 * @deprecated This function is not used. The editor uses wire-as-element
 * (wire_h, wire_v, wire_corner, wire_junction elements in the elements Map)
 * rather than LadderWire[] objects. The `data.wires` array is always empty.
 * This function is kept temporarily for reference but should be removed
 * in a future cleanup pass.
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

  // Detect parallel branches and generate vertical wires
  const branches = findParallelBranches(elements, gridConfig);

  for (const branch of branches) {
    // Generate vertical wire segments for gaps between branch rows
    const elementsMap = new Map<string, LadderElement>();
    elements.forEach(el => {
      elementsMap.set(`${el.position.row}-${el.position.col}`, el);
    });

    const vertSegments = generateVerticalWireSegments(branch, elementsMap);
    for (const seg of vertSegments) {
      const key = `${seg.position.row}-${seg.position.col}`;
      if (!occupiedCells.has(key)) {
        wireSegments.push({
          type: 'vertical',
          position: seg.position,
        });
      }
    }

    // Generate junction at branch start/end points
    for (const branchRow of branch.branchRows) {
      const junctionResult = generateJunctionAtBranchPoint(
        { row: branchRow, col: branch.column },
        elementsMap,
        gridConfig
      );
      if (junctionResult) {
        const junctionKey = `${branchRow}-${branch.column}`;
        if (!occupiedCells.has(junctionKey)) {
          wireSegments.push({
            type: (junctionResult.direction ?? 'junction_t') as WireComponentType,
            position: { row: branchRow, col: branch.column },
          });
        }
      }
    }
  }

  // Convert wire segments to LadderWire objects
  wireSegments.forEach((segment, index) => {
    const mappedType = mapWireSegmentType(segment.type);
    const wire: LadderWire = {
      id: `wire_${index}`,
      from: {
        elementId: 'auto',
        port: segment.type === 'vertical' ? 'bottom' : 'right',
      },
      to: {
        elementId: 'auto',
        port: segment.type === 'vertical' ? 'top' : 'left',
      },
      type: mappedType,
      energized: segment.isEnergized,
    };

    // Add junctionDirection for junction types
    if (mappedType === 'junction' && segment.type.startsWith('junction_')) {
      wire.junctionDirection = segment.type as 'junction_t' | 'junction_b' | 'junction_l' | 'junction_r';
    }

    wires.push(wire);
  });

  return wires;
}

/**
 * Map component wire type to ladder wire type
 */
function mapWireSegmentType(type: WireComponentType): LadderWire['type'] {
  if (type === 'horizontal') return 'horizontal';
  if (type === 'vertical') return 'vertical';
  if (type === 'cross') return 'cross';
  if (type.startsWith('junction_')) return 'junction';
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
          type: 'horizontal',
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

// ============================================================================
// Phase 1.2: Direction → WireComponentType Mapping Table
// ============================================================================

const { TOP, BOTTOM, LEFT, RIGHT } = WireDirection;

/**
 * Maps a WireDirection bitmask to the corresponding WireComponentType.
 * Covers:
 * - 4 single-direction cases (dead-end / stub wires)
 * - 6 two-direction combinations (straight + corner)
 * - 4 three-direction combinations (T-junctions)
 * - 1 four-direction combination (cross)
 */
const DIRECTION_TO_WIRE_TYPE: Record<number, WireComponentType> = {
  // Single-direction (dead-end stubs — render as nearest straight wire)
  [LEFT]:                        'horizontal',
  [RIGHT]:                       'horizontal',
  [TOP]:                         'vertical',
  [BOTTOM]:                      'vertical',
  // Two-direction (straight + corner)
  [LEFT | RIGHT]:                'horizontal',
  [TOP | BOTTOM]:                'vertical',
  [LEFT | BOTTOM]:               'corner_tl',
  [RIGHT | BOTTOM]:              'corner_tr',
  [LEFT | TOP]:                  'corner_bl',
  [RIGHT | TOP]:                 'corner_br',
  // Three-direction (T-junctions)
  [LEFT | RIGHT | BOTTOM]:       'junction_t',
  [LEFT | RIGHT | TOP]:          'junction_b',
  [TOP | BOTTOM | RIGHT]:        'junction_l',
  [TOP | BOTTOM | LEFT]:         'junction_r',
  // Four-direction (cross)
  [TOP | BOTTOM | LEFT | RIGHT]: 'cross',
};

/**
 * Resolve a WireDirection bitmask to a WireComponentType.
 * Falls back to 'horizontal' for unmapped combinations.
 */
export function resolveWireTypeFromDirections(directions: number): WireComponentType {
  // Validate bitmask range: valid values are 0-15 (4 bits: TOP|BOTTOM|LEFT|RIGHT)
  if (directions < 0 || directions > 15) {
    console.warn(`[wireGenerator] Invalid direction bitmask: ${directions}, expected 0-15. Falling back to horizontal.`);
    return 'horizontal';
  }
  return DIRECTION_TO_WIRE_TYPE[directions] ?? 'horizontal';
}

/** Export the mapping table for external use / testing */
export { DIRECTION_TO_WIRE_TYPE };

// ============================================================================
// Phase 1.3: getElementDirections()
// ============================================================================

/** Map from wire_corner/wire_junction direction property to bitmask */
const WIRE_DIRECTION_PROPERTY_MAP: Record<string, number> = {
  corner_tl:  LEFT | BOTTOM,
  corner_tr:  RIGHT | BOTTOM,
  corner_bl:  LEFT | TOP,
  corner_br:  RIGHT | TOP,
  junction_t: LEFT | RIGHT | BOTTOM,
  junction_b: LEFT | RIGHT | TOP,
  junction_l: TOP | BOTTOM | RIGHT,
  junction_r: TOP | BOTTOM | LEFT,
  cross:      TOP | BOTTOM | LEFT | RIGHT,
};

/**
 * Returns the WireDirection bitmask for a given LadderElement,
 * indicating which directions this element connects to.
 */
export function getElementDirections(element: LadderElement): number {
  const { type } = element;

  // Wire elements
  if (type === 'wire_h') return LEFT | RIGHT;
  if (type === 'wire_v') return TOP | BOTTOM;

  if (type === 'wire_corner' || type === 'wire_junction') {
    const props = element.properties as WireProperties;
    const dir = props.direction;
    if (dir && WIRE_DIRECTION_PROPERTY_MAP[dir] !== undefined) {
      return WIRE_DIRECTION_PROPERTY_MAP[dir];
    }
    if (dir) {
      console.warn(`[wireGenerator] Unknown wire direction "${dir}" for ${type}, using default`);
    }
    // Defaults
    return type === 'wire_corner' ? (LEFT | BOTTOM) : (LEFT | RIGHT | BOTTOM);
  }

  // Rail elements
  if (type === 'power_rail') return RIGHT;
  if (type === 'neutral_rail') return LEFT;

  // All logic elements (contact, coil, timer, counter, compare) connect left-right
  return LEFT | RIGHT;
}

// ============================================================================
// Phase 1.4 + 2.5: analyzeNeighborDirections()
// ============================================================================

/**
 * Build a position-keyed index for O(1) lookups.
 * Call once before batch neighbor analysis operations.
 */
function buildPositionIndex(elements: Map<string, LadderElement>): Map<string, LadderElement> {
  const index = new Map<string, LadderElement>();
  for (const el of elements.values()) {
    index.set(`${el.position.row}-${el.position.col}`, el);
  }
  return index;
}

/**
 * Helper: look up element at a grid position.
 * Accepts either a position index (O(1)) or elements Map (O(n) fallback).
 */
function getElementAtPosition(
  row: number,
  col: number,
  elements: Map<string, LadderElement>
): LadderElement | undefined {
  // If elements is already a position index (key format "row-col"), use O(1) lookup
  const key = `${row}-${col}`;
  const directHit = elements.get(key);
  if (directHit) return directHit;

  // Fallback: linear scan for when elements is the id-keyed Map
  for (const el of elements.values()) {
    if (el.position.row === row && el.position.col === col) return el;
  }
  return undefined;
}

/**
 * Analyze the 4-directional neighbors of a cell and return a bitmask
 * of which directions have incoming connections to this cell.
 *
 * Also handles implicit rail connections at grid edges (Phase 2.5):
 * - col === 0 → LEFT (PowerRail)
 * - col === columns-1 → RIGHT (NeutralRail)
 *
 * When a ConnectivityGraph is provided (Phase 5), delegates to O(1) lookups
 * instead of iterating all elements.
 */
export function analyzeNeighborDirections(
  position: GridPosition,
  elements: Map<string, LadderElement>,
  gridConfig: LadderGridConfig,
  graph?: ConnectivityGraph
): number {
  // Phase 5: Use graph for O(1) lookups when available
  if (graph) {
    return graph.getConnectedDirections(position);
  }

  let result = WireDirection.NONE;
  const { row, col } = position;

  // Check top neighbor (row-1, col): if it has BOTTOM direction → we get TOP
  if (row > 0) {
    const topEl = getElementAtPosition(row - 1, col, elements);
    if (topEl && (getElementDirections(topEl) & BOTTOM)) {
      result |= TOP;
    }
  }

  // Check bottom neighbor (row+1, col): if it has TOP direction → we get BOTTOM
  {
    const bottomEl = getElementAtPosition(row + 1, col, elements);
    if (bottomEl && (getElementDirections(bottomEl) & TOP)) {
      result |= BOTTOM;
    }
  }

  // Check left neighbor (row, col-1): if it has RIGHT direction → we get LEFT
  if (col > 0) {
    const leftEl = getElementAtPosition(row, col - 1, elements);
    if (leftEl && (getElementDirections(leftEl) & RIGHT)) {
      result |= LEFT;
    }
  }

  // Check right neighbor (row, col+1): if it has LEFT direction → we get RIGHT
  if (col < gridConfig.columns - 1) {
    const rightEl = getElementAtPosition(row, col + 1, elements);
    if (rightEl && (getElementDirections(rightEl) & LEFT)) {
      result |= RIGHT;
    }
  }

  // Phase 2.5: Rail edge implicit connections
  if (col === 0) {
    result |= LEFT;  // PowerRail
  }
  if (col === gridConfig.columns - 1) {
    result |= RIGHT; // NeutralRail
  }

  return result;
}

// ============================================================================
// Phase 1.5: resolveWireElementType()
// ============================================================================

/** Result of resolving the wire element type during placement */
export interface ResolvedWireType {
  type: WireType;
  direction?: string;
}

/**
 * Determines the correct wire element type when a user places a wire.
 * Combines the user's intended type (wire_h or wire_v) with
 * the directions coming from neighboring cells.
 */
export function resolveWireElementType(
  position: GridPosition,
  intendedType: 'wire_h' | 'wire_v',
  elements: Map<string, LadderElement>,
  gridConfig: LadderGridConfig,
  graph?: ConnectivityGraph
): ResolvedWireType {
  // Get the user's intended directions
  const intendedDirections = intendedType === 'wire_h'
    ? (LEFT | RIGHT)
    : (TOP | BOTTOM);

  // Get incoming directions from neighbors
  const neighborDirections = analyzeNeighborDirections(position, elements, gridConfig, graph);

  // Combine: the directions this wire would connect
  const combined = intendedDirections | neighborDirections;

  // Count active direction bits
  const bitCount = countBits(combined);

  if (bitCount <= 1) {
    // Only 0 or 1 direction — keep as intended simple wire
    return { type: intendedType };
  }

  // Look up the combined directions in the mapping table
  const wireComponentType = DIRECTION_TO_WIRE_TYPE[combined];

  if (!wireComponentType) {
    // No mapping found — keep as intended
    return { type: intendedType };
  }

  // Map the WireComponentType back to a WireType + direction
  if (wireComponentType === 'horizontal') return { type: 'wire_h' };
  if (wireComponentType === 'vertical') return { type: 'wire_v' };
  if (wireComponentType.startsWith('corner_')) return { type: 'wire_corner', direction: wireComponentType };
  if (wireComponentType.startsWith('junction_') || wireComponentType === 'cross') {
    return { type: 'wire_junction', direction: wireComponentType };
  }

  return { type: intendedType };
}

/** Count set bits in a number */
function countBits(n: number): number {
  let count = 0;
  let v = n;
  while (v) {
    count += v & 1;
    v >>= 1;
  }
  return count;
}

// ============================================================================
// Phase 1.6: updateAdjacentWires()
// ============================================================================

/** Description of a wire element that needs its type updated */
export interface WireTypeUpdate {
  elementId: string;
  newType: WireType;
  newDirection?: string;
}

/**
 * After placing or removing an element, recalculate the wire type
 * of adjacent wire elements and return any needed updates.
 *
 * Only returns updates for wire-type elements (wire_h, wire_v, wire_corner, wire_junction).
 * Logic elements (contact, coil, etc.) are never modified.
 *
 * Uses a position index internally for O(1) lookups instead of O(n) scans.
 */
export function updateAdjacentWires(
  position: GridPosition,
  elements: Map<string, LadderElement>,
  gridConfig: LadderGridConfig,
  graph?: ConnectivityGraph
): WireTypeUpdate[] {
  const updates: WireTypeUpdate[] = [];
  const { row, col } = position;

  // Build position index for O(1) lookups during neighbor analysis
  const posIndex = buildPositionIndex(elements);

  // Check all 4 neighbors
  const neighbors: Array<{ r: number; c: number }> = [
    { r: row - 1, c: col },  // top
    { r: row + 1, c: col },  // bottom
    { r: row, c: col - 1 },  // left
    { r: row, c: col + 1 },  // right
  ];

  for (const { r, c } of neighbors) {
    // Skip out of bounds
    if (r < 0 || c < 0 || c >= gridConfig.columns) continue;

    const neighbor = getElementAtPosition(r, c, posIndex);
    if (!neighbor) continue;

    // Only update wire-type elements
    if (!isWireType(neighbor.type)) continue;

    // Recalculate what this neighbor's type should be
    const neighborDirs = analyzeNeighborDirections(
      { row: r, col: c },
      elements,
      gridConfig,
      graph
    );

    // Combine with the wire's own intended base directions
    const ownBase = getBaseWireDirections(neighbor.type);
    const combined = ownBase | neighborDirs;

    const newComponentType = DIRECTION_TO_WIRE_TYPE[combined];
    if (!newComponentType) continue;

    // Determine the new WireType + direction
    const resolved = componentTypeToWireType(newComponentType);

    // Check if it actually changed
    const currentDirection = (neighbor.properties as WireProperties).direction;
    if (resolved.type === neighbor.type && resolved.direction === currentDirection) {
      continue; // No change needed
    }

    updates.push({
      elementId: neighbor.id,
      newType: resolved.type,
      newDirection: resolved.direction,
    });
  }

  return updates;
}

/**
 * Get the base (intended) directions for a wire type, ignoring
 * the current direction property. This represents what the wire
 * "wants" to be before neighbor influence.
 */
function getBaseWireDirections(wireType: WireType): number {
  switch (wireType) {
    case 'wire_h': return LEFT | RIGHT;
    case 'wire_v': return TOP | BOTTOM;
    case 'wire_corner': return LEFT | BOTTOM; // default corner direction
    case 'wire_junction': return LEFT | RIGHT | BOTTOM; // default junction direction
    default: return LEFT | RIGHT;
  }
}

/**
 * Convert a WireComponentType back to a WireType + optional direction property.
 */
function componentTypeToWireType(componentType: WireComponentType): ResolvedWireType {
  if (componentType === 'horizontal') return { type: 'wire_h' };
  if (componentType === 'vertical') return { type: 'wire_v' };
  if (componentType.startsWith('corner_')) return { type: 'wire_corner', direction: componentType };
  if (componentType.startsWith('junction_') || componentType === 'cross') {
    return { type: 'wire_junction', direction: componentType };
  }
  return { type: 'wire_h' };
}

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
function rowsShareHorizontalPath(
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
  graph?: ConnectivityGraph
): ResolvedWireType | null {
  const existing = getElementAtPosition(branchPoint.row, branchPoint.col, elements);

  // Analyze what directions connect at this point
  const neighborDirs = analyzeNeighborDirections(branchPoint, elements, gridConfig, graph);

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

// ============================================================================
// Wire Merge: mergeWireDirections()
// ============================================================================

/**
 * Merge a new wire type onto an existing wire element.
 * Used when placing wire_v on an existing wire_h (or vice versa)
 * to create junctions/crosses.
 *
 * Combines the existing element's directions with the new wire's
 * base directions, then resolves the merged type.
 *
 * @returns WireTypeUpdate if the element should change, null if no change
 */
export function mergeWireDirections(
  existingElement: LadderElement,
  newIntendedType: 'wire_h' | 'wire_v',
  elements: Map<string, LadderElement>,
  gridConfig: LadderGridConfig,
  graph?: ConnectivityGraph
): WireTypeUpdate | null {
  if (!isWireType(existingElement.type)) return null;

  // Get directions from existing element
  const existingDirs = getElementDirections(existingElement);

  // Get base directions for the new wire tool
  const newBase = newIntendedType === 'wire_h'
    ? (LEFT | RIGHT)
    : (TOP | BOTTOM);

  // Also consider neighbor directions at this position
  const neighborDirs = analyzeNeighborDirections(
    existingElement.position, elements, gridConfig, graph
  );

  // Combine all directions
  const combined = existingDirs | newBase | neighborDirs;

  // Resolve the merged type
  const componentType = DIRECTION_TO_WIRE_TYPE[combined];
  if (!componentType) return null;

  const resolved = componentTypeToWireType(componentType);

  // Check if actually changed
  const currentDirection = (existingElement.properties as WireProperties)?.direction;
  if (resolved.type === existingElement.type && resolved.direction === currentDirection) {
    return null;
  }

  return {
    elementId: existingElement.id,
    newType: resolved.type,
    newDirection: resolved.direction,
  };
}

// ============================================================================
// Phase 2 Helpers: recalculateWireType() + applyWireTypeUpdate()
// ============================================================================

/**
 * Recalculate the wire type of the element at a given position based on
 * its current neighbors. Unlike updateAdjacentWires() which updates
 * NEIGHBORS, this updates the element ITSELF.
 *
 * Returns a WireTypeUpdate if the element's type should change, or null
 * if no change is needed (or if the element is not a wire).
 */
export function recalculateWireType(
  element: LadderElement,
  elements: Map<string, LadderElement>,
  gridConfig: LadderGridConfig,
  graph?: ConnectivityGraph
): WireTypeUpdate | null {
  if (!isWireType(element.type)) return null;

  const neighborDirs = analyzeNeighborDirections(element.position, elements, gridConfig, graph);
  const ownBase = getBaseWireDirections(element.type);
  const combined = ownBase | neighborDirs;

  const newComponentType = DIRECTION_TO_WIRE_TYPE[combined];
  if (!newComponentType) return null;

  const resolved = componentTypeToWireType(newComponentType);

  // Check if actually changed
  const currentDirection = (element.properties as WireProperties)?.direction;
  if (resolved.type === element.type && resolved.direction === currentDirection) {
    return null;
  }

  return {
    elementId: element.id,
    newType: resolved.type,
    newDirection: resolved.direction,
  };
}

/**
 * Apply a WireTypeUpdate to an element (Immer-safe).
 * Uses `= undefined` instead of `delete` for safer Immer compatibility.
 */
export function applyWireTypeUpdate(element: LadderElement, update: WireTypeUpdate): void {
  (element as { type: LadderElementType }).type = update.newType;
  const props = (element.properties ?? {}) as WireProperties;
  if (update.newDirection) {
    props.direction = update.newDirection as WireProperties['direction'];
  } else {
    props.direction = undefined;
  }
}

/**
 * Recalculate wire types for ALL wire elements in the elements Map.
 * Used after bulk operations like loadFromAST where the entire Map is replaced.
 */
export function recalculateAllWireTypes(
  elements: Map<string, LadderElement>,
  gridConfig: LadderGridConfig
): void {
  const wireElements = Array.from(elements.values()).filter(el => isWireType(el.type));
  for (const wireEl of wireElements) {
    const update = recalculateWireType(wireEl, elements, gridConfig);
    if (update) {
      applyWireTypeUpdate(wireEl, update);
    }
  }
}

export default {
  // generateWires is deprecated — wire-as-element is the active pattern
  getConnectionPoints,
  validateConnection,
  getWireTypeForConnection,
  calculateWirePath,
  // Phase 1 exports
  resolveWireTypeFromDirections,
  getElementDirections,
  analyzeNeighborDirections,
  resolveWireElementType,
  updateAdjacentWires,
  // Wire merge
  mergeWireDirections,
  // Phase 2 helpers
  recalculateWireType,
  applyWireTypeUpdate,
  recalculateAllWireTypes,
  // Phase 3 exports
  findParallelBranches,
  generateVerticalWireSegments,
  generateJunctionAtBranchPoint,
};
