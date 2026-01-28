/**
 * Address Parser Utility
 *
 * Parse and convert Modbus address formats including PLC alias conversion.
 * Supports standard prefixed formats (C:, DI:, H:, IR:) and PLC aliases (M0001, D12345).
 */

import type { MemoryType } from '../../../types/modbus';

// ============================================================================
// Types
// ============================================================================

/**
 * Parsed address result.
 */
export interface ParsedAddress {
  /** Memory type */
  type: 'coil' | 'discrete' | 'holding' | 'input';
  /** Numeric address value */
  address: number;
  /** Original input string */
  rawString: string;
}

/**
 * PLC alias pattern definition.
 */
interface AliasPattern {
  /** Regex pattern to match */
  pattern: RegExp;
  /** Memory type this pattern maps to */
  type: ParsedAddress['type'];
  /** Address offset to apply after parsing */
  offset: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum valid Modbus address */
const MAX_ADDRESS = 65535;

/** Standard Modbus address prefix mapping */
const ADDRESS_PREFIXES: Record<string, ParsedAddress['type']> = {
  'C:': 'coil',
  'DI:': 'discrete',
  'H:': 'holding',
  'IR:': 'input',
};

/** Prefix for formatting addresses */
const TYPE_TO_PREFIX: Record<ParsedAddress['type'], string> = {
  coil: 'C:',
  discrete: 'DI:',
  holding: 'H:',
  input: 'IR:',
};

/** Map parsed type to MemoryType enum */
const TYPE_TO_MEMORY_TYPE: Record<ParsedAddress['type'], MemoryType> = {
  coil: 'coil',
  discrete: 'discrete',
  holding: 'holding',
  input: 'input',
};

/**
 * PLC alias patterns.
 * M pattern: Coils (M0001 -> address 1)
 * D pattern: Holding registers (D12345 -> address 12345)
 * X pattern: Discrete inputs (X0001 -> address 1)
 * Y pattern: Coils/outputs (Y0001 -> address 1)
 */
const PLC_ALIAS_PATTERNS: AliasPattern[] = [
  // Mitsubishi M coil pattern (M0000-M9999)
  { pattern: /^M(\d{4})$/i, type: 'coil', offset: 0 },
  // Mitsubishi D data register pattern (D0-D99999)
  { pattern: /^D(\d{1,5})$/i, type: 'holding', offset: 0 },
  // Siemens/Generic X input pattern (X0000-X9999)
  { pattern: /^X(\d{4})$/i, type: 'discrete', offset: 0 },
  // Siemens/Generic Y output pattern (Y0000-Y9999)
  { pattern: /^Y(\d{4})$/i, type: 'coil', offset: 0 },
  // Input register pattern (I0-I65535)
  { pattern: /^I(\d{1,5})$/i, type: 'input', offset: 0 },
];

// ============================================================================
// Internal Parsing Functions
// ============================================================================

/**
 * Parse a hex or decimal number string.
 *
 * @param numStr - Number string (may have 0x prefix)
 * @returns Parsed number or NaN if invalid
 */
function parseNumber(numStr: string): number {
  const trimmed = numStr.trim();

  // Check for hex format
  if (trimmed.toLowerCase().startsWith('0x')) {
    const hexValue = parseInt(trimmed.slice(2), 16);
    return isNaN(hexValue) ? NaN : hexValue;
  }

  // Parse as decimal
  const decValue = parseInt(trimmed, 10);
  return isNaN(decValue) ? NaN : decValue;
}

/**
 * Validate that an address is within valid range.
 *
 * @param address - Address to validate
 * @returns True if address is valid
 */
function isValidAddressRange(address: number): boolean {
  return Number.isInteger(address) && address >= 0 && address <= MAX_ADDRESS;
}

/**
 * Parse an address with standard prefix format (C:0x0001, DI:100, etc.).
 *
 * @param input - Input string to parse
 * @returns ParsedAddress or null if invalid
 */
function parsePrefixedAddress(input: string): ParsedAddress | null {
  const trimmed = input.trim().toUpperCase();

  // Try each prefix
  for (const [prefix, type] of Object.entries(ADDRESS_PREFIXES)) {
    const upperPrefix = prefix.toUpperCase();
    if (trimmed.startsWith(upperPrefix)) {
      const addressPart = trimmed.slice(prefix.length);

      // Skip if no address part
      if (!addressPart) {
        return null;
      }

      const address = parseNumber(addressPart);

      // Validate address
      if (isNaN(address) || !isValidAddressRange(address)) {
        return null;
      }

      return {
        type,
        address,
        rawString: input,
      };
    }
  }

  return null;
}

/**
 * Parse a PLC alias address (M0001, D12345, etc.).
 *
 * @param input - Input string to parse
 * @returns ParsedAddress or null if invalid
 */
function parseAliasAddress(input: string): ParsedAddress | null {
  const trimmed = input.trim();

  // Try each alias pattern
  for (const { pattern, type, offset } of PLC_ALIAS_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      // Parse the numeric part as decimal (not treating leading zeros as octal)
      const numericPart = parseInt(match[1], 10);

      // Apply offset
      const address = numericPart + offset;

      // Validate address range
      if (!isValidAddressRange(address)) {
        return null;
      }

      return {
        type,
        address,
        rawString: input,
      };
    }
  }

  return null;
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Parse an address string in any supported format.
 *
 * Supported formats:
 * - Standard prefix: C:0x0001, C:100, DI:0x0001, H:256, IR:0x0100
 * - PLC alias: M0001, D12345, X0001, Y0001, I100
 *
 * @param input - Address string to parse
 * @returns ParsedAddress or null if invalid
 *
 * @example
 * parseAddress('C:0x0001') // { type: 'coil', address: 1, rawString: 'C:0x0001' }
 * parseAddress('M0042')    // { type: 'coil', address: 42, rawString: 'M0042' }
 * parseAddress('H:256')    // { type: 'holding', address: 256, rawString: 'H:256' }
 */
export function parseAddress(input: string): ParsedAddress | null {
  // Validate input
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  // Try standard prefix format first
  const prefixed = parsePrefixedAddress(trimmed);
  if (prefixed) {
    return prefixed;
  }

  // Try PLC alias format
  const alias = parseAliasAddress(trimmed);
  if (alias) {
    return alias;
  }

  return null;
}

/**
 * Format a parsed address back to standard string format.
 *
 * @param parsed - Parsed address to format
 * @returns Formatted address string (e.g., "C:0x0001")
 *
 * @example
 * formatAddress({ type: 'coil', address: 1, rawString: '' })
 * // Returns: "C:0x0001"
 */
export function formatAddress(parsed: ParsedAddress): string {
  const prefix = TYPE_TO_PREFIX[parsed.type];
  const hexAddress = parsed.address.toString(16).toUpperCase().padStart(4, '0');
  return `${prefix}0x${hexAddress}`;
}

/**
 * Format an address as decimal instead of hex.
 *
 * @param parsed - Parsed address to format
 * @returns Formatted address string (e.g., "C:1")
 */
export function formatAddressDecimal(parsed: ParsedAddress): string {
  const prefix = TYPE_TO_PREFIX[parsed.type];
  return `${prefix}${parsed.address}`;
}

/**
 * Check if an address string is valid.
 *
 * @param input - Address string to validate
 * @returns True if the address is valid
 *
 * @example
 * isValidAddress('C:0x0001') // true
 * isValidAddress('INVALID')  // false
 */
export function isValidAddress(input: string): boolean {
  return parseAddress(input) !== null;
}

/**
 * Get the MemoryType for an address string.
 *
 * @param input - Address string to parse
 * @returns MemoryType or null if invalid
 *
 * @example
 * addressToMemoryType('C:0x0001') // 'coil'
 * addressToMemoryType('H:256')    // 'holding_register'
 */
export function addressToMemoryType(input: string): MemoryType | null {
  const parsed = parseAddress(input);
  if (!parsed) {
    return null;
  }
  return TYPE_TO_MEMORY_TYPE[parsed.type];
}

/**
 * Convert a simple numeric address to a full address string.
 *
 * @param type - Memory type
 * @param address - Numeric address
 * @returns Formatted address string
 */
export function createAddress(type: ParsedAddress['type'], address: number): string {
  return formatAddress({ type, address, rawString: '' });
}

/**
 * Compare two address strings for equality.
 *
 * @param addr1 - First address
 * @param addr2 - Second address
 * @returns True if addresses are equal (same type and address)
 */
export function addressesEqual(addr1: string, addr2: string): boolean {
  const parsed1 = parseAddress(addr1);
  const parsed2 = parseAddress(addr2);

  if (!parsed1 || !parsed2) {
    return false;
  }

  return parsed1.type === parsed2.type && parsed1.address === parsed2.address;
}

/**
 * Get address range info for a memory type.
 */
export function getAddressRange(_type: ParsedAddress['type']): { min: number; max: number } {
  // All Modbus types have the same range
  return { min: 0, max: MAX_ADDRESS };
}

/**
 * Validate and normalize an address string.
 * Returns the normalized format or null if invalid.
 *
 * @param input - Address string to normalize
 * @returns Normalized address string or null
 */
export function normalizeAddress(input: string): string | null {
  const parsed = parseAddress(input);
  if (!parsed) {
    return null;
  }
  return formatAddress(parsed);
}

export default {
  parseAddress,
  formatAddress,
  formatAddressDecimal,
  isValidAddress,
  addressToMemoryType,
  createAddress,
  addressesEqual,
  getAddressRange,
  normalizeAddress,
};
