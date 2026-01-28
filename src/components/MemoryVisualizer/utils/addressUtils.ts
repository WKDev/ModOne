/**
 * Address Utility Functions
 *
 * Utilities for formatting, parsing, and calculating memory addresses.
 */

import type { MemoryType } from '../../../types/modbus';

// ============================================================================
// Address Formatting
// ============================================================================

/**
 * Format an address in decimal or hexadecimal.
 *
 * @param address - The address to format (0-65535)
 * @param format - 'DEC' for decimal, 'HEX' for hexadecimal
 * @returns Formatted address string
 */
export function formatAddress(
  address: number,
  format: 'DEC' | 'HEX' = 'DEC'
): string {
  if (format === 'HEX') {
    return '0x' + address.toString(16).toUpperCase().padStart(4, '0');
  }
  return address.toString();
}

/**
 * Get the Modbus function code prefix for a memory type.
 * Used for generating standard Modbus addresses (e.g., 40001 for holding register 0).
 *
 * @param type - The memory type
 * @returns The Modbus prefix ('0', '1', '3', or '4')
 */
export function getModbusAddressPrefix(type: MemoryType): string {
  switch (type) {
    case 'coil':
      return '0'; // 0xxxx
    case 'discrete':
      return '1'; // 1xxxx
    case 'input':
      return '3'; // 3xxxx
    case 'holding':
      return '4'; // 4xxxx
    default:
      return '';
  }
}

/**
 * Format a full Modbus address with prefix.
 * e.g., holding register 0 -> "40001"
 *
 * @param type - The memory type
 * @param address - The address (0-based)
 * @returns Full Modbus address string
 */
export function formatModbusAddress(type: MemoryType, address: number): string {
  const prefix = getModbusAddressPrefix(type);
  // Modbus addresses are traditionally 1-based in display
  return prefix + (address + 1).toString().padStart(4, '0');
}

/**
 * Get the display name for a memory type.
 *
 * @param type - The memory type
 * @returns Human-readable name
 */
export function getMemoryTypeName(type: MemoryType): string {
  switch (type) {
    case 'coil':
      return 'Coil';
    case 'discrete':
      return 'Discrete Input';
    case 'holding':
      return 'Holding Register';
    case 'input':
      return 'Input Register';
    default:
      return 'Unknown';
  }
}

/**
 * Get the short display name for a memory type.
 *
 * @param type - The memory type
 * @returns Short name (2-3 characters)
 */
export function getMemoryTypeShortName(type: MemoryType): string {
  switch (type) {
    case 'coil':
      return 'CO';
    case 'discrete':
      return 'DI';
    case 'holding':
      return 'HR';
    case 'input':
      return 'IR';
    default:
      return '??';
  }
}

// ============================================================================
// Address Parsing
// ============================================================================

/**
 * Parse an address string to a number.
 *
 * @param input - Address string (can be decimal or hex with "0x" prefix)
 * @returns Parsed address or null if invalid
 */
export function parseAddress(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let value: number;

  if (trimmed.toLowerCase().startsWith('0x')) {
    value = parseInt(trimmed.slice(2), 16);
  } else {
    value = parseInt(trimmed, 10);
  }

  if (Number.isNaN(value) || value < 0 || value > 65535) {
    return null;
  }

  return value;
}

// ============================================================================
// Table Calculations
// ============================================================================

/**
 * Calculate the number of rows needed for a memory table.
 *
 * @param count - Total number of addresses to display
 * @param columns - Number of columns in the table
 * @returns Number of rows needed
 */
export function calculateRowCount(count: number, columns: number): number {
  if (columns <= 0) return 0;
  return Math.ceil(count / columns);
}

/**
 * Get the address for a specific cell in the table.
 *
 * @param startAddress - Starting address of the table
 * @param row - Row index (0-based)
 * @param col - Column index (0-based)
 * @param columns - Number of columns in the table
 * @returns The address for this cell
 */
export function getAddressForCell(
  startAddress: number,
  row: number,
  col: number,
  columns: number
): number {
  return startAddress + row * columns + col;
}

/**
 * Get row and column for an address.
 *
 * @param address - The address to locate
 * @param startAddress - Starting address of the table
 * @param columns - Number of columns in the table
 * @returns [row, col] or null if address is not in table
 */
export function getCellForAddress(
  address: number,
  startAddress: number,
  columns: number
): [number, number] | null {
  const offset = address - startAddress;
  if (offset < 0) return null;

  const row = Math.floor(offset / columns);
  const col = offset % columns;

  return [row, col];
}

/**
 * Check if an address is within a table range.
 *
 * @param address - The address to check
 * @param startAddress - Starting address of the table
 * @param count - Number of addresses in the table
 * @returns Whether the address is in range
 */
export function isAddressInRange(
  address: number,
  startAddress: number,
  count: number
): boolean {
  return address >= startAddress && address < startAddress + count;
}

// ============================================================================
// Address Range Utilities
// ============================================================================

/**
 * Generate an array of addresses for a range.
 *
 * @param startAddress - Starting address
 * @param count - Number of addresses
 * @returns Array of addresses
 */
export function getAddressRange(startAddress: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => startAddress + i);
}

/**
 * Validate an address range.
 *
 * @param startAddress - Starting address
 * @param count - Number of addresses
 * @returns Object with validation result and error message
 */
export function validateAddressRange(
  startAddress: number,
  count: number
): { valid: boolean; error?: string } {
  if (startAddress < 0) {
    return { valid: false, error: 'Start address must be >= 0' };
  }
  if (startAddress > 65535) {
    return { valid: false, error: 'Start address must be <= 65535' };
  }
  if (count < 1) {
    return { valid: false, error: 'Count must be >= 1' };
  }
  if (startAddress + count > 65536) {
    return {
      valid: false,
      error: 'Address range exceeds maximum (65535)',
    };
  }
  return { valid: true };
}
