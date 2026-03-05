/**
 * Modbus Service - Tauri Command Wrappers
 *
 * This service provides type-safe wrappers around Tauri backend commands
 * for Modbus server control and memory access operations.
 */

import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
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
    try {
      await invoke('modbus_start_tcp', { config });
    } catch (error) {
      toast.error('Modbus connection failed', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Stop the Modbus TCP server
   */
  async stopTcp(): Promise<void> {
    try {
      await invoke('modbus_stop_tcp');
    } catch (error) {
      toast.error('Failed to stop Modbus TCP server', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  // ============================================================================
  // Server Control - RTU
  // ============================================================================

  /**
   * Start the Modbus RTU server
   * @param config - RTU server configuration
   */
  async startRtu(config: RtuConfig): Promise<void> {
    try {
      await invoke('modbus_start_rtu', { config });
    } catch (error) {
      toast.error('Modbus connection failed', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Stop the Modbus RTU server
   */
  async stopRtu(): Promise<void> {
    try {
      await invoke('modbus_stop_rtu');
    } catch (error) {
      toast.error('Failed to stop Modbus RTU server', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * List available serial ports
   */
  async listSerialPorts(): Promise<PortInfo[]> {
    try {
      return await invoke('modbus_list_serial_ports');
    } catch (error) {
      toast.error('Failed to list serial ports', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  // ============================================================================
  // Status
  // ============================================================================

  /**
   * Get the current status of Modbus servers
   */
  async getStatus(): Promise<ModbusStatus> {
    try {
      return await invoke('modbus_get_status');
    } catch (error) {
      toast.error('Failed to get Modbus status', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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
    try {
      return await invoke('modbus_read_coils', { start, count });
    } catch (error) {
      toast.error('Failed to read Modbus coils', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Write a single coil
   * @param address - Coil address
   * @param value - Value to write
   */
  async writeCoil(address: number, value: boolean): Promise<void> {
    try {
      await invoke('modbus_write_coil', { address, value });
    } catch (error) {
      toast.error('Failed to write Modbus coil', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Write multiple coils
   * @param start - Starting address
   * @param values - Values to write
   */
  async writeCoils(start: number, values: boolean[]): Promise<void> {
    try {
      await invoke('modbus_write_coils', { start, values });
    } catch (error) {
      toast.error('Failed to write Modbus coils', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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
    try {
      return await invoke('modbus_read_discrete_inputs', { start, count });
    } catch (error) {
      toast.error('Failed to read discrete inputs', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Write a discrete input (internal use for simulation)
   * @param address - Input address
   * @param value - Value to write
   */
  async writeDiscreteInput(address: number, value: boolean): Promise<void> {
    try {
      await invoke('modbus_write_discrete_input', { address, value });
    } catch (error) {
      toast.error('Failed to write discrete input', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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
    try {
      return await invoke('modbus_read_holding_registers', { start, count });
    } catch (error) {
      toast.error('Failed to read holding registers', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Write a single holding register
   * @param address - Register address
   * @param value - Value to write
   */
  async writeHoldingRegister(address: number, value: number): Promise<void> {
    try {
      await invoke('modbus_write_holding_register', { address, value });
    } catch (error) {
      toast.error('Failed to write holding register', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Write multiple holding registers
   * @param start - Starting address
   * @param values - Values to write
   */
  async writeHoldingRegisters(start: number, values: number[]): Promise<void> {
    try {
      await invoke('modbus_write_holding_registers', { start, values });
    } catch (error) {
      toast.error('Failed to write holding registers', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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
    try {
      return await invoke('modbus_read_input_registers', { start, count });
    } catch (error) {
      toast.error('Failed to read input registers', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Write an input register (internal use for simulation)
   * @param address - Register address
   * @param value - Value to write
   */
  async writeInputRegister(address: number, value: number): Promise<void> {
    try {
      await invoke('modbus_write_input_register', { address, value });
    } catch (error) {
      toast.error('Failed to write input register', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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
    try {
      await invoke('modbus_bulk_write', { operations });
    } catch (error) {
      toast.error('Failed to perform bulk Modbus write', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  // ============================================================================
  // Memory Snapshots
  // ============================================================================

  /**
   * Save memory snapshot to CSV file
   * @param path - File path to save to
   */
  async saveMemoryCsv(path: string): Promise<void> {
    try {
      await invoke('modbus_save_memory_csv', { path });
    } catch (error) {
      toast.error('Failed to save Modbus memory CSV', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Load memory snapshot from CSV file
   * @param path - File path to load from
   */
  async loadMemoryCsv(path: string): Promise<void> {
    try {
      await invoke('modbus_load_memory_csv', { path });
    } catch (error) {
      toast.error('Failed to load Modbus memory CSV', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};

export default modbusService;
