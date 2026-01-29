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

  for (const element of elements.values()) {
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
 * Detect parallel groups from wire topology
 */
export function detectParallelGroups(
  rowGroups: RowGroups,
  wires: LadderWire[]
): ParallelGroup[] {
  const groups: ParallelGroup[] = [];

  // Find vertical wires that indicate parallel connections
  const verticalWires = wires.filter((w) => w.type === 'vertical');

  if (verticalWires.length === 0 || rowGroups.size <= 1) {
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
function findElementByWireEndpoint(
  elementId: string,
  rowGroups: RowGroups
): LadderElement | null {
  for (const elements of rowGroups.values()) {
    const element = elements.find((e) => e.id === elementId);
    if (element) return element;
  }
  return null;
}

/**
 * Map editor element type to AST node type
 */
function mapElementTypeToNodeType(
  elementType: LadderElementType
): LadderNode['type'] | null {
  const typeMap: Record<string, LadderNode['type']> = {
    // Contacts
    contact_no: 'contact_no',
    contact_nc: 'contact_nc',
    contact_p: 'contact_p',
    contact_n: 'contact_n',
    // Coils
    coil: 'coil_out',
    coil_set: 'coil_set',
    coil_reset: 'coil_rst',
    // Timers
    timer_ton: 'timer_ton',
    timer_tof: 'timer_tof',
    timer_tmr: 'timer_tmr',
    // Counters
    counter_ctu: 'counter_ctu',
    counter_ctd: 'counter_ctd',
    counter_ctud: 'counter_ctud',
    // Comparison
    compare_eq: 'comparison',
    compare_gt: 'comparison',
    compare_lt: 'comparison',
    compare_ge: 'comparison',
    compare_le: 'comparison',
    compare_ne: 'comparison',
  };

  return typeMap[elementType] ?? null;
}

/**
 * Parse address string to DeviceAddress
 */
function parseAddressString(address: string): DeviceAddress | null {
  if (!address || address.length < 2) return null;

  const device = address.charAt(0).toUpperCase();
  const rest = address.slice(1);

  // Check for bit index
  const dotIndex = rest.indexOf('.');
  let addressNum: number;
  let bitIndex: number | undefined;

  if (dotIndex >= 0) {
    addressNum = parseInt(rest.slice(0, dotIndex), 10);
    bitIndex = parseInt(rest.slice(dotIndex + 1), 10);
  } else {
    addressNum = parseInt(rest, 10);
  }

  if (isNaN(addressNum)) return null;

  return {
    device: device as DeviceAddress['device'],
    address: addressNum,
    bitIndex,
  };
}

/**
 * Convert a single element to an AST node
 */
function elementToASTNode(element: LadderElement): LadderNode | null {
  const nodeType = mapElementTypeToNodeType(element.type);
  if (!nodeType) return null;

  const address = element.address
    ? parseAddressString(element.address)
    : { device: 'M' as const, address: 0 };

  if (!address) return null;

  const baseNode = {
    id: element.id,
    gridPosition: element.position,
    comment: element.label ?? element.properties?.comment,
  };

  switch (nodeType) {
    case 'contact_no':
    case 'contact_nc':
    case 'contact_p':
    case 'contact_n':
      return {
        ...baseNode,
        type: nodeType,
        address,
      } as ContactNode;

    case 'coil_out':
    case 'coil_set':
    case 'coil_rst':
      return {
        ...baseNode,
        type: nodeType,
        address,
      } as CoilNode;

    case 'timer_ton':
    case 'timer_tof':
    case 'timer_tmr': {
      const timerProps = element.properties as TimerProperties;
      return {
        ...baseNode,
        type: nodeType,
        address,
        preset: timerProps?.presetTime ?? 100,
        timeBase: timerProps?.timeBase ?? 'ms',
      } as TimerNode;
    }

    case 'counter_ctu':
    case 'counter_ctd':
    case 'counter_ctud': {
      const counterProps = element.properties as CounterProperties;
      return {
        ...baseNode,
        type: nodeType,
        address,
        preset: counterProps?.presetValue ?? 10,
      } as CounterNode;
    }

    case 'comparison': {
      const compareProps = element.properties as CompareProperties;
      const operator = compareProps?.operator ?? '=';
      const compareValue = compareProps?.compareValue ?? 0;

      return {
        ...baseNode,
        type: nodeType,
        operator,
        operand1: address,
        operand2:
          typeof compareValue === 'number'
            ? compareValue
            : parseAddressString(compareValue) ?? 0,
      } as ComparisonNode;
    }

    default:
      return null;
  }
}

/**
 * Build AST from row groups and parallel groups
 */
export function buildASTFromGroups(
  rowGroups: RowGroups,
  parallelGroups: ParallelGroup[]
): LadderNode | null {
  const rows = Array.from(rowGroups.keys()).sort((a, b) => a - b);

  if (rows.length === 0) {
    return null;
  }

  // Single row - create series node
  if (rows.length === 1 && parallelGroups.length === 0) {
    const elements = rowGroups.get(rows[0])!;
    const nodes = elements.map(elementToASTNode).filter((n): n is LadderNode => n !== null);

    if (nodes.length === 0) return null;
    if (nodes.length === 1) return nodes[0];

    return {
      id: `block-${Date.now()}`,
      type: 'block_series',
      children: nodes,
      gridPosition: { row: rows[0], col: 0 },
    } as BlockNode;
  }

  // Multiple rows or parallel groups - create parallel structure
  if (parallelGroups.length > 0) {
    return buildParallelAST(rowGroups, parallelGroups);
  }

  // Multiple rows without detected parallel groups - treat as independent series
  const branches: LadderNode[] = [];

  for (const row of rows) {
    const elements = rowGroups.get(row)!;
    const nodes = elements.map(elementToASTNode).filter((n): n is LadderNode => n !== null);

    if (nodes.length > 0) {
      if (nodes.length === 1) {
        branches.push(nodes[0]);
      } else {
        branches.push({
          id: `series-${row}-${Date.now()}`,
          type: 'block_series',
          children: nodes,
          gridPosition: { row, col: 0 },
        } as BlockNode);
      }
    }
  }

  if (branches.length === 0) return null;
  if (branches.length === 1) return branches[0];

  return {
    id: `parallel-${Date.now()}`,
    type: 'block_parallel',
    children: branches,
    gridPosition: { row: rows[0], col: 0 },
  } as BlockNode;
}

/**
 * Build parallel AST from detected parallel groups
 */
function buildParallelAST(
  rowGroups: RowGroups,
  parallelGroups: ParallelGroup[]
): LadderNode | null {
  // Simple case: one parallel group covering all rows
  if (parallelGroups.length === 1) {
    const group = parallelGroups[0];
    const branches: LadderNode[] = [];

    for (const row of group.rows) {
      const elements = rowGroups.get(row);
      if (!elements) continue;

      // Filter elements within the parallel group columns
      const groupElements = elements.filter(
        (e) => e.position.col >= group.startColumn && e.position.col <= group.endColumn
      );

      const nodes = groupElements.map(elementToASTNode).filter((n): n is LadderNode => n !== null);

      if (nodes.length > 0) {
        if (nodes.length === 1) {
          branches.push(nodes[0]);
        } else {
          branches.push({
            id: `series-${row}-${Date.now()}`,
            type: 'block_series',
            children: nodes,
            gridPosition: { row, col: group.startColumn },
          } as BlockNode);
        }
      }
    }

    if (branches.length === 0) return null;
    if (branches.length === 1) return branches[0];

    return {
      id: `parallel-${Date.now()}`,
      type: 'block_parallel',
      children: branches,
      gridPosition: { row: group.rows[0], col: group.startColumn },
    } as BlockNode;
  }

  // Multiple parallel groups - build nested structure
  const allRows = Array.from(rowGroups.keys()).sort((a, b) => a - b);
  const branches: LadderNode[] = [];

  for (const row of allRows) {
    const elements = rowGroups.get(row);
    if (!elements) continue;

    const nodes = elements.map(elementToASTNode).filter((n): n is LadderNode => n !== null);

    if (nodes.length > 0) {
      if (nodes.length === 1) {
        branches.push(nodes[0]);
      } else {
        branches.push({
          id: `series-${row}-${Date.now()}`,
          type: 'block_series',
          children: nodes,
          gridPosition: { row, col: 0 },
        } as BlockNode);
      }
    }
  }

  if (branches.length === 0) return null;
  if (branches.length === 1) return branches[0];

  return {
    id: `parallel-${Date.now()}`,
    type: 'block_parallel',
    children: branches,
    gridPosition: { row: allRows[0], col: 0 },
  } as BlockNode;
}

/**
 * Normalize AST by removing unnecessary nesting
 */
export function normalizeAST(ast: LadderNode | null): LadderNode | null {
  if (!ast) return null;

  // Non-block nodes are already normalized
  if (!isBlockNode(ast)) {
    return ast;
  }

  const block = ast as BlockNode;

  // Recursively normalize children
  const normalizedChildren = block.children
    .map((child) => normalizeAST(child))
    .filter((n): n is LadderNode => n !== null);

  // Empty block -> null
  if (normalizedChildren.length === 0) {
    return null;
  }

  // Single child -> unwrap
  if (normalizedChildren.length === 1) {
    return normalizedChildren[0];
  }

  // Flatten nested same-type blocks
  const flattenedChildren: LadderNode[] = [];
  for (const child of normalizedChildren) {
    if (isBlockNode(child) && (child as BlockNode).type === block.type) {
      // Flatten: same-type block inside block
      flattenedChildren.push(...(child as BlockNode).children);
    } else {
      flattenedChildren.push(child);
    }
  }

  // Sort parallel branches consistently (by first element's row)
  if (block.type === 'block_parallel') {
    flattenedChildren.sort((a, b) => {
      const rowA = a.gridPosition?.row ?? 0;
      const rowB = b.gridPosition?.row ?? 0;
      return rowA - rowB;
    });
  }

  return {
    ...block,
    children: flattenedChildren,
  };
}

/**
 * Convert ladder grid to AST format
 *
 * @param elements - Map of element ID to LadderElement
 * @param wires - Array of wire connections
 * @returns Normalized AST node or null if empty
 */
export function gridToAST(
  elements: Map<string, LadderElement>,
  wires: LadderWire[]
): LadderNode | null {
  // Handle empty grid
  if (elements.size === 0) {
    return null;
  }

  // Step 1: Group elements by row
  const rowGroups = groupElementsByRow(elements);

  // Handle no logic elements (only wires/rails)
  if (rowGroups.size === 0) {
    return null;
  }

  // Step 2: Detect parallel connections from wires
  const parallelGroups = detectParallelGroups(rowGroups, wires);

  // Step 3: Build AST from groups
  const rawAST = buildASTFromGroups(rowGroups, parallelGroups);

  // Step 4: Normalize AST
  return normalizeAST(rawAST);
}

/**
 * Convert editor LadderNetwork to AST LadderNetwork
 */
export function convertEditorNetworkToAST(
  network: LadderNetwork
): LadderNetworkAST | null {
  const ast = gridToAST(network.elements, network.wires);

  if (!ast) {
    return null;
  }

  // Flatten the AST to get all nodes as a flat list for the network
  const nodes = flattenNodes(ast).filter((n) => !isBlockNode(n));

  // If the root is a series or simple node, use it directly
  const resultNodes = isBlockNode(ast) ? nodes : [ast];

  return {
    id: network.id,
    step: parseInt(network.label?.replace(/\D/g, '') ?? '1', 10),
    nodes: resultNodes,
    comment: network.comment,
  };
}

export default {
  convertNodeToGrid,
  convertNetworkToGrid,
  convertToEditorNetwork,
  convertMultipleNetworks,
  flattenNodes,
  getNodeStats,
  calculateNodeDimensions,
  // Grid to AST exports
  groupElementsByRow,
  detectParallelGroups,
  buildASTFromGroups,
  normalizeAST,
  gridToAST,
  convertEditorNetworkToAST,
};
