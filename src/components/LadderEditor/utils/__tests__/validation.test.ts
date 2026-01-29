/**
 * Validation Utility Tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateDeviceAddress,
  validateDeviceAddressForType,
  validateTimerPreset,
  validateCounterPreset,
  validateCompareValue,
  validateLabel,
  collectValidationErrors,
} from '../validation';

describe('validateDeviceAddress', () => {
  it('should accept valid bit device addresses', () => {
    expect(validateDeviceAddress('M0000')).toEqual({ valid: true });
    expect(validateDeviceAddress('M0100')).toEqual({ valid: true });
    expect(validateDeviceAddress('P0000')).toEqual({ valid: true });
    expect(validateDeviceAddress('K2047')).toEqual({ valid: true });
    expect(validateDeviceAddress('F1000')).toEqual({ valid: true });
    expect(validateDeviceAddress('T0500')).toEqual({ valid: true });
    expect(validateDeviceAddress('C2047')).toEqual({ valid: true });
  });

  it('should accept valid word device addresses', () => {
    expect(validateDeviceAddress('D0000')).toEqual({ valid: true });
    expect(validateDeviceAddress('D9999')).toEqual({ valid: true });
    expect(validateDeviceAddress('R0100')).toEqual({ valid: true });
    expect(validateDeviceAddress('Z15')).toEqual({ valid: true });
    expect(validateDeviceAddress('N8191')).toEqual({ valid: true });
  });

  it('should accept addresses with bit index', () => {
    expect(validateDeviceAddress('D0000.0')).toEqual({ valid: true });
    expect(validateDeviceAddress('D0000.15')).toEqual({ valid: true });
  });

  it('should accept lowercase addresses (converted to uppercase)', () => {
    expect(validateDeviceAddress('m0000')).toEqual({ valid: true });
    expect(validateDeviceAddress('d100')).toEqual({ valid: true });
  });

  it('should reject empty addresses', () => {
    expect(validateDeviceAddress('')).toEqual({ valid: false, error: 'Address is required' });
    expect(validateDeviceAddress('   ')).toEqual({ valid: false, error: 'Address is required' });
  });

  it('should reject invalid device types', () => {
    const result = validateDeviceAddress('X0000');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid device type');
  });

  it('should reject addresses out of range', () => {
    // M device range is 0-8191
    const result = validateDeviceAddress('M9000');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be 0-8191');
  });

  it('should reject Z device addresses out of range', () => {
    // Z device range is 0-15
    const result = validateDeviceAddress('Z100');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be 0-15');
  });

  it('should reject invalid address formats', () => {
    expect(validateDeviceAddress('M')).toEqual({ valid: false, error: 'Invalid address format' });
    expect(validateDeviceAddress('MXXX')).toEqual({ valid: false, error: 'Invalid address format' });
    expect(validateDeviceAddress('M-100')).toEqual({ valid: false, error: 'Invalid address format' });
  });

  it('should reject bit index greater than 15', () => {
    const result = validateDeviceAddress('D0000.16');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid address format');
  });
});

describe('validateDeviceAddressForType', () => {
  it('should accept matching device types', () => {
    expect(validateDeviceAddressForType('M0000', 'M')).toEqual({ valid: true });
    expect(validateDeviceAddressForType('D100', 'D')).toEqual({ valid: true });
  });

  it('should reject mismatched device types', () => {
    const result = validateDeviceAddressForType('M0000', 'D');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Expected D device');
  });

  it('should propagate address validation errors', () => {
    const result = validateDeviceAddressForType('', 'M');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Address is required');
  });
});

describe('validateTimerPreset', () => {
  it('should accept valid preset values', () => {
    expect(validateTimerPreset(0, 'ms')).toEqual({ valid: true });
    expect(validateTimerPreset(1000, 'ms')).toEqual({ valid: true });
    expect(validateTimerPreset(32767, 'ms')).toEqual({ valid: true });
    expect(validateTimerPreset(65535, 's')).toEqual({ valid: true });
  });

  it('should reject negative values', () => {
    const result = validateTimerPreset(-1, 'ms');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('positive number');
  });

  it('should reject values exceeding max for ms time base', () => {
    const result = validateTimerPreset(32768, 'ms');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('0-32767');
  });

  it('should reject values exceeding absolute max', () => {
    const result = validateTimerPreset(65536, 's');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('0-65535');
  });
});

describe('validateCounterPreset', () => {
  it('should accept valid preset values', () => {
    expect(validateCounterPreset(0)).toEqual({ valid: true });
    expect(validateCounterPreset(1000)).toEqual({ valid: true });
    expect(validateCounterPreset(65535)).toEqual({ valid: true });
  });

  it('should reject negative values', () => {
    const result = validateCounterPreset(-1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('positive number');
  });

  it('should reject values exceeding max', () => {
    const result = validateCounterPreset(65536);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('0-65535');
  });
});

describe('validateCompareValue', () => {
  it('should accept valid numeric constants', () => {
    expect(validateCompareValue(0)).toEqual({ valid: true });
    expect(validateCompareValue(100)).toEqual({ valid: true });
    expect(validateCompareValue(-32768)).toEqual({ valid: true });
    expect(validateCompareValue(32767)).toEqual({ valid: true });
  });

  it('should accept valid device addresses', () => {
    expect(validateCompareValue('D0000')).toEqual({ valid: true });
    expect(validateCompareValue('M0100')).toEqual({ valid: true });
  });

  it('should accept valid numeric strings', () => {
    expect(validateCompareValue('100')).toEqual({ valid: true });
    expect(validateCompareValue('-100')).toEqual({ valid: true });
  });

  it('should reject numbers out of range', () => {
    let result = validateCompareValue(-32769);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('-32768 to 32767');

    result = validateCompareValue(32768);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('-32768 to 32767');
  });

  it('should reject empty values', () => {
    const result = validateCompareValue('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Value is required');
  });
});

describe('validateLabel', () => {
  it('should accept valid labels', () => {
    expect(validateLabel('')).toEqual({ valid: true });
    expect(validateLabel('Motor 1')).toEqual({ valid: true });
    expect(validateLabel('PUMP_START')).toEqual({ valid: true });
    expect(validateLabel('12345678901234567890123456789012')).toEqual({ valid: true }); // 32 chars
  });

  it('should reject labels that are too long', () => {
    const longLabel = 'A'.repeat(33);
    const result = validateLabel(longLabel);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('32 characters');
  });

  it('should reject labels with invalid characters', () => {
    const result = validateLabel('Test<>:');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalid characters');
  });
});

describe('collectValidationErrors', () => {
  it('should return empty array for all valid', () => {
    const validations = {
      address: { valid: true },
      preset: { valid: true },
    };
    expect(collectValidationErrors(validations)).toEqual([]);
  });

  it('should collect errors from invalid fields', () => {
    const validations = {
      address: { valid: false, error: 'Invalid address' },
      preset: { valid: true },
      label: { valid: false, error: 'Too long' },
    };
    const errors = collectValidationErrors(validations);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('address');
    expect(errors[0]).toContain('Invalid address');
    expect(errors[1]).toContain('label');
    expect(errors[1]).toContain('Too long');
  });
});
