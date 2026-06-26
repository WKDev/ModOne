import type {
  LadderElement, LadderElementType, LadderGridConfig, WireProperties, VerticalLinkEntity,
} from "../../../types/ladder";
import { isWireType } from "../../../types/ladder";
import type { ConnectivityGraph } from "./connectivityGraph";
import {
  getElementDirections, analyzeNeighborDirections, DIRECTION_TO_WIRE_TYPE,
  TOP, BOTTOM, LEFT, RIGHT,
} from "./wireDirections";
import { componentTypeToWireType, getBaseWireDirections } from "./wireTypeResolution";
import type { WireTypeUpdate } from "./wireTypeResolution";

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
  graph?: ConnectivityGraph,
  verticalLinks?: Map<string, VerticalLinkEntity>
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
    existingElement.position, elements, gridConfig, graph, verticalLinks
  );

  // Combine all directions
  const combined = existingDirs | newBase | neighborDirs;

  // Resolve the merged type
  const componentType = DIRECTION_TO_WIRE_TYPE[combined];
  if (!componentType) return null;

  const resolved = componentTypeToWireType(componentType);

  // Check if actually changed
  const currentDirection = (existingElement.properties as WireProperties)?.direction;
  const currentDirs = (existingElement.properties as WireProperties)?.connectedDirections;
  if (resolved.type === existingElement.type && resolved.direction === currentDirection && currentDirs === combined) {
    return null;
  }

  return {
    elementId: existingElement.id,
    newType: resolved.type,
    newDirection: resolved.direction,
    newDirections: combined,
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
  graph?: ConnectivityGraph,
  verticalLinks?: Map<string, VerticalLinkEntity>
): WireTypeUpdate | null {
  if (!isWireType(element.type)) return null;

  const neighborDirs = analyzeNeighborDirections(element.position, elements, gridConfig, graph, verticalLinks);
  const ownBase = getBaseWireDirections(element.type);
  const combined = ownBase | neighborDirs;

  const newComponentType = DIRECTION_TO_WIRE_TYPE[combined];
  if (!newComponentType) return null;

  const resolved = componentTypeToWireType(newComponentType);

  // Check if actually changed
  const currentDirection = (element.properties as WireProperties)?.direction;
  const currentDirs = (element.properties as WireProperties)?.connectedDirections;

  if (resolved.type === element.type &&
    resolved.direction === currentDirection &&
    combined === currentDirs) {
    return null;
  }

  return {
    elementId: element.id,
    newType: resolved.type,
    newDirection: resolved.direction,
    newDirections: combined,
  };
}

/**
 * Apply a WireTypeUpdate to an element (Immer-safe).
 * Uses `= undefined` instead of `delete` for safer Immer compatibility.
 */
export function applyWireTypeUpdate(element: LadderElement, update: WireTypeUpdate): void {
  (element as { type: LadderElementType }).type = update.newType;
  if (!element.properties) {
    element.properties = {};
  }
  const props = element.properties as WireProperties;

  if (update.newDirection) {
    props.direction = update.newDirection as WireProperties['direction'];
  } else {
    props.direction = undefined;
  }

  if (update.newDirections !== undefined) {
    props.connectedDirections = update.newDirections;
  }
}

/**
 * Recalculate wire types for ALL wire elements in the elements Map.
 * Used after bulk operations like loadFromAST where the entire Map is replaced.
 */
export function recalculateAllWireTypes(
  elements: Map<string, LadderElement>,
  gridConfig: LadderGridConfig,
  verticalLinks?: Map<string, VerticalLinkEntity>
): void {
  const wireElements = Array.from(elements.values()).filter(el => isWireType(el.type));
  for (const wireEl of wireElements) {
    const update = recalculateWireType(wireEl, elements, gridConfig, undefined, verticalLinks);
    if (update) {
      applyWireTypeUpdate(wireEl, update);
    }
  }
}

