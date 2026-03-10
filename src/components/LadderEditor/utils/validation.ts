/**
 * Validation Utilities for Ladder Editor
 *
 * Address validation and property validation for ladder elements.
 */

import {
  parseDeviceAddress,
  isAddressInRange,
  DEVICE_RANGES,
  type DeviceType,
} from '../../OneParser/types';
import {
  type LadderElementType,
  type GridPosition,
  COIL_TYPES,
  TIMER_TYPES,
  COUNTER_TYPES,
  COMPARE_TYPES,
  CONTACT_TYPES,
} from '../../../types/ladder';

/**
 * Validation error result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a device address string
 * @param address - Address string to validate (e.g., "M0000", "D100")
 * @returns Validation result with error message if invalid
 */
export function validateDeviceAddress(address: string): ValidationResult {
  if (!address || address.trim() === '') {
    return { valid: false, error: 'Address is required' };
  }

  const trimmed = address.trim().toUpperCase();

  // Parse the address
  const parsed = parseDeviceAddress(trimmed);
  if (!parsed) {
    // Try to give a more specific error
    if (!/^[PMKFTCDRZN]/i.test(trimmed)) {
      return {
        valid: false,
        error: 'Invalid device type. Use P, M, K, F, T, C, D, R, Z, or N',
      };
    }
    return { valid: false, error: 'Invalid address format' };
  }

  // Check address range
  if (!isAddressInRange(parsed.device, parsed.address)) {
    const range = DEVICE_RANGES[parsed.device];
    return {
      valid: false,
      error: `${parsed.device} address must be ${range.start}-${range.end}`,
    };
  }

  // Validate bit index for word devices
  if (parsed.bitIndex !== undefined && parsed.bitIndex > 15) {
    return { valid: false, error: 'Bit index must be 0-15' };
  }

  return { valid: true };
}

/**
 * Validate address for a specific device type
 * @param address - Address string
 * @param expectedType - Expected device type
 * @returns Validation result
 */
export function validateDeviceAddressForType(
  address: string,
  expectedType: DeviceType
): ValidationResult {
  const basicResult = validateDeviceAddress(address);
  if (!basicResult.valid) {
    return basicResult;
  }

  const parsed = parseDeviceAddress(address);
  if (parsed && parsed.device !== expectedType) {
    return {
      valid: false,
      error: `Expected ${expectedType} device, got ${parsed.device}`,
    };
  }

  return { valid: true };
}

/**
 * Validate timer preset value
 * @param preset - Preset value
 * @param timeBase - Time base (ms or s)
 * @returns Validation result
 */
export function validateTimerPreset(
  preset: number,
  timeBase: 'ms' | 's'
): ValidationResult {
  if (isNaN(preset) || preset < 0) {
    return { valid: false, error: 'Preset must be a positive number' };
  }

  // Max 65535 for word-sized preset
  if (preset > 65535) {
    return { valid: false, error: 'Preset must be 0-65535' };
  }

  // Practical limits based on time base
  if (timeBase === 'ms' && preset > 32767) {
    return { valid: false, error: 'Preset in ms should be 0-32767' };
  }

  return { valid: true };
}

/**
 * Validate counter preset value
 * @param preset - Preset value
 * @returns Validation result
 */
export function validateCounterPreset(preset: number): ValidationResult {
  if (isNaN(preset) || preset < 0) {
    return { valid: false, error: 'Preset must be a positive number' };
  }

  if (preset > 65535) {
    return { valid: false, error: 'Preset must be 0-65535' };
  }

  return { valid: true };
}

/**
 * Validate a compare value (can be address or constant)
 * @param value - Value to validate
 * @returns Validation result
 */
export function validateCompareValue(value: string | number): ValidationResult {
  if (typeof value === 'number') {
    // Numeric constants: 16-bit signed range
    if (value < -32768 || value > 32767) {
      return { valid: false, error: 'Constant must be -32768 to 32767' };
    }
    return { valid: true };
  }

  // String value - either address or numeric string
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, error: 'Value is required' };
  }

  // Check if it's a numeric string
  const numValue = parseFloat(trimmed);
  if (!isNaN(numValue)) {
    if (numValue < -32768 || numValue > 32767) {
      return { valid: false, error: 'Constant must be -32768 to 32767' };
    }
    return { valid: true };
  }

  // Must be an address
  return validateDeviceAddress(trimmed);
}

/**
 * Validate element label
 * @param label - Label string
 * @returns Validation result
 */
export function validateLabel(label: string): ValidationResult {
  if (label.length > 32) {
    return { valid: false, error: 'Label must be 32 characters or less' };
  }

  // Check for invalid characters
  if (/[<>:"/\\|?*]/.test(label)) {
    return { valid: false, error: 'Label contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Format validation error for display
 * @param field - Field name
 * @param result - Validation result
 * @returns Formatted error message
 */
export function formatValidationError(
  field: string,
  result: ValidationResult
): string {
  if (result.valid) return '';
  return `${field}: ${result.error}`;
}

/**
 * Collect validation errors from multiple fields
 * @param validations - Object with field names and validation results
 * @returns Array of error messages
 */
export function collectValidationErrors(
  validations: Record<string, ValidationResult>
): string[] {
  return Object.entries(validations)
    .filter(([, result]) => !result.valid)
    .map(([field, result]) => formatValidationError(field, result));
}

/**
 * Check if a ladder element type is an output-type element
 * (e.g., coils, timers, counters)
 */
export function isOutputElementType(type: LadderElementType): boolean {
  return (
    (COIL_TYPES as readonly string[]).includes(type) ||
    (TIMER_TYPES as readonly string[]).includes(type) ||
    (COUNTER_TYPES as readonly string[]).includes(type)
  );
}

/**
 * Check if a ladder element type is an input-type element
 * (e.g., contacts, comparisons)
 */
export function isInputElementType(type: LadderElementType): boolean {
  return (
    (CONTACT_TYPES as readonly string[]).includes(type) ||
    (COMPARE_TYPES as readonly string[]).includes(type)
  );
}

/**
 * Validate placement of a ladder element based on IEC 61131-3 rules
 * @param type - Type of element being placed
 * @param position - Grid position
 * @param columns - Total number of columns in a rung
 * @returns Validation result
 */
export function validatePlacement(
  type: LadderElementType,
  position: GridPosition,
  columns: number
): ValidationResult {
  const isLastColumn = position.col === columns - 1;
  const isOutput = isOutputElementType(type);
  const isInput = isInputElementType(type);

  // Rule 2-1: Output elements must only be in the last column
  if (isOutput && !isLastColumn) {
    return {
      valid: false,
      error: '코일과 펑션 블록은 반드시 렁의 마지막 열에만 위치해야 합니다.',
    };
  }

  // Rule 2-1 (implied): Input elements cannot be in the last column
  if (isInput && isLastColumn) {
    return {
      valid: false,
      error: '마지막 열에는 코일 혹은 펑션 블록만 배치할 수 있습니다.',
    };
  }

  return { valid: true };
}
