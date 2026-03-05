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
      { id: 'out', type: 'output', label: '+', position: 'bottom', absolutePosition: { x: 20, y: 40 } },
    ],
    defaultProps: { voltage: 24, polarity: 'positive', maxCurrent: 1000 },
  },
  plc_out: {
    size: { width: 80, height: 40 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 20 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 80, y: 20 } },
    ],
    defaultProps: { address: 'C:0x0000', normallyOpen: true, inverted: false },
  },
  plc_in: {
    size: { width: 80, height: 40 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 20 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 80, y: 20 } },
    ],
    defaultProps: { address: 'DI:0x0000', thresholdVoltage: 12, inverted: false },
  },
  led: {
    size: { width: 40, height: 60 },
    defaultPorts: [
      { id: 'anode', type: 'input', label: '+', position: 'top', absolutePosition: { x: 20, y: 0 } },
      { id: 'cathode', type: 'output', label: '-', position: 'bottom', absolutePosition: { x: 20, y: 60 } },
    ],
    defaultProps: { color: 'red', forwardVoltage: 2.0, lit: false },
  },
  button: {
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 20 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 40, y: 20 } },
    ],
    defaultProps: { mode: 'momentary', contactConfig: '1a', pressed: false },
  },
  scope: {
    size: { width: 100, height: 80 },
    defaultPorts: [
      { id: 'ch1', type: 'input', label: 'CH1', position: 'left', offset: 0.25, absolutePosition: { x: 0, y: 20 } },
      { id: 'ch2', type: 'input', label: 'CH2', position: 'left', offset: 0.5, absolutePosition: { x: 0, y: 40 } },
      { id: 'ch3', type: 'input', label: 'CH3', position: 'left', offset: 0.75, absolutePosition: { x: 0, y: 60 } },
      { id: 'ch4', type: 'input', label: 'CH4', position: 'left', offset: 1.0, absolutePosition: { x: 0, y: 80 } },
    ],
    defaultProps: { channels: 1, triggerMode: 'auto', timeBase: 100, voltageScale: 5 },
  },
  text: {
    size: { width: 160, height: 40 },
    defaultPorts: [],
    defaultProps: {
      content: 'Text',
      textStyle: 'label',
      fontSize: 14,
      textColor: '#e5e5e5',
      backgroundColor: '',
      showBorder: false,
    },
  },

  // ========================================================================
  // Industrial Components
  // ========================================================================

  relay: {
    size: { width: 60, height: 60 },
    defaultPorts: [
      { id: 'coil_in', type: 'input', label: 'A1', position: 'top', absolutePosition: { x: 30, y: 0 } },
      { id: 'coil_out', type: 'output', label: 'A2', position: 'bottom', absolutePosition: { x: 30, y: 60 } },
      { id: 'com', type: 'input', label: 'COM', position: 'left', offset: 0.5, absolutePosition: { x: 0, y: 30 } },
      { id: 'no', type: 'output', label: 'NO', position: 'right', offset: 0.35, absolutePosition: { x: 60, y: 21 } },
      { id: 'nc', type: 'output', label: 'NC', position: 'right', offset: 0.65, absolutePosition: { x: 60, y: 39 } },
    ],
    defaultProps: { designation: 'K1', coilVoltage: 24, contacts: 'NO', energized: false },
  },
  fuse: {
    size: { width: 40, height: 50 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'LINE', position: 'top', absolutePosition: { x: 20, y: 0 } },
      { id: 'out', type: 'output', label: 'LOAD', position: 'bottom', absolutePosition: { x: 20, y: 50 } },
    ],
    defaultProps: { designation: 'F1', fuseType: 'fuse', ratingAmps: 10, tripped: false },
  },
  motor: {
    size: { width: 60, height: 60 },
    defaultPorts: [
      { id: 'l1', type: 'input', label: 'U', position: 'top', offset: 0.25, absolutePosition: { x: 15, y: 0 } },
      { id: 'l2', type: 'input', label: 'V', position: 'top', offset: 0.5, absolutePosition: { x: 30, y: 0 } },
      { id: 'l3', type: 'input', label: 'W', position: 'top', offset: 0.75, absolutePosition: { x: 45, y: 0 } },
      { id: 'pe', type: 'input', label: 'PE', position: 'bottom', absolutePosition: { x: 30, y: 60 } },
    ],
    defaultProps: { designation: 'M1', powerKw: 1.5, voltageRating: 400, running: false },
  },
  emergency_stop: {
    size: { width: 50, height: 50 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 25 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 50, y: 25 } },
    ],
    defaultProps: { designation: 'ES1', engaged: false },
  },
  selector_switch: {
    size: { width: 50, height: 50 },
    defaultPorts: [
      { id: 'com', type: 'input', label: 'COM', position: 'left', absolutePosition: { x: 0, y: 25 } },
      { id: 'pos1', type: 'output', label: '1', position: 'right', offset: 0.35, absolutePosition: { x: 50, y: 17.5 } },
      { id: 'pos2', type: 'output', label: '2', position: 'right', offset: 0.65, absolutePosition: { x: 50, y: 32.5 } },
    ],
    defaultProps: { designation: 'S1', positions: 2, currentPosition: 0, maintained: true },
  },
  solenoid_valve: {
    size: { width: 60, height: 50 },
    defaultPorts: [
      { id: 'coil_in', type: 'input', label: 'A1', position: 'top', absolutePosition: { x: 30, y: 0 } },
      { id: 'coil_out', type: 'output', label: 'A2', position: 'bottom', absolutePosition: { x: 30, y: 50 } },
    ],
    defaultProps: { designation: 'Y1', valveType: '5-2', coilVoltage: 24, energized: false },
  },
  sensor: {
    size: { width: 60, height: 40 },
    defaultPorts: [
      { id: 'vcc', type: 'input', label: '+V', position: 'top', absolutePosition: { x: 30, y: 0 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 60, y: 20 } },
      { id: 'gnd', type: 'output', label: '0V', position: 'bottom', absolutePosition: { x: 30, y: 40 } },
    ],
    defaultProps: { designation: 'B1', sensorType: 'proximity_inductive', outputType: 'PNP', detecting: false },
  },
  pilot_lamp: {
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'in', type: 'input', label: '+', position: 'top', absolutePosition: { x: 20, y: 0 } },
      { id: 'out', type: 'output', label: '-', position: 'bottom', absolutePosition: { x: 20, y: 40 } },
    ],
    defaultProps: { designation: 'H1', lampColor: 'green', voltageRating: 24, lit: false },
  },
  net_label: {
    size: { width: 80, height: 24 },
    defaultPorts: [
      { id: 'conn', type: 'input', label: '', position: 'left', absolutePosition: { x: 0, y: 12 } },
    ],
    defaultProps: { netName: '+24V', direction: 'right', description: '' },
  },

  // ========================================================================
  // Additional Industrial Components
  // ========================================================================

  transformer: {
    size: { width: 70, height: 80 },
    defaultPorts: [
      { id: 'pri_1', type: 'input', label: 'L1', position: 'top', offset: 0.3, absolutePosition: { x: 21, y: 0 } },
      { id: 'pri_2', type: 'input', label: 'N', position: 'top', offset: 0.7, absolutePosition: { x: 49, y: 0 } },
      { id: 'sec_1', type: 'output', label: 'L', position: 'bottom', offset: 0.3, absolutePosition: { x: 21, y: 80 } },
      { id: 'sec_2', type: 'output', label: 'N', position: 'bottom', offset: 0.7, absolutePosition: { x: 49, y: 80 } },
    ],
    defaultProps: {
      designation: 'T1',
      transformerType: 'control',
      primaryVoltage: 400,
      secondaryVoltage: 24,
      powerVa: 100,
    },
  },
  terminal_block: {
    size: { width: 40, height: 50 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'top', absolutePosition: { x: 20, y: 0 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'bottom', absolutePosition: { x: 20, y: 50 } },
    ],
    defaultProps: {
      designation: 'X1:1',
      terminalType: 'feed_through',
      wireSizeMm2: 2.5,
      terminalCount: 1,
    },
  },
  overload_relay: {
    size: { width: 60, height: 70 },
    defaultPorts: [
      { id: 'l1_in', type: 'input', label: '1', position: 'top', offset: 0.25, absolutePosition: { x: 15, y: 0 } },
      { id: 'l2_in', type: 'input', label: '3', position: 'top', offset: 0.5, absolutePosition: { x: 30, y: 0 } },
      { id: 'l3_in', type: 'input', label: '5', position: 'top', offset: 0.75, absolutePosition: { x: 45, y: 0 } },
      { id: 'l1_out', type: 'output', label: '2', position: 'bottom', offset: 0.25, absolutePosition: { x: 15, y: 70 } },
      { id: 'l2_out', type: 'output', label: '4', position: 'bottom', offset: 0.5, absolutePosition: { x: 30, y: 70 } },
      { id: 'l3_out', type: 'output', label: '6', position: 'bottom', offset: 0.75, absolutePosition: { x: 45, y: 70 } },
      { id: 'nc', type: 'output', label: '95-96', position: 'right', offset: 0.35, absolutePosition: { x: 60, y: 24.5 } },
      { id: 'no', type: 'output', label: '97-98', position: 'right', offset: 0.65, absolutePosition: { x: 60, y: 45.5 } },
    ],
    defaultProps: {
      designation: 'F1',
      overloadClass: '10',
      currentMin: 1.0,
      currentMax: 1.6,
      tripped: false,
    },
  },
  contactor: {
    size: { width: 70, height: 80 },
    defaultPorts: [
      { id: 'coil_a1', type: 'input', label: 'A1', position: 'left', offset: 0.25, absolutePosition: { x: 0, y: 20 } },
      { id: 'coil_a2', type: 'output', label: 'A2', position: 'left', offset: 0.75, absolutePosition: { x: 0, y: 60 } },
      { id: 'l1_in', type: 'input', label: '1', position: 'top', offset: 0.25, absolutePosition: { x: 17.5, y: 0 } },
      { id: 'l2_in', type: 'input', label: '3', position: 'top', offset: 0.5, absolutePosition: { x: 35, y: 0 } },
      { id: 'l3_in', type: 'input', label: '5', position: 'top', offset: 0.75, absolutePosition: { x: 52.5, y: 0 } },
      { id: 'l1_out', type: 'output', label: '2', position: 'bottom', offset: 0.25, absolutePosition: { x: 17.5, y: 80 } },
      { id: 'l2_out', type: 'output', label: '4', position: 'bottom', offset: 0.5, absolutePosition: { x: 35, y: 80 } },
      { id: 'l3_out', type: 'output', label: '6', position: 'bottom', offset: 0.75, absolutePosition: { x: 52.5, y: 80 } },
    ],
    defaultProps: {
      designation: 'KM1',
      contactorType: 'main',
      coilVoltage: 24,
      powerRating: 4,
      mainContacts: 3,
      auxContacts: 1,
      energized: false,
    },
  },
  disconnect_switch: {
    size: { width: 60, height: 70 },
    defaultPorts: [
      { id: 'l1_in', type: 'input', label: '1', position: 'top', offset: 0.25, absolutePosition: { x: 15, y: 0 } },
      { id: 'l2_in', type: 'input', label: '3', position: 'top', offset: 0.5, absolutePosition: { x: 30, y: 0 } },
      { id: 'l3_in', type: 'input', label: '5', position: 'top', offset: 0.75, absolutePosition: { x: 45, y: 0 } },
      { id: 'l1_out', type: 'output', label: '2', position: 'bottom', offset: 0.25, absolutePosition: { x: 15, y: 70 } },
      { id: 'l2_out', type: 'output', label: '4', position: 'bottom', offset: 0.5, absolutePosition: { x: 30, y: 70 } },
      { id: 'l3_out', type: 'output', label: '6', position: 'bottom', offset: 0.75, absolutePosition: { x: 45, y: 70 } },
    ],
    defaultProps: {
      designation: 'Q1',
      disconnectType: 'rotary',
      poles: 3,
      currentRating: 25,
      open: false,
    },
  },
  off_page_connector: {
    size: { width: 80, height: 32 },
    defaultPorts: [
      { id: 'conn', type: 'bidirectional', label: '', position: 'left', absolutePosition: { x: 0, y: 16 } },
    ],
    defaultProps: {
      signalLabel: 'SIGNAL',
      direction: 'outgoing',
      targetPageId: undefined,
      targetPageNumber: undefined,
      targetPageName: undefined,
      dangling: true,
    },
  },
  custom_symbol: {
    size: { width: 60, height: 60 },
    defaultPorts: [],
    defaultProps: { symbolId: '', selectedUnit: 0, instanceProperties: {} },
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
