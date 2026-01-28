/**
 * PLC Address Utilities
 *
 * Formatting and validation for PLC memory addresses.
 */

// ============================================================================
// Types
// ============================================================================

export type PlcAddressType = 'coil' | 'discrete' | 'holding' | 'input';

// ============================================================================
// Constants
// ============================================================================

// Address prefixes by type
const ADDRESS_PREFIXES: Record<PlcAddressType, string> = {
  coil: 'M',      // Coil / Output
  discrete: 'X',  // Discrete Input
  holding: 'D',   // Data Register (Holding)
  input: 'IR',    // Input Register
};

// Maximum address values
const MAX_ADDRESS = 9999;
const MIN_ADDRESS = 0;

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format a PLC address with type prefix
 * @param address - Numeric address (0-9999)
 * @param type - Address type
 * @returns Formatted address string (e.g., M0001, X0042)
 */
export function formatPlcAddress(address: number, type: PlcAddressType): string {
  const prefix = ADDRESS_PREFIXES[type];
  const clampedAddress = Math.max(MIN_ADDRESS, Math.min(MAX_ADDRESS, Math.floor(address)));
  return `${prefix}${clampedAddress.toString().padStart(4, '0')}`;
}

/**
 * Format a coil address (M prefix)
 */
export function formatCoilAddress(address: number): string {
  return formatPlcAddress(address, 'coil');
}

/**
 * Format a discrete input address (X prefix)
 */
export function formatDiscreteAddress(address: number): string {
  return formatPlcAddress(address, 'discrete');
}

/**
 * Format a holding register address (D prefix)
 */
export function formatHoldingAddress(address: number): string {
  return formatPlcAddress(address, 'holding');
}

/**
 * Format an input register address (IR prefix)
 */
export function formatInputRegisterAddress(address: number): string {
  return formatPlcAddress(address, 'input');
}

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse a formatted PLC address string
 * @param addressStr - Formatted address (e.g., M0001)
 * @returns Object with type and address, or null if invalid
 */
export function parsePlcAddress(
  addressStr: string
): { type: PlcAddressType; address: number } | null {
  const normalized = addressStr.toUpperCase().trim();

  // Check each prefix
  for (const [type, prefix] of Object.entries(ADDRESS_PREFIXES)) {
    if (normalized.startsWith(prefix)) {
      const numPart = normalized.slice(prefix.length);
      const address = parseInt(numPart, 10);

      if (!isNaN(address) && address >= MIN_ADDRESS && address <= MAX_ADDRESS) {
        return { type: type as PlcAddressType, address };
      }
    }
  }

  return null;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate an address is in valid range
 */
export function isValidAddress(address: number): boolean {
  return (
    Number.isInteger(address) &&
    address >= MIN_ADDRESS &&
    address <= MAX_ADDRESS
  );
}

/**
 * Validate a formatted address string
 */
export function isValidPlcAddressString(addressStr: string): boolean {
  return parsePlcAddress(addressStr) !== null;
}

// ============================================================================
// Address Range Helpers
// ============================================================================

/**
 * Get the valid address range
 */
export function getAddressRange(): { min: number; max: number } {
  return { min: MIN_ADDRESS, max: MAX_ADDRESS };
}

/**
 * Clamp an address to valid range
 */
export function clampAddress(address: number): number {
  return Math.max(MIN_ADDRESS, Math.min(MAX_ADDRESS, Math.floor(address)));
}
