/**
 * Project Block Store (Zustand)
 *
 * State management for user-defined XML symbol blocks loaded from the
 * project's `.modone/symbols/` directory.
 *
 * Provides:
 * - `xmlBlocks` — currently loaded XML symbol summaries
 * - `loadedDefinitions` — full SymbolDefinition cache (keyed by id)
 * - Actions for listing, loading, importing, and deleting XML blocks
 *
 * This store is separate from `symbolStore` which manages JSON-backed symbols
 * created through the GUI editor.  Both stores produce `SymbolDefinition`
 * objects that can be placed on the canvas.
 *
 * ## Usage
 * ```ts
 * const {
 *   xmlBlocks, isLoading, error,
 *   loadProjectBlocks, importXmlBlock,
 * } = useProjectBlockStore();
 *
 * // On project open
 * await loadProjectBlocks(projectDir);
 *
 * // Get all blocks for the symbol palette
 * const allXmlBlocks = xmlBlocks;
 * ```
 */

import { create } from 'zustand';
import type { SymbolDefinition } from '../types/symbol';
import type { XmlSymbolSummary, XmlSymbolLoadResult } from '../services/projectBlockLoader';
import * as projectBlockLoader from '../services/projectBlockLoader';

// ============================================================================
// Store state interface
// ============================================================================

interface ProjectBlockStoreState {
  // ---- State ----------------------------------------------------------------

  /** Lightweight summaries of all XML blocks in the project. */
  xmlBlocks: XmlSymbolSummary[];

  /**
   * Full `SymbolDefinition` cache keyed by symbol ID.
   *
   * Populated lazily when `loadBlockDefinition` or `loadAllBlockDefinitions`
   * is called.
   */
  loadedDefinitions: Record<string, SymbolDefinition>;

  /** Whether an async operation is in progress. */
  isLoading: boolean;

  /** Last error message, or `null` if no error. */
  error: string | null;

  /**
   * Warnings from the last `loadAllBlockDefinitions` call.
   * Maps symbol ID → warning messages.
   */
  loadWarnings: Record<string, string[]>;

  // ---- Actions --------------------------------------------------------------

  /** Scan the project's `.modone/symbols/` directory and refresh `xmlBlocks`. */
  loadProjectBlocks: (projectDir: string) => Promise<void>;

  /**
   * Load the full `SymbolDefinition` for a specific block by ID.
   * Updates `loadedDefinitions[id]`.
   */
  loadBlockDefinition: (projectDir: string, id: string) => Promise<SymbolDefinition | null>;

  /**
   * Load ALL full definitions and update `loadedDefinitions`.
   * Also populates `loadWarnings`.
   */
  loadAllBlockDefinitions: (projectDir: string) => Promise<void>;

  /**
   * Validate and import an XML string, then refresh the block list.
   *
   * @returns The parsed `SymbolDefinition` on success, or `null` on failure.
   */
  importXmlBlock: (projectDir: string, xmlContent: string) => Promise<SymbolDefinition | null>;

  /** Delete a block by ID and refresh the block list. */
  deleteBlock: (projectDir: string, id: string) => Promise<void>;

  /**
   * Ensure the `.modone/symbols/` directory exists.
   *
   * @returns The absolute path to the directory.
   */
  ensureSymbolsDir: (projectDir: string) => Promise<string | null>;

  /**
   * Return the full `SymbolDefinition` for a block ID.
   * Uses the cache; does NOT trigger a network/file request.
   */
  getDefinition: (id: string) => SymbolDefinition | undefined;

  /** Clear the error state. */
  clearError: () => void;

  /** Reset all state (use when the project is closed). */
  reset: () => void;
}

// ============================================================================
// Initial state
// ============================================================================

const initialState: Pick<
  ProjectBlockStoreState,
  'xmlBlocks' | 'loadedDefinitions' | 'isLoading' | 'error' | 'loadWarnings'
> = {
  xmlBlocks: [],
  loadedDefinitions: {},
  isLoading: false,
  error: null,
  loadWarnings: {},
};

// ============================================================================
// Store implementation
// ============================================================================

export const useProjectBlockStore = create<ProjectBlockStoreState>((set, get) => ({
  ...initialState,

  // --------------------------------------------------------------------------
  // loadProjectBlocks
  // --------------------------------------------------------------------------
  loadProjectBlocks: async (projectDir: string) => {
    set({ isLoading: true, error: null });
    try {
      const xmlBlocks = await projectBlockLoader.listProjectBlocks(projectDir);
      set({ xmlBlocks, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  // --------------------------------------------------------------------------
  // loadBlockDefinition
  // --------------------------------------------------------------------------
  loadBlockDefinition: async (
    projectDir: string,
    id: string
  ): Promise<SymbolDefinition | null> => {
    // Return from cache if available
    const cached = get().loadedDefinitions[id];
    if (cached) return cached;

    set({ isLoading: true, error: null });
    try {
      const definition = await projectBlockLoader.loadProjectBlock(projectDir, id);
      set((state) => ({
        loadedDefinitions: { ...state.loadedDefinitions, [id]: definition },
        isLoading: false,
      }));
      return definition;
    } catch (err) {
      set({ error: String(err), isLoading: false });
      return null;
    }
  },

  // --------------------------------------------------------------------------
  // loadAllBlockDefinitions
  // --------------------------------------------------------------------------
  loadAllBlockDefinitions: async (projectDir: string) => {
    set({ isLoading: true, error: null });
    try {
      const results: XmlSymbolLoadResult[] =
        await projectBlockLoader.loadAllProjectBlocksWithWarnings(projectDir);

      const newDefs: Record<string, SymbolDefinition> = {};
      const newWarnings: Record<string, string[]> = {};

      for (const result of results) {
        newDefs[result.definition.id] = result.definition;
        if (result.warnings.length > 0) {
          newWarnings[result.definition.id] = result.warnings;
        }
      }

      set({
        loadedDefinitions: newDefs,
        loadWarnings: newWarnings,
        isLoading: false,
      });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  // --------------------------------------------------------------------------
  // importXmlBlock
  // --------------------------------------------------------------------------
  importXmlBlock: async (
    projectDir: string,
    xmlContent: string
  ): Promise<SymbolDefinition | null> => {
    set({ isLoading: true, error: null });
    try {
      const definition = await projectBlockLoader.importXmlBlock(projectDir, xmlContent);

      // Refresh the block list and update definition cache
      const xmlBlocks = await projectBlockLoader.listProjectBlocks(projectDir);
      set((state) => ({
        xmlBlocks,
        loadedDefinitions: {
          ...state.loadedDefinitions,
          [definition.id]: definition,
        },
        isLoading: false,
      }));

      return definition;
    } catch (err) {
      set({ error: String(err), isLoading: false });
      return null;
    }
  },

  // --------------------------------------------------------------------------
  // deleteBlock
  // --------------------------------------------------------------------------
  deleteBlock: async (projectDir: string, id: string) => {
    set({ isLoading: true, error: null });
    try {
      await projectBlockLoader.deleteProjectBlock(projectDir, id);

      // Refresh list and remove from definition cache
      const xmlBlocks = await projectBlockLoader.listProjectBlocks(projectDir);
      set((state) => {
        const { [id]: _removed, ...remainingDefs } = state.loadedDefinitions;
        const { [id]: _removedWarn, ...remainingWarnings } = state.loadWarnings;
        return {
          xmlBlocks,
          loadedDefinitions: remainingDefs,
          loadWarnings: remainingWarnings,
          isLoading: false,
        };
      });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  // --------------------------------------------------------------------------
  // ensureSymbolsDir
  // --------------------------------------------------------------------------
  ensureSymbolsDir: async (projectDir: string): Promise<string | null> => {
    try {
      return await projectBlockLoader.ensureProjectBlocksDir(projectDir);
    } catch (err) {
      set({ error: String(err) });
      return null;
    }
  },

  // --------------------------------------------------------------------------
  // getDefinition (synchronous cache lookup)
  // --------------------------------------------------------------------------
  getDefinition: (id: string): SymbolDefinition | undefined => {
    return get().loadedDefinitions[id];
  },

  // --------------------------------------------------------------------------
  // clearError / reset
  // --------------------------------------------------------------------------
  clearError: () => set({ error: null }),

  reset: () => set({ ...initialState }),
}));

// ============================================================================
// Selector helpers (optional convenience)
// ============================================================================

/**
 * Return all loaded XML block summaries.
 * Use this in the symbol palette to show available blocks.
 */
export function selectXmlBlocks(state: ProjectBlockStoreState): XmlSymbolSummary[] {
  return state.xmlBlocks;
}

/**
 * Return all cached `SymbolDefinition` objects as an array.
 * Use this for canvas rendering.
 */
export function selectLoadedDefinitions(
  state: ProjectBlockStoreState
): SymbolDefinition[] {
  return Object.values(state.loadedDefinitions);
}

/**
 * Return the `XmlSymbolSummary` for a given ID, or `undefined` if not found.
 */
export function selectXmlBlockById(
  state: ProjectBlockStoreState,
  id: string
): XmlSymbolSummary | undefined {
  return state.xmlBlocks.find((b) => b.id === id);
}

/**
 * Return whether any XML blocks have warnings.
 */
export function selectHasWarnings(state: ProjectBlockStoreState): boolean {
  return Object.keys(state.loadWarnings).length > 0;
}
