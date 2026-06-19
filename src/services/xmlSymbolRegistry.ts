/**
 * XML Symbol Registry
 *
 * A dynamic runtime registry for SymbolDefinition objects that supports:
 *  - Built-in TypeScript-defined symbols (loaded synchronously at module init)
 *  - Built-in XML-defined symbols (loaded from bundled ?raw imports)
 *  - Project-scoped custom symbols (loaded from project directory at runtime)
 *
 * Storage hierarchy:
 *   1. Built-in TS symbols   — always available, lowest precedence for overrides
 *   2. Built-in XML symbols  — loaded at app init, override TS symbols with same ID
 *   3. Project XML symbols   — loaded per-project, override built-ins
 *
 * Usage in app initialization:
 *   import { xmlSymbolRegistry } from '@/services/xmlSymbolRegistry';
 *   import { BUILTIN_SYMBOLS } from '@/assets/builtin-symbols';
 *   import relayXml from '@/assets/builtin-symbols/xml/relay.symbol.xml?raw';
 *   import fuseXml from '@/assets/builtin-symbols/xml/fuse.symbol.xml?raw';
 *
 *   xmlSymbolRegistry.initBuiltins(BUILTIN_SYMBOLS);
 *   xmlSymbolRegistry.loadBuiltinXml([relayXml, fuseXml, ...]);
 */

import type { SymbolDefinition, SymbolSummary } from '@/types/symbol';
import { parseXmlSymbolDefinition, validateSymbolDefinition } from './xmlSymbolLoader';

// ============================================================================
// Registry Class
// ============================================================================

export interface XmlLoadResult {
  /** Symbol ID that was registered */
  id: string;
  /** Whether the load succeeded */
  success: boolean;
  /** Error message if load failed */
  error?: string;
}

export class SymbolRegistry {
  private readonly _builtinTs = new Map<string, SymbolDefinition>();
  private readonly _builtinXml = new Map<string, SymbolDefinition>();
  private readonly _project = new Map<string, SymbolDefinition>();

  /** True if initBuiltins() has been called */
  private _initialized = false;

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  /**
   * Register all built-in TypeScript symbol definitions.
   * Should be called once at app startup before any canvas operations.
   */
  initBuiltins(builtins: ReadonlyMap<string, SymbolDefinition>): void {
    for (const [id, symbol] of builtins) {
      this._builtinTs.set(id, symbol);
    }
    this._initialized = true;
  }

  /**
   * Load and register symbols from built-in XML strings.
   * XML-defined symbols override TypeScript counterparts with the same ID.
   *
   * @param xmlStrings  Array of raw XML strings (use `?raw` Vite imports)
   * @returns           Array of load results (one per input string)
   */
  loadBuiltinXml(xmlStrings: string[]): XmlLoadResult[] {
    return xmlStrings.map((xml) => this._loadXmlInto(xml, this._builtinXml));
  }

  /**
   * Load and register a single symbol from a project-scoped XML string.
   * Project symbols override all built-in definitions.
   */
  loadProjectXml(xmlString: string): XmlLoadResult {
    return this._loadXmlInto(xmlString, this._project);
  }

  /**
   * Directly register a pre-parsed SymbolDefinition as a project-scoped symbol.
   * Used when receiving symbols from Tauri via `symbol_load`.
   */
  registerProjectSymbol(symbol: SymbolDefinition): void {
    this._project.set(symbol.id, symbol);
  }

  /**
   * Remove all project-scoped symbols (call when closing a project).
   */
  clearProjectSymbols(): void {
    this._project.clear();
  }

  // --------------------------------------------------------------------------
  // Lookup
  // --------------------------------------------------------------------------

  /**
   * Get a symbol definition by ID.
   * Project symbols shadow XML-overrides which shadow TypeScript built-ins.
   */
  get(id: string): SymbolDefinition | undefined {
    return this._project.get(id) ?? this._builtinXml.get(id) ?? this._builtinTs.get(id);
  }

  /**
   * Check whether any version of a symbol is registered.
   */
  has(id: string): boolean {
    return this._project.has(id) || this._builtinXml.has(id) || this._builtinTs.has(id);
  }

  /**
   * Resolve a block type string to a symbol definition.
   * Tries both "builtin:<type>" and the raw type name.
   */
  getForBlockType(blockType: string): SymbolDefinition | undefined {
    return this.get(`builtin:${blockType}`) ?? this.get(blockType);
  }

  // --------------------------------------------------------------------------
  // Listing
  // --------------------------------------------------------------------------

  /**
   * List all registered symbols as summaries.
   * Merged view: project shadows builtinXml shadows builtinTs.
   */
  listAll(): SymbolSummary[] {
    const merged = new Map<string, SymbolDefinition>();

    // Layer built-ins first (lowest priority)
    for (const [id, sym] of this._builtinTs) merged.set(id, sym);
    for (const [id, sym] of this._builtinXml) merged.set(id, sym);
    for (const [id, sym] of this._project) merged.set(id, sym);

    return Array.from(merged.values()).map((sym) => ({
      id: sym.id,
      name: sym.name,
      version: sym.version,
      category: sym.category,
      description: sym.description,
      scope: this._project.has(sym.id) ? ('project' as const) : ('global' as const),
      updatedAt: sym.updatedAt,
    }));
  }

  /**
   * Number of total unique symbols registered (merged view).
   */
  get size(): number {
    const ids = new Set([
      ...this._builtinTs.keys(),
      ...this._builtinXml.keys(),
      ...this._project.keys(),
    ]);
    return ids.size;
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private _loadXmlInto(
    xmlString: string,
    target: Map<string, SymbolDefinition>,
  ): XmlLoadResult {
    try {
      const symbol = parseXmlSymbolDefinition(xmlString);
      const errors = validateSymbolDefinition(symbol);
      if (errors.length > 0) {
        return {
          id: symbol.id ?? '(unknown)',
          success: false,
          error: `Validation failed: ${errors.join('; ')}`,
        };
      }
      target.set(symbol.id, symbol);
      return { id: symbol.id, success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { id: '(unknown)', success: false, error: msg };
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

/**
 * Global singleton symbol registry.
 * Call `xmlSymbolRegistry.initBuiltins(BUILTIN_SYMBOLS)` at app startup.
 */
export const xmlSymbolRegistry = new SymbolRegistry();

// ============================================================================
// Initialization Helper
// ============================================================================

/**
 * Initialize the global registry with all built-in TypeScript symbols and
 * any provided built-in XML overrides.
 *
 * Call this once during app startup (e.g., in main.tsx or App.tsx useEffect).
 *
 * @param builtinTs   The BUILTIN_SYMBOLS Map from src/assets/builtin-symbols
 * @param xmlStrings  Optional array of raw XML strings for XML-defined built-ins
 * @returns           XML load results (empty array if no XML strings provided)
 */
export function initializeSymbolRegistry(
  builtinTs: ReadonlyMap<string, SymbolDefinition>,
  xmlStrings: string[] = [],
): XmlLoadResult[] {
  xmlSymbolRegistry.initBuiltins(builtinTs);
  const results = xmlSymbolRegistry.loadBuiltinXml(xmlStrings);

  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    console.warn(
      `[SymbolRegistry] ${failed.length} XML symbol(s) failed to load:`,
      failed.map((r) => `${r.id}: ${r.error}`).join('\n'),
    );
  }

  return results;
}
