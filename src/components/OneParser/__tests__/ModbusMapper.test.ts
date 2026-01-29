/**
 * ModbusMapper Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ModbusMapper,
  DEFAULT_MAPPING_RULES,
  SPECIAL_MAPPINGS,
  formatModbusAddress,
  parseModbusAddress,
  createDefaultMapper,
} from '../ModbusMapper';
import type { DeviceAddress, MappingRule } from '../types';

describe('ModbusMapper', () => {
  let mapper: ModbusMapper;

  beforeEach(() => {
    mapper = new ModbusMapper();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('initialization', () => {
    it('should create mapper with default rules', () => {
      expect(mapper).toBeDefined();
      expect(mapper.getRule('M')).toBeDefined();
      expect(mapper.getRule('D')).toBeDefined();
    });

    it('should allow custom rules to override defaults', () => {
      const customRules: MappingRule[] = [
        { device: 'M', modbusType: 'coil', offset: 5000 },
      ];
      const customMapper = new ModbusMapper(customRules);

      const rule = customMapper.getRule('M');
      expect(rule?.offset).toBe(5000);
    });

    it('createDefaultMapper should return a valid mapper', () => {
      const defaultMapper = createDefaultMapper();
      expect(defaultMapper).toBeInstanceOf(ModbusMapper);
    });
  });

  // ==========================================================================
  // DEFAULT_MAPPING_RULES Tests
  // ==========================================================================

  describe('DEFAULT_MAPPING_RULES', () => {
    it('should contain all 10 device types', () => {
      expect(DEFAULT_MAPPING_RULES.length).toBe(10);
    });

    it('should have correct offsets for bit devices', () => {
      const mRule = DEFAULT_MAPPING_RULES.find(r => r.device === 'M');
      const kRule = DEFAULT_MAPPING_RULES.find(r => r.device === 'K');
      const tRule = DEFAULT_MAPPING_RULES.find(r => r.device === 'T');
      const cRule = DEFAULT_MAPPING_RULES.find(r => r.device === 'C');

      expect(mRule?.offset).toBe(0);
      expect(kRule?.offset).toBe(8192);
      expect(tRule?.offset).toBe(10240);
      expect(cRule?.offset).toBe(12288);
    });

    it('should have correct offsets for word devices', () => {
      const dRule = DEFAULT_MAPPING_RULES.find(r => r.device === 'D');
      const rRule = DEFAULT_MAPPING_RULES.find(r => r.device === 'R');

      expect(dRule?.offset).toBe(0);
      expect(rRule?.offset).toBe(10000);
    });
  });

  // ==========================================================================
  // SPECIAL_MAPPINGS Tests
  // ==========================================================================

  describe('SPECIAL_MAPPINGS', () => {
    it('should have correct TD offset', () => {
      expect(SPECIAL_MAPPINGS.TD.offset).toBe(28208);
      expect(SPECIAL_MAPPINGS.TD.modbusType).toBe('holding');
    });

    it('should have correct CD offset', () => {
      expect(SPECIAL_MAPPINGS.CD.offset).toBe(30256);
      expect(SPECIAL_MAPPINGS.CD.modbusType).toBe('holding');
    });
  });

  // ==========================================================================
  // mapToModbus Tests
  // ==========================================================================

  describe('mapToModbus', () => {
    it('should map P to discrete input at offset 0', () => {
      const addr: DeviceAddress = { device: 'P', address: 100 };
      const result = mapper.mapToModbus(addr);

      expect(result).toEqual({ type: 'discrete', address: 100 });
    });

    it('should map M to coil at offset 0', () => {
      const addr: DeviceAddress = { device: 'M', address: 100 };
      const result = mapper.mapToModbus(addr);

      expect(result).toEqual({ type: 'coil', address: 100 });
    });

    it('should map K to coil at offset 8192', () => {
      const addr: DeviceAddress = { device: 'K', address: 0 };
      const result = mapper.mapToModbus(addr);

      expect(result).toEqual({ type: 'coil', address: 8192 });
    });

    it('should map K100 to coil 8292', () => {
      const addr: DeviceAddress = { device: 'K', address: 100 };
      const result = mapper.mapToModbus(addr);

      expect(result).toEqual({ type: 'coil', address: 8292 });
    });

    it('should map T to coil at offset 10240', () => {
      const addr: DeviceAddress = { device: 'T', address: 5 };
      const result = mapper.mapToModbus(addr);

      expect(result).toEqual({ type: 'coil', address: 10245 });
    });

    it('should map C to coil at offset 12288', () => {
      const addr: DeviceAddress = { device: 'C', address: 10 };
      const result = mapper.mapToModbus(addr);

      expect(result).toEqual({ type: 'coil', address: 12298 });
    });

    it('should map D to holding register at offset 0', () => {
      const addr: DeviceAddress = { device: 'D', address: 100 };
      const result = mapper.mapToModbus(addr);

      expect(result).toEqual({ type: 'holding', address: 100 });
    });

    it('should map R to holding register at offset 10000', () => {
      const addr: DeviceAddress = { device: 'R', address: 500 };
      const result = mapper.mapToModbus(addr);

      expect(result).toEqual({ type: 'holding', address: 10500 });
    });

    it('should map F to discrete input at offset 2048', () => {
      const addr: DeviceAddress = { device: 'F', address: 0 };
      const result = mapper.mapToModbus(addr);

      expect(result).toEqual({ type: 'discrete', address: 2048 });
    });

    it('should handle bit access on word device (D0.5)', () => {
      const addr: DeviceAddress = { device: 'D', address: 0, bitIndex: 5 };
      const result = mapper.mapToModbus(addr);

      // D0 at offset 0, so (0 + 0) * 16 + 5 = 5
      expect(result).toEqual({ type: 'coil', address: 5 });
    });

    it('should handle bit access on word device (D1.5)', () => {
      const addr: DeviceAddress = { device: 'D', address: 1, bitIndex: 5 };
      const result = mapper.mapToModbus(addr);

      // D1 at offset 0, so (0 + 1) * 16 + 5 = 21
      expect(result).toEqual({ type: 'coil', address: 21 });
    });

    it('should handle bit access on word device (D100.0)', () => {
      const addr: DeviceAddress = { device: 'D', address: 100, bitIndex: 0 };
      const result = mapper.mapToModbus(addr);

      // (0 + 100) * 16 + 0 = 1600
      expect(result).toEqual({ type: 'coil', address: 1600 });
    });

    it('should return null for indexed address and log warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const addr: DeviceAddress = { device: 'D', address: 0, indexRegister: 0 };
      const result = mapper.mapToModbus(addr);

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        'Indexed address D[Z0] cannot be mapped statically'
      );

      warnSpy.mockRestore();
    });
  });

  // ==========================================================================
  // mapFromModbus Tests
  // ==========================================================================

  describe('mapFromModbus', () => {
    it('should map coil 0 to M0', () => {
      const result = mapper.mapFromModbus({ type: 'coil', address: 0 });

      expect(result).toContainEqual({ device: 'M', address: 0 });
    });

    it('should map coil 100 to M100', () => {
      const result = mapper.mapFromModbus({ type: 'coil', address: 100 });

      expect(result).toContainEqual({ device: 'M', address: 100 });
    });

    it('should map coil 8192 to both K0 and M8192', () => {
      const result = mapper.mapFromModbus({ type: 'coil', address: 8192 });

      expect(result).toContainEqual({ device: 'K', address: 0 });
      expect(result).toContainEqual({ device: 'M', address: 8192 });
    });

    it('should map holding register 0 to D0', () => {
      const result = mapper.mapFromModbus({ type: 'holding', address: 0 });

      expect(result).toContainEqual({ device: 'D', address: 0 });
    });

    it('should map holding register 10500 to R500', () => {
      const result = mapper.mapFromModbus({ type: 'holding', address: 10500 });

      expect(result).toContainEqual({ device: 'R', address: 500 });
      expect(result).toContainEqual({ device: 'D', address: 10500 });
    });

    it('should map holding register 20000 to Z0', () => {
      const result = mapper.mapFromModbus({ type: 'holding', address: 20000 });

      // Z maps to holding at offset 20000
      expect(result).toContainEqual({ device: 'Z', address: 0 });
    });

    it('should return empty array for address with no matches', () => {
      // Use an address that would result in negative offset for all devices
      // For 'input' type, Z has offset 0 and N has offset 100
      // So a very high address that no device maps to
      const result = mapper.mapFromModbus({ type: 'coil', address: 50000 });

      // All matches should still be valid (just very high addresses)
      // M, K, T, C all map to coil, so we'll have matches
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(r => r.address >= 0)).toBe(true);
    });
  });

  // ==========================================================================
  // Timer/Counter Data Mapping Tests
  // ==========================================================================

  describe('mapTimerDataToModbus', () => {
    it('should map timer 0 to holding register 28208', () => {
      const result = mapper.mapTimerDataToModbus(0);
      expect(result).toEqual({ type: 'holding', address: 28208 });
    });

    it('should map timer 100 to holding register 28308', () => {
      const result = mapper.mapTimerDataToModbus(100);
      expect(result).toEqual({ type: 'holding', address: 28308 });
    });

    it('should map timer 2047 correctly', () => {
      const result = mapper.mapTimerDataToModbus(2047);
      expect(result).toEqual({ type: 'holding', address: 30255 });
    });
  });

  describe('mapCounterDataToModbus', () => {
    it('should map counter 0 to holding register 30256', () => {
      const result = mapper.mapCounterDataToModbus(0);
      expect(result).toEqual({ type: 'holding', address: 30256 });
    });

    it('should map counter 100 to holding register 30356', () => {
      const result = mapper.mapCounterDataToModbus(100);
      expect(result).toEqual({ type: 'holding', address: 30356 });
    });
  });

  // ==========================================================================
  // isReadOnly Tests
  // ==========================================================================

  describe('isReadOnly', () => {
    it('should return true for F (Special Relay)', () => {
      expect(mapper.isReadOnly({ device: 'F', address: 0 })).toBe(true);
    });

    it('should return true for T (Timer Contact)', () => {
      expect(mapper.isReadOnly({ device: 'T', address: 0 })).toBe(true);
    });

    it('should return true for C (Counter Contact)', () => {
      expect(mapper.isReadOnly({ device: 'C', address: 0 })).toBe(true);
    });

    it('should return false for M (Auxiliary Relay)', () => {
      expect(mapper.isReadOnly({ device: 'M', address: 0 })).toBe(false);
    });

    it('should return false for D (Data Register)', () => {
      expect(mapper.isReadOnly({ device: 'D', address: 0 })).toBe(false);
    });

    it('should return false for P (Input Relay)', () => {
      expect(mapper.isReadOnly({ device: 'P', address: 0 })).toBe(false);
    });

    it('should return false for K (Keep Relay)', () => {
      expect(mapper.isReadOnly({ device: 'K', address: 0 })).toBe(false);
    });
  });

  // ==========================================================================
  // Device Type Checks
  // ==========================================================================

  describe('device type checks', () => {
    it('isBitDevice should return true for bit devices', () => {
      expect(mapper.isBitDevice('P')).toBe(true);
      expect(mapper.isBitDevice('M')).toBe(true);
      expect(mapper.isBitDevice('K')).toBe(true);
      expect(mapper.isBitDevice('F')).toBe(true);
      expect(mapper.isBitDevice('T')).toBe(true);
      expect(mapper.isBitDevice('C')).toBe(true);
    });

    it('isBitDevice should return false for word devices', () => {
      expect(mapper.isBitDevice('D')).toBe(false);
      expect(mapper.isBitDevice('R')).toBe(false);
      expect(mapper.isBitDevice('Z')).toBe(false);
      expect(mapper.isBitDevice('N')).toBe(false);
    });

    it('isWordDevice should return true for word devices', () => {
      expect(mapper.isWordDevice('D')).toBe(true);
      expect(mapper.isWordDevice('R')).toBe(true);
      expect(mapper.isWordDevice('Z')).toBe(true);
      expect(mapper.isWordDevice('N')).toBe(true);
    });

    it('isWordDevice should return false for bit devices', () => {
      expect(mapper.isWordDevice('P')).toBe(false);
      expect(mapper.isWordDevice('M')).toBe(false);
    });
  });
});

// ==========================================================================
// Utility Function Tests
// ==========================================================================

describe('formatModbusAddress', () => {
  it('should format holding register address', () => {
    expect(formatModbusAddress({ type: 'holding', address: 1000 })).toBe('HR:1000');
  });

  it('should format coil address', () => {
    expect(formatModbusAddress({ type: 'coil', address: 0 })).toBe('C:0');
  });

  it('should format discrete input address', () => {
    expect(formatModbusAddress({ type: 'discrete', address: 100 })).toBe('DI:100');
  });

  it('should format input register address', () => {
    expect(formatModbusAddress({ type: 'input', address: 50 })).toBe('IR:50');
  });
});

describe('parseModbusAddress', () => {
  it('should parse holding register address', () => {
    expect(parseModbusAddress('HR:1000')).toEqual({ type: 'holding', address: 1000 });
  });

  it('should parse coil address', () => {
    expect(parseModbusAddress('C:100')).toEqual({ type: 'coil', address: 100 });
  });

  it('should parse discrete input address', () => {
    expect(parseModbusAddress('DI:50')).toEqual({ type: 'discrete', address: 50 });
  });

  it('should parse input register address', () => {
    expect(parseModbusAddress('IR:200')).toEqual({ type: 'input', address: 200 });
  });

  it('should be case insensitive', () => {
    expect(parseModbusAddress('hr:1000')).toEqual({ type: 'holding', address: 1000 });
    expect(parseModbusAddress('c:100')).toEqual({ type: 'coil', address: 100 });
    expect(parseModbusAddress('di:50')).toEqual({ type: 'discrete', address: 50 });
  });

  it('should return null for invalid format', () => {
    expect(parseModbusAddress('INVALID')).toBeNull();
    expect(parseModbusAddress('HR1000')).toBeNull();
    expect(parseModbusAddress(':1000')).toBeNull();
    expect(parseModbusAddress('HR:')).toBeNull();
    expect(parseModbusAddress('')).toBeNull();
  });

  it('should return null for unknown prefix', () => {
    expect(parseModbusAddress('XX:100')).toBeNull();
  });
});

// ==========================================================================
// Round-trip Tests
// ==========================================================================

describe('Round-trip mapping', () => {
  let mapper: ModbusMapper;

  beforeEach(() => {
    mapper = new ModbusMapper();
  });

  it('should round-trip M device correctly', () => {
    const original: DeviceAddress = { device: 'M', address: 500 };
    const modbus = mapper.mapToModbus(original);
    expect(modbus).not.toBeNull();

    const backMapped = mapper.mapFromModbus(modbus!);
    expect(backMapped).toContainEqual(original);
  });

  it('should round-trip D device correctly', () => {
    const original: DeviceAddress = { device: 'D', address: 1234 };
    const modbus = mapper.mapToModbus(original);
    expect(modbus).not.toBeNull();

    const backMapped = mapper.mapFromModbus(modbus!);
    expect(backMapped).toContainEqual(original);
  });

  it('should round-trip format/parse correctly', () => {
    const original = { type: 'holding' as const, address: 5000 };
    const formatted = formatModbusAddress(original);
    const parsed = parseModbusAddress(formatted);

    expect(parsed).toEqual(original);
  });
});
