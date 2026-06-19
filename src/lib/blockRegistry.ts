/**
 * blockRegistry.ts — Unified Block Definition Registry
 *
 * Merges builtin symbols (source: 'builtin') with project/global custom symbols
 * (source: 'project' | 'global'). Custom blocks take priority over builtins on
 * ID conflict. Priority order: project > global > builtin.
 *
 * Architecture:
 * - BuiltinBlockLoader  – Reads from BUILTIN_SYMBOLS map (bundled TypeScript)
 * - ProjectBlockLoader  – Reads from Tauri backend (project/global scope)
 * - BlockRegistry       – Merges both, applies conflict resolution, exposes lookup API
 *
 * Reference: AutomationML / CAEX (IEC 62714) — source metadata mirrors the
 * CAEX SystemUnitClass library layering (project library overrides role/system
 * unit libraries).
 */

import type { SymbolDefinition, LibraryScope } from '../types/symbol';
import {
  BUILTIN_SYMBOLS,
  getBuiltinSymbolForBlockType,
} from '../assets/builtin-symbols';
import { registerCustomSymbol } from '../components/OneCanvas/renderers/symbols/customSymbolBridge';
import * as symbolService from '../services/symbolService';

// ============================================================================
// Types
// ============================================================================

/** Origin of a block definition in the registry */
export type BlockSource = 'builtin' | 'project' | 'global';

/** Priority weight for conflict resolution (higher wins) */
const SOURCE_PRIORITY: Record<BlockSource, number> = {
  builtin: 0,
  global: 1,
  project: 2,
};

/** A single entry in the block registry with source provenance */
export interface BlockRegistryEntry {
  /** Symbol unique ID (e.g. 'builtin:relay', 'project:my-relay') */
  id: string;
  /** Full symbol definition */
  definition: SymbolDefinition;
  /** Where this block definition came from */
  source: BlockSource;
  /**
   * True when this entry shadows a builtin symbol with the same ID.
   * Useful for UI display (e.g. showing an "override" badge).
   */
  overridesBuiltin: boolean;
}

// ============================================================================
// BuiltinBlockLoader
// ============================================================================

/**
 * Loads all bundled builtin symbols and returns them as registry entries.
 * Source is always 'builtin'. Synchronous — no I/O required.
 */
export class BuiltinBlockLoader {
  /**
   * Load all builtin symbols.
   * @returns An array of BlockRegistryEntry with source 'builtin'.
   */
  load(): BlockRegistryEntry[] {
    const entries: BlockRegistryEntry[] = [];
    for (const [id, definition] of BUILTIN_SYMBOLS.entries()) {
      entries.push({
        id,
        definition,
        source: 'builtin',
        overridesBuiltin: false,
      });
    }
    return entries;
  }
}

// ============================================================================
// ProjectBlockLoader
// ============================================================================

/**
 * Loads project-scoped and globally-scoped custom symbols from the Tauri
 * backend. Each symbol is tagged with the scope it came from.
 *
 * Load order: global symbols are loaded first, then project symbols.
 * On conflict, project entries will supersede global ones in the registry.
 */
export class ProjectBlockLoader {
  /**
   * Load all custom symbols for the given project directory.
   *
   * Returns an empty array (rather than throwing) if the backend is
   * unavailable (e.g. unit-test environment without Tauri).
   *
   * @param projectDir - Absolute path to the open project directory.
   */
  async load(projectDir: string): Promise<BlockRegistryEntry[]> {
    // Fetch summary lists from both scopes concurrently
    const [globalResult, projectResult] = await Promise.allSettled([
      symbolService.listSymbols(projectDir, 'global'),
      symbolService.listSymbols(projectDir, 'project'),
    ]);

    const entries: BlockRegistryEntry[] = [];

    /**
     * Fetch full SymbolDefinition objects for a list of IDs and wrap them
     * as BlockRegistryEntry values.
     */
    const loadScope = async (
      ids: string[],
      scope: LibraryScope,
    ): Promise<BlockRegistryEntry[]> => {
      if (ids.length === 0) return [];

      const results = await Promise.allSettled(
        ids.map((id) => symbolService.loadSymbol(projectDir, id, scope)),
      );

      return results
        .filter(
          (r): r is PromiseFulfilledResult<SymbolDefinition> =>
            r.status === 'fulfilled',
        )
        .map((r) => ({
          id: r.value.id,
          definition: r.value,
          source: scope as BlockSource,
          overridesBuiltin: BUILTIN_SYMBOLS.has(r.value.id),
        }));
    };

    // Load global scope first (lower priority)
    if (globalResult.status === 'fulfilled') {
      const globalEntries = await loadScope(
        globalResult.value.map((s) => s.id),
        'global',
      );
      entries.push(...globalEntries);
    }

    // Load project scope second (higher priority — will win on conflict)
    if (projectResult.status === 'fulfilled') {
      const projectEntries = await loadScope(
        projectResult.value.map((s) => s.id),
        'project',
      );
      entries.push(...projectEntries);
    }

    return entries;
  }
}

// ============================================================================
// BlockRegistry
// ============================================================================

/**
 * Integrated block registry that merges builtin + project/global symbols.
 *
 * **Conflict resolution**: project > global > builtin
 * When two entries share the same symbol ID, the one with higher priority
 * wins. The winning entry's `overridesBuiltin` flag is set when it shadows
 * a builtin.
 *
 * **Rendering integration**: Every accepted entry is also pushed into the
 * `customSymbolBridge` cache so Pixi.js renderers can look up graphics
 * contexts transparently.
 *
 * **Usage**:
 * ```ts
 * // App startup:
 * blockRegistry.initialize();
 *
 * // After project opens:
 * await blockRegistry.loadProjectSymbols(projectDir);
 *
 * // Look up a symbol:
 * const entry = blockRegistry.getByBlockType('relay');  // source: 'builtin'
 * const custom = blockRegistry.get('project:my-relay'); // source: 'project'
 * ```
 */
export class BlockRegistry {
  private readonly _entries = new Map<string, BlockRegistryEntry>();
  private readonly _builtinLoader: BuiltinBlockLoader;
  private readonly _projectLoader: ProjectBlockLoader;

  constructor(
    builtinLoader = new BuiltinBlockLoader(),
    projectLoader = new ProjectBlockLoader(),
  ) {
    this._builtinLoader = builtinLoader;
    this._projectLoader = projectLoader;
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  /**
   * Populate the registry with all bundled builtin symbols.
   * Idempotent — safe to call multiple times; builtins are only added if no
   * entry with the same ID already exists (custom overrides are preserved).
   */
  initialize(): void {
    const builtinEntries = this._builtinLoader.load();
    for (const entry of builtinEntries) {
      // Only add builtin if no higher-priority entry is already registered
      const existing = this._entries.get(entry.id);
      if (!existing || SOURCE_PRIORITY[existing.source] < SOURCE_PRIORITY[entry.source]) {
        this._setEntry(entry);
      }
    }
  }

  /**
   * Load project/global custom symbols from the Tauri backend and merge them
   * into the registry. Entries with higher priority source override lower ones.
   *
   * @param projectDir - Absolute path to the open project directory.
   */
  async loadProjectSymbols(projectDir: string): Promise<void> {
    const customEntries = await this._projectLoader.load(projectDir);

    // Sort ascending by priority so lower-priority items are written first
    // and will be overwritten by higher-priority items in the same batch.
    customEntries.sort(
      (a, b) => SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source],
    );

    for (const entry of customEntries) {
      const existing = this._entries.get(entry.id);
      if (!existing || SOURCE_PRIORITY[entry.source] >= SOURCE_PRIORITY[existing.source]) {
        this._setEntry(entry);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Mutation
  // --------------------------------------------------------------------------

  /**
   * Register a single symbol definition directly (e.g. after Symbol Editor
   * saves a new or updated symbol). If an entry with the same ID already
   * exists, it is replaced only if the new `source` has equal or higher
   * priority.
   *
   * @param definition - The symbol definition to register.
   * @param source     - Origin of the definition.
   * @returns The created/updated BlockRegistryEntry.
   */
  register(definition: SymbolDefinition, source: BlockSource): BlockRegistryEntry {
    const existing = this._entries.get(definition.id);
    const entry: BlockRegistryEntry = {
      id: definition.id,
      definition,
      source,
      overridesBuiltin: BUILTIN_SYMBOLS.has(definition.id),
    };

    if (!existing || SOURCE_PRIORITY[source] >= SOURCE_PRIORITY[existing.source]) {
      this._setEntry(entry);
    }

    return this._entries.get(definition.id)!;
  }

  /**
   * Remove a custom symbol from the registry. If the removed entry was
   * overriding a builtin symbol, the builtin is automatically restored.
   *
   * @param id - Symbol ID to remove.
   */
  unregister(id: string): void {
    const entry = this._entries.get(id);
    if (!entry) return;

    this._entries.delete(id);

    // Restore builtin fallback if the removed entry was shadowing it
    if (entry.overridesBuiltin) {
      const builtin = BUILTIN_SYMBOLS.get(id);
      if (builtin) {
        this._setEntry({
          id,
          definition: builtin,
          source: 'builtin',
          overridesBuiltin: false,
        });
      }
    }
  }

  /**
   * Clear all entries. Primarily intended for testing and project-close
   * teardown.
   */
  clear(): void {
    this._entries.clear();
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /**
   * Look up an entry by its symbol ID.
   * @param id - Symbol ID (e.g. 'builtin:relay', 'project:my-relay').
   */
  get(id: string): BlockRegistryEntry | undefined {
    return this._entries.get(id);
  }

  /**
   * Look up an entry by its canvas block-type string
   * (e.g. 'relay', 'relay_coil', 'switch_no').
   *
   * Resolution order:
   * 1. Builtin BLOCK_TYPE_TO_SYMBOL_ID mapping → check if ID has been overridden
   * 2. Direct symbol ID match
   * 3. Prefixed `project:<blockType>` match
   */
  getByBlockType(blockType: string): BlockRegistryEntry | undefined {
    // Resolve via the canonical block-type → symbol-ID mapping
    const canonicalDef = getBuiltinSymbolForBlockType(blockType);
    if (canonicalDef) {
      // The registry may hold an overriding custom entry under the same ID
      return this._entries.get(canonicalDef.id);
    }

    // Direct symbol ID fallback (custom block types have no builtin mapping)
    return (
      this._entries.get(blockType) ??
      this._entries.get(`project:${blockType}`) ??
      undefined
    );
  }

  /**
   * Return every entry in the registry as an array.
   */
  getAll(): BlockRegistryEntry[] {
    return Array.from(this._entries.values());
  }

  /**
   * Return all entries from the specified source.
   * @param source - Source to filter by.
   */
  getBySource(source: BlockSource): BlockRegistryEntry[] {
    return this.getAll().filter((e) => e.source === source);
  }

  /**
   * Return all entries that override a builtin symbol.
   */
  getOverrides(): BlockRegistryEntry[] {
    return this.getAll().filter((e) => e.overridesBuiltin);
  }

  /**
   * Check whether a symbol ID is registered.
   * @param id - Symbol ID to check.
   */
  has(id: string): boolean {
    return this._entries.has(id);
  }

  /** Total number of registered symbols. */
  get size(): number {
    return this._entries.size;
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  private _setEntry(entry: BlockRegistryEntry): void {
    this._entries.set(entry.id, entry);
    // Keep customSymbolBridge cache in sync so renderers always have the
    // latest definition available.
    registerCustomSymbol(entry.definition);
  }
}

// ============================================================================
// Singleton
// ============================================================================

/**
 * Global BlockRegistry singleton.
 *
 * Builtins are loaded automatically when this module is first imported.
 * Call `loadProjectSymbols(dir)` after a project opens to layer custom symbols
 * on top.
 *
 * @example
 * ```ts
 * import { blockRegistry } from '@/lib/blockRegistry';
 *
 * // Startup (already called at import time):
 * blockRegistry.initialize();
 *
 * // Project opened:
 * await blockRegistry.loadProjectSymbols('/path/to/project');
 *
 * // Canvas block resolved:
 * const entry = blockRegistry.getByBlockType('relay');
 * console.log(entry?.source); // 'builtin' or 'project' / 'global'
 * ```
 */
export const blockRegistry = new BlockRegistry();

// Auto-initialize with builtins at module load (safe to re-initialize later)
blockRegistry.initialize();
