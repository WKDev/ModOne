/**
 * Block Definitions Registry
 *
 * Block geometry (size, default ports, default props) is derived from the
 * builtin symbol registry via symbolBlockDefAdapter — the symbol is the single
 * source of truth. This map holds ONLY the intentional overrides: block types
 * that have no symbol (custom_symbol) or whose placement geometry deliberately
 * differs from their symbol — relay_coil/power_source/power_source_dc_2p are
 * simplified placement variants of their parent symbol, and `text` keeps a
 * different default fontSize. For every other block type the getters below
 * derive from the symbol, so symbol edits propagate automatically (no
 * hand-syncing).
 *
 * The override set was established by a strict size+ports(incl. type/offset/abs)
 * +props comparison against the symbol-derived definition (see
 * xml-loader-integration.test.ts). When changing this map, re-run that test.
 */

import type { BlockType, Port, Size, PowerPolarity } from './types';
import { normalizeSymbolPortToMm, normalizeSymbolSizeToMm } from './canvasUnits';
import {
  getBlockDefinitionFromSymbol,
  getSymbolSize,
  getSymbolPorts,
  getSymbolDefaultProps,
} from '../../utils/symbolBlockDefAdapter';

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
// Overrides — block types NOT derived from their symbol (see file header).
// ============================================================================

const BLOCK_DEFINITIONS: Partial<Record<BlockType, BlockDefinition>> = {
  // No symbol — user-instanced custom symbols resolve geometry elsewhere.
  custom_symbol: {
    size: { width: 30, height: 30 },
    defaultPorts: [],
    defaultProps: { symbolId: '', selectedUnit: 0, instanceProperties: {} },
  },
  // Symbol's text default fontSize differs (14) from the placement default (7).
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
  // ── Canonical aliases whose placement geometry/props diverge from symbol ──
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
  // 2-pin coil-only simplification of the 5-pin relay symbol.
  ['relay_coil' as BlockType]: {
    size: { width: 20, height: 30 },
    defaultPorts: [
      { id: 'in', type: 'input', label: 'A1', position: 'top', absolutePosition: { x: 10, y: 0 } },
      { id: 'out', type: 'output', label: 'A2', position: 'bottom', absolutePosition: { x: 10, y: 30 } },
    ],
    defaultProps: { designation: 'K1', coilVoltage: 24, energized: false },
  },
};

// ============================================================================
// Access Functions — override map wins, else derive from the builtin symbol.
// ============================================================================

/**
 * Get the full block definition for a block type.
 */
export function getBlockDefinition(type: BlockType): BlockDefinition {
  const override = BLOCK_DEFINITIONS[type];
  if (override) {
    return {
      ...override,
      size: normalizeSymbolSizeToMm(override.size),
      defaultPorts: override.defaultPorts.map((port) => normalizeSymbolPortToMm(port)),
    };
  }
  const derived = getBlockDefinitionFromSymbol(type);
  if (derived) return derived;
  throw new Error(`No block definition for type: ${type}`);
}

/**
 * Get the size for a block type.
 */
export function getBlockSize(type: BlockType): Size {
  const override = BLOCK_DEFINITIONS[type];
  if (override) return normalizeSymbolSizeToMm(override.size);
  const size = getSymbolSize(type);
  if (size) return size;
  throw new Error(`No block definition for type: ${type}`);
}

/**
 * Get the default ports for a block type.
 */
export function getDefaultPorts(type: BlockType): Port[] {
  const override = BLOCK_DEFINITIONS[type];
  if (override) return override.defaultPorts.map((port) => normalizeSymbolPortToMm(port));
  return getSymbolPorts(type);
}

/**
 * Get the default type-specific properties for a block type.
 */
export function getDefaultBlockProps(type: BlockType): Record<string, unknown> {
  const override = BLOCK_DEFINITIONS[type];
  if (override) return override.defaultProps;
  return getSymbolDefaultProps(type);
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
