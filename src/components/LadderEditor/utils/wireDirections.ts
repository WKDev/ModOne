import type {
  LadderElement, LadderGridConfig, GridPosition, WireProperties, VerticalLinkEntity,
} from "../../../types/ladder";
import { WireDirection } from "../../../types/ladder";
import type { WireType as WireComponentType } from "../elements/Wire";
import type { ConnectivityGraph } from "./connectivityGraph";

// ============================================================================
// Phase 1.2: Direction → WireComponentType Mapping Table
// ============================================================================

export const { TOP, BOTTOM, LEFT, RIGHT } = WireDirection;

/**
 * Maps a WireDirection bitmask to the corresponding WireComponentType.
 * Covers:
 * - 4 single-direction cases (dead-end / stub wires)
 * - 6 two-direction combinations (straight + corner)
 * - 4 three-direction combinations (T-junctions)
 * - 1 four-direction combination (cross)
 */
export const DIRECTION_TO_WIRE_TYPE: Record<number, WireComponentType> = {
  // Single-direction (dead-end stubs — render as nearest straight wire)
  [LEFT]: 'horizontal',
  [RIGHT]: 'horizontal',
  [TOP]: 'vertical',
  [BOTTOM]: 'vertical',
  // Two-direction (straight + corner)
  [LEFT | RIGHT]: 'horizontal',
  [TOP | BOTTOM]: 'vertical',
  [LEFT | BOTTOM]: 'corner_tl',
  [RIGHT | BOTTOM]: 'corner_tr',
  [LEFT | TOP]: 'corner_bl',
  [RIGHT | TOP]: 'corner_br',
  // Three-direction (T-junctions)
  [LEFT | RIGHT | BOTTOM]: 'junction_t',
  [LEFT | RIGHT | TOP]: 'junction_b',
  [TOP | BOTTOM | RIGHT]: 'junction_l',
  [TOP | BOTTOM | LEFT]: 'junction_r',
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

// ============================================================================
// Phase 1.3: getElementDirections()
// ============================================================================

/** Map from wire_corner/wire_junction direction property to bitmask */
export const WIRE_DIRECTION_PROPERTY_MAP: Record<string, number> = {
  corner_tl: LEFT | BOTTOM,
  corner_tr: RIGHT | BOTTOM,
  corner_bl: LEFT | TOP,
  corner_br: RIGHT | TOP,
  junction_t: LEFT | RIGHT | BOTTOM,
  junction_b: LEFT | RIGHT | TOP,
  junction_l: TOP | BOTTOM | RIGHT,
  junction_r: TOP | BOTTOM | LEFT,
  cross: TOP | BOTTOM | LEFT | RIGHT,
};

/**
 * Returns the WireDirection bitmask for a given LadderElement,
 * indicating which directions this element connects to.
 */
export function getElementDirections(element: LadderElement): number {
  const { type } = element;

  // Wire elements
  if (type === 'wire_h') return WireDirection.LEFT | WireDirection.RIGHT;
  if (type === 'wire_v') return WireDirection.TOP | WireDirection.BOTTOM; // Now centered and spans row boundaries

  if (type === 'wire_corner' || type === 'wire_junction') {
    const props = element.properties as WireProperties;
    const dir = props.direction;
    if (dir && WIRE_DIRECTION_PROPERTY_MAP[dir] !== undefined) {
      return WIRE_DIRECTION_PROPERTY_MAP[dir];
    }
    // Defaults
    return type === 'wire_corner' ? (WireDirection.LEFT | WireDirection.BOTTOM) : (WireDirection.LEFT | WireDirection.RIGHT | WireDirection.BOTTOM);
  }

  // Rail elements
  if (type === 'power_rail') return WireDirection.RIGHT;
  if (type === 'neutral_rail') return WireDirection.LEFT;

  // All logic elements (contact, coil, timer, counter, compare) connect left-right
  return WireDirection.LEFT | WireDirection.RIGHT;
}


// ============================================================================
// Phase 1.4 + 2.5: analyzeNeighborDirections()
// ============================================================================

/**
 * Build a position-keyed index for O(1) lookups.
 * Call once before batch neighbor analysis operations.
 */
export function buildPositionIndex(elements: Map<string, LadderElement>): Map<string, LadderElement> {
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
export function getElementAtPosition(
  row: number,
  col: number,
  elements: Map<string, LadderElement>
): LadderElement | undefined {
  const key = `${row}-${col}`;
  const directHit = elements.get(key);
  if (directHit) return directHit;

  for (const el of elements.values()) {
    if (el.position.row === row && el.position.col === col) return el;
  }
  return undefined;
}

export function getVerticalLinkAtPosition(
  row: number,
  col: number,
  verticalLinks?: Map<string, VerticalLinkEntity>
): VerticalLinkEntity | undefined {
  if (!verticalLinks) return undefined;

  for (const verticalLink of verticalLinks.values()) {
    if (verticalLink.position.row === row && verticalLink.position.col === col) {
      return verticalLink;
    }
  }

  return undefined;
}

/**
 * Analyze the 4-directional neighbors of a cell and return a bitmask
 * of which directions have incoming connections to this cell.
 *
 * Also handles implicit rail connections at grid edges (Phase 2.5):
 * - col === 0 -> LEFT (PowerRail)
 * - col === columns-1 -> RIGHT (NeutralRail)
 *
 * Vertical links use their own coordinate system with origin (0, -0.5):
 * - a link at (col, row) connects main-grid cells (row-1, col) and (row, col)
 */
export function analyzeNeighborDirections(
  position: GridPosition,
  elements: Map<string, LadderElement>,
  gridConfig: LadderGridConfig,
  graph?: ConnectivityGraph,
  verticalLinks?: Map<string, VerticalLinkEntity>
): number {
  if (graph) {
    let graphResult = graph.getConnectedDirections(position);
    if (position.row === 0) {
      graphResult &= ~TOP;
    }
    return graphResult;
  }

  let result = WireDirection.NONE;
  const { row, col } = position;

  if (row > 0) {
    const topLink = getVerticalLinkAtPosition(row, col, verticalLinks);
    if (topLink) {
      result |= WireDirection.TOP;
    } else {
      const topEl = getElementAtPosition(row - 1, col, elements);
      if (topEl && (getElementDirections(topEl) & WireDirection.BOTTOM)) {
        result |= WireDirection.TOP;
      }
    }
  }

  {
    const bottomLink = getVerticalLinkAtPosition(row + 1, col, verticalLinks);
    if (bottomLink) {
      result |= WireDirection.BOTTOM;
    } else {
      const bottomEl = getElementAtPosition(row + 1, col, elements);
      if (bottomEl && (getElementDirections(bottomEl) & WireDirection.TOP)) {
        result |= WireDirection.BOTTOM;
      }
    }
  }

  if (col > 0) {
    const leftEl = getElementAtPosition(row, col - 1, elements);
    if (leftEl && (getElementDirections(leftEl) & WireDirection.RIGHT)) {
      result |= WireDirection.LEFT;
    }
  }

  if (col < gridConfig.columns - 1) {
    const rightEl = getElementAtPosition(row, col + 1, elements);
    if (rightEl && (getElementDirections(rightEl) & WireDirection.LEFT)) {
      result |= WireDirection.RIGHT;
    }
  }

  if (col === 0) {
    result |= WireDirection.LEFT;
  }
  if (col === gridConfig.columns - 1) {
    result |= WireDirection.RIGHT;
  }

  if (row === 0) {
    result &= ~WireDirection.TOP;
  }

  return result;
}

