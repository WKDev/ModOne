import type {
  LadderNode, BlockNode, ContactNode, CoilNode, TimerNode, CounterNode,
  ComparisonNode, LadderNetwork as LadderNetworkAST,
} from "../../OneParser/types";
import {
  isBlockNode, isContactNode, isCoilNode, isTimerNode, isCounterNode,
  isComparisonNode,
} from "../../OneParser/types";
import type { LadderElement, LadderWire, GridPosition, WireProperties } from "../../../types/ladder";
import type { ConversionContext, ConversionOptions, ConversionResult } from "./astFactories";
import {
  createContactElement, createCoilElement, createTimerElement,
  createCounterElement, createCompareElement, createWire, generateId,
} from "./astFactories";

// ============================================================================
// Node Traversal
// ============================================================================

/**
 * Calculate dimensions of a node subtree
 */
export function calculateNodeDimensions(node: LadderNode): { rows: number; cols: number } {
  if (!isBlockNode(node)) {
    // Single element takes 1x1
    return { rows: 1, cols: 1 };
  }

  const block = node as BlockNode;

  if (block.type === 'block_series') {
    // Series: sum columns, max rows
    let totalCols = 0;
    let maxRows = 0;
    for (const child of block.children) {
      const dims = calculateNodeDimensions(child);
      totalCols += dims.cols;
      maxRows = Math.max(maxRows, dims.rows);
    }
    return { rows: maxRows, cols: totalCols };
  } else {
    // Parallel: sum rows, max columns
    let totalRows = 0;
    let maxCols = 0;
    for (const child of block.children) {
      const dims = calculateNodeDimensions(child);
      totalRows += dims.rows;
      maxCols = Math.max(maxCols, dims.cols);
    }
    return { rows: totalRows, cols: maxCols };
  }
}

/**
 * Process a single non-block node and add element to context
 */
export function processLeafNode(
  node: LadderNode,
  position: GridPosition,
  context: ConversionContext
): LadderElement | null {
  let element: LadderElement | null = null;

  if (isContactNode(node)) {
    element = createContactElement(node as ContactNode, position, context);
  } else if (isCoilNode(node)) {
    element = createCoilElement(node as CoilNode, position, context);
  } else if (isTimerNode(node)) {
    element = createTimerElement(node as TimerNode, position, context);
  } else if (isCounterNode(node)) {
    element = createCounterElement(node as CounterNode, position, context);
  } else if (isComparisonNode(node)) {
    element = createCompareElement(node as ComparisonNode, position, context);
  }

  if (element) {
    context.elements.push(element);
    context.maxRow = Math.max(context.maxRow, position.row);
    context.maxCol = Math.max(context.maxCol, position.col);
  }

  return element;
}

/**
 * Process a block node recursively
 * Returns array of element IDs at the entry and exit points for wire connections
 */
export function processBlockNode(
  node: BlockNode,
  startRow: number,
  startCol: number,
  context: ConversionContext
): { entryIds: string[]; exitIds: string[] } {
  const entryIds: string[] = [];
  const exitIds: string[] = [];

  if (node.type === 'block_series') {
    // Series block: children placed horizontally
    let currentCol = startCol;
    let prevExitIds: string[] = [];

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const result = processNode(child, startRow, currentCol, context);

      // First child entry points are block entry points
      if (i === 0) {
        entryIds.push(...result.entryIds);
      } else {
        // Connect previous exits to current entries
        for (const prevId of prevExitIds) {
          for (const currId of result.entryIds) {
            context.wires.push(createWire(prevId, currId, context));
          }
        }
      }

      // Last child exit points are block exit points
      if (i === node.children.length - 1) {
        exitIds.push(...result.exitIds);
      }

      prevExitIds = result.exitIds;
      const dims = calculateNodeDimensions(child);
      currentCol += dims.cols;
    }
  } else {
    // Parallel block: children placed vertically
    let currentRow = startRow;
    const branchStartRows: number[] = [];

    for (const child of node.children) {
      branchStartRows.push(currentRow);
      const result = processNode(child, currentRow, startCol, context);
      entryIds.push(...result.entryIds);
      exitIds.push(...result.exitIds);

      const dims = calculateNodeDimensions(child);
      currentRow += dims.rows;
    }

    // Phase 3.5: Generate vertical wire elements between parallel branches
    if (branchStartRows.length >= 2) {
      const firstRow = branchStartRows[0];
      const lastRow = branchStartRows[branchStartRows.length - 1];

      // Vertical wire at the entry column (startCol - 1 if possible, or startCol)
      const entryCol = Math.max(0, startCol - 1);
      for (let row = firstRow; row <= lastRow; row++) {
        // Skip rows that have logic elements placed
        const occupied = context.elements.some(
          (el) => el.position.row === row && el.position.col === entryCol
        );
        if (!occupied && !branchStartRows.includes(row)) {
          // Place a vertical wire in the gap
          const wireId = generateId(context, 'wire_v');
          const wireElement: LadderElement = {
            id: wireId,
            type: 'wire_v',
            position: { row, col: entryCol },
            properties: {} as WireProperties,
          } as LadderElement;
          context.elements.push(wireElement);
          context.maxRow = Math.max(context.maxRow, row);
          context.maxCol = Math.max(context.maxCol, entryCol);
        }
      }

      // Add vertical wires connecting entries (junction points)
      for (let i = 0; i < branchStartRows.length - 1; i++) {
        const fromRow = branchStartRows[i];
        const toRow = branchStartRows[i + 1];
        // Create vertical wire connection between adjacent branches
        if (entryIds[i] && entryIds[i + 1]) {
          context.wires.push(createWire(entryIds[i], entryIds[i + 1], context, 'vertical'));
        }
        // Same for exit points
        if (exitIds[i] && exitIds[i + 1]) {
          context.wires.push(createWire(exitIds[i], exitIds[i + 1], context, 'vertical'));
        }
        void fromRow;
        void toRow;
      }
    }
  }

  return { entryIds, exitIds };
}

/**
 * Process any node type and return entry/exit IDs
 */
export function processNode(
  node: LadderNode,
  startRow: number,
  startCol: number,
  context: ConversionContext
): { entryIds: string[]; exitIds: string[] } {
  if (isBlockNode(node)) {
    return processBlockNode(node as BlockNode, startRow, startCol, context);
  }

  // Leaf node
  const element = processLeafNode(node, { row: startRow, col: startCol }, context);
  if (element) {
    return { entryIds: [element.id], exitIds: [element.id] };
  }
  return { entryIds: [], exitIds: [] };
}

// ============================================================================
// Main Conversion Functions
// ============================================================================

/**
 * Convert a single AST node tree to grid elements
 */
export function convertNodeToGrid(
  node: LadderNode,
  options: ConversionOptions = {}
): ConversionResult {
  const { startRow = 0, startCol = 0 } = options;

  const context: ConversionContext = {
    elements: [],
    wires: [],
    currentRow: startRow,
    currentCol: startCol,
    maxRow: startRow,
    maxCol: startCol,
    idCounter: 0,
  };

  processNode(node, startRow, startCol, context);

  return {
    elements: context.elements,
    wires: context.wires,
    rowCount: context.maxRow - startRow + 1,
    maxColumn: context.maxCol,
  };
}

/**
 * Convert a complete AST network to grid elements
 */
export function convertNetworkToGrid(
  network: LadderNetworkAST,
  options: ConversionOptions = {}
): ConversionResult {
  const { startRow = 0, startCol = 0 } = options;

  const context: ConversionContext = {
    elements: [],
    wires: [],
    currentRow: startRow,
    currentCol: startCol,
    maxRow: startRow,
    maxCol: startCol,
    idCounter: 0,
  };

  // Process all nodes in the network
  // Assuming nodes are already structured as a series (rung)
  let prevExitIds: string[] = [];

  for (let i = 0; i < network.nodes.length; i++) {
    const node = network.nodes[i];
    const dims = calculateNodeDimensions(node);

    // Use the node's grid position if available, otherwise compute
    const nodeCol = node.gridPosition?.col ?? context.currentCol;
    const nodeRow = startRow;

    const result = processNode(node, nodeRow, nodeCol, context);

    // Connect previous exits to current entries
    if (i > 0 && prevExitIds.length > 0) {
      for (const prevId of prevExitIds) {
        for (const currId of result.entryIds) {
          context.wires.push(createWire(prevId, currId, context));
        }
      }
    }

    prevExitIds = result.exitIds;
    context.currentCol += dims.cols;
  }

  return {
    elements: context.elements,
    wires: context.wires,
    rowCount: context.maxRow - startRow + 1,
    maxColumn: context.maxCol,
  };
}

/** Result of converting AST network to editor format */
export interface EditorNetworkData {
  elements: Map<string, LadderElement>;
  wires: LadderWire[];
  comment?: string;
}

/**
 * Convert AST network to editor format (elements Map + wires)
 */
export function convertToEditorNetwork(
  astNetwork: LadderNetworkAST,
  options: ConversionOptions = {}
): EditorNetworkData {
  const result = convertNetworkToGrid(astNetwork, options);

  // Convert elements array to Map
  const elementsMap = new Map<string, LadderElement>();
  for (const element of result.elements) {
    elementsMap.set(element.id, element);
  }

  return {
    elements: elementsMap,
    wires: result.wires,
    comment: astNetwork.comment,
  };
}

/**
 * Batch convert multiple AST networks and merge into a single flat structure.
 * Each network's elements are offset by row to avoid position collisions.
 */
export function convertMultipleNetworks(
  networks: LadderNetworkAST[],
  options: ConversionOptions = {}
): EditorNetworkData {
  const mergedElements = new Map<string, LadderElement>();
  const mergedWires: LadderWire[] = [];
  let rowOffset = options.startRow ?? 0;

  for (const network of networks) {
    const data = convertToEditorNetwork(network, { ...options, startRow: rowOffset });
    for (const [id, element] of Array.from(data.elements.entries())) {
      mergedElements.set(id, element);
    }
    mergedWires.push(...data.wires);

    // Calculate the max row used by this network's elements to offset the next one
    let maxRow = rowOffset;
    for (const element of data.elements.values()) {
      if (element.position.row > maxRow) {
        maxRow = element.position.row;
      }
    }
    rowOffset = maxRow + 1;
  }

  return {
    elements: mergedElements,
    wires: mergedWires,
  };
}

