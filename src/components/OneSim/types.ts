/**
 * OneSim Type Definitions
 *
 * Types for the OneSim PLC simulation engine including device memory,
 * timer/counter state, simulation configuration, and debugger interfaces.
 */

// Re-export common device types from OneParser for consistency
export type {
  BitDeviceType,
  WordDeviceType,
  DeviceType,
  DeviceAddress,
  TimeBase,
} from '../OneParser/types';

export {
  BIT_DEVICES,
  WORD_DEVICES,
  ALL_DEVICES,
  isBitDevice,
  isWordDevice,
  isValidDeviceType,
  parseDeviceAddress,
  formatDeviceAddress,
} from '../OneParser/types';

// ============================================================================
// Device Memory Configuration Types
// ============================================================================

/** Bit device configuration */
export interface BitDeviceConfig {
  /** Device type identifier */
  type: 'P' | 'M' | 'K' | 'F' | 'T' | 'C';
  /** Number of addresses available */
  size: number;
  /** Whether device is read-only from user code */
  readonly: boolean;
  /** Device description */
  description: string;
}

/** Word device configuration */
export interface WordDeviceConfig {
  /** Device type identifier */
  type: 'D' | 'R' | 'Z' | 'N' | 'TD' | 'CD';
  /** Number of addresses available */
  size: number;
  /** Device description */
  description: string;
}

/** Default bit device configurations for LS PLC */
export const BIT_DEVICE_CONFIGS: Record<string, BitDeviceConfig> = {
  P: { type: 'P', size: 2048, readonly: false, description: 'Output Relay' },
  M: { type: 'M', size: 8192, readonly: false, description: 'Internal Relay' },
  K: { type: 'K', size: 2048, readonly: false, description: 'Keep Relay' },
  F: { type: 'F', size: 2048, readonly: true, description: 'Special Relay' },
  T: { type: 'T', size: 2048, readonly: true, description: 'Timer Contact' },
  C: { type: 'C', size: 2048, readonly: true, description: 'Counter Contact' },
};

/** Default word device configurations for LS PLC */
export const WORD_DEVICE_CONFIGS: Record<string, WordDeviceConfig> = {
  D: { type: 'D', size: 10000, description: 'Data Register' },
  R: { type: 'R', size: 10000, description: 'Retentive Data Register' },
  Z: { type: 'Z', size: 16, description: 'Index Register' },
  N: { type: 'N', size: 8192, description: 'Constant Register' },
  TD: { type: 'TD', size: 2048, description: 'Timer Current Value' },
  CD: { type: 'CD', size: 2048, description: 'Counter Current Value' },
};

/** Extended word device types (includes timer/counter value registers) */
export type ExtendedWordDeviceType = 'D' | 'R' | 'Z' | 'N' | 'TD' | 'CD';

/** Check if a device type is a timer/counter value register */
export function isTimerCounterValue(type: string): type is 'TD' | 'CD' {
  return type === 'TD' || type === 'CD';
}

// ============================================================================
// Timer Types
// ============================================================================

/** Timer instruction types */
export type SimTimerType = 'TON' | 'TOF' | 'TMR';

/** Time base options */
export type SimTimeBase = 'ms' | '10ms' | '100ms' | 's';

/** Timer runtime state */
export interface TimerState {
  /** Whether timer input is enabled */
  enabled: boolean;
  /** Whether timer has completed (done bit) */
  done: boolean;
  /** Elapsed time in milliseconds */
  elapsed: number;
  /** Preset time in time base units */
  preset: number;
  /** Time base for preset */
  timeBase: SimTimeBase;
  /** Timer type */
  timerType: SimTimerType;
}

/** Array of timer types for validation */
export const TIMER_TYPES: readonly SimTimerType[] = ['TON', 'TOF', 'TMR'] as const;

/** Array of time bases for validation */
export const TIME_BASES: readonly SimTimeBase[] = ['ms', '10ms', '100ms', 's'] as const;

/** Convert time base to milliseconds multiplier */
export function timeBaseToMs(timeBase: SimTimeBase): number {
  switch (timeBase) {
    case 'ms': return 1;
    case '10ms': return 10;
    case '100ms': return 100;
    case 's': return 1000;
  }
}

/** Check if a string is a valid timer type */
export function isValidTimerType(type: string): type is SimTimerType {
  return (TIMER_TYPES as readonly string[]).includes(type);
}

/** Check if a string is a valid time base */
export function isValidTimeBase(base: string): base is SimTimeBase {
  return (TIME_BASES as readonly string[]).includes(base);
}

/** Check if timer preset is valid (positive integer) */
export function isValidTimerPreset(preset: number): boolean {
  return Number.isInteger(preset) && preset > 0 && preset <= 32767;
}

/** Create a default timer state */
export function createTimerState(
  timerType: SimTimerType = 'TON',
  preset = 1000,
  timeBase: SimTimeBase = 'ms'
): TimerState {
  return {
    enabled: false,
    done: false,
    elapsed: 0,
    preset,
    timeBase,
    timerType,
  };
}

/** Default timer state */
export const DEFAULT_TIMER_STATE: TimerState = createTimerState();

// ============================================================================
// Counter Types
// ============================================================================

/** Counter instruction types */
export type SimCounterType = 'CTU' | 'CTD' | 'CTUD';

/** Counter runtime state */
export interface CounterState {
  /** Whether counter has reached preset (done bit) */
  done: boolean;
  /** Current count value */
  currentValue: number;
  /** Preset value */
  preset: number;
  /** Previous state of count-up input (for edge detection) */
  prevUp: boolean;
  /** Previous state of count-down input (for CTUD) */
  prevDown?: boolean;
  /** Previous state of reset input (for edge detection) */
  prevReset?: boolean;
  /** Counter type */
  counterType: SimCounterType;
}

/** Array of counter types for validation */
export const COUNTER_TYPES: readonly SimCounterType[] = ['CTU', 'CTD', 'CTUD'] as const;

/** Check if a string is a valid counter type */
export function isValidCounterType(type: string): type is SimCounterType {
  return (COUNTER_TYPES as readonly string[]).includes(type);
}

/** Check if counter preset is valid */
export function isValidCounterPreset(preset: number): boolean {
  return Number.isInteger(preset) && preset >= -32768 && preset <= 32767;
}

/** Create a default counter state */
export function createCounterState(
  counterType: SimCounterType = 'CTU',
  preset = 10
): CounterState {
  return {
    done: false,
    currentValue: 0,
    preset,
    prevUp: false,
    prevDown: counterType === 'CTUD' ? false : undefined,
    prevReset: false,
    counterType,
  };
}

/** Default counter state */
export const DEFAULT_COUNTER_STATE: CounterState = createCounterState();

// ============================================================================
// Simulation Configuration Types
// ============================================================================

/** Synchronization mode for memory updates */
export type SyncMode = 'immediate' | 'endOfScan' | 'manual';

/** Simulation configuration */
export interface SimulationConfig {
  /** Target scan time in milliseconds (default: 10) */
  scanTimeMs: number;
  /** Watchdog timeout in milliseconds (default: 1000) */
  watchdogTimeoutMs: number;
  /** Memory synchronization mode */
  syncMode: SyncMode;
  /** Maximum history entries for watch variables */
  maxWatchHistory: number;
  /** Enable detailed timing statistics */
  enableTimingStats: boolean;
}

/** Default simulation configuration */
export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  scanTimeMs: 10,
  watchdogTimeoutMs: 1000,
  syncMode: 'endOfScan',
  maxWatchHistory: 100,
  enableTimingStats: true,
};

// ============================================================================
// Simulation Status Types
// ============================================================================

/** Simulation runtime state */
export type SimulationState = 'stopped' | 'running' | 'paused' | 'error';

/** Simulation runtime status */
export interface SimulationStatus {
  /** Current simulation state */
  state: SimulationState;
  /** Total number of scan cycles executed */
  scanCount: number;
  /** Last scan cycle time in microseconds */
  lastScanTimeUs: number;
  /** Average scan cycle time in microseconds */
  avgScanTimeUs: number;
  /** Maximum scan cycle time in microseconds */
  maxScanTimeUs: number;
  /** Minimum scan cycle time in microseconds */
  minScanTimeUs: number;
  /** Error message if state is 'error' */
  error?: string;
  /** Timestamp of last status update (ISO 8601) */
  lastUpdateTime: string;
}

/** Default simulation status */
export const DEFAULT_SIMULATION_STATUS: SimulationStatus = {
  state: 'stopped',
  scanCount: 0,
  lastScanTimeUs: 0,
  avgScanTimeUs: 0,
  maxScanTimeUs: 0,
  minScanTimeUs: 0,
  lastUpdateTime: new Date().toISOString(),
};

/** Scan cycle information */
export interface ScanCycleInfo {
  /** Total cycle count */
  cycleCount: number;
  /** Last scan time in microseconds */
  lastScanTime: number;
  /** Average scan time in microseconds */
  averageScanTime: number;
  /** Maximum scan time in microseconds */
  maxScanTime: number;
  /** Timestamp of this info (epoch ms) */
  timestamp: number;
}

// ============================================================================
// Debugger Types
// ============================================================================

/** Breakpoint types */
export type BreakpointType = 'network' | 'device' | 'condition' | 'scanCount';

/** Breakpoint definition */
export interface Breakpoint {
  /** Unique identifier */
  id: string;
  /** Breakpoint type */
  type: BreakpointType;
  /** Whether breakpoint is enabled */
  enabled: boolean;
  /** Network ID for network breakpoints */
  networkId?: number;
  /** Device address for device breakpoints (e.g., "M0000") */
  deviceAddress?: string;
  /** Condition expression for condition breakpoints */
  condition?: string;
  /** Scan count for scanCount breakpoints */
  scanCount?: number;
  /** Hit count (how many times this breakpoint was triggered) */
  hitCount: number;
  /** Optional description */
  description?: string;
}

/** Array of breakpoint types for validation */
export const BREAKPOINT_TYPES: readonly BreakpointType[] = [
  'network', 'device', 'condition', 'scanCount',
] as const;

/** Check if a breakpoint is conditional */
export function isConditionalBreakpoint(bp: Breakpoint): boolean {
  return bp.type === 'condition' && bp.condition !== undefined;
}

/** Create a new breakpoint */
export function createBreakpoint(
  type: BreakpointType,
  options: Partial<Omit<Breakpoint, 'id' | 'type' | 'hitCount'>> = {}
): Breakpoint {
  return {
    id: crypto.randomUUID(),
    type,
    enabled: true,
    hitCount: 0,
    ...options,
  };
}

/** Watch variable for monitoring device values */
export interface WatchVariable {
  /** Device address (e.g., "M0000", "D0100") */
  address: string;
  /** Current value */
  currentValue: number | boolean;
  /** Previous value */
  previousValue: number | boolean;
  /** Number of times the value has changed */
  changeCount: number;
  /** Timestamp of last change (epoch ms) */
  lastChangeTime: number;
  /** Value history (newest first) */
  history: Array<{
    value: number | boolean;
    timestamp: number;
  }>;
  /** Maximum history length */
  maxHistory: number;
}

/** Create a new watch variable */
export function createWatchVariable(
  address: string,
  initialValue: number | boolean = 0,
  maxHistory = 100
): WatchVariable {
  const now = Date.now();
  return {
    address,
    currentValue: initialValue,
    previousValue: initialValue,
    changeCount: 0,
    lastChangeTime: now,
    history: [{ value: initialValue, timestamp: now }],
    maxHistory,
  };
}

/** Update a watch variable with a new value */
export function updateWatchVariable(
  watch: WatchVariable,
  newValue: number | boolean
): WatchVariable {
  if (watch.currentValue === newValue) {
    return watch;
  }

  const now = Date.now();
  const newHistory = [
    { value: newValue, timestamp: now },
    ...watch.history,
  ].slice(0, watch.maxHistory);

  return {
    ...watch,
    previousValue: watch.currentValue,
    currentValue: newValue,
    changeCount: watch.changeCount + 1,
    lastChangeTime: now,
    history: newHistory,
  };
}

// ============================================================================
// Memory Snapshot Types
// ============================================================================

/** Memory snapshot for state capture/restore */
export interface MemorySnapshot {
  /** Snapshot ID */
  id: string;
  /** Snapshot name */
  name: string;
  /** Timestamp (ISO 8601) */
  timestamp: string;
  /** Bit device memory (device type -> address -> value) */
  bitDevices: Record<string, Record<number, boolean>>;
  /** Word device memory (device type -> address -> value) */
  wordDevices: Record<string, Record<number, number>>;
  /** Timer states */
  timerStates: Record<number, TimerState>;
  /** Counter states */
  counterStates: Record<number, CounterState>;
  /** Scan count at snapshot time */
  scanCount: number;
}

/** Create a new empty memory snapshot */
export function createMemorySnapshot(name = 'Snapshot'): MemorySnapshot {
  return {
    id: crypto.randomUUID(),
    name,
    timestamp: new Date().toISOString(),
    bitDevices: {},
    wordDevices: {},
    timerStates: {},
    counterStates: {},
    scanCount: 0,
  };
}

// ============================================================================
// Event Types
// ============================================================================

/** Simulation event types for Tauri event system */
export const SIM_EVENTS = {
  /** Simulation status changed */
  STATUS_CHANGED: 'sim:status-changed',
  /** Scan cycle completed */
  SCAN_COMPLETED: 'sim:scan-completed',
  /** Breakpoint hit */
  BREAKPOINT_HIT: 'sim:breakpoint-hit',
  /** Watch variable changed */
  WATCH_CHANGED: 'sim:watch-changed',
  /** Error occurred */
  ERROR: 'sim:error',
} as const;

/** Simulation status change event payload */
export interface SimStatusChangedEvent {
  /** Previous state */
  previousState: SimulationState;
  /** New state */
  newState: SimulationState;
  /** Timestamp */
  timestamp: string;
}

/** Breakpoint hit event payload */
export interface BreakpointHitEvent {
  /** Breakpoint that was hit */
  breakpoint: Breakpoint;
  /** Scan count when hit */
  scanCount: number;
  /** Timestamp */
  timestamp: string;
}
