/**
 * OneParser Type Definitions
 *
 * Types for parsing LS PLC ladder logic programs from XG5000 CSV export,
 * including device types, instruction types, AST structures, and Modbus mapping.
 */

import type { MemoryType } from '../../types/modbus';

// ============================================================================
// Device Types
// ============================================================================

/** LS PLC Bit Device Types */
export type BitDeviceType = 'P' | 'M' | 'K' | 'F' | 'T' | 'C';

/** LS PLC Word Device Types */
export type WordDeviceType = 'D' | 'R' | 'Z' | 'N';

/** All device types */
export type DeviceType = BitDeviceType | WordDeviceType;

/** Array of all bit device types for validation */
export const BIT_DEVICES: readonly BitDeviceType[] = ['P', 'M', 'K', 'F', 'T', 'C'] as const;

/** Array of all word device types for validation */
export const WORD_DEVICES: readonly WordDeviceType[] = ['D', 'R', 'Z', 'N'] as const;

/** Array of all device types */
export const ALL_DEVICES: readonly DeviceType[] = [...BIT_DEVICES, ...WORD_DEVICES] as const;

/** Device address with optional bit index */
export interface DeviceAddress {
  /** Device type (P, M, K, F, T, C, D, R, Z, N) */
  device: DeviceType;
  /** Address number (e.g., 0, 100, 1000) */
  address: number;
  /** Optional bit index for bit access on word devices (e.g., D0000.0) */
  bitIndex?: number;
  /** Optional index register for indexed addressing (e.g., D[Z0]) */
  indexRegister?: number;
}

// ============================================================================
// Instruction Types
// ============================================================================

/** Contact instruction types */
export type ContactInstructionType =
  | 'LOAD' | 'LOADN' | 'LOADP' | 'LOADF'
  | 'AND' | 'ANDN' | 'ANDP' | 'ANDF'
  | 'OR' | 'ORN' | 'ORP' | 'ORF';

/** Block instruction types */
export type BlockInstructionType = 'ANDB' | 'ORB';

/** Output instruction types */
export type OutputInstructionType = 'OUT' | 'OUTN' | 'SET' | 'RST';

/** Timer instruction types */
export type TimerInstructionType = 'TON' | 'TOF' | 'TMR';

/** Counter instruction types */
export type CounterInstructionType = 'CTU' | 'CTD' | 'CTUD';

/** Comparison instruction types */
export type ComparisonInstructionType =
  | 'LD=' | 'LD>' | 'LD<' | 'LD>=' | 'LD<=' | 'LD<>'
  | 'AND=' | 'AND>' | 'AND<' | 'AND>=' | 'AND<=' | 'AND<>'
  | 'OR=' | 'OR>' | 'OR<' | 'OR>=' | 'OR<=' | 'OR<>';

/** Math instruction types */
export type MathInstructionType = 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'MOV';

/** All instruction types */
export type InstructionType =
  | ContactInstructionType
  | BlockInstructionType
  | OutputInstructionType
  | TimerInstructionType
  | CounterInstructionType
  | ComparisonInstructionType
  | MathInstructionType;

/** Arrays for instruction validation */
export const CONTACT_INSTRUCTIONS: readonly ContactInstructionType[] = [
  'LOAD', 'LOADN', 'LOADP', 'LOADF',
  'AND', 'ANDN', 'ANDP', 'ANDF',
  'OR', 'ORN', 'ORP', 'ORF',
] as const;

export const BLOCK_INSTRUCTIONS: readonly BlockInstructionType[] = ['ANDB', 'ORB'] as const;

export const OUTPUT_INSTRUCTIONS: readonly OutputInstructionType[] = [
  'OUT', 'OUTN', 'SET', 'RST',
] as const;

export const TIMER_INSTRUCTIONS: readonly TimerInstructionType[] = ['TON', 'TOF', 'TMR'] as const;

export const COUNTER_INSTRUCTIONS: readonly CounterInstructionType[] = [
  'CTU', 'CTD', 'CTUD',
] as const;

export const COMPARISON_INSTRUCTIONS: readonly ComparisonInstructionType[] = [
  'LD=', 'LD>', 'LD<', 'LD>=', 'LD<=', 'LD<>',
  'AND=', 'AND>', 'AND<', 'AND>=', 'AND<=', 'AND<>',
  'OR=', 'OR>', 'OR<', 'OR>=', 'OR<=', 'OR<>',
] as const;

export const MATH_INSTRUCTIONS: readonly MathInstructionType[] = [
  'ADD', 'SUB', 'MUL', 'DIV', 'MOV',
] as const;

// ============================================================================
// CSV Row Types
// ============================================================================

/** Raw CSV row from XG5000 export */
export interface CsvRow {
  /** Row number in CSV */
  no: number;
  /** Network/Rung number (step) */
  step: number;
  /** Instruction mnemonic */
  instruction: string;
  /** First operand (optional) */
  operand1?: string;
  /** Second operand (optional) */
  operand2?: string;
  /** Third operand (optional) */
  operand3?: string;
  /** Comment (optional) */
  comment?: string;
}

// ============================================================================
// AST Node Types
// ============================================================================

/** Ladder node types */
export type LadderNodeType =
  | 'contact_no' | 'contact_nc' | 'contact_p' | 'contact_n'
  | 'coil_out' | 'coil_set' | 'coil_rst'
  | 'timer_ton' | 'timer_tof' | 'timer_tmr'
  | 'counter_ctu' | 'counter_ctd' | 'counter_ctud'
  | 'comparison' | 'math' | 'move'
  | 'block_series' | 'block_parallel';

/** Grid position for visualization */
export interface GridPosition {
  /** Row index (0-based) */
  row: number;
  /** Column index (0-based) */
  col: number;
}

/** Base ladder node */
export interface BaseLadderNode {
  /** Unique identifier */
  id: string;
  /** Node type discriminator */
  type: LadderNodeType;
  /** Device address (optional for block nodes) */
  address?: DeviceAddress;
  /** Comment (optional) */
  comment?: string;
  /** Grid position for visualization */
  gridPosition: GridPosition;
}

/** Contact node */
export interface ContactNode extends BaseLadderNode {
  type: 'contact_no' | 'contact_nc' | 'contact_p' | 'contact_n';
  address: DeviceAddress;
}

/** Coil node */
export interface CoilNode extends BaseLadderNode {
  type: 'coil_out' | 'coil_set' | 'coil_rst';
  address: DeviceAddress;
}

/** Time base for timer operations */
export type TimeBase = 'ms' | 's';

/** Timer node */
export interface TimerNode extends BaseLadderNode {
  type: 'timer_ton' | 'timer_tof' | 'timer_tmr';
  address: DeviceAddress;
  /** Timer preset value */
  preset: number;
  /** Time base (milliseconds or seconds) */
  timeBase: TimeBase;
}

/** Counter node */
export interface CounterNode extends BaseLadderNode {
  type: 'counter_ctu' | 'counter_ctd' | 'counter_ctud';
  address: DeviceAddress;
  /** Counter preset value */
  preset: number;
}

/** Comparison operator */
export type ComparisonOperator = '=' | '>' | '<' | '>=' | '<=' | '<>';

/** Comparison node */
export interface ComparisonNode extends BaseLadderNode {
  type: 'comparison';
  /** Comparison operator */
  operator: ComparisonOperator;
  /** First operand (device address or immediate value) */
  operand1: DeviceAddress | number;
  /** Second operand (device address or immediate value) */
  operand2: DeviceAddress | number;
}

/** Math operator */
export type MathOperator = 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'MOV';

/** Math node */
export interface MathNode extends BaseLadderNode {
  type: 'math' | 'move';
  /** Math operator */
  operator: MathOperator;
  /** First operand (device address or immediate value) */
  operand1: DeviceAddress | number;
  /** Second operand (device address or immediate value, optional for MOV) */
  operand2?: DeviceAddress | number;
  /** Destination device address */
  destination: DeviceAddress;
}

/** Block node (series/parallel connection) */
export interface BlockNode extends BaseLadderNode {
  type: 'block_series' | 'block_parallel';
  /** Child nodes in this block */
  children: LadderNode[];
}

/** Union type for all ladder nodes */
export type LadderNode =
  | ContactNode
  | CoilNode
  | TimerNode
  | CounterNode
  | ComparisonNode
  | MathNode
  | BlockNode;

// ============================================================================
// Program Structure
// ============================================================================

/** Ladder network (single rung) */
export interface LadderNetwork {
  /** Unique identifier */
  id: string;
  /** Rung number (step from CSV) */
  step: number;
  /** Nodes in this network */
  nodes: LadderNode[];
  /** Network comment (optional) */
  comment?: string;
}

/** Data type for symbol entries */
export type DataType = 'BOOL' | 'INT' | 'WORD' | 'DWORD' | 'REAL';

/** Symbol table entry */
export interface SymbolEntry {
  /** Device address */
  address: DeviceAddress;
  /** Symbol name (optional) */
  symbol?: string;
  /** Comment/description (optional) */
  comment?: string;
  /** Data type (optional) */
  dataType?: DataType;
}

/** Symbol table */
export interface SymbolTable {
  /** Symbol entries indexed by stringified address */
  entries: Map<string, SymbolEntry>;
}

/** Program metadata */
export interface ProgramMetadata {
  /** Program name */
  name: string;
  /** Description (optional) */
  description?: string;
  /** Author (optional) */
  author?: string;
  /** Creation timestamp (ISO 8601, optional) */
  createdAt?: string;
  /** Last modified timestamp (ISO 8601, optional) */
  modifiedAt?: string;
  /** Version (optional) */
  version?: string;
  /** PLC model (optional) */
  plcModel?: string;
}

/** Complete ladder program */
export interface LadderProgram {
  /** Program metadata */
  metadata: ProgramMetadata;
  /** Ladder networks (rungs) */
  networks: LadderNetwork[];
  /** Symbol table */
  symbolTable: SymbolTable;
}

// ============================================================================
// Modbus Mapping Types
// ============================================================================

/** Modbus address type (reuses MemoryType from modbus module) */
export type ModbusAddressType = MemoryType;

/** Modbus address */
export interface ModbusAddress {
  /** Modbus memory type */
  type: ModbusAddressType;
  /** Modbus address number */
  address: number;
}

/** Device to Modbus mapping rule */
export interface MappingRule {
  /** PLC device type */
  device: DeviceType;
  /** Modbus memory type to map to */
  modbusType: ModbusAddressType;
  /** Address offset for mapping */
  offset: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a device type is a bit device
 */
export function isBitDevice(device: DeviceType): device is BitDeviceType {
  return (BIT_DEVICES as readonly string[]).includes(device);
}

/**
 * Check if a device type is a word device
 */
export function isWordDevice(device: DeviceType): device is WordDeviceType {
  return (WORD_DEVICES as readonly string[]).includes(device);
}

/**
 * Check if a string is a valid device type
 */
export function isValidDeviceType(device: string): device is DeviceType {
  return (ALL_DEVICES as readonly string[]).includes(device);
}

/**
 * Check if a node is a contact node
 */
export function isContactNode(node: LadderNode): node is ContactNode {
  return (
    node.type === 'contact_no' ||
    node.type === 'contact_nc' ||
    node.type === 'contact_p' ||
    node.type === 'contact_n'
  );
}

/**
 * Check if a node is a coil node
 */
export function isCoilNode(node: LadderNode): node is CoilNode {
  return (
    node.type === 'coil_out' ||
    node.type === 'coil_set' ||
    node.type === 'coil_rst'
  );
}

/**
 * Check if a node is a timer node
 */
export function isTimerNode(node: LadderNode): node is TimerNode {
  return (
    node.type === 'timer_ton' ||
    node.type === 'timer_tof' ||
    node.type === 'timer_tmr'
  );
}

/**
 * Check if a node is a counter node
 */
export function isCounterNode(node: LadderNode): node is CounterNode {
  return (
    node.type === 'counter_ctu' ||
    node.type === 'counter_ctd' ||
    node.type === 'counter_ctud'
  );
}

/**
 * Check if a node is a comparison node
 */
export function isComparisonNode(node: LadderNode): node is ComparisonNode {
  return node.type === 'comparison';
}

/**
 * Check if a node is a math node
 */
export function isMathNode(node: LadderNode): node is MathNode {
  return node.type === 'math' || node.type === 'move';
}

/**
 * Check if a node is a block node
 */
export function isBlockNode(node: LadderNode): node is BlockNode {
  return node.type === 'block_series' || node.type === 'block_parallel';
}

/**
 * Check if a value is a device address (not an immediate number)
 */
export function isDeviceAddress(
  value: DeviceAddress | number
): value is DeviceAddress {
  return typeof value === 'object' && 'device' in value && 'address' in value;
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Device address parsing regex */
const DEVICE_ADDRESS_REGEX = /^([PMKFTCDRZN])(\d+)(?:\.(\d+))?(?:\[Z(\d+)\])?$/i;

/**
 * Parse a device address string into a DeviceAddress object
 * @param str - Address string (e.g., "M0000", "D100.5", "D[Z0]")
 * @returns Parsed DeviceAddress or null if invalid
 */
export function parseDeviceAddress(str: string): DeviceAddress | null {
  const match = str.trim().toUpperCase().match(DEVICE_ADDRESS_REGEX);
  if (!match) return null;

  const device = match[1] as DeviceType;
  if (!isValidDeviceType(device)) return null;

  const address = parseInt(match[2], 10);
  if (isNaN(address) || address < 0) return null;

  const result: DeviceAddress = { device, address };

  // Parse bit index if present
  if (match[3] !== undefined) {
    const bitIndex = parseInt(match[3], 10);
    if (isNaN(bitIndex) || bitIndex < 0 || bitIndex > 15) return null;
    result.bitIndex = bitIndex;
  }

  // Parse index register if present
  if (match[4] !== undefined) {
    const indexRegister = parseInt(match[4], 10);
    if (isNaN(indexRegister) || indexRegister < 0) return null;
    result.indexRegister = indexRegister;
  }

  return result;
}

/**
 * Format a DeviceAddress to string representation
 * @param addr - Device address to format
 * @returns Formatted string (e.g., "M0000", "D0100.5", "D0100[Z0]")
 */
export function formatDeviceAddress(addr: DeviceAddress): string {
  let result = `${addr.device}${addr.address.toString().padStart(4, '0')}`;

  if (addr.bitIndex !== undefined) {
    result += `.${addr.bitIndex}`;
  }

  if (addr.indexRegister !== undefined) {
    result += `[Z${addr.indexRegister}]`;
  }

  return result;
}

/**
 * Create a unique key for a device address (for use in Maps)
 * @param addr - Device address
 * @returns Unique key string
 */
export function deviceAddressKey(addr: DeviceAddress): string {
  return formatDeviceAddress(addr);
}

/**
 * Get default Modbus mapping rules for LS PLC devices
 * @returns Array of default mapping rules
 */
export function getDefaultMappingRules(): MappingRule[] {
  return [
    // Bit devices to coils
    { device: 'P', modbusType: 'coil', offset: 0 },       // P (Output) -> Coil 0-999
    { device: 'M', modbusType: 'coil', offset: 1000 },    // M (Internal) -> Coil 1000-1999
    { device: 'K', modbusType: 'discrete', offset: 0 },   // K (Keep) -> Discrete Input 0-999
    { device: 'F', modbusType: 'discrete', offset: 1000 },// F (Special) -> Discrete Input 1000-1999
    // Timer/Counter bits
    { device: 'T', modbusType: 'coil', offset: 2000 },    // T (Timer) -> Coil 2000-2999
    { device: 'C', modbusType: 'coil', offset: 3000 },    // C (Counter) -> Coil 3000-3999
    // Word devices to holding registers
    { device: 'D', modbusType: 'holding', offset: 0 },    // D (Data) -> Holding 0-9999
    { device: 'R', modbusType: 'holding', offset: 10000 },// R (Retentive) -> Holding 10000-19999
    { device: 'Z', modbusType: 'input', offset: 0 },      // Z (Index) -> Input 0-99
    { device: 'N', modbusType: 'input', offset: 100 },    // N (Constant) -> Input 100-199
  ];
}

// ============================================================================
// Default Values
// ============================================================================

/** Default program metadata */
export const DEFAULT_PROGRAM_METADATA: ProgramMetadata = {
  name: 'Untitled Program',
  description: '',
  author: '',
  version: '1.0.0',
};

/** Default grid position */
export const DEFAULT_GRID_POSITION: GridPosition = {
  row: 0,
  col: 0,
};

/**
 * Create an empty ladder program
 * @returns New empty LadderProgram
 */
export function createEmptyLadderProgram(): LadderProgram {
  const now = new Date().toISOString();
  return {
    metadata: {
      ...DEFAULT_PROGRAM_METADATA,
      createdAt: now,
      modifiedAt: now,
    },
    networks: [],
    symbolTable: { entries: new Map() },
  };
}

/**
 * Create a new ladder network
 * @param step - Rung/step number
 * @param comment - Optional network comment
 * @returns New LadderNetwork
 */
export function createLadderNetwork(step: number, comment?: string): LadderNetwork {
  return {
    id: crypto.randomUUID(),
    step,
    nodes: [],
    comment,
  };
}

/**
 * Create a contact node
 * @param type - Contact type (no, nc, p, n)
 * @param address - Device address
 * @param position - Grid position
 * @returns New ContactNode
 */
export function createContactNode(
  type: ContactNode['type'],
  address: DeviceAddress,
  position: GridPosition = DEFAULT_GRID_POSITION
): ContactNode {
  return {
    id: crypto.randomUUID(),
    type,
    address,
    gridPosition: position,
  };
}

/**
 * Create a coil node
 * @param type - Coil type (out, set, rst)
 * @param address - Device address
 * @param position - Grid position
 * @returns New CoilNode
 */
export function createCoilNode(
  type: CoilNode['type'],
  address: DeviceAddress,
  position: GridPosition = DEFAULT_GRID_POSITION
): CoilNode {
  return {
    id: crypto.randomUUID(),
    type,
    address,
    gridPosition: position,
  };
}

// ============================================================================
// Serialization Utilities
// ============================================================================

/** Serializable version of SymbolTable (for JSON) */
export interface SerializableSymbolTable {
  entries: Record<string, SymbolEntry>;
}

/** Serializable version of LadderProgram (for JSON) */
export interface SerializableLadderProgram {
  metadata: ProgramMetadata;
  networks: LadderNetwork[];
  symbolTable: SerializableSymbolTable;
}

/**
 * Convert LadderProgram to serializable format
 * @param program - Ladder program to convert
 * @returns Serializable ladder program
 */
export function ladderProgramToSerializable(
  program: LadderProgram
): SerializableLadderProgram {
  return {
    metadata: program.metadata,
    networks: program.networks,
    symbolTable: {
      entries: Object.fromEntries(program.symbolTable.entries),
    },
  };
}

/**
 * Convert serializable format to LadderProgram
 * @param data - Serializable data to convert
 * @returns LadderProgram
 */
export function serializableToLadderProgram(
  data: SerializableLadderProgram
): LadderProgram {
  return {
    metadata: data.metadata,
    networks: data.networks,
    symbolTable: {
      entries: new Map(Object.entries(data.symbolTable.entries)),
    },
  };
}
