import type {
  LadderNode, BlockNode, ContactNode, CoilNode, TimerNode, CounterNode,
  ComparisonNode, DeviceAddress, LadderNetwork as LadderNetworkAST,
} from "../../OneParser/types";
import { isBlockNode } from "../../OneParser/types";
import type {
  LadderElement, LadderWire, LadderElementType,
  TimerProperties, CounterProperties, CompareProperties,
} from "../../../types/ladder";
import type { RowGroups, ParallelGroup } from "./gridGrouping";
import { groupElementsByRow, detectParallelGroups } from "./gridGrouping";
import { flattenNodes } from "./nodeUtils";

/**
 * Map editor element type to AST node type
 */
export function mapElementTypeToNodeType(
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
export function parseAddressString(address: string): DeviceAddress | null {
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
export function elementToASTNode(element: LadderElement): LadderNode | null {
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
export function buildParallelAST(
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
  // Pass full elements map so wire_v/wire_junction elements can be scanned
  const parallelGroups = detectParallelGroups(rowGroups, wires, elements);

  // Step 3: Build AST from groups
  const rawAST = buildASTFromGroups(rowGroups, parallelGroups);

  // Step 4: Normalize AST
  return normalizeAST(rawAST);
}

/**
 * Convert editor elements/wires to AST LadderNetwork
 */
export function convertEditorToAST(
  elements: Map<string, LadderElement>,
  wires: LadderWire[],
  options?: { id?: string; step?: number; comment?: string }
): LadderNetworkAST | null {
  const ast = gridToAST(elements, wires);

  if (!ast) {
    return null;
  }

  // Flatten the AST to get all nodes as a flat list for the network
  const nodes = flattenNodes(ast).filter((n) => !isBlockNode(n));

  // If the root is a series or simple node, use it directly
  const resultNodes = isBlockNode(ast) ? nodes : [ast];

  return {
    id: options?.id ?? 'network-1',
    step: options?.step ?? 1,
    nodes: resultNodes,
    comment: options?.comment,
  };
}

