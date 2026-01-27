/**
 * Modbus Service - Tauri Command Wrappers
 *
 * This service provides type-safe wrappers around Tauri backend commands
 * for Modbus server control and memory access operations.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  ModbusStatus,
  RtuConfig,
  PortInfo,
  TcpServerConfig,
  WriteOperation,
  MemoryType,
} from '../types/modbus';

/**
 * Modbus service for interacting with the Tauri backend
 */
export const modbusService = {
  // ============================================================================
  // Server Control - TCP
  // ============================================================================

  /**
   * Start the Modbus TCP server
   * @param config - TCP server configuration (optional, uses defaults if not provided)
   */
  async startTcp(config?: TcpServerConfig): Promise<void> {
    return invoke('modbus_start_tcp', { config });
  },

  /**
   * Stop the Modbus TCP server
   */
  async stopTcp(): Promise<void> {
    return invoke('modbus_stop_tcp');
  },

  // ============================================================================
  // Server Control - RTU
  // ============================================================================

  /**
   * Start the Modbus RTU server
   * @param config - RTU server configuration
   */
  async startRtu(config: RtuConfig): Promise<void> {
    return invoke('modbus_start_rtu', { config });
  },

  /**
   * Stop the Modbus RTU server
   */
  async stopRtu(): Promise<void> {
    return invoke('modbus_stop_rtu');
  },

  /**
   * List available serial ports
   */
  async listSerialPorts(): Promise<PortInfo[]> {
    return invoke('modbus_list_serial_ports');
  },

  // ============================================================================
  // Status
  // ============================================================================

  /**
   * Get the current status of Modbus servers
   */
  async getStatus(): Promise<ModbusStatus> {
    return invoke('modbus_get_status');
  },

  // ============================================================================
  // Memory Access - Coils
  // ============================================================================

  /**
   * Read coils from Modbus memory
   * @param start - Starting address
   * @param count - Number of coils to read
   */
  async readCoils(start: number, count: number): Promise<boolean[]> {
    return invoke('modbus_read_coils', { start, count });
  },

  /**
   * Write a single coil
   * @param address - Coil address
   * @param value - Value to write
   */
  async writeCoil(address: number, value: boolean): Promise<void> {
    return invoke('modbus_write_coil', { address, value });
  },

  /**
   * Write multiple coils
   * @param start - Starting address
   * @param values - Values to write
   */
  async writeCoils(start: number, values: boolean[]): Promise<void> {
    return invoke('modbus_write_coils', { start, values });
  },

  // ============================================================================
  // Memory Access - Discrete Inputs
  // ============================================================================

  /**
   * Read discrete inputs from Modbus memory
   * @param start - Starting address
   * @param count - Number of inputs to read
   */
  async readDiscreteInputs(start: number, count: number): Promise<boolean[]> {
    return invoke('modbus_read_discrete_inputs', { start, count });
  },

  /**
   * Write a discrete input (internal use for simulation)
   * @param address - Input address
   * @param value - Value to write
   */
  async writeDiscreteInput(address: number, value: boolean): Promise<void> {
    return invoke('modbus_write_discrete_input', { address, value });
  },

  // ============================================================================
  // Memory Access - Holding Registers
  // ============================================================================

  /**
   * Read holding registers from Modbus memory
   * @param start - Starting address
   * @param count - Number of registers to read
   */
  async readHoldingRegisters(start: number, count: number): Promise<number[]> {
    return invoke('modbus_read_holding_registers', { start, count });
  },

  /**
   * Write a single holding register
   * @param address - Register address
   * @param value - Value to write
   */
  async writeHoldingRegister(address: number, value: number): Promise<void> {
    return invoke('modbus_write_holding_register', { address, value });
  },

  /**
   * Write multiple holding registers
   * @param start - Starting address
   * @param values - Values to write
   */
  async writeHoldingRegisters(start: number, values: number[]): Promise<void> {
    return invoke('modbus_write_holding_registers', { start, values });
  },

  // ============================================================================
  // Memory Access - Input Registers
  // ============================================================================

  /**
   * Read input registers from Modbus memory
   * @param start - Starting address
   * @param count - Number of registers to read
   */
  async readInputRegisters(start: number, count: number): Promise<number[]> {
    return invoke('modbus_read_input_registers', { start, count });
  },

  /**
   * Write an input register (internal use for simulation)
   * @param address - Register address
   * @param value - Value to write
   */
  async writeInputRegister(address: number, value: number): Promise<void> {
    return invoke('modbus_write_input_register', { address, value });
  },

  // ============================================================================
  // Generic Memory Access
  // ============================================================================

  /**
   * Read memory values by type
   * @param type - Memory type (coil, discrete, holding, input)
   * @param start - Starting address
   * @param count - Number of values to read
   */
  async readMemory(
    type: MemoryType,
    start: number,
    count: number
  ): Promise<boolean[] | number[]> {
    switch (type) {
      case 'coil':
        return this.readCoils(start, count);
      case 'discrete':
        return this.readDiscreteInputs(start, count);
      case 'holding':
        return this.readHoldingRegisters(start, count);
      case 'input':
        return this.readInputRegisters(start, count);
    }
  },

  /**
   * Write a memory value by type
   * @param type - Memory type (coil, discrete, holding, input)
   * @param address - Address to write
   * @param value - Value to write
   */
  async writeMemory(
    type: MemoryType,
    address: number,
    value: boolean | number
  ): Promise<void> {
    switch (type) {
      case 'coil':
        return this.writeCoil(address, value as boolean);
      case 'discrete':
        return this.writeDiscreteInput(address, value as boolean);
      case 'holding':
        return this.writeHoldingRegister(address, value as number);
      case 'input':
        return this.writeInputRegister(address, value as number);
    }
  },

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Perform multiple write operations in bulk
   * @param operations - Array of write operations
   */
  async bulkWrite(operations: WriteOperation[]): Promise<void> {
    return invoke('modbus_bulk_write', { operations });
  },

  // ============================================================================
  // Memory Snapshots
  // ============================================================================

  /**
   * Save memory snapshot to CSV file
   * @param path - File path to save to
   */
  async saveMemoryCsv(path: string): Promise<void> {
    return invoke('modbus_save_memory_csv', { path });
  },

  /**
   * Load memory snapshot from CSV file
   * @param path - File path to load from
   */
  async loadMemoryCsv(path: string): Promise<void> {
    return invoke('modbus_load_memory_csv', { path });
  },
};

export default modbusService;
