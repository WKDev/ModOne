/**
 * symbolBridge.ts — Unified symbol resolver for ALL block types (builtin + custom).
 *
 * Strategy:
 * 1. At startup, registerBuiltinSymbols() loads all builtin SymbolDefinitions
 *    into the same cache used by customSymbolBridge.
 * 2. Unified lookup functions try the definition cache first (covers both
 *    builtin and custom symbols), then fall back to SymbolLibrary.
 */
import { GraphicsContext } from 'pixi.js';
import {
  BUILTIN_SYMBOLS,
  getBuiltinSymbolForBlockType,
} from '../../../../assets/builtin-symbols';
import {
  registerCustomSymbol,
  getCustomSymbolContext,
  getCustomSymbolSize,
  getCustomSymbolPorts,
} from './customSymbolBridge';

// ---------------------------------------------------------------------------
// Startup registration
// ---------------------------------------------------------------------------

let _builtinsRegistered = false;

/**
 * Register all builtin SymbolDefinitions into the shared definition cache.
 * Call once at app startup (idempotent — safe to call multiple times).
 */
export function registerBuiltinSymbols(): void {
  if (_builtinsRegistered) return;
  for (const def of BUILTIN_SYMBOLS.values()) {
    registerCustomSymbol(def);
  }
  _builtinsRegistered = true;
}

// Auto-register on module load (side-effect import is safe here)
registerBuiltinSymbols();

// ---------------------------------------------------------------------------
// Unified lookup by block type string (e.g. 'relay_coil', 'power_source')
// ---------------------------------------------------------------------------

/**
 * Get GraphicsContext for a block type string.
 * Looks up the builtin symbol for the type, then returns its cached context.
 * Returns null if no builtin symbol is registered for this type.
 */
export function getSymbolContextForBlockType(blockType: string): GraphicsContext | null {
  const def = getBuiltinSymbolForBlockType(blockType);
  if (!def) return null;
  return getCustomSymbolContext(def.id);
}

/**
 * Get size for a block type string.
 * Returns null if no builtin symbol is registered for this type.
 */
export function getSymbolSizeForBlockType(
  blockType: string,
): { width: number; height: number } | null {
  const def = getBuiltinSymbolForBlockType(blockType);
  if (!def) return null;
  return getCustomSymbolSize(def.id);
}

// ---------------------------------------------------------------------------
// Unified lookup by symbol ID (e.g. 'builtin:relay', 'user:my-symbol')
// ---------------------------------------------------------------------------

/**
 * Get GraphicsContext by symbol ID.
 * Works for both builtin IDs ('builtin:*') and custom user symbol IDs.
 */
export function getSymbolContextFromDef(symbolId: string): GraphicsContext | null {
  return getCustomSymbolContext(symbolId);
}

/**
 * Get size by symbol ID.
 */
export function getSymbolSizeFromDef(
  symbolId: string,
): { width: number; height: number } | null {
  return getCustomSymbolSize(symbolId);
}

/**
 * Get ports by symbol ID.
 */
export function getSymbolPortsFromDef(symbolId: string) {
  return getCustomSymbolPorts(symbolId);
}
