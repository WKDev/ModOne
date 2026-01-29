/**
 * Parser Service
 *
 * Frontend service for Tauri parser commands including CSV parsing,
 * address mapping, and ladder program file operations.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  CsvRow,
  ModbusAddress,
  LadderProgram,
} from '../components/OneParser/types';

// ============================================================================
// CSV Parsing Commands
// ============================================================================

/**
 * Parse a CSV file from disk
 */
export async function parseCsvFile(path: string): Promise<CsvRow[]> {
  return await invoke<CsvRow[]>('parser_parse_csv_file', { path });
}

/**
 * Parse CSV content from string
 */
export async function parseCsvContent(content: string): Promise<CsvRow[]> {
  return await invoke<CsvRow[]>('parser_parse_csv_content', { content });
}

/**
 * Parse CSV content and group by step/network
 */
export async function parseCsvGrouped(
  content: string
): Promise<Record<number, CsvRow[]>> {
  return await invoke<Record<number, CsvRow[]>>('parser_parse_csv_grouped', {
    content,
  });
}

// ============================================================================
// Address Mapping Commands
// ============================================================================

/**
 * Map a device address string to Modbus address
 * @param deviceAddress - Device address like "M0000", "D0100.5"
 * @returns Modbus address or null if no mapping exists
 */
export async function mapAddressToModbus(
  deviceAddress: string
): Promise<ModbusAddress | null> {
  return await invoke<ModbusAddress | null>('parser_map_address_to_modbus', {
    deviceAddress,
  });
}

/**
 * Map a Modbus address back to device address(es)
 * @param modbusAddress - Modbus address to look up
 * @returns Array of device address strings (may be empty)
 */
export async function mapModbusToAddress(
  modbusAddress: ModbusAddress
): Promise<string[]> {
  return await invoke<string[]>('parser_map_modbus_to_address', {
    modbusAddress,
  });
}

/**
 * Check if a device address is read-only
 * @param deviceAddress - Device address to check
 * @returns True if the device is read-only
 */
export async function isReadOnly(deviceAddress: string): Promise<boolean> {
  return await invoke<boolean>('parser_is_read_only', { deviceAddress });
}

/**
 * Format a Modbus address for display
 * @param modbusAddress - Modbus address to format
 * @returns Formatted string like "Coil:100" or "Holding:200"
 */
export async function formatModbusAddress(
  modbusAddress: ModbusAddress
): Promise<string> {
  return await invoke<string>('parser_format_modbus_address', { modbusAddress });
}

/**
 * Parse a Modbus address string
 * @param addressStr - String like "Coil:100" or "Holding:200"
 * @returns Parsed Modbus address or null if invalid
 */
export async function parseModbusAddress(
  addressStr: string
): Promise<ModbusAddress | null> {
  return await invoke<ModbusAddress | null>('parser_parse_modbus_address', {
    addressStr,
  });
}

// ============================================================================
// Program File Commands
// ============================================================================

/**
 * Save a ladder program to a JSON file
 * @param path - File path to save to
 * @param program - Ladder program to save
 */
export async function saveProgram(
  path: string,
  program: LadderProgram
): Promise<void> {
  await invoke('parser_save_program', { path, program });
}

/**
 * Load a ladder program from a JSON file
 * @param path - File path to load from
 * @returns Loaded ladder program
 */
export async function loadProgram(path: string): Promise<LadderProgram> {
  return await invoke<LadderProgram>('parser_load_program', { path });
}

/**
 * Check if a program file exists
 * @param path - File path to check
 * @returns True if the file exists
 */
export async function programExists(path: string): Promise<boolean> {
  return await invoke<boolean>('parser_program_exists', { path });
}

// ============================================================================
// Service Object
// ============================================================================

/**
 * Parser service object with all methods
 */
export const parserService = {
  // CSV parsing
  parseCsvFile,
  parseCsvContent,
  parseCsvGrouped,

  // Address mapping
  mapAddressToModbus,
  mapModbusToAddress,
  isReadOnly,
  formatModbusAddress,
  parseModbusAddress,

  // Program files
  saveProgram,
  loadProgram,
  programExists,
};

export default parserService;
