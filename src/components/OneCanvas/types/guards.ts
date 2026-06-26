import type { Block, PowerSourceBlock, PlcOutBlock, PlcInBlock, TextBlock, ButtonBlock, LedBlock } from './blocks';
import type { LegacyBlockType, PowerPolarity } from './geometry';
import type { BlockType } from '../../../types/circuit';

// ============================================================================
// Type Guards
// ============================================================================

/** Check if a string is a valid BlockType */
export function isValidBlockType(type: string): type is BlockType {
  // Old 22 types (backward compat)
  const legacyTypes = [
    'powersource', 'plc_out', 'plc_in', 'led', 'button', 'scope', 'text',
    'relay', 'fuse', 'motor', 'emergency_stop', 'selector_switch',
    'solenoid_valve', 'sensor', 'pilot_lamp', 'net_label',
    'transformer', 'terminal_block', 'overload_relay', 'contactor',
    'disconnect_switch', 'off_page_connector', 'terminal',
  ];
  // New canonical types (from circuit.ts CanonicalBlockType)
  const canonicalTypes = [
    'power_source', 'motor', 'relay_coil', 'relay_contact_no', 'relay_contact_nc',
    'switch_no', 'switch_nc', 'switch_changeover', 'fuse', 'led', 'button',
    'circuit_breaker', 'pilot_lamp', 'emergency_stop', 'selector_switch',
    'solenoid_valve', 'sensor', 'overload_relay', 'contactor', 'disconnect_switch',
    'transformer', 'net_label', 'terminal_block', 'off_page_connector', 'terminal',
    'scope', 'text', 'custom_symbol', 'capacitor', 'resistor', 'inductor', 'diode',
    'ground', 'connector', 'plc_input', 'plc_output', 'timer_on_delay', 'timer_off_delay',
    'counter_up', 'counter_down', 'junction_box', 'push_button_no', 'push_button_nc',
  ];
  return legacyTypes.includes(type) || canonicalTypes.includes(type);
}

/** Check if a string is a legacy block type that can be migrated */
export function isLegacyBlockType(type: string): type is LegacyBlockType {
  return ['power_24v', 'power_12v', 'gnd'].includes(type);
}

/** Check if a block is a power source */
export function isPowerSource(block: Block): block is PowerSourceBlock {
  return block.type === 'powersource';
}

/**
 * Migrate a legacy block type to powersource properties.
 * Returns null if type is not a legacy type.
 */
export function migrateLegacyBlockType(type: string): { voltage: number; polarity: PowerPolarity; label: string } | null {
  switch (type) {
    case 'power_24v':
      return { voltage: 24, polarity: 'positive', label: '+24V' };
    case 'power_12v':
      return { voltage: 12, polarity: 'positive', label: '+12V' };
    case 'gnd':
      return { voltage: 0, polarity: 'ground', label: 'GND' };
    default:
      return null;
  }
}

/** Check if a block is a PLC I/O block */
export function isPlcBlock(block: Block): block is PlcOutBlock | PlcInBlock {
  return block.type === 'plc_out' || block.type === 'plc_in';
}

/** Check if a block is interactive (can be clicked/toggled) */
export function isInteractiveBlock(
  block: Block
): block is ButtonBlock | LedBlock {
  return block.type === 'button' || block.type === 'led';
}

/** Check if a block is a non-electrical annotation (excluded from simulation) */
export function isAnnotationBlock(block: Block): block is TextBlock {
  return block.type === 'text';
}

