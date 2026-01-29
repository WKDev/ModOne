/**
 * Ladder Editor Type Definitions
 *
 * Types for the visual ladder diagram editor including grid positioning,
 * wire routing, monitoring state, and editor-specific element structures.
 *
 * Core AST and device types are re-exported from OneParser module.
 */

// Re-export core types from OneParser for unified access
export type {
  // Device types
  BitDeviceType,
  WordDeviceType,
  DeviceType,
  DeviceAddress,
  // Instruction types
  ContactInstructionType,
  BlockInstructionType,
  OutputInstructionType,
  TimerInstructionType,
  CounterInstructionType,
  ComparisonInstructionType,
  MathInstructionType,
  InstructionType,
  // AST Node types
  LadderNodeType,
  BaseLadderNode,
  ContactNode,
  CoilNode,
  TimerNode,
  CounterNode,
  ComparisonNode,
  MathNode,
  BlockNode,
  LadderNode,
  TimeBase,
  ComparisonOperator,
  MathOperator,
  // Grid position
  GridPosition,
  // Program structure
  LadderNetwork as LadderNetworkAST,
  SymbolEntry,
  SymbolTable,
  DataType,
  ProgramMetadata,
  LadderProgram as LadderProgramAST,
  // Modbus mapping
  ModbusAddress,
  MappingRule,
  // Serialization
  SerializableSymbolTable,
  SerializableLadderProgram,
} from '../components/OneParser/types';

export {
  // Type guards
  isBitDevice,
  isWordDevice,
  isValidDeviceType,
  isContactNode,
  isCoilNode,
  isTimerNode,
  isCounterNode,
  isComparisonNode,
  isMathNode,
  isBlockNode,
  isDeviceAddress,
  // Utility functions
  parseDeviceAddress,
  formatDeviceAddress,
  deviceAddressKey,
  getDefaultMappingRules,
  // Factory functions
  createEmptyLadderProgram,
  createLadderNetwork,
  createContactNode,
  createCoilNode,
  // Serialization
  ladderProgramToSerializable,
  serializableToLadderProgram,
  // Constants
  BIT_DEVICES,
  WORD_DEVICES,
  ALL_DEVICES,
  CONTACT_INSTRUCTIONS,
  BLOCK_INSTRUCTIONS,
  OUTPUT_INSTRUCTIONS,
  TIMER_INSTRUCTIONS,
  COUNTER_INSTRUCTIONS,
  COMPARISON_INSTRUCTIONS,
  MATH_INSTRUCTIONS,
  DEFAULT_PROGRAM_METADATA,
  DEFAULT_GRID_POSITION,
} from '../components/OneParser/types';

import type {
  LadderNode,
  GridPosition,
  DeviceAddress,
} from '../components/OneParser/types';

// ============================================================================
// Ladder Element Types (Editor-specific)
// ============================================================================

/**
 * Ladder element type for visual editor
 * Includes wire and rail types in addition to logic elements
 */
export type LadderElementType =
  // Contact types
  | 'contact_no' | 'contact_nc' | 'contact_p' | 'contact_n'
  // Coil types
  | 'coil' | 'coil_set' | 'coil_reset'
  // Timer types
  | 'timer_ton' | 'timer_tof' | 'timer_tmr'
  // Counter types
  | 'counter_ctu' | 'counter_ctd' | 'counter_ctud'
  // Comparison types
  | 'compare_eq' | 'compare_gt' | 'compare_lt'
  | 'compare_ge' | 'compare_le' | 'compare_ne'
  // Wire types
  | 'wire_h' | 'wire_v' | 'wire_corner' | 'wire_junction'
  // Rail types
  | 'power_rail' | 'neutral_rail';

/** Contact element type subset */
export type ContactType = 'contact_no' | 'contact_nc' | 'contact_p' | 'contact_n';

/** Coil element type subset */
export type CoilType = 'coil' | 'coil_set' | 'coil_reset';

/** Timer element type subset */
export type TimerType = 'timer_ton' | 'timer_tof' | 'timer_tmr';

/** Counter element type subset */
export type CounterType = 'counter_ctu' | 'counter_ctd' | 'counter_ctud';

/** Comparison element type subset */
export type CompareType =
  | 'compare_eq' | 'compare_gt' | 'compare_lt'
  | 'compare_ge' | 'compare_le' | 'compare_ne';

/** Wire element type subset */
export type WireType = 'wire_h' | 'wire_v' | 'wire_corner' | 'wire_junction';

/** Rail element type subset */
export type RailType = 'power_rail' | 'neutral_rail';

/** Arrays for element type validation */
export const CONTACT_TYPES: readonly ContactType[] = [
  'contact_no', 'contact_nc', 'contact_p', 'contact_n',
] as const;

export const COIL_TYPES: readonly CoilType[] = [
  'coil', 'coil_set', 'coil_reset',
] as const;

export const TIMER_TYPES: readonly TimerType[] = [
  'timer_ton', 'timer_tof', 'timer_tmr',
] as const;

export const COUNTER_TYPES: readonly CounterType[] = [
  'counter_ctu', 'counter_ctd', 'counter_ctud',
] as const;

export const COMPARE_TYPES: readonly CompareType[] = [
  'compare_eq', 'compare_gt', 'compare_lt',
  'compare_ge', 'compare_le', 'compare_ne',
] as const;

export const WIRE_TYPES: readonly WireType[] = [
  'wire_h', 'wire_v', 'wire_corner', 'wire_junction',
] as const;

export const RAIL_TYPES: readonly RailType[] = [
  'power_rail', 'neutral_rail',
] as const;

export const ALL_ELEMENT_TYPES: readonly LadderElementType[] = [
  ...CONTACT_TYPES,
  ...COIL_TYPES,
  ...TIMER_TYPES,
  ...COUNTER_TYPES,
  ...COMPARE_TYPES,
  ...WIRE_TYPES,
  ...RAIL_TYPES,
] as const;

// ============================================================================
// Grid Configuration Types
// ============================================================================

/** Cell size in pixels */
export interface CellSize {
  /** Cell width in pixels */
  width: number;
  /** Cell height in pixels */
  height: number;
}

/** Grid span for multi-cell elements */
export interface GridSpan {
  /** Number of rows spanned */
  rows: number;
  /** Number of columns spanned */
  columns: number;
}

/** Grid configuration for ladder editor */
export interface LadderGridConfig {
  /** Number of columns per rung (default: 10) */
  columns: number;
  /** Cell width in pixels */
  cellWidth: number;
  /** Cell height in pixels */
  cellHeight: number;
  /** Whether to show grid lines */
  showGridLines?: boolean;
  /** Whether to snap elements to grid */
  snapToGrid?: boolean;
}

/** Default ladder grid configuration */
export const DEFAULT_LADDER_GRID_CONFIG: LadderGridConfig = {
  columns: 10,
  cellWidth: 80,
  cellHeight: 60,
  showGridLines: true,
  snapToGrid: true,
};

// ============================================================================
// Ladder Element Interfaces
// ============================================================================

/** Base element properties */
export interface ElementProperties {
  /** Whether the element is inverted (NOT) */
  inverted?: boolean;
  /** Element comment */
  comment?: string;
}

/** Contact-specific properties */
export interface ContactProperties extends ElementProperties {
  /** Edge detection type for transition contacts */
  edgeDetection?: 'rising' | 'falling';
}

/** Coil-specific properties */
export interface CoilProperties extends ElementProperties {
  /** Whether this is a latched output */
  latched?: boolean;
}

/** Timer-specific properties */
export interface TimerProperties extends ElementProperties {
  /** Preset time in milliseconds */
  presetTime: number;
  /** Time base (ms or s) */
  timeBase: 'ms' | 's';
  /** Accumulated time (runtime) */
  accumulatedTime?: number;
}

/** Counter-specific properties */
export interface CounterProperties extends ElementProperties {
  /** Preset value */
  presetValue: number;
  /** Current value (runtime) */
  currentValue?: number;
  /** Count direction */
  direction?: 'up' | 'down' | 'both';
}

/** Comparison-specific properties */
export interface CompareProperties extends ElementProperties {
  /** Comparison operator */
  operator: '=' | '>' | '<' | '>=' | '<=' | '<>';
  /** Compare value (constant or address string) */
  compareValue: number | string;
}

/** Base ladder element interface */
export interface BaseLadderElement<T extends LadderElementType = LadderElementType> {
  /** Unique identifier */
  id: string;
  /** Element type discriminator */
  type: T;
  /** Grid position */
  position: GridPosition;
  /** Device address (e.g., 'X0', 'Y0', 'T0', 'C0') */
  address?: string;
  /** Display label */
  label?: string;
  /** Whether element is selected */
  selected?: boolean;
  /** Element properties */
  properties: ElementProperties;
}

/** Contact element */
export interface ContactElement extends BaseLadderElement<ContactType> {
  address: string;
  properties: ContactProperties;
}

/** Coil element */
export interface CoilElement extends BaseLadderElement<CoilType> {
  address: string;
  properties: CoilProperties;
}

/** Timer element */
export interface TimerElement extends BaseLadderElement<TimerType> {
  address: string;
  properties: TimerProperties;
}

/** Counter element */
export interface CounterElement extends BaseLadderElement<CounterType> {
  address: string;
  properties: CounterProperties;
}

/** Comparison element */
export interface CompareElement extends BaseLadderElement<CompareType> {
  address: string;
  properties: CompareProperties;
}

/** Wire element */
export interface WireElement extends BaseLadderElement<WireType> {
  properties: ElementProperties;
}

/** Rail element */
export interface RailElement extends BaseLadderElement<RailType> {
  properties: ElementProperties;
}

/** Discriminated union of all ladder elements */
export type LadderElement =
  | ContactElement
  | CoilElement
  | TimerElement
  | CounterElement
  | CompareElement
  | WireElement
  | RailElement;

// ============================================================================
// Wire Connection Types
// ============================================================================

/** Port position on an element */
export type PortPosition = 'left' | 'right' | 'top' | 'bottom';

/** Wire endpoint */
export interface WireEndpoint {
  /** Element ID this wire connects to */
  elementId: string;
  /** Port on the element */
  port: PortPosition;
}

/** Wire connection between elements */
export interface LadderWire {
  /** Unique identifier */
  id: string;
  /** Source endpoint */
  from: WireEndpoint;
  /** Destination endpoint */
  to: WireEndpoint;
  /** Wire routing type */
  type: 'horizontal' | 'vertical' | 'corner';
  /** Whether wire is energized (runtime) */
  energized?: boolean;
}

// ============================================================================
// Network and Program Structure (Editor)
// ============================================================================

/** Editor-specific ladder network (rung) */
export interface LadderNetwork {
  /** Unique identifier */
  id: string;
  /** Network label/number */
  label?: string;
  /** Network comment */
  comment?: string;
  /** Elements in this network indexed by ID */
  elements: Map<string, LadderElement>;
  /** Wire connections */
  wires: LadderWire[];
  /** Computed AST from topology (for code generation) */
  ast?: LadderNode;
  /** Whether network is enabled */
  enabled: boolean;
}

/** Program metadata for editor */
export interface LadderProgramMetadata {
  /** Program name */
  name: string;
  /** Description */
  description?: string;
  /** Author */
  author?: string;
  /** Creation date (ISO 8601) */
  createdAt?: string;
  /** Last modified date (ISO 8601) */
  modifiedAt?: string;
  /** Version string */
  version?: string;
  /** Target PLC model */
  plcModel?: string;
}

/** Complete ladder program for editor */
export interface LadderProgram {
  /** Unique identifier */
  id: string;
  /** Program name */
  name: string;
  /** All networks (rungs) */
  networks: LadderNetwork[];
  /** Program metadata */
  metadata: LadderProgramMetadata;
  /** Symbol table */
  symbolTable?: Map<string, { address: DeviceAddress; symbol?: string; comment?: string }>;
}

// ============================================================================
// Monitoring State Types
// ============================================================================

/** Timer runtime state */
export interface TimerState {
  /** Elapsed time in milliseconds */
  et: number;
  /** Preset time in milliseconds */
  pt: number;
  /** Whether timer is running */
  running: boolean;
  /** Whether timer has completed */
  done: boolean;
}

/** Counter runtime state */
export interface CounterState {
  /** Current value */
  cv: number;
  /** Preset value */
  pv: number;
  /** Whether counter has reached preset */
  done: boolean;
}

/** Complete ladder monitoring state */
export interface LadderMonitoringState {
  /** Device states (address -> boolean for bits, number for words) */
  deviceStates: Map<string, boolean | number>;
  /** Forced device addresses */
  forcedDevices: Set<string>;
  /** Energized wire IDs */
  energizedWires: Set<string>;
  /** Timer states (address -> state) */
  timerStates: Map<string, TimerState>;
  /** Counter states (address -> state) */
  counterStates: Map<string, CounterState>;
}

/** Default timer state */
export const DEFAULT_TIMER_STATE: TimerState = {
  et: 0,
  pt: 0,
  running: false,
  done: false,
};

/** Default counter state */
export const DEFAULT_COUNTER_STATE: CounterState = {
  cv: 0,
  pv: 0,
  done: false,
};

/** Default monitoring state */
export const DEFAULT_MONITORING_STATE: LadderMonitoringState = {
  deviceStates: new Map(),
  forcedDevices: new Set(),
  energizedWires: new Set(),
  timerStates: new Map(),
  counterStates: new Map(),
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a string is a valid ladder element type
 */
export function isValidLadderElementType(type: string): type is LadderElementType {
  return (ALL_ELEMENT_TYPES as readonly string[]).includes(type);
}

/**
 * Check if type is a contact type
 */
export function isContactType(type: LadderElementType): type is ContactType {
  return (CONTACT_TYPES as readonly string[]).includes(type);
}

/**
 * Check if type is a coil type
 */
export function isCoilType(type: LadderElementType): type is CoilType {
  return (COIL_TYPES as readonly string[]).includes(type);
}

/**
 * Check if type is a timer type
 */
export function isTimerType(type: LadderElementType): type is TimerType {
  return (TIMER_TYPES as readonly string[]).includes(type);
}

/**
 * Check if type is a counter type
 */
export function isCounterType(type: LadderElementType): type is CounterType {
  return (COUNTER_TYPES as readonly string[]).includes(type);
}

/**
 * Check if type is a comparison type
 */
export function isCompareType(type: LadderElementType): type is CompareType {
  return (COMPARE_TYPES as readonly string[]).includes(type);
}

/**
 * Check if type is a wire type
 */
export function isWireType(type: LadderElementType): type is WireType {
  return (WIRE_TYPES as readonly string[]).includes(type);
}

/**
 * Check if type is a rail type
 */
export function isRailType(type: LadderElementType): type is RailType {
  return (RAIL_TYPES as readonly string[]).includes(type);
}

/**
 * Check if an element is a contact element
 */
export function isContactElement(element: LadderElement): element is ContactElement {
  return isContactType(element.type);
}

/**
 * Check if an element is a coil element
 */
export function isCoilElement(element: LadderElement): element is CoilElement {
  return isCoilType(element.type);
}

/**
 * Check if an element is a timer element
 */
export function isTimerElement(element: LadderElement): element is TimerElement {
  return isTimerType(element.type);
}

/**
 * Check if an element is a counter element
 */
export function isCounterElement(element: LadderElement): element is CounterElement {
  return isCounterType(element.type);
}

/**
 * Check if an element is a comparison element
 */
export function isCompareElement(element: LadderElement): element is CompareElement {
  return isCompareType(element.type);
}

/**
 * Check if an element is a wire element
 */
export function isWireElement(element: LadderElement): element is WireElement {
  return isWireType(element.type);
}

/**
 * Check if an element is a rail element
 */
export function isRailElement(element: LadderElement): element is RailElement {
  return isRailType(element.type);
}

/**
 * Check if an element is a logic element (not wire/rail)
 */
export function isLogicElement(element: LadderElement): boolean {
  return (
    isContactElement(element) ||
    isCoilElement(element) ||
    isTimerElement(element) ||
    isCounterElement(element) ||
    isCompareElement(element)
  );
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an empty ladder network
 */
export function createEmptyNetwork(id?: string, label?: string): LadderNetwork {
  return {
    id: id ?? crypto.randomUUID(),
    label,
    elements: new Map(),
    wires: [],
    enabled: true,
  };
}

/**
 * Create an empty ladder program
 */
export function createEmptyEditorProgram(name = 'Untitled Program'): LadderProgram {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    networks: [],
    metadata: {
      name,
      createdAt: now,
      modifiedAt: now,
      version: '1.0.0',
    },
  };
}

/**
 * Create a new monitoring state
 */
export function createEmptyMonitoringState(): LadderMonitoringState {
  return {
    deviceStates: new Map(),
    forcedDevices: new Set(),
    energizedWires: new Set(),
    timerStates: new Map(),
    counterStates: new Map(),
  };
}

// ============================================================================
// Serialization Types
// ============================================================================

/** Serializable version of LadderNetwork */
export interface SerializableLadderNetwork {
  id: string;
  label?: string;
  comment?: string;
  elements: Record<string, LadderElement>;
  wires: LadderWire[];
  enabled: boolean;
}

/** Serializable version of LadderProgram */
export interface SerializableEditorProgram {
  id: string;
  name: string;
  networks: SerializableLadderNetwork[];
  metadata: LadderProgramMetadata;
  symbolTable?: Record<string, { address: DeviceAddress; symbol?: string; comment?: string }>;
}

/**
 * Convert LadderNetwork to serializable format
 */
export function networkToSerializable(network: LadderNetwork): SerializableLadderNetwork {
  return {
    id: network.id,
    label: network.label,
    comment: network.comment,
    elements: Object.fromEntries(network.elements),
    wires: network.wires,
    enabled: network.enabled,
  };
}

/**
 * Convert serializable format to LadderNetwork
 */
export function serializableToNetwork(data: SerializableLadderNetwork): LadderNetwork {
  return {
    id: data.id,
    label: data.label,
    comment: data.comment,
    elements: new Map(Object.entries(data.elements)),
    wires: data.wires,
    enabled: data.enabled,
  };
}
