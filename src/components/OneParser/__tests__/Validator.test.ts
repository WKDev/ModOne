/**
 * Program Validator Tests
 *
 * Tests for ProgramValidator class and validateProgram function.
 */

import { describe, it, expect } from 'vitest';
import { ProgramValidator, validateProgram } from '../Validator';
import type {
  LadderProgram,
  LadderNetwork,
  ContactNode,
  CoilNode,
  TimerNode,
  CounterNode,
  BlockNode,
  DeviceAddress,
} from '../types';

// ============================================================================
// Test Helpers
// ============================================================================

function createAddress(
  device: string,
  address: number,
  bitIndex?: number,
  indexRegister?: number
): DeviceAddress {
  return {
    device: device as DeviceAddress['device'],
    address,
    bitIndex,
    indexRegister,
  };
}

function createContact(
  id: string,
  address: DeviceAddress,
  type: ContactNode['type'] = 'contact_no'
): ContactNode {
  return {
    id,
    type,
    address,
    gridPosition: { row: 0, col: 0 },
  };
}

function createCoil(
  id: string,
  address: DeviceAddress,
  type: CoilNode['type'] = 'coil_out'
): CoilNode {
  return {
    id,
    type,
    address,
    gridPosition: { row: 0, col: 0 },
  };
}

function createTimer(
  id: string,
  address: DeviceAddress,
  preset: number = 100,
  type: TimerNode['type'] = 'timer_ton'
): TimerNode {
  return {
    id,
    type,
    address,
    preset,
    timeBase: 'ms',
    gridPosition: { row: 0, col: 0 },
  };
}

function createCounter(
  id: string,
  address: DeviceAddress,
  preset: number = 10,
  type: CounterNode['type'] = 'counter_ctu'
): CounterNode {
  return {
    id,
    type,
    address,
    preset,
    gridPosition: { row: 0, col: 0 },
  };
}

function createNetwork(id: string, nodes: LadderNetwork['nodes']): LadderNetwork {
  return {
    id,
    step: parseInt(id.replace('net', ''), 10) || 1,
    nodes,
  };
}

function createProgram(networks: LadderNetwork[]): LadderProgram {
  return {
    metadata: {
      name: 'Test Program',
      version: '1.0',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    },
    networks,
    symbolTable: { entries: new Map() },
  };
}

// ============================================================================
// Address Validation Tests
// ============================================================================

describe('Address Validation', () => {
  it('catches address out of range errors', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('P', 2048)), // Out of range (max 2047)
        createCoil('o1', createAddress('M', 0)),
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].errorType).toBe('address');
    expect(result.errors[0].message).toContain('out of range');
  });

  it('catches M device out of range', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 8192)), // Out of range (max 8191)
        createCoil('o1', createAddress('M', 0)),
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('out of range');
  });

  it('catches bit index out of range', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('D', 100, 16)), // Bit index > 15
        createCoil('o1', createAddress('M', 0)),
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Bit index');
    expect(result.errors[0].message).toContain('out of range');
  });

  it('catches negative bit index', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('D', 100, -1)),
        createCoil('o1', createAddress('M', 0)),
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Bit index');
  });

  it('catches index register out of range', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('D', 100, undefined, 16)), // Z16 invalid
        createCoil('o1', createAddress('M', 0)),
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Index register');
  });

  it('accepts valid addresses', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('P', 2047)), // Max valid P
        createContact('c2', createAddress('M', 8191)), // Max valid M
        createContact('c3', createAddress('D', 100, 15)), // Valid bit index
        createContact('c4', createAddress('D', 100, undefined, 15)), // Valid Z register
        createCoil('o1', createAddress('M', 0)),
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================================
// Read-Only Device Tests
// ============================================================================

describe('Read-Only Device Validation', () => {
  it('catches writes to P device', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createCoil('o1', createAddress('P', 0)), // Cannot write to P
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Cannot write to read-only device P');
  });

  it('catches writes to F device', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createCoil('o1', createAddress('F', 0)), // Cannot write to F
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Cannot write to read-only device F');
  });

  it('catches writes to T device via coil', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createCoil('o1', createAddress('T', 0)), // Cannot write to T via coil
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Cannot write to read-only device T');
  });

  it('catches writes to C device via coil', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createCoil('o1', createAddress('C', 0)), // Cannot write to C via coil
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Cannot write to read-only device C');
  });

  it('allows writes to M device', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('P', 0)),
        createCoil('o1', createAddress('M', 0)), // OK
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(true);
  });

  it('allows writes to K device', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('P', 0)),
        createCoil('o1', createAddress('K', 0)), // OK
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// Timer Validation Tests
// ============================================================================

describe('Timer Validation', () => {
  it('rejects timer with non-T device', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createTimer('t1', createAddress('M', 0)), // Wrong device
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Timer must use T device');
  });

  it('warns about zero or negative preset', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createTimer('t1', createAddress('T', 0), 0), // Zero preset
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(true); // Warning, not error
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('preset should be positive');
  });

  it('accepts valid timer', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createTimer('t1', createAddress('T', 0), 100),
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================================
// Counter Validation Tests
// ============================================================================

describe('Counter Validation', () => {
  it('rejects counter with non-C device', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createCounter('ct1', createAddress('M', 0)), // Wrong device
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Counter must use C device');
  });

  it('warns about zero or negative preset', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createCounter('ct1', createAddress('C', 0), 0), // Zero preset
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(true); // Warning, not error
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('preset should be positive');
  });

  it('accepts valid counter', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createCounter('ct1', createAddress('C', 0), 10),
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================================
// Contact Validation Tests
// ============================================================================

describe('Contact Validation', () => {
  it('warns when using word device without bit access', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('D', 100)), // D without bit index
        createCoil('o1', createAddress('M', 0)),
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(true); // Warning, not error
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings[0].message).toContain('word device');
    expect(result.warnings[0].message).toContain('without bit access');
  });

  it('accepts bit devices in contacts', () => {
    const bitDevices = ['P', 'M', 'K', 'F', 'T', 'C'];

    for (const device of bitDevices) {
      const program = createProgram([
        createNetwork('net1', [
          createContact('c1', createAddress(device, 0)),
          createCoil('o1', createAddress('M', 0)),
        ]),
      ]);

      const result = validateProgram(program);
      // Should not have warnings about bit access
      const bitAccessWarnings = result.warnings.filter(
        w => w.message.includes('without bit access')
      );
      expect(bitAccessWarnings).toHaveLength(0);
    }
  });

  it('accepts word devices with bit index in contacts', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('D', 100, 5)), // D with bit index
        createCoil('o1', createAddress('M', 0)),
      ]),
    ]);

    const result = validateProgram(program);

    const bitAccessWarnings = result.warnings.filter(
      w => w.message.includes('without bit access')
    );
    expect(bitAccessWarnings).toHaveLength(0);
  });
});

// ============================================================================
// Structure Validation Tests
// ============================================================================

describe('Structure Validation', () => {
  it('warns about empty networks', () => {
    const program = createProgram([createNetwork('net1', [])]);

    const result = validateProgram(program);

    expect(result.valid).toBe(true); // Warning, not error
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toBe('Empty network');
    expect(result.warnings[0].errorType).toBe('structure');
  });

  it('warns about networks without output instructions', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createContact('c2', createAddress('M', 1)),
        // No output
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(true); // Warning, not error
    expect(result.warnings.some(w => w.message.includes('no output instruction'))).toBe(
      true
    );
  });

  it('accepts networks with coil output', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createCoil('o1', createAddress('M', 1)),
      ]),
    ]);

    const result = validateProgram(program);

    const outputWarnings = result.warnings.filter(w =>
      w.message.includes('no output instruction')
    );
    expect(outputWarnings).toHaveLength(0);
  });

  it('accepts networks with timer output', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createTimer('t1', createAddress('T', 0)),
      ]),
    ]);

    const result = validateProgram(program);

    const outputWarnings = result.warnings.filter(w =>
      w.message.includes('no output instruction')
    );
    expect(outputWarnings).toHaveLength(0);
  });

  it('accepts networks with counter output', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createCounter('ct1', createAddress('C', 0)),
      ]),
    ]);

    const result = validateProgram(program);

    const outputWarnings = result.warnings.filter(w =>
      w.message.includes('no output instruction')
    );
    expect(outputWarnings).toHaveLength(0);
  });
});

// ============================================================================
// Block Validation Tests
// ============================================================================

describe('Block Validation', () => {
  it('errors when block has fewer than 2 children', () => {
    const block: BlockNode = {
      id: 'b1',
      type: 'block_series',
      children: [createContact('c1', createAddress('M', 0))], // Only 1 child
      gridPosition: { row: 0, col: 0 },
    };

    const program = createProgram([
      createNetwork('net1', [block, createCoil('o1', createAddress('M', 1))]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('at least 2 children');
    expect(result.errors[0].errorType).toBe('structure');
  });

  it('accepts block with 2 or more children', () => {
    const block: BlockNode = {
      id: 'b1',
      type: 'block_parallel',
      children: [
        createContact('c1', createAddress('M', 0)),
        createContact('c2', createAddress('M', 1)),
      ],
      gridPosition: { row: 0, col: 0 },
    };

    const program = createProgram([
      createNetwork('net1', [block, createCoil('o1', createAddress('M', 2))]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(true);
  });

  it('recursively validates block children', () => {
    const block: BlockNode = {
      id: 'b1',
      type: 'block_series',
      children: [
        createContact('c1', createAddress('P', 9999)), // Out of range
        createContact('c2', createAddress('M', 1)),
      ],
      gridPosition: { row: 0, col: 0 },
    };

    const program = createProgram([
      createNetwork('net1', [block, createCoil('o1', createAddress('M', 2))]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('out of range');
  });
});

// ============================================================================
// Duplicate Output Detection Tests
// ============================================================================

describe('Duplicate Output Detection', () => {
  it('warns when same address used in multiple networks', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createCoil('o1', createAddress('M', 100)), // M100
      ]),
      createNetwork('net2', [
        createContact('c2', createAddress('M', 1)),
        createCoil('o2', createAddress('M', 100)), // M100 again
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(true); // Warning, not error
    expect(result.warnings.some(w => w.message.includes('multiple networks'))).toBe(
      true
    );
  });

  it('does not warn when different addresses used', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createCoil('o1', createAddress('M', 100)),
      ]),
      createNetwork('net2', [
        createContact('c2', createAddress('M', 1)),
        createCoil('o2', createAddress('M', 101)), // Different address
      ]),
    ]);

    const result = validateProgram(program);

    const duplicateWarnings = result.warnings.filter(w =>
      w.message.includes('multiple networks')
    );
    expect(duplicateWarnings).toHaveLength(0);
  });

  it('detects timer duplicate outputs', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('M', 0)),
        createTimer('t1', createAddress('T', 0)),
      ]),
      createNetwork('net2', [
        createContact('c2', createAddress('M', 1)),
        createTimer('t2', createAddress('T', 0)), // Same T0
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.warnings.some(w => w.message.includes('multiple networks'))).toBe(
      true
    );
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Program Validation Integration', () => {
  it('validates a complete valid program', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('P', 0)),
        createContact('c2', createAddress('M', 100)),
        createCoil('o1', createAddress('M', 200)),
      ]),
      createNetwork('net2', [
        createContact('c3', createAddress('M', 200)),
        createTimer('t1', createAddress('T', 0), 1000),
      ]),
      createNetwork('net3', [
        createContact('c4', createAddress('T', 0)), // Timer contact
        createCounter('ct1', createAddress('C', 0), 10),
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('collects multiple errors from different networks', () => {
    const program = createProgram([
      createNetwork('net1', [
        createContact('c1', createAddress('P', 9999)), // Out of range
        createCoil('o1', createAddress('M', 0)),
      ]),
      createNetwork('net2', [
        createContact('c2', createAddress('M', 0)),
        createCoil('o2', createAddress('P', 0)), // Read-only write
      ]),
    ]);

    const result = validateProgram(program);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('returns ValidationResult with correct structure', () => {
    const program = createProgram([
      createNetwork('net1', [createCoil('o1', createAddress('M', 0))]),
    ]);

    const result = validateProgram(program);

    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});

// ============================================================================
// ProgramValidator Class Tests
// ============================================================================

describe('ProgramValidator class', () => {
  it('can be instantiated multiple times', () => {
    const validator1 = new ProgramValidator();
    const validator2 = new ProgramValidator();

    const program = createProgram([
      createNetwork('net1', [createCoil('o1', createAddress('M', 0))]),
    ]);

    const result1 = validator1.validate(program);
    const result2 = validator2.validate(program);

    expect(result1.valid).toBe(result2.valid);
  });

  it('resets state between validations', () => {
    const validator = new ProgramValidator();

    const invalidProgram = createProgram([
      createNetwork('net1', [createCoil('o1', createAddress('P', 0))]), // Error
    ]);

    const validProgram = createProgram([
      createNetwork('net1', [createCoil('o1', createAddress('M', 0))]),
    ]);

    const result1 = validator.validate(invalidProgram);
    const result2 = validator.validate(validProgram);

    expect(result1.valid).toBe(false);
    expect(result2.valid).toBe(true);
    expect(result2.errors).toHaveLength(0);
  });
});
