/**
 * symbolBlockDefAdapter.ts
 *
 * Compatibility adapter between the SymbolDefinition type system and the
 * legacy BlockDefinition API used by blockDefinitions.ts.
 *
 * This adapter is the core of Sub-AC 4: it verifies that XML/TS-loaded
 * SymbolDefinitions can replace blockDefinitions.ts as the source of truth
 * while keeping all existing code paths working.
 *
 * Key mapping:
 *   SymbolDefinition.width/height  → BlockDefinition.size
 *   SymbolDefinition.pins          → BlockDefinition.defaultPorts
 *   SymbolDefinition.properties    → BlockDefinition.defaultProps
 */

import type { SymbolDefinition, SymbolPin } from '../types/symbol';
import type { BlockDefinition } from '../components/OneCanvas/blockDefinitions';
import type { Port, PortType, PortPosition, Size } from '../components/OneCanvas/types';
import { getBuiltinSymbolForBlockType } from '../assets/builtin-symbols';
import { resolveEffectivePins } from '../components/OneCanvas/renderers/symbols/resolveInstancePorts';
import { normalizeSymbolPortToMm, normalizeSymbolSizeToMm } from '../components/OneCanvas/canvasUnits';

// ---------------------------------------------------------------------------
// Pin → Port type mapping (mirrors customSymbolBridge.ts)
// ---------------------------------------------------------------------------

const PIN_TYPE_TO_PORT_TYPE: Record<string, PortType> = {
  input: 'input',
  output: 'output',
  bidirectional: 'bidirectional',
  power: 'input',
  passive: 'bidirectional',
};

const PIN_ORIENTATION_TO_PORT_POSITION: Record<string, PortPosition> = {
  right: 'right',
  left: 'left',
  up: 'top',
  down: 'bottom',
};

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

/**
 * Compute the port offset (0–1) from a pin's position and the symbol dimensions.
 *
 * The offset is the fractional distance along the edge where the port sits:
 *   - left/right edge → offset = position.y / symbolHeight
 *   - top/bottom edge → offset = position.x / symbolWidth
 *
 * This must be computed so that wire-routing code (wirePathCalculator.ts) can
 * re-derive the canvas position from (portPosition, offset, blockSize) without
 * relying on absolutePosition.
 */
export function computePinOffset(
  pin: SymbolPin,
  symbolWidth: number,
  symbolHeight: number,
): number {
  const portPos = PIN_ORIENTATION_TO_PORT_POSITION[pin.orientation] ?? 'left';
  if (portPos === 'left' || portPos === 'right') {
    return symbolHeight > 0 ? pin.position.y / symbolHeight : 0.5;
  }
  // top or bottom
  return symbolWidth > 0 ? pin.position.x / symbolWidth : 0.5;
}

/**
 * Convert a SymbolPin to a Port, computing the offset from pin position.
 *
 * The `symbolWidth` and `symbolHeight` are the raw pixel dimensions of the
 * symbol (before mm normalisation) — needed to compute the fractional offset.
 *
 * Mirrors the pin → port conversion in customSymbolBridge.ts::buildPorts(),
 * but also sets `port.offset` so wire-routing code can use it without
 * relying on absolutePosition.
 */
export function symbolPinToPort(
  pin: SymbolPin,
  symbolWidth: number,
  symbolHeight: number,
): Port {
  const portPosition = PIN_ORIENTATION_TO_PORT_POSITION[pin.orientation] ?? 'left';
  const offset = computePinOffset(pin, symbolWidth, symbolHeight);

  return {
    id: pin.id,
    type: PIN_TYPE_TO_PORT_TYPE[pin.type] ?? 'bidirectional',
    label: pin.name,
    position: portPosition,
    // Only set offset explicitly if it differs from the default (0.5)
    ...(Math.abs(offset - 0.5) > 1e-9 ? { offset } : {}),
    absolutePosition: { x: pin.position.x, y: pin.position.y },
  };
}

/**
 * Get all unique pins from a SymbolDefinition (union across all units).
 * Multi-unit symbols contain the same pins in both the top-level `pins` array
 * and in individual units; de-duplication is done by pin ID.
 */
export function getAllPins(symbol: SymbolDefinition): SymbolPin[] {
  const allPins = [
    // static pins + PortTemplate-expanded pins (using property defaults)
    ...resolveEffectivePins(symbol),
    ...(symbol.units?.flatMap((unit) => unit.pins) ?? []),
  ];
  const seen = new Set<string>();
  return allPins.filter((pin) => {
    if (seen.has(pin.id)) return false;
    seen.add(pin.id);
    return true;
  });
}

/**
 * Convert SymbolDefinition pins to Port array (raw pixel coordinates).
 * Does NOT apply mm normalization — use symbolDefToBlockDefinition() for
 * normalized values.
 */
export function symbolPinsToRawPorts(symbol: SymbolDefinition): Port[] {
  return getAllPins(symbol)
    .filter((pin) => !pin.hidden)
    .map((pin) => symbolPinToPort(pin, symbol.width, symbol.height));
}

/**
 * Convert SymbolDefinition properties to a defaultProps record.
 * Uses the property `value` field as the default.
 */
export function symbolPropsToDefaultProps(symbol: SymbolDefinition): Record<string, unknown> {
  return Object.fromEntries(
    symbol.properties.map((prop) => [prop.key, prop.value]),
  );
}

/**
 * Derive a BlockDefinition from a SymbolDefinition.
 * The returned BlockDefinition has mm-normalised size and absolutePositions,
 * matching what getBlockDefinition() returns from blockDefinitions.ts.
 */
export function symbolDefToBlockDefinition(symbol: SymbolDefinition): BlockDefinition {
  const rawSize: Size = { width: symbol.width, height: symbol.height };
  const rawPorts = symbolPinsToRawPorts(symbol);

  return {
    size: normalizeSymbolSizeToMm(rawSize),
    defaultPorts: rawPorts.map((port) => normalizeSymbolPortToMm(port)),
    defaultProps: symbolPropsToDefaultProps(symbol),
  };
}

// ---------------------------------------------------------------------------
// Lookup helpers (for block type → derived BlockDefinition)
// ---------------------------------------------------------------------------

/**
 * Derive a BlockDefinition from the builtin symbol registered for the given
 * block type.  Returns null if no symbol is registered for the type.
 *
 * This is the XML/symbol-system analogue of getBlockDefinition() from
 * blockDefinitions.ts.
 */
export function getBlockDefinitionFromSymbol(blockType: string): BlockDefinition | null {
  const symbol = getBuiltinSymbolForBlockType(blockType);
  if (!symbol) return null;
  return symbolDefToBlockDefinition(symbol);
}

/**
 * Get the size for a block type from its builtin symbol.
 * Returns null if no symbol is registered.
 */
export function getSymbolSize(blockType: string): Size | null {
  const symbol = getBuiltinSymbolForBlockType(blockType);
  if (!symbol) return null;
  return normalizeSymbolSizeToMm({ width: symbol.width, height: symbol.height });
}

/**
 * Get the default ports for a block type from its builtin symbol.
 * Returns [] if no symbol is registered.
 */
export function getSymbolPorts(blockType: string): Port[] {
  const symbol = getBuiltinSymbolForBlockType(blockType);
  if (!symbol) return [];
  return symbolPinsToRawPorts(symbol).map((port) => normalizeSymbolPortToMm(port));
}

/**
 * Get the default props for a block type from its builtin symbol.
 * Returns {} if no symbol is registered.
 */
export function getSymbolDefaultProps(blockType: string): Record<string, unknown> {
  const symbol = getBuiltinSymbolForBlockType(blockType);
  if (!symbol) return {};
  return symbolPropsToDefaultProps(symbol);
}

// ---------------------------------------------------------------------------
// Compatibility verification helpers (used in tests)
// ---------------------------------------------------------------------------

export interface CompatibilityCheckResult {
  blockType: string;
  sizeMatch: boolean;
  portCountMatch: boolean;
  portPositionsMatch: boolean;
  mismatches: string[];
}

/**
 * Compare a BlockDefinition (from blockDefinitions.ts) against a derived one
 * (from symbol system) and return a compatibility result.
 *
 * Used in integration tests to verify the two systems produce identical data.
 */
export function checkCompatibility(
  blockType: string,
  legacy: BlockDefinition,
  derived: BlockDefinition,
): CompatibilityCheckResult {
  const mismatches: string[] = [];

  // Size check
  const sizeMatch =
    Math.abs(legacy.size.width - derived.size.width) < 0.01 &&
    Math.abs(legacy.size.height - derived.size.height) < 0.01;
  if (!sizeMatch) {
    mismatches.push(
      `size: legacy=${legacy.size.width}x${legacy.size.height} ` +
      `derived=${derived.size.width}x${derived.size.height}`,
    );
  }

  // Port count check
  const portCountMatch = legacy.defaultPorts.length === derived.defaultPorts.length;
  if (!portCountMatch) {
    mismatches.push(
      `port count: legacy=${legacy.defaultPorts.length} derived=${derived.defaultPorts.length}`,
    );
  }

  // Port positions check
  let portPositionsMatch = true;
  if (portCountMatch) {
    for (const legacyPort of legacy.defaultPorts) {
      const derivedPort = derived.defaultPorts.find((p) => p.id === legacyPort.id);
      if (!derivedPort) {
        portPositionsMatch = false;
        mismatches.push(`port '${legacyPort.id}' missing in derived`);
        continue;
      }
      if (derivedPort.position !== legacyPort.position) {
        portPositionsMatch = false;
        mismatches.push(
          `port '${legacyPort.id}' position: legacy=${legacyPort.position} derived=${derivedPort.position}`,
        );
      }
      if (legacyPort.absolutePosition && derivedPort.absolutePosition) {
        const dx = Math.abs(legacyPort.absolutePosition.x - derivedPort.absolutePosition.x);
        const dy = Math.abs(legacyPort.absolutePosition.y - derivedPort.absolutePosition.y);
        if (dx > 0.01 || dy > 0.01) {
          portPositionsMatch = false;
          mismatches.push(
            `port '${legacyPort.id}' absolutePosition: ` +
            `legacy=(${legacyPort.absolutePosition.x},${legacyPort.absolutePosition.y}) ` +
            `derived=(${derivedPort.absolutePosition.x},${derivedPort.absolutePosition.y})`,
          );
        }
      }
    }
  }

  return {
    blockType,
    sizeMatch,
    portCountMatch,
    portPositionsMatch,
    mismatches,
  };
}
