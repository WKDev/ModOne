/**
 * Modbus Address Mapper
 *
 * Converts LS PLC device addresses to Modbus addresses according to the
 * defined mapping rules. This mapping aligns with the Rust ModServerSync
 * module for consistent address translation.
 */

import type {
  DeviceAddress,
  DeviceType,
  ModbusAddress,
  ModbusAddressType,
  MappingRule,
} from './types';
import { isBitDevice, isWordDevice } from './types';

// ============================================================================
// Default Mapping Rules
// ============================================================================

/**
 * Default Modbus mapping rules for LS PLC devices
 *
 * These mappings align with the Rust ModServerSync module offsets:
 * - Bit devices map to Coils/Discrete Inputs
 * - Word devices map to Holding Registers
 */
export const DEFAULT_MAPPING_RULES: MappingRule[] = [
  // Bit devices to Coils
  { device: 'P', modbusType: 'discrete', offset: 0 },    // Input Relay -> Discrete Input (read from)
  { device: 'M', modbusType: 'coil', offset: 0 },        // Auxiliary Relay -> Coil 0-8191
  { device: 'K', modbusType: 'coil', offset: 8192 },     // Keep Relay -> Coil 8192-10239
  { device: 'T', modbusType: 'coil', offset: 10240 },    // Timer Contact -> Coil 10240-12287 (read-only)
  { device: 'C', modbusType: 'coil', offset: 12288 },    // Counter Contact -> Coil 12288-14335 (read-only)
  { device: 'F', modbusType: 'discrete', offset: 2048 }, // Special Relay -> Discrete Input 2048+ (read-only)

  // Word devices to Holding Registers
  { device: 'D', modbusType: 'holding', offset: 0 },     // Data Register -> Holding 0-9999
  { device: 'R', modbusType: 'holding', offset: 10000 }, // Retentive Data Register -> Holding 10000-19999
  { device: 'Z', modbusType: 'holding', offset: 20000 }, // Index Register -> Holding 20000-20015
  { device: 'N', modbusType: 'holding', offset: 20016 }, // Link Data Register -> Holding 20016+
];

/**
 * Special device addresses for timer/counter current values
 * These are virtual word devices that map to specific Holding Register ranges.
 */
export const SPECIAL_MAPPINGS = {
  /** Timer current value (TD) - Holding Register offset 28208 */
  TD: { modbusType: 'holding' as ModbusAddressType, offset: 28208 },
  /** Counter current value (CD) - Holding Register offset 30256 */
  CD: { modbusType: 'holding' as ModbusAddressType, offset: 30256 },
} as const;

// ============================================================================
// Modbus Mapper Class
// ============================================================================

/**
 * Modbus Address Mapper
 *
 * Provides bidirectional mapping between LS PLC device addresses and
 * Modbus addresses according to configurable mapping rules.
 */
export class ModbusMapper {
  private rules: Map<DeviceType, MappingRule>;

  /**
   * Create a new ModbusMapper
   * @param customRules - Optional custom rules to override defaults
   */
  constructor(customRules?: MappingRule[]) {
    this.rules = new Map();

    // Initialize with default rules
    for (const rule of DEFAULT_MAPPING_RULES) {
      this.rules.set(rule.device, rule);
    }

    // Override with custom rules if provided
    if (customRules) {
      for (const rule of customRules) {
        this.rules.set(rule.device, rule);
      }
    }
  }

  /**
   * Map device address to Modbus address
   *
   * @param deviceAddr - PLC device address to map
   * @returns Modbus address or null if mapping not possible
   *
   * @example
   * ```typescript
   * const mapper = new ModbusMapper();
   * mapper.mapToModbus({ device: 'M', address: 100 });
   * // Returns: { type: 'coil', address: 100 }
   *
   * mapper.mapToModbus({ device: 'K', address: 0 });
   * // Returns: { type: 'coil', address: 8192 }
   *
   * mapper.mapToModbus({ device: 'D', address: 100, bitIndex: 5 });
   * // Returns: { type: 'coil', address: 1605 } (100*16 + 5)
   * ```
   */
  mapToModbus(deviceAddr: DeviceAddress): ModbusAddress | null {
    const rule = this.rules.get(deviceAddr.device);
    if (!rule) {
      return null;
    }

    // Handle indexed addressing - cannot be mapped statically
    if (deviceAddr.indexRegister !== undefined) {
      console.warn(
        `Indexed address ${deviceAddr.device}[Z${deviceAddr.indexRegister}] cannot be mapped statically`
      );
      return null;
    }

    // Handle bit access on word devices
    if (deviceAddr.bitIndex !== undefined && isWordDevice(deviceAddr.device)) {
      // Word device bit access maps to coil area
      // Address = (rule.offset + word_address) * 16 + bit_index
      // This maps D0.0-D0.15 to coils 0-15, D1.0-D1.15 to coils 16-31, etc.
      const wordOffset = rule.offset + deviceAddr.address;
      return {
        type: 'coil',
        address: wordOffset * 16 + deviceAddr.bitIndex,
      };
    }

    return {
      type: rule.modbusType,
      address: rule.offset + deviceAddr.address,
    };
  }

  /**
   * Map Modbus address back to device address
   *
   * Note: This may return multiple possible matches for overlapping ranges.
   * The caller should determine which match is most appropriate based on context.
   *
   * @param modbusAddr - Modbus address to map
   * @returns Array of possible device addresses (may be empty)
   *
   * @example
   * ```typescript
   * const mapper = new ModbusMapper();
   * mapper.mapFromModbus({ type: 'coil', address: 100 });
   * // Returns: [{ device: 'M', address: 100 }]
   *
   * mapper.mapFromModbus({ type: 'coil', address: 8192 });
   * // Returns: [{ device: 'K', address: 0 }, { device: 'M', address: 8192 }]
   * ```
   */
  mapFromModbus(modbusAddr: ModbusAddress): DeviceAddress[] {
    const matches: DeviceAddress[] = [];

    for (const [device, rule] of this.rules) {
      if (rule.modbusType === modbusAddr.type) {
        const deviceAddress = modbusAddr.address - rule.offset;
        if (deviceAddress >= 0) {
          matches.push({
            device,
            address: deviceAddress,
          });
        }
      }
    }

    return matches;
  }

  /**
   * Map timer current value address (TD) to Modbus
   *
   * Timer current values are stored in a separate Holding Register range.
   *
   * @param timerNumber - Timer number (0-2047)
   * @returns Modbus address for timer current value
   *
   * @example
   * ```typescript
   * const mapper = new ModbusMapper();
   * mapper.mapTimerDataToModbus(0);
   * // Returns: { type: 'holding', address: 28208 }
   *
   * mapper.mapTimerDataToModbus(100);
   * // Returns: { type: 'holding', address: 28308 }
   * ```
   */
  mapTimerDataToModbus(timerNumber: number): ModbusAddress {
    return {
      type: 'holding',
      address: SPECIAL_MAPPINGS.TD.offset + timerNumber,
    };
  }

  /**
   * Map counter current value address (CD) to Modbus
   *
   * Counter current values are stored in a separate Holding Register range.
   *
   * @param counterNumber - Counter number (0-2047)
   * @returns Modbus address for counter current value
   *
   * @example
   * ```typescript
   * const mapper = new ModbusMapper();
   * mapper.mapCounterDataToModbus(0);
   * // Returns: { type: 'holding', address: 30256 }
   *
   * mapper.mapCounterDataToModbus(100);
   * // Returns: { type: 'holding', address: 30356 }
   * ```
   */
  mapCounterDataToModbus(counterNumber: number): ModbusAddress {
    return {
      type: 'holding',
      address: SPECIAL_MAPPINGS.CD.offset + counterNumber,
    };
  }

  /**
   * Get the mapping rule for a device type
   *
   * @param device - Device type to get rule for
   * @returns Mapping rule or undefined if not found
   */
  getRule(device: DeviceType): MappingRule | undefined {
    return this.rules.get(device);
  }

  /**
   * Check if a device address is read-only
   *
   * Read-only devices cannot be written to via Modbus:
   * - F (Special Relay) - system status bits
   * - T (Timer Contact) - set by timer logic
   * - C (Counter Contact) - set by counter logic
   *
   * @param deviceAddr - Device address to check
   * @returns True if device is read-only
   */
  isReadOnly(deviceAddr: DeviceAddress): boolean {
    // F (Special Relay), T (Timer Contact), C (Counter Contact) are read-only
    return ['F', 'T', 'C'].includes(deviceAddr.device);
  }

  /**
   * Check if a device is a bit device
   *
   * @param device - Device type to check
   * @returns True if device is a bit device
   */
  isBitDevice(device: DeviceType): boolean {
    return isBitDevice(device);
  }

  /**
   * Check if a device is a word device
   *
   * @param device - Device type to check
   * @returns True if device is a word device
   */
  isWordDevice(device: DeviceType): boolean {
    return isWordDevice(device);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format Modbus address for display
 *
 * Uses common prefixes:
 * - C: Coil
 * - DI: Discrete Input
 * - HR: Holding Register
 * - IR: Input Register
 *
 * @param addr - Modbus address to format
 * @returns Formatted string (e.g., "HR:1000", "C:8192")
 *
 * @example
 * ```typescript
 * formatModbusAddress({ type: 'holding', address: 1000 });
 * // Returns: "HR:1000"
 *
 * formatModbusAddress({ type: 'coil', address: 0 });
 * // Returns: "C:0"
 * ```
 */
export function formatModbusAddress(addr: ModbusAddress): string {
  const prefix = {
    coil: 'C',
    discrete: 'DI',
    holding: 'HR',
    input: 'IR',
  }[addr.type];

  return `${prefix}:${addr.address}`;
}

/**
 * Parse Modbus address string
 *
 * Accepts format: PREFIX:ADDRESS
 * - C: Coil
 * - DI: Discrete Input
 * - HR: Holding Register
 * - IR: Input Register
 *
 * @param str - String to parse (e.g., "HR:1000", "C:100")
 * @returns Parsed Modbus address or null if invalid
 *
 * @example
 * ```typescript
 * parseModbusAddress("HR:1000");
 * // Returns: { type: 'holding', address: 1000 }
 *
 * parseModbusAddress("c:100"); // Case insensitive
 * // Returns: { type: 'coil', address: 100 }
 *
 * parseModbusAddress("INVALID");
 * // Returns: null
 * ```
 */
export function parseModbusAddress(str: string): ModbusAddress | null {
  const match = str.match(/^(C|DI|HR|IR):(\d+)$/i);
  if (!match) return null;

  const typeMap: Record<string, ModbusAddressType> = {
    C: 'coil',
    DI: 'discrete',
    HR: 'holding',
    IR: 'input',
  };

  return {
    type: typeMap[match[1].toUpperCase()],
    address: parseInt(match[2], 10),
  };
}

/**
 * Create a default ModbusMapper instance
 *
 * @returns New ModbusMapper with default mapping rules
 */
export function createDefaultMapper(): ModbusMapper {
  return new ModbusMapper();
}
