/**
 * Block Definitions Registry
 *
 * Single source of truth for block sizes, default ports, and default properties.
 * All block types (except junction, which is a wire-level concept) are defined here.
 */

import type { BlockType, Port, Size } from './types';

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

const BLOCK_DEFINITIONS: Record<Exclude<BlockType, 'junction'>, BlockDefinition> = {
  power_24v: {
    size: { width: 60, height: 40 },
    defaultPorts: [
      { id: 'out', type: 'output', label: '+', position: 'bottom' },
    ],
    defaultProps: { maxCurrent: 1000 },
  },
  power_12v: {
    size: { width: 60, height: 40 },
    defaultPorts: [
      { id: 'out', type: 'output', label: '+', position: 'bottom' },
    ],
    defaultProps: { maxCurrent: 1000 },
  },
  gnd: {
    size: { width: 40, height: 50 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'GND', position: 'top' },
    ],
    defaultProps: {},
  },
  plc_out: {
    size: { width: 80, height: 50 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left' },
      { id: 'out', type: 'output', label: 'OUT', position: 'right' },
    ],
    defaultProps: { address: 'C:0x0000', normallyOpen: true, inverted: false },
  },
  plc_in: {
    size: { width: 80, height: 50 },
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
    size: { width: 60, height: 60 },
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
 * Returns undefined for 'junction' type (use Junction interface instead).
 */
export function getBlockDefinition(type: BlockType): BlockDefinition | undefined {
  if (type === 'junction') return undefined;
  return BLOCK_DEFINITIONS[type as Exclude<BlockType, 'junction'>];
}

/**
 * Get the size for a block type.
 * Returns { width: 0, height: 0 } for junction (center-based, no visual size).
 */
export function getBlockSize(type: BlockType): Size {
  if (type === 'junction') return { width: 0, height: 0 };
  return BLOCK_DEFINITIONS[type as Exclude<BlockType, 'junction'>]?.size ?? { width: 60, height: 60 };
}

/**
 * Get the default ports for a block type.
 */
export function getDefaultPorts(type: BlockType): Port[] {
  if (type === 'junction') {
    return [{ id: 'hub', type: 'bidirectional', label: '', position: 'right', offset: 0.5 }];
  }
  return BLOCK_DEFINITIONS[type as Exclude<BlockType, 'junction'>]?.defaultPorts ?? [];
}

/**
 * Get the default type-specific properties for a block type.
 */
export function getDefaultBlockProps(type: BlockType): Record<string, unknown> {
  if (type === 'junction') return {};
  return BLOCK_DEFINITIONS[type as Exclude<BlockType, 'junction'>]?.defaultProps ?? {};
}

export default BLOCK_DEFINITIONS;
