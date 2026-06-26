import type {
  LadderNode, ContactNode, CoilNode, TimerNode, CounterNode,
  ComparisonNode, DeviceAddress,
} from "../../OneParser/types";
import { formatDeviceAddress } from "../../OneParser/types";
import type {
  LadderElement, LadderWire, GridPosition, LadderElementType,
  ContactElement, CoilElement, TimerElement, CounterElement, CompareElement,
  ContactProperties, CoilProperties, TimerProperties, CounterProperties,
  CompareProperties,
} from "../../../types/ladder";

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
export interface ConversionContext {
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
export function mapNodeTypeToElementType(nodeType: LadderNode['type']): LadderElementType | null {
  const typeMap: Record<string, LadderElementType> = {
    // Contacts
    contact_no: 'contact_no',
    contact_nc: 'contact_nc',
    contact_p: 'contact_p',
    contact_n: 'contact_n',
    // Coils - AST uses different naming
    coil_out: 'coil',
    coil_inv: 'coil_inverted',
    coil_set: 'coil_set',
    coil_rst: 'coil_reset',
    coil_p: 'coil_p',
    coil_n: 'coil_n',
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
export function mapComparisonOperatorToType(operator: string): LadderElementType {
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

/** Module-level counter for globally unique IDs */
let globalIdCounter = 0;

/**
 * Generate unique ID for elements
 */
export function generateId(context: ConversionContext, prefix: string = 'elem'): string {
  context.idCounter++;
  globalIdCounter++;
  return `${prefix}-${globalIdCounter}-${Date.now().toString(36)}`;
}

/**
 * Create a contact element from AST node
 */
export function createContactElement(
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
export function createCoilElement(
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
export function createTimerElement(
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
export function createCounterElement(
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
export function createCompareElement(
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
export function createWire(
  fromId: string,
  toId: string,
  context: ConversionContext,
  type: 'horizontal' | 'vertical' | 'junction' | 'cross' = 'horizontal',
  junctionDirection?: LadderWire['junctionDirection']
): LadderWire {
  const wire: LadderWire = {
    id: generateId(context, 'wire'),
    from: {
      elementId: fromId,
      port: type === 'horizontal' ? 'right' : type === 'vertical' ? 'bottom' : 'right',
    },
    to: {
      elementId: toId,
      port: type === 'horizontal' ? 'left' : type === 'vertical' ? 'top' : 'left',
    },
    type: type === 'junction' || type === 'cross' ? 'junction' : type,
  };

  if (junctionDirection) {
    wire.junctionDirection = junctionDirection;
  }

  return wire;
}

