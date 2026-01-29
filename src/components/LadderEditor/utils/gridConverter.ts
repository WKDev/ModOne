/**
 * Grid Converter Utility
 *
 * Converts OneParser AST output into ladder grid elements with correct positioning.
 * Handles series and parallel block traversal for proper element placement.
 */

import type {
  LadderNode,
  BlockNode,
  ContactNode,
  CoilNode,
  TimerNode,
  CounterNode,
  ComparisonNode,
  DeviceAddress,
  LadderNetwork as LadderNetworkAST,
} from '../../OneParser/types';
import {
  isBlockNode,
  isContactNode,
  isCoilNode,
  isTimerNode,
  isCounterNode,
  isComparisonNode,
  formatDeviceAddress,
} from '../../OneParser/types';
import type {
  LadderElement,
  LadderWire,
  GridPosition,
  LadderElementType,
  ContactElement,
  CoilElement,
  TimerElement,
  CounterElement,
  CompareElement,
  ContactProperties,
  CoilProperties,
  TimerProperties,
  CounterProperties,
  CompareProperties,
  LadderNetwork,
} from '../../../types/ladder';

// ============================================================================
// Types
// ============================================================================

/** Result of AST to grid conversion */
export interface ConversionResult {
  /** Converted ladder elements */
  elements: LadderElement[];
  /** Wire connections between elements */
  wires: LadderWire[];
  /** Total row count needed for layout */
  rowCount: number;
  /** Maximum column used */
  maxColumn: number;
}

/** Conversion options */
export interface ConversionOptions {
  /** Starting row offset (default: 0) */
  startRow?: number;
  /** Starting column offset (default: 0) */
  startCol?: number;
  /** Reserve columns for output elements at end (default: 2) */
  outputColumnReserve?: number;
}

/** Internal tracking context during conversion */
interface ConversionContext {
  elements: LadderElement[];
  wires: LadderWire[];
  currentRow: number;
  currentCol: number;
  maxRow: number;
  maxCol: number;
  idCounter: number;
}

// ============================================================================
// Type Mapping
// ============================================================================

/**
 * Map AST node type to editor element type
 */
function mapNodeTypeToElementType(nodeType: LadderNode['type']): LadderElementType | null {
  const typeMap: Record<string, LadderElementType> = {
    // Contacts
    contact_no: 'contact_no',
    contact_nc: 'contact_nc',
    contact_p: 'contact_p',
    contact_n: 'contact_n',
    // Coils - AST uses different naming
    coil_out: 'coil',
    coil_set: 'coil_set',
    coil_rst: 'coil_reset',
    // Timers
    timer_ton: 'timer_ton',
    timer_tof: 'timer_tof',
    timer_tmr: 'timer_tmr',
    // Counters
    counter_ctu: 'counter_ctu',
    counter_ctd: 'counter_ctd',
    counter_ctud: 'counter_ctud',
    // Comparison (mapped to compare_eq as default, actual operator is in properties)
    comparison: 'compare_eq',
    // Math/Move nodes are not directly representable in the current element types
    math: 'compare_eq', // Fallback
    move: 'compare_eq', // Fallback
  };

  return typeMap[nodeType] ?? null;
}

/**
 * Map comparison operator to compare element type
 */
function mapComparisonOperatorToType(operator: string): LadderElementType {
  const operatorMap: Record<string, LadderElementType> = {
    '=': 'compare_eq',
    '>': 'compare_gt',
    '<': 'compare_lt',
    '>=': 'compare_ge',
    '<=': 'compare_le',
    '<>': 'compare_ne',
  };
  return operatorMap[operator] ?? 'compare_eq';
}

// ============================================================================
// Element Creation
// ============================================================================

/**
 * Generate unique ID for elements
 */
function generateId(context: ConversionContext, prefix: string = 'elem'): string {
  context.idCounter++;
  return `${prefix}-${context.idCounter}-${Date.now().toString(36)}`;
}

/**
 * Create a contact element from AST node
 */
function createContactElement(
  node: ContactNode,
  position: GridPosition,
  context: ConversionContext
): ContactElement {
  const elementType = mapNodeTypeToElementType(node.type) as ContactElement['type'];

  return {
    id: generateId(context, 'contact'),
    type: elementType,
    position,
    address: formatDeviceAddress(node.address),
    label: node.comment,
    properties: {
      edgeDetection: node.type === 'contact_p' ? 'rising' :
                     node.type === 'contact_n' ? 'falling' : undefined,
      comment: node.comment,
    } as ContactProperties,
  };
}

/**
 * Create a coil element from AST node
 */
function createCoilElement(
  node: CoilNode,
  position: GridPosition,
  context: ConversionContext
): CoilElement {
  const typeMap: Record<string, CoilElement['type']> = {
    coil_out: 'coil',
    coil_set: 'coil_set',
    coil_rst: 'coil_reset',
  };

  return {
    id: generateId(context, 'coil'),
    type: typeMap[node.type] ?? 'coil',
    position,
    address: formatDeviceAddress(node.address),
    label: node.comment,
    properties: {
      latched: node.type === 'coil_set',
      comment: node.comment,
    } as CoilProperties,
  };
}

/**
 * Create a timer element from AST node
 */
function createTimerElement(
  node: TimerNode,
  position: GridPosition,
  context: ConversionContext
): TimerElement {
  const elementType = mapNodeTypeToElementType(node.type) as TimerElement['type'];

  return {
    id: generateId(context, 'timer'),
    type: elementType,
    position,
    address: formatDeviceAddress(node.address),
    label: node.comment,
    properties: {
      presetTime: node.preset,
      timeBase: node.timeBase,
      comment: node.comment,
    } as TimerProperties,
  };
}

/**
 * Create a counter element from AST node
 */
function createCounterElement(
  node: CounterNode,
  position: GridPosition,
  context: ConversionContext
): CounterElement {
  const elementType = mapNodeTypeToElementType(node.type) as CounterElement['type'];
  const direction = node.type === 'counter_ctu' ? 'up' :
                   node.type === 'counter_ctd' ? 'down' : 'both';

  return {
    id: generateId(context, 'counter'),
    type: elementType,
    position,
    address: formatDeviceAddress(node.address),
    label: node.comment,
    properties: {
      presetValue: node.preset,
      direction,
      comment: node.comment,
    } as CounterProperties,
  };
}

/**
 * Create a comparison element from AST node
 */
function createCompareElement(
  node: ComparisonNode,
  position: GridPosition,
  context: ConversionContext
): CompareElement {
  const elementType = mapComparisonOperatorToType(node.operator) as CompareElement['type'];

  // Format operand value
  const formatOperand = (op: DeviceAddress | number): number | string => {
    if (typeof op === 'number') return op;
    return formatDeviceAddress(op);
  };

  return {
    id: generateId(context, 'compare'),
    type: elementType,
    position,
    address: typeof node.operand1 === 'number' ? '' : formatDeviceAddress(node.operand1),
    label: node.comment,
    properties: {
      operator: node.operator,
      compareValue: formatOperand(node.operand2),
      comment: node.comment,
    } as CompareProperties,
  };
}

// ============================================================================
// Wire Creation
// ============================================================================

/**
 * Create a horizontal wire connection between two elements
 */
function createWire(
  fromId: string,
  toId: string,
  context: ConversionContext,
  type: 'horizontal' | 'vertical' = 'horizontal'
): LadderWire {
  return {
    id: generateId(context, 'wire'),
    from: {
      elementId: fromId,
      port: type === 'horizontal' ? 'right' : 'bottom',
    },
    to: {
      elementId: toId,
      port: type === 'horizontal' ? 'left' : 'top',
    },
    type,
  };
}

// ============================================================================
// Node Traversal
// ============================================================================

/**
 * Calculate dimensions of a node subtree
 */
function calculateNodeDimensions(node: LadderNode): { rows: number; cols: number } {
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
function processLeafNode(
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
function processBlockNode(
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

    for (const child of node.children) {
      const result = processNode(child, currentRow, startCol, context);
      entryIds.push(...result.entryIds);
      exitIds.push(...result.exitIds);

      const dims = calculateNodeDimensions(child);
      currentRow += dims.rows;
    }
  }

  return { entryIds, exitIds };
}

/**
 * Process any node type and return entry/exit IDs
 */
function processNode(
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

/**
 * Convert AST network to editor LadderNetwork format
 */
export function convertToEditorNetwork(
  astNetwork: LadderNetworkAST,
  options: ConversionOptions = {}
): LadderNetwork {
  const result = convertNetworkToGrid(astNetwork, options);

  // Convert elements array to Map
  const elementsMap = new Map<string, LadderElement>();
  for (const element of result.elements) {
    elementsMap.set(element.id, element);
  }

  return {
    id: astNetwork.id,
    label: `Network ${astNetwork.step}`,
    comment: astNetwork.comment,
    elements: elementsMap,
    wires: result.wires,
    enabled: true,
  };
}

/**
 * Batch convert multiple AST networks
 */
export function convertMultipleNetworks(
  networks: LadderNetworkAST[],
  options: ConversionOptions = {}
): LadderNetwork[] {
  return networks.map((network) => convertToEditorNetwork(network, options));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Flatten a nested block structure for debugging
 */
export function flattenNodes(node: LadderNode): LadderNode[] {
  if (!isBlockNode(node)) {
    return [node];
  }

  const block = node as BlockNode;
  const result: LadderNode[] = [node];

  for (const child of block.children) {
    result.push(...flattenNodes(child));
  }

  return result;
}

/**
 * Get statistics about a node tree
 */
export function getNodeStats(node: LadderNode): {
  totalNodes: number;
  contacts: number;
  coils: number;
  timers: number;
  counters: number;
  comparisons: number;
  blocks: number;
} {
  const stats = {
    totalNodes: 0,
    contacts: 0,
    coils: 0,
    timers: 0,
    counters: 0,
    comparisons: 0,
    blocks: 0,
  };

  function traverse(n: LadderNode) {
    stats.totalNodes++;

    if (isBlockNode(n)) {
      stats.blocks++;
      for (const child of (n as BlockNode).children) {
        traverse(child);
      }
    } else if (isContactNode(n)) {
      stats.contacts++;
    } else if (isCoilNode(n)) {
      stats.coils++;
    } else if (isTimerNode(n)) {
      stats.timers++;
    } else if (isCounterNode(n)) {
      stats.counters++;
    } else if (isComparisonNode(n)) {
      stats.comparisons++;
    }
  }

  traverse(node);
  return stats;
}

export default {
  convertNodeToGrid,
  convertNetworkToGrid,
  convertToEditorNetwork,
  convertMultipleNetworks,
  flattenNodes,
  getNodeStats,
  calculateNodeDimensions,
};
