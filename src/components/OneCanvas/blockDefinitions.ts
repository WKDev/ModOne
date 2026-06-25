/**
 * Block Definitions Registry
 *
 * Single source of truth for block sizes, default ports, and default properties.
 */

import type { BlockType, Port, Size, PowerPolarity } from './types';
import { normalizeSymbolPortToMm, normalizeSymbolSizeToMm } from './canvasUnits';

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

const BLOCK_DEFINITIONS: Partial<Record<BlockType, BlockDefinition>> = {
  powersource: {
    size: { width: 20, height: 20 },
    defaultPorts: [
      { id: 'out', type: 'output', label: '+', position: 'bottom', absolutePosition: { x: 10, y: 20 } },
    ],
    defaultProps: { voltage: 24, polarity: 'positive', maxCurrent: 1000 },
  },
  plc_out: {
    size: { width: 40, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 10 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 40, y: 10 } },
    ],
    defaultProps: { address: 'C:0x0000', normallyOpen: true, inverted: false },
  },
  plc_in: {
    size: { width: 40, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 10 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 40, y: 10 } },
    ],
    defaultProps: { address: 'DI:0x0000', thresholdVoltage: 12, inverted: false },
  },
  led: {
    size: { width: 20, height: 30 },
    defaultPorts: [
      { id: 'anode', type: 'input', label: '+', position: 'top', absolutePosition: { x: 10, y: 0 } },
      { id: 'cathode', type: 'output', label: '-', position: 'bottom', absolutePosition: { x: 10, y: 30 } },
    ],
    defaultProps: { color: 'red', forwardVoltage: 2.0, lit: false },
  },
  button: {
    size: { width: 20, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 10 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 20, y: 10 } },
    ],
    defaultProps: { mode: 'momentary', contactConfig: '1a', pressed: false },
  },
  scope: {
    size: { width: 50, height: 40 },
    defaultPorts: [
      { id: 'ch1', type: 'input', label: 'CH1', position: 'left', offset: 0.25, absolutePosition: { x: 0, y: 10 } },
      { id: 'ch2', type: 'input', label: 'CH2', position: 'left', offset: 0.5, absolutePosition: { x: 0, y: 20 } },
      { id: 'ch3', type: 'input', label: 'CH3', position: 'left', offset: 0.75, absolutePosition: { x: 0, y: 30 } },
      { id: 'ch4', type: 'input', label: 'CH4', position: 'left', offset: 1.0, absolutePosition: { x: 0, y: 40 } },
    ],
    defaultProps: { channels: 1, triggerMode: 'auto', timeBase: 100, voltageScale: 5 },
  },
  text: {
    size: { width: 80, height: 20 },
    defaultPorts: [],
    defaultProps: {
      content: 'Text',
      textStyle: 'label',
      fontSize: 7,
      textColor: '#e5e5e5',
      backgroundColor: '',
      showBorder: false,
    },
  },

  // ========================================================================
  // Industrial Components
  // ========================================================================

  relay: {
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'coil_in', type: 'input', label: 'A1', position: 'top', absolutePosition: { x: 20, y: 0 } },
      { id: 'coil_out', type: 'output', label: 'A2', position: 'bottom', absolutePosition: { x: 20, y: 40 } },
      { id: 'com', type: 'input', label: 'COM', position: 'left', offset: 0.5, absolutePosition: { x: 0, y: 20 } },
      { id: 'no', type: 'output', label: 'NO', position: 'right', offset: 0.25, absolutePosition: { x: 40, y: 10 } },
      { id: 'nc', type: 'output', label: 'NC', position: 'right', offset: 0.75, absolutePosition: { x: 40, y: 30 } },
    ],
    defaultProps: { designation: 'K1', coilVoltage: 24, contacts: 'NO', energized: false },
  },
  fuse: {
    size: { width: 20, height: 30 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'LINE', position: 'top', absolutePosition: { x: 10, y: 0 } },
      { id: 'out', type: 'output', label: 'LOAD', position: 'bottom', absolutePosition: { x: 10, y: 30 } },
    ],
    defaultProps: { designation: 'F1', fuseType: 'fuse', ratingAmps: 10, tripped: false },
  },
  motor: {
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'l1', type: 'input', label: 'U', position: 'top', offset: 0.25, absolutePosition: { x: 10, y: 0 } },
      { id: 'l2', type: 'input', label: 'V', position: 'top', offset: 0.5, absolutePosition: { x: 20, y: 0 } },
      { id: 'l3', type: 'input', label: 'W', position: 'top', offset: 0.75, absolutePosition: { x: 30, y: 0 } },
      { id: 'pe', type: 'input', label: 'PE', position: 'bottom', absolutePosition: { x: 20, y: 40 } },
    ],
    defaultProps: { designation: 'M1', powerKw: 1.5, voltageRating: 400, running: false },
  },
  emergency_stop: {
    size: { width: 30, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 10 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 30, y: 10 } },
    ],
    defaultProps: { designation: 'ES1', engaged: false },
  },
  selector_switch: {
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'com', type: 'input', label: 'COM', position: 'left', offset: 0.25, absolutePosition: { x: 0, y: 10 } },
      { id: 'pos1', type: 'output', label: '1', position: 'right', offset: 0.25, absolutePosition: { x: 40, y: 10 } },
      { id: 'pos2', type: 'output', label: '2', position: 'right', offset: 0.5, absolutePosition: { x: 40, y: 20 } },
    ],
    defaultProps: { designation: 'S1', positions: 2, currentPosition: 0, maintained: true },
  },
  solenoid_valve: {
    size: { width: 20, height: 30 },
    defaultPorts: [
      { id: 'coil_in', type: 'input', label: 'A1', position: 'top', absolutePosition: { x: 10, y: 0 } },
      { id: 'coil_out', type: 'output', label: 'A2', position: 'bottom', absolutePosition: { x: 10, y: 30 } },
    ],
    defaultProps: { designation: 'Y1', valveType: '5-2', coilVoltage: 24, energized: false },
  },
  sensor: {
    size: { width: 20, height: 20 },
    defaultPorts: [
      { id: 'vcc', type: 'input', label: '+V', position: 'top', absolutePosition: { x: 10, y: 0 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 20, y: 10 } },
      { id: 'gnd', type: 'output', label: '0V', position: 'bottom', absolutePosition: { x: 10, y: 20 } },
    ],
    defaultProps: { designation: 'B1', sensorType: 'proximity_inductive', outputType: 'PNP', detecting: false },
  },
  pilot_lamp: {
    size: { width: 20, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: '+', position: 'top', absolutePosition: { x: 10, y: 0 } },
      { id: 'out', type: 'output', label: '-', position: 'bottom', absolutePosition: { x: 10, y: 20 } },
    ],
    defaultProps: { designation: 'H1', lampColor: 'green', voltageRating: 24, lit: false },
  },
  net_label: {
    size: { width: 40, height: 20 },
    defaultPorts: [
      { id: 'conn', type: 'input', label: '', position: 'left', absolutePosition: { x: 0, y: 10 } },
    ],
    defaultProps: { netName: '+24V', direction: 'right', description: '' },
  },

  // ========================================================================
  // Additional Industrial Components
  // ========================================================================

  transformer: {
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'pri_1', type: 'input', label: 'L1', position: 'top', offset: 0.25, absolutePosition: { x: 10, y: 0 } },
      { id: 'pri_2', type: 'input', label: 'N', position: 'top', offset: 0.75, absolutePosition: { x: 30, y: 0 } },
      { id: 'sec_1', type: 'output', label: 'L', position: 'bottom', offset: 0.25, absolutePosition: { x: 10, y: 40 } },
      { id: 'sec_2', type: 'output', label: 'N', position: 'bottom', offset: 0.75, absolutePosition: { x: 30, y: 40 } },
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
    size: { width: 20, height: 30 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'top', absolutePosition: { x: 10, y: 0 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'bottom', absolutePosition: { x: 10, y: 30 } },
    ],
    defaultProps: {
      designation: 'X1:1',
      terminalType: 'feed_through',
      wireSizeMm2: 2.5,
      terminalCount: 1,
    },
  },
  overload_relay: {
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'l1_in', type: 'input', label: '1', position: 'top', offset: 0.25, absolutePosition: { x: 10, y: 0 } },
      { id: 'l2_in', type: 'input', label: '3', position: 'top', offset: 0.5, absolutePosition: { x: 20, y: 0 } },
      { id: 'l3_in', type: 'input', label: '5', position: 'top', offset: 0.75, absolutePosition: { x: 30, y: 0 } },
      { id: 'l1_out', type: 'output', label: '2', position: 'bottom', offset: 0.25, absolutePosition: { x: 10, y: 40 } },
      { id: 'l2_out', type: 'output', label: '4', position: 'bottom', offset: 0.5, absolutePosition: { x: 20, y: 40 } },
      { id: 'l3_out', type: 'output', label: '6', position: 'bottom', offset: 0.75, absolutePosition: { x: 30, y: 40 } },
      { id: 'nc', type: 'output', label: '95-96', position: 'right', offset: 0.25, absolutePosition: { x: 40, y: 10 } },
      { id: 'no', type: 'output', label: '97-98', position: 'right', offset: 0.75, absolutePosition: { x: 40, y: 30 } },
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
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'coil_a1', type: 'input', label: 'A1', position: 'left', offset: 0.25, absolutePosition: { x: 0, y: 10 } },
      { id: 'coil_a2', type: 'output', label: 'A2', position: 'left', offset: 0.75, absolutePosition: { x: 0, y: 30 } },
      { id: 'l1_in', type: 'input', label: '1', position: 'top', offset: 0.25, absolutePosition: { x: 10, y: 0 } },
      { id: 'l2_in', type: 'input', label: '3', position: 'top', offset: 0.5, absolutePosition: { x: 20, y: 0 } },
      { id: 'l3_in', type: 'input', label: '5', position: 'top', offset: 0.75, absolutePosition: { x: 30, y: 0 } },
      { id: 'l1_out', type: 'output', label: '2', position: 'bottom', offset: 0.25, absolutePosition: { x: 10, y: 40 } },
      { id: 'l2_out', type: 'output', label: '4', position: 'bottom', offset: 0.5, absolutePosition: { x: 20, y: 40 } },
      { id: 'l3_out', type: 'output', label: '6', position: 'bottom', offset: 0.75, absolutePosition: { x: 30, y: 40 } },
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
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'l1_in', type: 'input', label: '1', position: 'top', offset: 0.25, absolutePosition: { x: 10, y: 0 } },
      { id: 'l2_in', type: 'input', label: '3', position: 'top', offset: 0.5, absolutePosition: { x: 20, y: 0 } },
      { id: 'l3_in', type: 'input', label: '5', position: 'top', offset: 0.75, absolutePosition: { x: 30, y: 0 } },
      { id: 'l1_out', type: 'output', label: '2', position: 'bottom', offset: 0.25, absolutePosition: { x: 10, y: 40 } },
      { id: 'l2_out', type: 'output', label: '4', position: 'bottom', offset: 0.5, absolutePosition: { x: 20, y: 40 } },
      { id: 'l3_out', type: 'output', label: '6', position: 'bottom', offset: 0.75, absolutePosition: { x: 30, y: 40 } },
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
    size: { width: 40, height: 20 },
    defaultPorts: [
      { id: 'conn', type: 'bidirectional', label: '', position: 'left', absolutePosition: { x: 0, y: 10 } },
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
    size: { width: 30, height: 30 },
    defaultPorts: [],
    defaultProps: { symbolId: '', selectedUnit: 0, instanceProperties: {} },
  },
  terminal: {
    size: { width: 20, height: 20 },
    defaultPorts: [
      { id: 'conn', type: 'bidirectional', label: '', position: 'left', absolutePosition: { x: 0, y: 10 } },
    ],
    defaultProps: { designation: 'X1', terminalType: 'generic' },
  },

  // ======== Canonical Symbol Types ========
  ['power_source' as BlockType]: {
    size: { width: 20, height: 40 },
    defaultPorts: [
      { id: 'out', type: 'output', label: '+', position: 'bottom', absolutePosition: { x: 10, y: 40 } },
    ],
    defaultProps: { designation: 'PS1', voltage: 24, polarity: 'positive' },
  },
  ['power_source_dc_2p' as BlockType]: {
    size: { width: 20, height: 30 },
    defaultPorts: [
      { id: 'pos', type: 'output', label: '+', position: 'top', absolutePosition: { x: 10, y: 0 } },
      { id: 'neg', type: 'output', label: '-', position: 'bottom', absolutePosition: { x: 10, y: 30 } },
    ],
    defaultProps: { designation: 'BAT1', voltage: 24, polarity: 'positive' },
  },
  ['power_source_ac_1p' as BlockType]: {
    size: { width: 20, height: 20 },
    defaultPorts: [
      { id: 'out', type: 'output', label: 'L', position: 'bottom', absolutePosition: { x: 10, y: 20 } },
    ],
    defaultProps: { designation: 'L1', voltage: 230, frequency: 50 },
  },
  ['power_source_ac_2p' as BlockType]: {
    size: { width: 30, height: 30 },
    defaultPorts: [
      { id: 'l', type: 'output', label: 'L', position: 'top', absolutePosition: { x: 15, y: 0 } },
      { id: 'n', type: 'output', label: 'N', position: 'bottom', absolutePosition: { x: 15, y: 30 } },
    ],
    defaultProps: { designation: 'G1', voltage: 230, frequency: 50 },
  },
  ['ground' as BlockType]: {
    size: { width: 20, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'GND', position: 'top', absolutePosition: { x: 10, y: 0 } },
    ],
    defaultProps: { designation: 'GND1', netName: '0V' },
  },
  ['switch_no' as BlockType]: {
    size: { width: 30, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 10 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 30, y: 10 } },
    ],
    defaultProps: { designation: 'S1', normallyOpen: true },
  },
  ['switch_nc' as BlockType]: {
    size: { width: 30, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 10 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 30, y: 10 } },
    ],
    defaultProps: { designation: 'S1', normallyOpen: false },
  },
  ['switch_changeover' as BlockType]: {
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'com', type: 'input', label: 'COM', position: 'left', offset: 0.5, absolutePosition: { x: 0, y: 20 } },
      { id: 'pos1', type: 'output', label: 'NO', position: 'right', offset: 0.25, absolutePosition: { x: 40, y: 10 } },
      { id: 'pos2', type: 'output', label: 'NC', position: 'right', offset: 0.5, absolutePosition: { x: 40, y: 20 } },
    ],
    defaultProps: { designation: 'S1', normallyOpen: true, position: 1 },
  },
  ['push_button_no' as BlockType]: {
    size: { width: 30, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 10 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 30, y: 10 } },
    ],
    defaultProps: { designation: 'S1', normallyOpen: true, momentary: true, pressed: false },
  },
  ['push_button_nc' as BlockType]: {
    size: { width: 30, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 10 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 30, y: 10 } },
    ],
    defaultProps: { designation: 'S1', normallyOpen: false, momentary: true, pressed: false },
  },
  ['circuit_breaker' as BlockType]: {
    size: { width: 20, height: 30 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'LINE', position: 'top', absolutePosition: { x: 10, y: 0 } },
      { id: 'out', type: 'output', label: 'LOAD', position: 'bottom', absolutePosition: { x: 10, y: 30 } },
    ],
    defaultProps: { designation: 'Q1', currentRating: 10, tripped: false },
  },
  ['relay_coil' as BlockType]: {
    size: { width: 20, height: 30 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'A1', position: 'top', absolutePosition: { x: 10, y: 0 } },
      { id: 'out', type: 'output', label: 'A2', position: 'bottom', absolutePosition: { x: 10, y: 30 } },
    ],
    defaultProps: { designation: 'K1', coilVoltage: 24, energized: false },
  },
  ['relay_contact_no' as BlockType]: {
    size: { width: 30, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 10 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 30, y: 10 } },
    ],
    defaultProps: { designation: 'K1', coilVoltage: 24, energized: false, normallyOpen: true },
  },
  ['relay_contact_nc' as BlockType]: {
    size: { width: 30, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 10 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 30, y: 10 } },
    ],
    defaultProps: { designation: 'K1', coilVoltage: 24, energized: false, normallyOpen: false },
  },
  ['resistor' as BlockType]: {
    size: { width: 30, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 10 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 30, y: 10 } },
    ],
    defaultProps: { designation: 'R1', value: 1000, tolerancePercent: 5 },
  },
  ['capacitor' as BlockType]: {
    size: { width: 20, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'top', absolutePosition: { x: 10, y: 0 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'bottom', absolutePosition: { x: 10, y: 20 } },
    ],
    defaultProps: { designation: 'C1', value: 10, unit: 'uF', voltageRating: 50 },
  },
  ['inductor' as BlockType]: {
    size: { width: 30, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 10 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 30, y: 10 } },
    ],
    defaultProps: { designation: 'L1', value: 10, unit: 'mH' },
  },
  ['diode' as BlockType]: {
    size: { width: 20, height: 20 },
    defaultPorts: [
      { id: 'anode', type: 'input', label: 'A', position: 'top', absolutePosition: { x: 10, y: 0 } },
      { id: 'cathode', type: 'output', label: 'K', position: 'bottom', absolutePosition: { x: 10, y: 20 } },
    ],
    defaultProps: { designation: 'D1', forwardVoltage: 0.7, currentRatingMa: 1000 },
  },
  ['plc_input' as BlockType]: {
    size: { width: 40, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 10 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 40, y: 10 } },
    ],
    defaultProps: { address: 'DI:0x0000' },
  },
  ['plc_output' as BlockType]: {
    size: { width: 40, height: 20 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 10 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 40, y: 10 } },
    ],
    defaultProps: { address: 'DO:0x0000' },
  },
  ['timer_on_delay' as BlockType]: {
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 20 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 40, y: 20 } },
    ],
    defaultProps: { designation: 'T1', delayMs: 1000, running: false },
  },
  ['timer_off_delay' as BlockType]: {
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'IN', position: 'left', absolutePosition: { x: 0, y: 20 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 40, y: 20 } },
    ],
    defaultProps: { designation: 'T1', delayMs: 1000, running: false },
  },
  ['counter_up' as BlockType]: {
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'count_in', type: 'input', label: 'CU', position: 'left', absolutePosition: { x: 0, y: 20 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 40, y: 20 } },
      { id: 'reset', type: 'input', label: 'RST', position: 'bottom', absolutePosition: { x: 20, y: 40 } },
    ],
    defaultProps: { designation: 'C1', preset: 10, currentValue: 0 },
  },
  ['counter_down' as BlockType]: {
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'count_in', type: 'input', label: 'CD', position: 'left', absolutePosition: { x: 0, y: 20 } },
      { id: 'out', type: 'output', label: 'OUT', position: 'right', absolutePosition: { x: 40, y: 20 } },
      { id: 'reset', type: 'input', label: 'RST', position: 'bottom', absolutePosition: { x: 20, y: 40 } },
    ],
    defaultProps: { designation: 'C1', preset: 10, currentValue: 0 },
  },
  ['connector' as BlockType]: {
    size: { width: 30, height: 20 },
    defaultPorts: [
      { id: 'left', type: 'bidirectional', label: 'L', position: 'left', absolutePosition: { x: 0, y: 10 } },
      { id: 'right', type: 'bidirectional', label: 'R', position: 'right', absolutePosition: { x: 30, y: 10 } },
    ],
    defaultProps: { designation: 'J1', connectorType: 'generic' },
  },
  ['junction_box' as BlockType]: {
    size: { width: 40, height: 40 },
    defaultPorts: [
      { id: 'top', type: 'input', label: 'TOP', position: 'top', absolutePosition: { x: 20, y: 0 } },
      { id: 'right', type: 'output', label: 'RIGHT', position: 'right', absolutePosition: { x: 40, y: 20 } },
      { id: 'bottom', type: 'output', label: 'BOT', position: 'bottom', absolutePosition: { x: 20, y: 40 } },
      { id: 'left', type: 'input', label: 'LEFT', position: 'left', absolutePosition: { x: 0, y: 20 } },
    ],
    defaultProps: { designation: 'JB1', enclosureRating: 'IP65' },
  },
};

// ============================================================================
// Access Functions
// ============================================================================

/**
 * Get the full block definition for a block type.
 */
export function getBlockDefinition(type: BlockType): BlockDefinition {
  const def = BLOCK_DEFINITIONS[type];
  if (!def) throw new Error(`No block definition for type: ${type}`);
  return {
    ...def,
    size: normalizeSymbolSizeToMm(def.size),
    defaultPorts: def.defaultPorts.map((port) => normalizeSymbolPortToMm(port)),
  };
}

/**
 * Get the size for a block type.
 */
export function getBlockSize(type: BlockType): Size {
  const def = BLOCK_DEFINITIONS[type];
  if (!def) throw new Error(`No block definition for type: ${type}`);
  return normalizeSymbolSizeToMm(def.size);
}

/**
 * Get the default ports for a block type.
 */
export function getDefaultPorts(type: BlockType): Port[] {
  const def = BLOCK_DEFINITIONS[type];
  if (!def) return [];
  return def.defaultPorts.map((port) => normalizeSymbolPortToMm(port));
}

/**
 * Get the default type-specific properties for a block type.
 */
export function getDefaultBlockProps(type: BlockType): Record<string, unknown> {
  const def = BLOCK_DEFINITIONS[type];
  if (!def) return {};
  return def.defaultProps;
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
