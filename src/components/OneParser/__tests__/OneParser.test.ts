/**
 * OneParser Integration Tests
 *
 * Tests for the main OneParser module with sample XG5000 CSV data.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OneParser, oneParser } from '../OneParser';
import { parseDeviceAddress, formatDeviceAddress } from '../types';
import { ModbusMapper, createDefaultMapper } from '../ModbusMapper';
import type { LadderProgram, ContactNode, CoilNode, TimerNode } from '../types';

// ============================================================================
// Sample XG5000 CSV Content
// ============================================================================

/**
 * Sample XG5000 CSV export - Self-holding circuit with timer
 *
 * Network 0: Self-holding motor control
 * - P0001: Start button
 * - P0002: Stop button
 * - M0001: Motor coil
 *
 * Network 1: Timer control
 * - M0001: Motor running
 * - T0001: Motor delay timer (1000ms)
 * - M0002: Delay complete flag
 */
const SAMPLE_CSV = `No,Step,Instruction,Operand1,Operand2,Operand3,Comment
1,0,LOAD,P0001,,,Start Button
2,0,OR,M0001,,,Self-hold
3,0,LOADN,P0002,,,Stop Button
4,0,ANDB,,,,AND Block
5,0,OUT,M0001,,,Motor ON
6,1,LOAD,M0001,,,Motor Running
7,1,TON,T0001,1000,,Motor Delay
8,1,OUT,M0002,,,Delay Complete
`;

/**
 * Simple single-rung CSV
 */
const SIMPLE_CSV = `No,Step,Instruction,Operand1,Operand2,Operand3,Comment
1,0,LOAD,M0000,,,Input Contact
2,0,OUT,M0001,,,Output Coil
`;

/**
 * CSV with counter
 */
const COUNTER_CSV = `No,Step,Instruction,Operand1,Operand2,Operand3,Comment
1,0,LOAD,P0000,,,Count Input
2,0,CTU,C0000,10,,Up Counter
`;

/**
 * CSV with parallel branches
 */
const PARALLEL_CSV = `No,Step,Instruction,Operand1,Operand2,Operand3,Comment
1,0,LOAD,M0000,,,Branch 1 Contact
2,0,LOAD,M0001,,,Branch 2 Contact
3,0,ORB,,,,OR Block
4,0,OUT,M0010,,,Output Coil
`;

// ============================================================================
// OneParser Tests
// ============================================================================

describe('OneParser', () => {
  let parser: OneParser;

  beforeEach(() => {
    parser = new OneParser();
  });

  describe('parseString', () => {
    it('should parse CSV content into LadderProgram', () => {
      const result = parser.parseString(SAMPLE_CSV);

      expect(result.program).toBeDefined();
      expect(result.program.networks).toHaveLength(2);
    });

    it('should parse network steps correctly', () => {
      const result = parser.parseString(SAMPLE_CSV);

      expect(result.program.networks[0].step).toBe(0);
      expect(result.program.networks[1].step).toBe(1);
    });

    it('should include CSV rows in result', () => {
      const result = parser.parseString(SAMPLE_CSV);

      expect(result.csvRows).toBeDefined();
      expect(result.csvRows!.length).toBeGreaterThan(0);
    });

    it('should include grouped rows in result', () => {
      const result = parser.parseString(SAMPLE_CSV);

      expect(result.groupedRows).toBeDefined();
      expect(result.groupedRows!.size).toBe(2); // 2 networks
    });

    it('should validate program by default', () => {
      const result = parser.parseString(SAMPLE_CSV);

      expect(result.validation).toBeDefined();
      expect(result.validation!.valid).toBe(true);
    });

    it('should skip validation when disabled', () => {
      const result = parser.parseString(SAMPLE_CSV, { validate: false });

      expect(result.validation).toBeUndefined();
    });

    it('should include metadata when provided', () => {
      const result = parser.parseString(SAMPLE_CSV, {
        metadata: {
          name: 'Test Program',
          description: 'A test program',
        },
      });

      expect(result.program.metadata.name).toBe('Test Program');
      expect(result.program.metadata.description).toBe('A test program');
    });
  });

  describe('parseToNetworks', () => {
    it('should return array of networks', () => {
      const networks = parser.parseToNetworks(SAMPLE_CSV);

      expect(networks).toHaveLength(2);
    });

    it('should parse simple CSV to single network', () => {
      const networks = parser.parseToNetworks(SIMPLE_CSV);

      expect(networks).toHaveLength(1);
    });
  });

  describe('validate', () => {
    it('should validate a parsed program', () => {
      const result = parser.parseString(SAMPLE_CSV, { validate: false });
      const validation = parser.validate(result.program);

      expect(validation).toBeDefined();
      expect(validation.valid).toBe(true);
    });

    it('should return errors for invalid program', () => {
      // Create a program with an invalid address
      const program: LadderProgram = {
        metadata: {
          name: 'Invalid Program',
          version: '1.0',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
        },
        networks: [
          {
            id: 'net-1',
            step: 0,
            nodes: [
              {
                id: 'coil-1',
                type: 'coil_out',
                address: { device: 'P', address: 0 }, // P is read-only
                gridPosition: { row: 0, col: 0 },
              } as CoilNode,
            ],
          },
        ],
        symbolTable: { entries: new Map() },
      };

      const validation = parser.validate(program);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('component accessors', () => {
    it('should return AstBuilder instance', () => {
      const builder = parser.getAstBuilder();
      expect(builder).toBeDefined();
    });

    it('should return ProgramValidator instance', () => {
      const validator = parser.getValidator();
      expect(validator).toBeDefined();
    });

    it('should return ModbusMapper instance', () => {
      const mapper = parser.getModbusMapper();
      expect(mapper).toBeDefined();
    });

    it('should return GridCalculator instance', () => {
      const calculator = parser.getGridCalculator();
      expect(calculator).toBeDefined();
    });
  });
});

// ============================================================================
// Singleton Instance Tests
// ============================================================================

describe('oneParser singleton', () => {
  it('should be a valid OneParser instance', () => {
    expect(oneParser).toBeInstanceOf(OneParser);
  });

  it('should parse CSV content', () => {
    const result = oneParser.parseString(SIMPLE_CSV);
    expect(result.program.networks).toHaveLength(1);
  });
});

// ============================================================================
// Address Parser Integration Tests
// ============================================================================

describe('Address Parser Integration', () => {
  describe('parseDeviceAddress', () => {
    it('should parse standard addresses', () => {
      const addr = parseDeviceAddress('P0001');
      expect(addr).not.toBeNull();
      expect(addr!.device).toBe('P');
      expect(addr!.address).toBe(1);
    });

    it('should parse M addresses', () => {
      const addr = parseDeviceAddress('M1234');
      expect(addr).not.toBeNull();
      expect(addr!.device).toBe('M');
      expect(addr!.address).toBe(1234);
    });

    it('should parse D addresses', () => {
      const addr = parseDeviceAddress('D9999');
      expect(addr).not.toBeNull();
      expect(addr!.device).toBe('D');
      expect(addr!.address).toBe(9999);
    });

    it('should parse bit access addresses', () => {
      const addr = parseDeviceAddress('D0000.5');
      expect(addr).not.toBeNull();
      expect(addr!.device).toBe('D');
      expect(addr!.address).toBe(0);
      expect(addr!.bitIndex).toBe(5);
    });

    it('should parse bit access at max index', () => {
      const addr = parseDeviceAddress('D0000.15');
      expect(addr).not.toBeNull();
      expect(addr!.bitIndex).toBe(15);
    });

    it('should parse indexed addresses', () => {
      const addr = parseDeviceAddress('D0100[Z0]');
      expect(addr).not.toBeNull();
      expect(addr!.device).toBe('D');
      expect(addr!.address).toBe(100);
      expect(addr!.indexRegister).toBe(0);
    });

    it('should parse combined format', () => {
      const addr = parseDeviceAddress('D0100.8[Z3]');
      expect(addr).not.toBeNull();
      expect(addr!.device).toBe('D');
      expect(addr!.address).toBe(100);
      expect(addr!.bitIndex).toBe(8);
      expect(addr!.indexRegister).toBe(3);
    });
  });

  describe('formatDeviceAddress', () => {
    it('should format simple addresses', () => {
      const result = formatDeviceAddress({ device: 'M', address: 100 });
      expect(result).toBe('M0100');
    });

    it('should format with bit index', () => {
      const result = formatDeviceAddress({ device: 'D', address: 0, bitIndex: 5 });
      expect(result).toBe('D0000.5');
    });

    it('should format with index register', () => {
      const result = formatDeviceAddress({
        device: 'D',
        address: 100,
        indexRegister: 0,
      });
      expect(result).toBe('D0100[Z0]');
    });

    it('should round-trip addresses', () => {
      const testAddresses = ['M0001', 'P0100', 'D0000', 'K2047', 'T0500'];

      for (const original of testAddresses) {
        const parsed = parseDeviceAddress(original);
        expect(parsed).not.toBeNull();
        const formatted = formatDeviceAddress(parsed!);
        expect(formatted).toBe(original);
      }
    });
  });
});

// ============================================================================
// Modbus Mapper Integration Tests
// ============================================================================

describe('Modbus Mapper Integration', () => {
  let mapper: ModbusMapper;

  beforeEach(() => {
    mapper = createDefaultMapper();
  });

  describe('mapToModbus', () => {
    it('should map P device to discrete input', () => {
      const addr = parseDeviceAddress('P0001')!;
      const modbus = mapper.mapToModbus(addr);

      expect(modbus).not.toBeNull();
      expect(modbus!.type).toBe('discrete');
      expect(modbus!.address).toBe(1);
    });

    it('should map M device to coil', () => {
      const addr = parseDeviceAddress('M0001')!;
      const modbus = mapper.mapToModbus(addr);

      expect(modbus).not.toBeNull();
      expect(modbus!.type).toBe('coil');
      expect(modbus!.address).toBe(1);
    });

    it('should map K device to coil with offset', () => {
      const addr = parseDeviceAddress('K0001')!;
      const modbus = mapper.mapToModbus(addr);

      expect(modbus).not.toBeNull();
      expect(modbus!.type).toBe('coil');
      expect(modbus!.address).toBe(8193); // K offset = 8192
    });

    it('should map D device to holding register', () => {
      const addr = parseDeviceAddress('D0100')!;
      const modbus = mapper.mapToModbus(addr);

      expect(modbus).not.toBeNull();
      expect(modbus!.type).toBe('holding');
      expect(modbus!.address).toBe(100);
    });

    it('should map T device to coil', () => {
      const addr = parseDeviceAddress('T0001')!;
      const modbus = mapper.mapToModbus(addr);

      expect(modbus).not.toBeNull();
      expect(modbus!.type).toBe('coil');
    });

    it('should map C device to coil', () => {
      const addr = parseDeviceAddress('C0001')!;
      const modbus = mapper.mapToModbus(addr);

      expect(modbus).not.toBeNull();
      expect(modbus!.type).toBe('coil');
    });
  });

  describe('isReadOnly', () => {
    it('should identify P as read-only', () => {
      const addr = parseDeviceAddress('P0000')!;
      expect(mapper.isReadOnly(addr)).toBe(true);
    });

    it('should identify F as read-only', () => {
      const addr = parseDeviceAddress('F0000')!;
      expect(mapper.isReadOnly(addr)).toBe(true);
    });

    it('should identify M as writable', () => {
      const addr = parseDeviceAddress('M0000')!;
      expect(mapper.isReadOnly(addr)).toBe(false);
    });

    it('should identify K as writable', () => {
      const addr = parseDeviceAddress('K0000')!;
      expect(mapper.isReadOnly(addr)).toBe(false);
    });
  });
});

// ============================================================================
// End-to-End Tests
// ============================================================================

describe('End-to-End Integration', () => {
  it('should parse, validate, and access all components', () => {
    const parser = new OneParser();

    // Parse
    const result = parser.parseString(SAMPLE_CSV);
    expect(result.program.networks).toHaveLength(2);

    // Validate
    expect(result.validation!.valid).toBe(true);

    // Access mapper
    const mapper = parser.getModbusMapper();
    const addr = parseDeviceAddress('M0001')!;
    const modbus = mapper.mapToModbus(addr);
    expect(modbus!.type).toBe('coil');

    // Grid calculation
    const dimensions = parser.calculateGridDimensions(result.program.networks[0]);
    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);
  });

  it('should handle counter CSV correctly', () => {
    const result = oneParser.parseString(COUNTER_CSV);

    expect(result.program.networks).toHaveLength(1);
    expect(result.validation!.valid).toBe(true);
  });

  it('should handle parallel branch CSV correctly', () => {
    const result = oneParser.parseString(PARALLEL_CSV);

    expect(result.program.networks).toHaveLength(1);
    expect(result.validation!.valid).toBe(true);
  });

  it('should calculate dimensions for all networks', () => {
    const parser = new OneParser();
    const result = parser.parseString(SAMPLE_CSV);

    const allDimensions = parser.calculateAllGridDimensions(result.program);

    expect(allDimensions.size).toBe(2);
    for (const [, dims] of allDimensions) {
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
    }
  });
});
