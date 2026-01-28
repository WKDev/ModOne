/**
 * Value Formatting Utilities
 *
 * Functions for formatting and parsing memory values in different display formats.
 */

import type { DisplayFormat } from '../types';

// ============================================================================
// Value Formatting
// ============================================================================

/**
 * Format a 16-bit unsigned value based on the display format.
 *
 * @param value - The value to format (0-65535)
 * @param format - The display format to use
 * @returns Formatted string representation
 */
export function formatValue(value: number, format: DisplayFormat): string {
  switch (format) {
    case 'DEC':
      return value.toString();

    case 'HEX':
      return '0x' + value.toString(16).toUpperCase().padStart(4, '0');

    case 'BINARY':
      return value.toString(2).padStart(16, '0');

    case 'SIGNED':
      // Convert unsigned 16-bit to signed 16-bit
      return (value > 32767 ? value - 65536 : value).toString();

    case 'FLOAT32':
      // FLOAT32 requires two registers, return placeholder
      return 'N/A';

    default:
      return value.toString();
  }
}

/**
 * Format a boolean value for coil/discrete display.
 *
 * @param value - The boolean value
 * @returns "1" for true, "0" for false
 */
export function formatBooleanValue(value: boolean): string {
  return value ? '1' : '0';
}

// ============================================================================
// Value Parsing
// ============================================================================

/**
 * Parse user input string to a 16-bit unsigned value.
 *
 * @param input - User input string
 * @param format - The current display format (affects parsing behavior)
 * @returns Parsed value (0-65535) or null if invalid
 */
export function parseInputValue(
  input: string,
  format: DisplayFormat
): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    let value: number;

    // Check for explicit hex prefix regardless of format
    if (trimmed.toLowerCase().startsWith('0x')) {
      value = parseInt(trimmed.slice(2), 16);
    } else if (trimmed.toLowerCase().startsWith('0b')) {
      // Binary prefix
      value = parseInt(trimmed.slice(2), 2);
    } else {
      // Parse based on current format
      switch (format) {
        case 'HEX':
          value = parseInt(trimmed, 16);
          break;

        case 'BINARY':
          value = parseInt(trimmed, 2);
          break;

        case 'SIGNED': {
          const signed = parseInt(trimmed, 10);
          // Convert signed to unsigned
          value = signed < 0 ? signed + 65536 : signed;
          break;
        }

        case 'DEC':
        case 'FLOAT32':
        default:
          value = parseInt(trimmed, 10);
          break;
      }
    }

    // Validate the result
    if (Number.isNaN(value) || value < 0 || value > 65535) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

/**
 * Parse a boolean input value.
 *
 * @param input - User input string
 * @returns true, false, or null if invalid
 */
export function parseBooleanInput(input: string): boolean | null {
  const trimmed = input.trim().toLowerCase();

  if (trimmed === '1' || trimmed === 'true' || trimmed === 'on') {
    return true;
  }

  if (trimmed === '0' || trimmed === 'false' || trimmed === 'off') {
    return false;
  }

  return null;
}

// ============================================================================
// FLOAT32 Handling
// ============================================================================

/**
 * Format two 16-bit registers as a 32-bit float (IEEE 754).
 *
 * @param highWord - High 16-bit word (first register)
 * @param lowWord - Low 16-bit word (second register)
 * @param bigEndian - Whether to use big endian byte order (default: true)
 * @returns Formatted float string with 3 decimal places
 */
export function formatFloat32(
  highWord: number,
  lowWord: number,
  bigEndian = true
): string {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);

  if (bigEndian) {
    // Big Endian: high word first
    view.setUint16(0, highWord, false);
    view.setUint16(2, lowWord, false);
  } else {
    // Little Endian: low word first
    view.setUint16(0, lowWord, true);
    view.setUint16(2, highWord, true);
  }

  const floatValue = view.getFloat32(0, !bigEndian);

  // Check for special values
  if (Number.isNaN(floatValue)) {
    return 'NaN';
  }
  if (!Number.isFinite(floatValue)) {
    return floatValue > 0 ? '+Inf' : '-Inf';
  }

  return floatValue.toFixed(3);
}

/**
 * Parse a float value and split into two 16-bit registers.
 *
 * @param floatStr - Float value as string
 * @param bigEndian - Whether to use big endian byte order (default: true)
 * @returns [highWord, lowWord] or null if invalid
 */
export function parseFloat32ToRegisters(
  floatStr: string,
  bigEndian = true
): [number, number] | null {
  const value = parseFloat(floatStr);

  if (Number.isNaN(value)) {
    return null;
  }

  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);

  view.setFloat32(0, value, !bigEndian);

  if (bigEndian) {
    const highWord = view.getUint16(0, false);
    const lowWord = view.getUint16(2, false);
    return [highWord, lowWord];
  } else {
    const lowWord = view.getUint16(0, true);
    const highWord = view.getUint16(2, true);
    return [highWord, lowWord];
  }
}

// ============================================================================
// Format Helpers
// ============================================================================

/**
 * Get the maximum input length for a display format.
 *
 * @param format - The display format
 * @returns Maximum character length
 */
export function getMaxInputLength(format: DisplayFormat): number {
  switch (format) {
    case 'BINARY':
      return 16;
    case 'HEX':
      return 6; // "0xFFFF"
    case 'SIGNED':
      return 6; // "-32768"
    case 'DEC':
      return 5; // "65535"
    case 'FLOAT32':
      return 12; // e.g., "-123456.789"
    default:
      return 10;
  }
}

/**
 * Get placeholder text for a display format.
 *
 * @param format - The display format
 * @returns Placeholder text
 */
export function getInputPlaceholder(format: DisplayFormat): string {
  switch (format) {
    case 'BINARY':
      return '0000000000000000';
    case 'HEX':
      return '0x0000';
    case 'SIGNED':
      return '-32768 ~ 32767';
    case 'DEC':
      return '0 ~ 65535';
    case 'FLOAT32':
      return '0.000';
    default:
      return '';
  }
}
