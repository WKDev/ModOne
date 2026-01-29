/**
 * Unit tests for Device Address Parser
 *
 * Tests parseDeviceAddress, formatDeviceAddress, and isAddressInRange
 * functions for LS PLC device address handling.
 */

import { describe, it, expect } from 'vitest';
import {
  parseDeviceAddress,
  formatDeviceAddress,
  isAddressInRange,
  isValidDeviceType,
  isBitDevice,
  isWordDevice,
  DEVICE_RANGES,
  type DeviceType,
} from '../types';

describe('parseDeviceAddress', () => {
  describe('standard addresses', () => {
    it('should parse bit device addresses', () => {
      expect(parseDeviceAddress('P0001')).toEqual({ device: 'P', address: 1 });
      expect(parseDeviceAddress('M0100')).toEqual({ device: 'M', address: 100 });
      expect(parseDeviceAddress('K0000')).toEqual({ device: 'K', address: 0 });
      expect(parseDeviceAddress('F0500')).toEqual({ device: 'F', address: 500 });
      expect(parseDeviceAddress('T0010')).toEqual({ device: 'T', address: 10 });
      expect(parseDeviceAddress('C0200')).toEqual({ device: 'C', address: 200 });
    });

    it('should parse word device addresses', () => {
      expect(parseDeviceAddress('D0000')).toEqual({ device: 'D', address: 0 });
      expect(parseDeviceAddress('D1234')).toEqual({ device: 'D', address: 1234 });
      expect(parseDeviceAddress('R0100')).toEqual({ device: 'R', address: 100 });
      expect(parseDeviceAddress('Z0')).toEqual({ device: 'Z', address: 0 });
      expect(parseDeviceAddress('N0001')).toEqual({ device: 'N', address: 1 });
    });

    it('should be case-insensitive', () => {
      expect(parseDeviceAddress('d0100')).toEqual({ device: 'D', address: 100 });
      expect(parseDeviceAddress('m0050')).toEqual({ device: 'M', address: 50 });
    });

    it('should trim whitespace', () => {
      expect(parseDeviceAddress('  D0100  ')).toEqual({ device: 'D', address: 100 });
    });
  });

  describe('bit access on word devices', () => {
    it('should parse bit index access', () => {
      expect(parseDeviceAddress('D0000.0')).toEqual({
        device: 'D',
        address: 0,
        bitIndex: 0,
      });
      expect(parseDeviceAddress('D0000.15')).toEqual({
        device: 'D',
        address: 0,
        bitIndex: 15,
      });
      expect(parseDeviceAddress('D1000.8')).toEqual({
        device: 'D',
        address: 1000,
        bitIndex: 8,
      });
    });

    it('should reject bit index > 15', () => {
      expect(parseDeviceAddress('D0000.16')).toBeNull();
      expect(parseDeviceAddress('D0000.20')).toBeNull();
    });

    it('should reject negative bit index', () => {
      // The regex won't match negative numbers, so this is implicitly handled
      expect(parseDeviceAddress('D0000.-1')).toBeNull();
    });
  });

  describe('indexed addressing', () => {
    it('should parse index register addressing', () => {
      expect(parseDeviceAddress('D0000[Z0]')).toEqual({
        device: 'D',
        address: 0,
        indexRegister: 0,
      });
      expect(parseDeviceAddress('D0100[Z15]')).toEqual({
        device: 'D',
        address: 100,
        indexRegister: 15,
      });
    });

    it('should be case-insensitive for index register', () => {
      expect(parseDeviceAddress('D0000[z5]')).toEqual({
        device: 'D',
        address: 0,
        indexRegister: 5,
      });
    });
  });

  describe('combined bit access and indexing', () => {
    it('should parse bit access with index register', () => {
      expect(parseDeviceAddress('D0000.5[Z0]')).toEqual({
        device: 'D',
        address: 0,
        bitIndex: 5,
        indexRegister: 0,
      });
    });
  });

  describe('invalid addresses', () => {
    it('should return null for invalid device types', () => {
      expect(parseDeviceAddress('X0000')).toBeNull();
      expect(parseDeviceAddress('A0100')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseDeviceAddress('')).toBeNull();
    });

    it('should return null for malformed addresses', () => {
      expect(parseDeviceAddress('D')).toBeNull();
      expect(parseDeviceAddress('0000')).toBeNull();
      expect(parseDeviceAddress('DD0000')).toBeNull();
    });

    it('should return null for addresses with invalid characters', () => {
      expect(parseDeviceAddress('D-100')).toBeNull();
      expect(parseDeviceAddress('D100A')).toBeNull();
    });
  });
});

describe('formatDeviceAddress', () => {
  it('should format simple addresses with 4-digit padding', () => {
    expect(formatDeviceAddress({ device: 'D', address: 0 })).toBe('D0000');
    expect(formatDeviceAddress({ device: 'D', address: 100 })).toBe('D0100');
    expect(formatDeviceAddress({ device: 'M', address: 1234 })).toBe('M1234');
  });

  it('should format addresses with bit index', () => {
    expect(formatDeviceAddress({ device: 'D', address: 0, bitIndex: 0 })).toBe('D0000.0');
    expect(formatDeviceAddress({ device: 'D', address: 100, bitIndex: 15 })).toBe('D0100.15');
  });

  it('should format addresses with index register', () => {
    expect(formatDeviceAddress({ device: 'D', address: 0, indexRegister: 0 })).toBe('D0000[Z0]');
    expect(formatDeviceAddress({ device: 'D', address: 100, indexRegister: 5 })).toBe('D0100[Z5]');
  });

  it('should format addresses with both bit index and index register', () => {
    expect(
      formatDeviceAddress({ device: 'D', address: 0, bitIndex: 8, indexRegister: 3 })
    ).toBe('D0000.8[Z3]');
  });

  it('should handle large addresses', () => {
    expect(formatDeviceAddress({ device: 'D', address: 9999 })).toBe('D9999');
    expect(formatDeviceAddress({ device: 'D', address: 12345 })).toBe('D12345');
  });
});

describe('round-trip (parse -> format -> parse)', () => {
  const testAddresses = [
    'P0001',
    'M0100',
    'D0000',
    'D0100.5',
    'D0000[Z0]',
    'D1000.8[Z5]',
    'R9999',
    'Z0015',
  ];

  testAddresses.forEach((addr) => {
    it(`should round-trip "${addr}"`, () => {
      const parsed = parseDeviceAddress(addr);
      expect(parsed).not.toBeNull();
      const formatted = formatDeviceAddress(parsed!);
      const reparsed = parseDeviceAddress(formatted);
      expect(reparsed).toEqual(parsed);
    });
  });
});

describe('isAddressInRange', () => {
  describe('bit devices', () => {
    it('should validate P device range (0-2047)', () => {
      expect(isAddressInRange('P', 0)).toBe(true);
      expect(isAddressInRange('P', 2047)).toBe(true);
      expect(isAddressInRange('P', 2048)).toBe(false);
      expect(isAddressInRange('P', -1)).toBe(false);
    });

    it('should validate M device range (0-8191)', () => {
      expect(isAddressInRange('M', 0)).toBe(true);
      expect(isAddressInRange('M', 8191)).toBe(true);
      expect(isAddressInRange('M', 8192)).toBe(false);
    });

    it('should validate T device range (0-2047)', () => {
      expect(isAddressInRange('T', 0)).toBe(true);
      expect(isAddressInRange('T', 1000)).toBe(true);
      expect(isAddressInRange('T', 2048)).toBe(false);
    });

    it('should validate C device range (0-2047)', () => {
      expect(isAddressInRange('C', 0)).toBe(true);
      expect(isAddressInRange('C', 2047)).toBe(true);
      expect(isAddressInRange('C', 2048)).toBe(false);
    });
  });

  describe('word devices', () => {
    it('should validate D device range (0-9999)', () => {
      expect(isAddressInRange('D', 0)).toBe(true);
      expect(isAddressInRange('D', 5000)).toBe(true);
      expect(isAddressInRange('D', 9999)).toBe(true);
      expect(isAddressInRange('D', 10000)).toBe(false);
    });

    it('should validate R device range (0-9999)', () => {
      expect(isAddressInRange('R', 0)).toBe(true);
      expect(isAddressInRange('R', 9999)).toBe(true);
      expect(isAddressInRange('R', 10000)).toBe(false);
    });

    it('should validate Z device range (0-15)', () => {
      expect(isAddressInRange('Z', 0)).toBe(true);
      expect(isAddressInRange('Z', 15)).toBe(true);
      expect(isAddressInRange('Z', 16)).toBe(false);
    });

    it('should validate N device range (0-8191)', () => {
      expect(isAddressInRange('N', 0)).toBe(true);
      expect(isAddressInRange('N', 8191)).toBe(true);
      expect(isAddressInRange('N', 8192)).toBe(false);
    });
  });
});

describe('DEVICE_RANGES constant', () => {
  it('should have ranges for all device types', () => {
    const allDevices: DeviceType[] = ['P', 'M', 'K', 'F', 'T', 'C', 'D', 'R', 'Z', 'N'];
    allDevices.forEach((device) => {
      expect(DEVICE_RANGES[device]).toBeDefined();
      expect(DEVICE_RANGES[device].start).toBeDefined();
      expect(DEVICE_RANGES[device].end).toBeDefined();
      expect(DEVICE_RANGES[device].start).toBeLessThanOrEqual(DEVICE_RANGES[device].end);
    });
  });
});

describe('type guards', () => {
  describe('isValidDeviceType', () => {
    it('should return true for valid device types', () => {
      expect(isValidDeviceType('P')).toBe(true);
      expect(isValidDeviceType('M')).toBe(true);
      expect(isValidDeviceType('D')).toBe(true);
      expect(isValidDeviceType('Z')).toBe(true);
    });

    it('should return false for invalid device types', () => {
      expect(isValidDeviceType('X')).toBe(false);
      expect(isValidDeviceType('A')).toBe(false);
      expect(isValidDeviceType('')).toBe(false);
    });
  });

  describe('isBitDevice', () => {
    it('should return true for bit devices', () => {
      expect(isBitDevice('P')).toBe(true);
      expect(isBitDevice('M')).toBe(true);
      expect(isBitDevice('K')).toBe(true);
      expect(isBitDevice('F')).toBe(true);
      expect(isBitDevice('T')).toBe(true);
      expect(isBitDevice('C')).toBe(true);
    });

    it('should return false for word devices', () => {
      expect(isBitDevice('D')).toBe(false);
      expect(isBitDevice('R')).toBe(false);
      expect(isBitDevice('Z')).toBe(false);
      expect(isBitDevice('N')).toBe(false);
    });
  });

  describe('isWordDevice', () => {
    it('should return true for word devices', () => {
      expect(isWordDevice('D')).toBe(true);
      expect(isWordDevice('R')).toBe(true);
      expect(isWordDevice('Z')).toBe(true);
      expect(isWordDevice('N')).toBe(true);
    });

    it('should return false for bit devices', () => {
      expect(isWordDevice('P')).toBe(false);
      expect(isWordDevice('M')).toBe(false);
      expect(isWordDevice('K')).toBe(false);
      expect(isWordDevice('F')).toBe(false);
      expect(isWordDevice('T')).toBe(false);
      expect(isWordDevice('C')).toBe(false);
    });
  });
});
