/**
 * Wire Numbering Utility (IEC 81346)
 *
 * Implements automatic wire numbering based on IEC 81346 standard.
 * Wire numbers are typically assigned based on:
 * - Source/destination component designations
 * - Function/signal type
 * - Sequential numbering within a circuit
 */

import type { Block, Wire, WireEndpoint, Position } from '../types';
import { isPortEndpoint } from '../types';

// ============================================================================
// Types
// ============================================================================

/** Wire number assignment */
export interface WireNumber {
  /** Wire ID */
  wireId: string;
  /** Assigned wire number */
  number: string;
  /** Optional color code */
  colorCode?: string;
  /** Source designation (e.g., "K1:A2") */
  source: string;
  /** Destination designation (e.g., "F1:LINE") */
  destination: string;
  /** Signal type (power, control, signal, etc.) */
  signalType: WireSignalType;
}

/** Signal type for wire classification */
export type WireSignalType = 'power_main' | 'power_control' | 'control' | 'signal' | 'ground' | 'unknown';

/** Wire numbering scheme */
export type NumberingScheme = 'sequential' | 'component_based' | 'zone_based';

/** Numbering options */
export interface WireNumberingOptions {
  /** Numbering scheme to use */
  scheme: NumberingScheme;
  /** Starting number for sequential scheme */
  startNumber?: number;
  /** Prefix for wire numbers */
  prefix?: string;
  /** Whether to include signal type in number */
  includeSignalType?: boolean;
  /** Whether to sort by position (top-to-bottom, left-to-right) */
  sortByPosition?: boolean;
}

/** Wire numbering result */
export interface WireNumberingResult {
  /** Wire numbers for all wires */
  wireNumbers: WireNumber[];
  /** Summary statistics */
  stats: {
    totalWires: number;
    powerWires: number;
    controlWires: number;
    signalWires: number;
    groundWires: number;
  };
}

// ============================================================================
// Signal Type Detection
// ============================================================================

/** Block types that indicate power circuits */
const POWER_BLOCK_TYPES = new Set([
  'powersource',
  'motor',
  'fuse',
  'disconnect_switch',
  'contactor',
  'overload_relay',
  'transformer',
]);

/** Block types that indicate control circuits */
const CONTROL_BLOCK_TYPES = new Set([
  'relay',
  'button',
  'emergency_stop',
  'selector_switch',
  'solenoid_valve',
  'pilot_lamp',
]);

/** Block types that indicate signal circuits */
const SIGNAL_BLOCK_TYPES = new Set([
  'plc_in',
  'plc_out',
  'sensor',
  'scope',
]);

/**
 * Detect the signal type of a wire based on connected components
 */
export function detectSignalType(
  wire: Wire,
  components: Map<string, Block>
): WireSignalType {
  const getBlockType = (endpoint: WireEndpoint): string | null => {
    if (!isPortEndpoint(endpoint)) return null;
    const block = components.get(endpoint.componentId);
    return block?.type ?? null;
  };

  const fromType = getBlockType(wire.from);
  const toType = getBlockType(wire.to);

  // Check for ground connections
  if (fromType === 'powersource' || toType === 'powersource') {
    const block = fromType === 'powersource' 
      ? components.get((wire.from as { componentId: string }).componentId)
      : components.get((wire.to as { componentId: string }).componentId);
    
    if (block && 'polarity' in block && block.polarity === 'ground') {
      return 'ground';
    }
  }

  // Check for power circuits (main power)
  if (fromType && POWER_BLOCK_TYPES.has(fromType) && toType && POWER_BLOCK_TYPES.has(toType)) {
    return 'power_main';
  }

  // Check for power to control
  if (fromType && POWER_BLOCK_TYPES.has(fromType) && toType && CONTROL_BLOCK_TYPES.has(toType)) {
    return 'power_control';
  }
  if (toType && POWER_BLOCK_TYPES.has(toType) && fromType && CONTROL_BLOCK_TYPES.has(fromType)) {
    return 'power_control';
  }

  // Check for control circuits
  if (fromType && CONTROL_BLOCK_TYPES.has(fromType) || toType && CONTROL_BLOCK_TYPES.has(toType)) {
    return 'control';
  }

  // Check for signal circuits
  if (fromType && SIGNAL_BLOCK_TYPES.has(fromType) || toType && SIGNAL_BLOCK_TYPES.has(toType)) {
    return 'signal';
  }

  return 'unknown';
}

// ============================================================================
// Designation Formatting
// ============================================================================

/**
 * Get the designation string for a wire endpoint
 */
export function getEndpointDesignation(
  endpoint: WireEndpoint,
  components: Map<string, Block>
): string {
  if (!isPortEndpoint(endpoint)) {
    return 'Junction';
  }

  const block = components.get(endpoint.componentId);
  if (!block) {
    return `Unknown:${endpoint.portId}`;
  }

  // Get the block's designation if it has one
  const designation = 'designation' in block 
    ? (block as { designation: string }).designation 
    : block.label ?? block.type.toUpperCase();

  // Get port label
  const port = block.ports.find(p => p.id === endpoint.portId);
  const portLabel = port?.label ?? endpoint.portId;

  return `${designation}:${portLabel}`;
}

// ============================================================================
// Wire Sorting
// ============================================================================

/**
 * Get the average position of a wire (for sorting)
 */
function getWireAveragePosition(
  wire: Wire,
  components: Map<string, Block>
): Position {
  const positions: Position[] = [];

  if (isPortEndpoint(wire.from)) {
    const block = components.get(wire.from.componentId);
    if (block) {
      positions.push({
        x: block.position.x + block.size.width / 2,
        y: block.position.y + block.size.height / 2,
      });
    }
  }

  if (isPortEndpoint(wire.to)) {
    const block = components.get(wire.to.componentId);
    if (block) {
      positions.push({
        x: block.position.x + block.size.width / 2,
        y: block.position.y + block.size.height / 2,
      });
    }
  }

  if (positions.length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: positions.reduce((sum, p) => sum + p.x, 0) / positions.length,
    y: positions.reduce((sum, p) => sum + p.y, 0) / positions.length,
  };
}

/**
 * Sort wires by position (top-to-bottom, left-to-right)
 */
function sortWiresByPosition(
  wires: Wire[],
  components: Map<string, Block>
): Wire[] {
  return [...wires].sort((a, b) => {
    const posA = getWireAveragePosition(a, components);
    const posB = getWireAveragePosition(b, components);

    // Primary sort by Y (top to bottom)
    if (Math.abs(posA.y - posB.y) > 50) {
      return posA.y - posB.y;
    }
    // Secondary sort by X (left to right)
    return posA.x - posB.x;
  });
}

// ============================================================================
// Numbering Schemes
// ============================================================================

/**
 * Generate sequential wire numbers
 */
function generateSequentialNumbers(
  wires: Wire[],
  components: Map<string, Block>,
  options: WireNumberingOptions
): WireNumber[] {
  const startNum = options.startNumber ?? 1;
  const prefix = options.prefix ?? '';
  const sortedWires = options.sortByPosition 
    ? sortWiresByPosition(wires, components)
    : wires;

  return sortedWires.map((wire, index) => {
    const signalType = detectSignalType(wire, components);
    const signalPrefix = options.includeSignalType 
      ? getSignalTypePrefix(signalType) 
      : '';

    return {
      wireId: wire.id,
      number: `${prefix}${signalPrefix}${startNum + index}`,
      source: getEndpointDesignation(wire.from, components),
      destination: getEndpointDesignation(wire.to, components),
      signalType,
    };
  });
}

/**
 * Generate component-based wire numbers (e.g., "K1-F1-1")
 */
function generateComponentBasedNumbers(
  wires: Wire[],
  components: Map<string, Block>,
  options: WireNumberingOptions
): WireNumber[] {
  const prefix = options.prefix ?? '';
  const counters = new Map<string, number>();

  return wires.map((wire) => {
    const source = getEndpointDesignation(wire.from, components);
    const destination = getEndpointDesignation(wire.to, components);
    const signalType = detectSignalType(wire, components);

    // Create a key based on source-destination
    const sourceComp = source.split(':')[0];
    const destComp = destination.split(':')[0];
    const key = `${sourceComp}-${destComp}`;

    // Increment counter for this combination
    const count = (counters.get(key) ?? 0) + 1;
    counters.set(key, count);

    return {
      wireId: wire.id,
      number: `${prefix}${key}-${count}`,
      source,
      destination,
      signalType,
    };
  });
}

/**
 * Get prefix for signal type
 */
function getSignalTypePrefix(signalType: WireSignalType): string {
  switch (signalType) {
    case 'power_main': return 'L';
    case 'power_control': return 'P';
    case 'control': return 'C';
    case 'signal': return 'S';
    case 'ground': return 'PE';
    default: return '';
  }
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Generate wire numbers for all wires on the canvas
 */
export function generateWireNumbers(
  wires: Wire[],
  components: Map<string, Block>,
  options: WireNumberingOptions = { scheme: 'sequential' }
): WireNumberingResult {
  let wireNumbers: WireNumber[];

  switch (options.scheme) {
    case 'sequential':
      wireNumbers = generateSequentialNumbers(wires, components, options);
      break;
    case 'component_based':
      wireNumbers = generateComponentBasedNumbers(wires, components, options);
      break;
    case 'zone_based':
      // Zone-based falls back to sequential for now
      wireNumbers = generateSequentialNumbers(wires, components, options);
      break;
    default:
      wireNumbers = generateSequentialNumbers(wires, components, options);
  }

  // Calculate statistics
  const stats = {
    totalWires: wireNumbers.length,
    powerWires: wireNumbers.filter(w => w.signalType === 'power_main' || w.signalType === 'power_control').length,
    controlWires: wireNumbers.filter(w => w.signalType === 'control').length,
    signalWires: wireNumbers.filter(w => w.signalType === 'signal').length,
    groundWires: wireNumbers.filter(w => w.signalType === 'ground').length,
  };

  return { wireNumbers, stats };
}

/**
 * Get wire number for a specific wire
 */
export function getWireNumber(
  wireId: string,
  wireNumbers: WireNumber[]
): WireNumber | undefined {
  return wireNumbers.find(wn => wn.wireId === wireId);
}

/**
 * Update wire label property with generated number
 */
export function applyWireNumbers(
  wires: Wire[],
  wireNumbers: WireNumber[]
): Wire[] {
  const numberMap = new Map(wireNumbers.map(wn => [wn.wireId, wn.number]));

  return wires.map(wire => ({
    ...wire,
    label: numberMap.get(wire.id) ?? wire.label,
  }));
}

/**
 * Generate a wire numbering report
 */
export function generateWireNumberingReport(result: WireNumberingResult): string {
  const lines: string[] = [
    '=== WIRE NUMBERING REPORT ===',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Total Wires: ${result.stats.totalWires}`,
    `Power Wires: ${result.stats.powerWires}`,
    `Control Wires: ${result.stats.controlWires}`,
    `Signal Wires: ${result.stats.signalWires}`,
    `Ground Wires: ${result.stats.groundWires}`,
    '',
    '--- WIRE LIST ---',
    'Number | Source | Destination | Type',
    '-'.repeat(60),
  ];

  for (const wn of result.wireNumbers) {
    lines.push(
      `${wn.number.padEnd(8)} | ${wn.source.padEnd(15)} | ${wn.destination.padEnd(15)} | ${wn.signalType}`
    );
  }

  return lines.join('\n');
}
