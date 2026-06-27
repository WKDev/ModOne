/**
 * Modbus TypeScript Type Definitions
 *
 * Types for Modbus memory, events, and configuration used in the frontend.
 */

// ============================================================================
// Memory Types
// ============================================================================

/** Type of Modbus memory region */
export type MemoryType = 'coil' | 'discrete' | 'holding' | 'input';

/** Source of a memory change */
export type ChangeSource = 'internal' | 'external' | 'simulation';

// ============================================================================
// Event Types
// ============================================================================

/** Event emitted when a single memory value changes */
export interface MemoryChangeEvent {
  /** Type of memory: coil, discrete, holding, or input */
  register_type: MemoryType;
  /** Address that changed */
  address: number;
  /** Previous value (boolean for coils/discrete, number for registers) */
  old_value: boolean | number;
  /** New value (boolean for coils/discrete, number for registers) */
  new_value: boolean | number;
  /** Source of the change */
  source: ChangeSource;
}

/** Event emitted when multiple memory values change (batch operation) */
export interface MemoryBatchChangeEvent {
  /** All changes in the batch */
  changes: MemoryChangeEvent[];
}

/** Observability event emitted for each Modbus request/response exchange */
export interface ModbusTrafficEvent {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Transport protocol */
  protocol: 'tcp' | 'rtu';
  /** Client address (IP:port for TCP, port name for RTU) */
  client_addr: string;
  /** Target unit ID (slave address) */
  unit_id: number;
  /** Function code (e.g. 0x03) */
  function_code: number;
  /** Human-readable function name */
  function_name: string;
  /** Start address, if parseable */
  start_address: number | null;
  /** Quantity/count, if parseable */
  quantity: number | null;
  /** Exception code, if the response was an exception */
  exception_code: number | null;
  /** Whether the response was successful (not an exception) */
  success: boolean;
}

/** Event emitted when a client connects or disconnects */
export interface ConnectionEvent {
  /** Type of event */
  event_type: 'connected' | 'disconnected';
  /** Protocol used */
  protocol: 'tcp' | 'rtu';
  /** Client address (IP:port for TCP, port name for RTU) */
  client_addr: string;
  /** ISO 8601 timestamp */
  timestamp: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/** TCP server configuration */
export interface TcpServerConfig {
  /** Port to listen on (default: 502) */
  port?: number;
  /** Address to bind to (default: "0.0.0.0") */
  bind_address?: string;
  /** Modbus unit ID (default: 1) */
  unit_id?: number;
  /** Maximum connections (default: 10) */
  max_connections?: number;
}

/** Parity setting for RTU */
export type RtuParity = 'None' | 'Odd' | 'Even';

/** Stop bits setting for RTU */
export type RtuStopBits = 'One' | 'Two';

/** Data bits setting for RTU */
export type RtuDataBits = 'Seven' | 'Eight';

/** RTU server configuration */
export interface RtuConfig {
  /** Serial port name (e.g., "COM1" on Windows) */
  com_port: string;
  /** Baud rate (e.g., 9600, 19200, 38400, 57600, 115200) */
  baud_rate: number;
  /** Parity setting */
  parity: RtuParity;
  /** Stop bits setting */
  stop_bits: RtuStopBits;
  /** Data bits setting */
  data_bits: RtuDataBits;
  /** Modbus unit ID (slave address) */
  unit_id: number;
}

/** Information about an available serial port */
export interface PortInfo {
  /** Port name (e.g., "COM1") */
  name: string;
  /** Port type (USB, Bluetooth, PCI, Unknown) */
  port_type: string;
  /** Optional description (manufacturer/product for USB) */
  description?: string;
}

/** Status of Modbus servers */
export interface ModbusStatus {
  /** Whether TCP server is running */
  tcp_running: boolean;
  /** TCP server port (if running) */
  tcp_port?: number;
  /** Number of active TCP connections */
  tcp_connections: number;
  /** Whether RTU server is running */
  rtu_running: boolean;
  /** RTU serial port name (if running) */
  rtu_port?: string;
  /** RTU baud rate (if running) */
  rtu_baud_rate?: number;
}

// ============================================================================
// Value Generator Types
// ============================================================================

/** Target memory region for a value generator */
export type GeneratorTarget = 'coil' | 'discrete' | 'holding' | 'input';

/** Waveform driving a value generator */
export type Waveform = 'sine' | 'ramp' | 'square' | 'random' | 'counter';

/** A single value generator that drives a memory address with a waveform */
export interface GeneratorConfig {
  /** Stable id (client-generated) */
  id: string;
  /** Whether this generator is active */
  enabled: boolean;
  /** Target memory region */
  target: GeneratorTarget;
  /** Address to drive */
  address: number;
  /** Waveform shape */
  waveform: Waveform;
  /** Cycle period in milliseconds */
  period_ms: number;
  /** Output lower bound */
  min: number;
  /** Output upper bound */
  max: number;
}

/** A single write operation for bulk writes */
export interface WriteOperation {
  /** Type of memory to write: "coil", "discrete", "holding", or "input" */
  memory_type: MemoryType;
  /** Address to write to */
  address: number;
  /** Value to write (for coils: 0 = false, non-zero = true) */
  value: number;
}

// ============================================================================
// Event Names (constants for type safety)
// ============================================================================

/** Tauri event names for Modbus */
export const MODBUS_EVENTS = {
  /** Single memory change event */
  MEMORY_CHANGED: 'modbus:memory-changed',
  /** Batch memory change event */
  MEMORY_BATCH_CHANGED: 'modbus:memory-batch-changed',
  /** Connection status event */
  CONNECTION: 'modbus:connection',
  /** Request/response traffic event */
  TRAFFIC: 'modbus:traffic',
} as const;
