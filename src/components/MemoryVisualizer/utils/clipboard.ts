/**
 * Clipboard Utilities
 *
 * Helper functions for clipboard operations in Memory Visualizer.
 */

import type { MemoryType } from '../../../types/modbus';
import type { DisplayFormat } from '../types';
import { formatValue } from './formatters';
import { formatModbusAddress } from './addressUtils';

/**
 * Copy text to clipboard.
 *
 * @param text - Text to copy
 * @returns Whether the copy was successful
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Copy a memory address to clipboard.
 *
 * @param memoryType - Type of memory
 * @param address - Memory address
 * @returns Whether the copy was successful
 */
export async function copyAddress(
  memoryType: MemoryType,
  address: number
): Promise<boolean> {
  const formattedAddress = formatModbusAddress(memoryType, address);
  return copyToClipboard(formattedAddress);
}

/**
 * Copy a memory value to clipboard.
 *
 * @param value - Value to copy
 * @param format - Display format
 * @returns Whether the copy was successful
 */
export async function copyValue(
  value: boolean | number,
  format: DisplayFormat
): Promise<boolean> {
  let text: string;

  if (typeof value === 'boolean') {
    text = value ? '1' : '0';
  } else {
    text = formatValue(value, format);
  }

  return copyToClipboard(text);
}
