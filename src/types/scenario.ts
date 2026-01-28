/**
 * Scenario Editor Type Definitions
 *
 * Types for scenario-based testing including events, execution state,
 * and Modbus address formats.
 */

import type { MemoryType } from './modbus';

// ============================================================================
// Modbus Address Types
// ============================================================================

/** Modbus address prefix types */
export type ModbusAddressPrefix = 'C' | 'DI' | 'H' | 'IR';

/** Mapping of prefix to memory type */
export const ADDRESS_PREFIX_TO_MEMORY_TYPE: Record<ModbusAddressPrefix, MemoryType> = {
  C: 'coil',
  DI: 'discrete',
  H: 'holding',
  IR: 'input',
};

/** Mapping of memory type to prefix */
export const MEMORY_TYPE_TO_ADDRESS_PREFIX: Record<MemoryType, ModbusAddressPrefix> = {
  coil: 'C',
  discrete: 'DI',
  holding: 'H',
  input: 'IR',
};

/** Valid address ranges per memory type */
export const ADDRESS_RANGES: Record<ModbusAddressPrefix, { min: number; max: number }> = {
  C: { min: 0, max: 65535 },      // Coils: 0x0000 - 0xFFFF
  DI: { min: 0, max: 65535 },     // Discrete Inputs: 0x0000 - 0xFFFF
  H: { min: 0, max: 65535 },      // Holding Registers: 0x0000 - 0xFFFF
  IR: { min: 0, max: 65535 },     // Input Registers: 0x0000 - 0xFFFF
};

/** Regex pattern for validating Modbus addresses */
export const MODBUS_ADDRESS_REGEX = /^(C|DI|H|IR):0x[0-9A-Fa-f]{1,4}$/;

/** Alternative decimal format regex */
export const MODBUS_ADDRESS_DECIMAL_REGEX = /^(C|DI|H|IR):\d{1,5}$/;

/**
 * Parsed Modbus address structure
 */
export interface ParsedModbusAddress {
  /** Address prefix (C, DI, H, IR) */
  prefix: ModbusAddressPrefix;
  /** Numeric address value */
  address: number;
  /** Original string representation */
  raw: string;
}

// ============================================================================
// Scenario Event Types
// ============================================================================

/**
 * A single timed memory write event in a scenario
 */
export interface ScenarioEvent {
  /** Unique identifier (UUID) */
  id: string;
  /** Time in seconds from simulation start */
  time: number;
  /** Modbus address (e.g., 'C:0x0001', 'H:0x0100') */
  address: string;
  /** Value to write (0-65535 for registers, 0-1 for coils) */
  value: number;
  /** Whether the value persists after being set */
  persist: boolean;
  /** Auto-release duration in ms (when persist=false) */
  persistDuration?: number;
  /** Description/note for this event */
  note: string;
  /** Whether the event is enabled */
  enabled: boolean;
}

// ============================================================================
// Scenario Metadata and Settings
// ============================================================================

/**
 * Scenario metadata
 */
export interface ScenarioMetadata {
  /** Scenario name */
  name: string;
  /** Scenario description */
  description: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
  /** Author name */
  author: string;
}

/**
 * Scenario execution settings
 */
export interface ScenarioSettings {
  /** Whether to loop the scenario */
  loop: boolean;
  /** Number of loop iterations (0 = infinite) */
  loopCount: number;
  /** Delay between loops in ms */
  loopDelay: number;
  /** Whether to start automatically when loaded */
  autoStart: boolean;
}

// ============================================================================
// Execution State
// ============================================================================

/** Scenario execution status */
export type ScenarioStatus = 'idle' | 'running' | 'paused' | 'stopped';

/**
 * Runtime execution state for UI tracking
 */
export interface ScenarioExecutionState {
  /** Current execution status */
  status: ScenarioStatus;
  /** Elapsed time in seconds */
  currentTime: number;
  /** Index of the current/next event to execute */
  currentEventIndex: number;
  /** IDs of completed events */
  completedEvents: string[];
  /** Current loop iteration (1-based) */
  currentLoopIteration: number;
}

// ============================================================================
// Complete Scenario
// ============================================================================

/**
 * Complete scenario definition
 */
export interface Scenario {
  /** Scenario metadata */
  metadata: ScenarioMetadata;
  /** Execution settings */
  settings: ScenarioSettings;
  /** Ordered list of events */
  events: ScenarioEvent[];
}

// ============================================================================
// Type Guards and Validators
// ============================================================================

/**
 * Check if a string is a valid Modbus address prefix
 */
export function isValidAddressPrefix(prefix: string): prefix is ModbusAddressPrefix {
  return ['C', 'DI', 'H', 'IR'].includes(prefix);
}

/**
 * Check if a string is a valid Modbus address format
 */
export function isValidModbusAddress(address: string): boolean {
  return MODBUS_ADDRESS_REGEX.test(address) || MODBUS_ADDRESS_DECIMAL_REGEX.test(address);
}

/**
 * Parse a Modbus address string into its components
 */
export function parseModbusAddress(address: string): ParsedModbusAddress | null {
  // Try hex format first
  const hexMatch = address.match(/^(C|DI|H|IR):0x([0-9A-Fa-f]{1,4})$/);
  if (hexMatch) {
    const prefix = hexMatch[1] as ModbusAddressPrefix;
    const numericAddress = parseInt(hexMatch[2], 16);
    return { prefix, address: numericAddress, raw: address };
  }

  // Try decimal format
  const decMatch = address.match(/^(C|DI|H|IR):(\d{1,5})$/);
  if (decMatch) {
    const prefix = decMatch[1] as ModbusAddressPrefix;
    const numericAddress = parseInt(decMatch[2], 10);
    if (numericAddress <= 65535) {
      return { prefix, address: numericAddress, raw: address };
    }
  }

  return null;
}

/**
 * Format a Modbus address to string
 */
export function formatModbusAddress(
  prefix: ModbusAddressPrefix,
  address: number,
  useHex = true
): string {
  if (useHex) {
    return `${prefix}:0x${address.toString(16).toUpperCase().padStart(4, '0')}`;
  }
  return `${prefix}:${address}`;
}

/**
 * Check if a value is valid for a given address type
 */
export function isValidValueForAddress(prefix: ModbusAddressPrefix, value: number): boolean {
  if (prefix === 'C' || prefix === 'DI') {
    // Coils and discrete inputs: 0 or 1
    return value === 0 || value === 1;
  }
  // Registers: 0-65535
  return Number.isInteger(value) && value >= 0 && value <= 65535;
}

/**
 * Check if a scenario event is valid
 */
export function isValidScenarioEvent(event: ScenarioEvent): boolean {
  // Check required fields
  if (!event.id || typeof event.time !== 'number' || event.time < 0) {
    return false;
  }

  // Validate address
  const parsed = parseModbusAddress(event.address);
  if (!parsed) {
    return false;
  }

  // Validate value for address type
  if (!isValidValueForAddress(parsed.prefix, event.value)) {
    return false;
  }

  // Validate persist duration if specified
  if (event.persistDuration !== undefined && event.persistDuration < 0) {
    return false;
  }

  return true;
}

// ============================================================================
// Default Values
// ============================================================================

/** Default scenario metadata */
export const DEFAULT_SCENARIO_METADATA: ScenarioMetadata = {
  name: 'Untitled Scenario',
  description: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  author: '',
};

/** Default scenario settings */
export const DEFAULT_SCENARIO_SETTINGS: ScenarioSettings = {
  loop: false,
  loopCount: 1,
  loopDelay: 0,
  autoStart: false,
};

/** Default execution state */
export const DEFAULT_EXECUTION_STATE: ScenarioExecutionState = {
  status: 'idle',
  currentTime: 0,
  currentEventIndex: 0,
  completedEvents: [],
  currentLoopIteration: 1,
};

/** Create a new empty scenario */
export function createEmptyScenario(): Scenario {
  return {
    metadata: {
      ...DEFAULT_SCENARIO_METADATA,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    settings: { ...DEFAULT_SCENARIO_SETTINGS },
    events: [],
  };
}

/** Create a new scenario event with defaults */
export function createScenarioEvent(
  overrides: Partial<ScenarioEvent> = {}
): ScenarioEvent {
  return {
    id: crypto.randomUUID(),
    time: 0,
    address: 'C:0x0000',
    value: 0,
    persist: true,
    note: '',
    enabled: true,
    ...overrides,
  };
}

// ============================================================================
// Serialization Utilities
// ============================================================================

/**
 * Sort events by time (for execution order)
 */
export function sortEventsByTime(events: ScenarioEvent[]): ScenarioEvent[] {
  return [...events].sort((a, b) => a.time - b.time);
}

/**
 * Get enabled events only
 */
export function getEnabledEvents(events: ScenarioEvent[]): ScenarioEvent[] {
  return events.filter((e) => e.enabled);
}

/**
 * Get the total duration of a scenario (time of last event)
 */
export function getScenarioDuration(scenario: Scenario): number {
  if (scenario.events.length === 0) return 0;
  const enabledEvents = getEnabledEvents(scenario.events);
  if (enabledEvents.length === 0) return 0;
  return Math.max(...enabledEvents.map((e) => e.time));
}
