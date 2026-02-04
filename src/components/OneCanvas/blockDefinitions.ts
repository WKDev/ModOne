/**
 * Block Definitions Registry
 *
 * Single source of truth for block sizes, default ports, and default properties.
 */

import type { BlockType, Port, Size, PowerPolarity } from './types';

// ============================================================================
// Types
// ============================================================================

export interface BlockDefinition {
  /** Block dimensions */
  size: Size;
  /** Default ports for this block type */
  defaultPorts: Port[];
  /** Default type-specific properties */
  defaultProps: Record<string, unknown>;
}

// ============================================================================
// Definitions
// ============================================================================

const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  powersource: {
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'out', type: 'output', label: '+', position: 'bottom' },
    ],
    defaultProps: { voltage: 24, polarity: 'positive', maxCurrent: 1000 },
  },
  plc_out: {
    size: { width: 80, height: 40 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left' },
      { id: 'out', type: 'output', label: 'OUT', position: 'right' },
    ],
    defaultProps: { address: 'C:0x0000', normallyOpen: true, inverted: false },
  },
  plc_in: {
    size: { width: 80, height: 40 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left' },
      { id: 'out', type: 'output', label: 'OUT', position: 'right' },
    ],
    defaultProps: { address: 'DI:0x0000', thresholdVoltage: 12, inverted: false },
  },
  led: {
    size: { width: 40, height: 60 },
    defaultPorts: [
      { id: 'anode', type: 'input', label: '+', position: 'top' },
      { id: 'cathode', type: 'output', label: '-', position: 'bottom' },
    ],
    defaultProps: { color: 'red', forwardVoltage: 2.0, lit: false },
  },
  button: {
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left' },
      { id: 'out', type: 'output', label: 'OUT', position: 'right' },
    ],
    defaultProps: { mode: 'momentary', contactConfig: '1a', pressed: false },
  },
  scope: {
    size: { width: 100, height: 80 },
    defaultPorts: [
      { id: 'ch1', type: 'input', label: 'CH1', position: 'left', offset: 0.25 },
      { id: 'ch2', type: 'input', label: 'CH2', position: 'left', offset: 0.5 },
      { id: 'ch3', type: 'input', label: 'CH3', position: 'left', offset: 0.75 },
      { id: 'ch4', type: 'input', label: 'CH4', position: 'left', offset: 1.0 },
    ],
    defaultProps: { channels: 1, triggerMode: 'auto', timeBase: 100, voltageScale: 5 },
  },
};

// ============================================================================
// Access Functions
// ============================================================================

/**
 * Get the full block definition for a block type.
 */
export function getBlockDefinition(type: BlockType): BlockDefinition {
  return BLOCK_DEFINITIONS[type];
}

/**
 * Get the size for a block type.
 */
export function getBlockSize(type: BlockType): Size {
  return BLOCK_DEFINITIONS[type].size;
}

/**
 * Get the default ports for a block type.
 */
export function getDefaultPorts(type: BlockType): Port[] {
  return BLOCK_DEFINITIONS[type].defaultPorts;
}

/**
 * Get the default type-specific properties for a block type.
 */
export function getDefaultBlockProps(type: BlockType): Record<string, unknown> {
  return BLOCK_DEFINITIONS[type].defaultProps;
}

/**
 * Get the appropriate ports for a power source based on polarity.
 * - positive/negative → output port on bottom
 * - ground → input port on top
 */
export function getPowerSourcePorts(polarity: PowerPolarity): Port[] {
  if (polarity === 'ground') {
    return [{ id: 'in', type: 'input', label: 'GND', position: 'top' }];
  }
  return [{ id: 'out', type: 'output', label: '+', position: 'bottom' }];
}

export default BLOCK_DEFINITIONS;
