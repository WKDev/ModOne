/**
 * blockRegistry.test.ts
 *
 * Unit tests for BlockRegistry, BuiltinBlockLoader and ProjectBlockLoader.
 * The Tauri symbolService is mocked so tests run without a native back-end.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SymbolDefinition, SymbolSummary } from '../types/symbol';

// ---------------------------------------------------------------------------
// Mock Tauri symbolService BEFORE importing the registry
// ---------------------------------------------------------------------------
vi.mock('../services/symbolService', () => ({
  listSymbols: vi.fn(),
  loadSymbol: vi.fn(),
  saveSymbol: vi.fn(),
  deleteSymbol: vi.fn(),
  listAllSymbols: vi.fn(),
}));

// Mock customSymbolBridge to avoid Pixi.js dependency in tests
vi.mock(
  '../components/OneCanvas/renderers/symbols/customSymbolBridge',
  () => ({
    registerCustomSymbol: vi.fn(),
    unregisterCustomSymbol: vi.fn(),
    getCustomSymbolContext: vi.fn(() => null),
    getCustomSymbolDefinition: vi.fn(() => null),
    getCustomSymbolSize: vi.fn(() => null),
    getCustomSymbolPorts: vi.fn(() => null),
    isCustomSymbolRegistered: vi.fn(() => false),
    clearCustomSymbolCache: vi.fn(),
  }),
);

import * as symbolService from '../services/symbolService';
import {
  BlockRegistry,
  BuiltinBlockLoader,
  ProjectBlockLoader,
  blockRegistry,
  type BlockSource,
} from '../lib/blockRegistry';
import { BUILTIN_SYMBOLS } from '../assets/builtin-symbols';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSymbol(id: string, overrides: Partial<SymbolDefinition> = {}): SymbolDefinition {
  return {
    id,
    name: `Symbol ${id}`,
    version: '1.0.0',
    category: 'test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    width: 40,
    height: 40,
    graphics: [],
    pins: [],
    properties: [],
    ...overrides,
  };
}

function makeSummary(id: string): SymbolSummary {
  return {
    id,
    name: `Symbol ${id}`,
    version: '1.0.0',
    category: 'test',
    scope: 'project',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// BuiltinBlockLoader
// ---------------------------------------------------------------------------

describe('BuiltinBlockLoader', () => {
  it('returns one entry per builtin symbol', () => {
    const loader = new BuiltinBlockLoader();
    const entries = loader.load();

    expect(entries.length).toBe(BUILTIN_SYMBOLS.size);
  });

  it('marks every entry with source "builtin"', () => {
    const loader = new BuiltinBlockLoader();
    const entries = loader.load();

    expect(entries.every((e) => e.source === 'builtin')).toBe(true);
  });

  it('sets overridesBuiltin to false for all builtins', () => {
    const loader = new BuiltinBlockLoader();
    const entries = loader.load();

    expect(entries.every((e) => e.overridesBuiltin === false)).toBe(true);
  });

  it('includes entry for relay symbol', () => {
    const loader = new BuiltinBlockLoader();
    const entries = loader.load();

    const relay = entries.find((e) => e.id === 'builtin:relay');
    expect(relay).toBeDefined();
    expect(relay?.definition.id).toBe('builtin:relay');
  });

  it('entry id matches definition id', () => {
    const loader = new BuiltinBlockLoader();
    const entries = loader.load();

    for (const entry of entries) {
      expect(entry.id).toBe(entry.definition.id);
    }
  });
});

// ---------------------------------------------------------------------------
// ProjectBlockLoader
// ---------------------------------------------------------------------------

describe('ProjectBlockLoader', () => {
  const mockListSymbols = vi.mocked(symbolService.listSymbols);
  const mockLoadSymbol = vi.mocked(symbolService.loadSymbol);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when both scopes fail', async () => {
    mockListSymbols.mockRejectedValue(new Error('No backend'));

    const loader = new ProjectBlockLoader();
    const entries = await loader.load('/fake/project');

    expect(entries).toEqual([]);
  });

  it('loads project symbols with source "project"', async () => {
    const projectDef = makeSymbol('project:my-relay');

    mockListSymbols.mockImplementation(async (_dir, scope) => {
      if (scope === 'project') return [makeSummary('project:my-relay')];
      return [];
    });
    mockLoadSymbol.mockResolvedValue(projectDef);

    const loader = new ProjectBlockLoader();
    const entries = await loader.load('/fake/project');

    expect(entries).toHaveLength(1);
    expect(entries[0].source).toBe<BlockSource>('project');
    expect(entries[0].definition.id).toBe('project:my-relay');
  });

  it('loads global symbols with source "global"', async () => {
    const globalDef = makeSymbol('global:common-fuse');

    mockListSymbols.mockImplementation(async (_dir, scope) => {
      if (scope === 'global') return [makeSummary('global:common-fuse')];
      return [];
    });
    mockLoadSymbol.mockResolvedValue(globalDef);

    const loader = new ProjectBlockLoader();
    const entries = await loader.load('/fake/project');

    expect(entries).toHaveLength(1);
    expect(entries[0].source).toBe<BlockSource>('global');
  });

  it('sets overridesBuiltin=true when custom ID matches a builtin ID', async () => {
    // 'builtin:relay' exists in BUILTIN_SYMBOLS
    const overridingDef = makeSymbol('builtin:relay');

    mockListSymbols.mockImplementation(async (_dir, scope) => {
      if (scope === 'project') return [makeSummary('builtin:relay')];
      return [];
    });
    mockLoadSymbol.mockResolvedValue(overridingDef);

    const loader = new ProjectBlockLoader();
    const entries = await loader.load('/fake/project');

    expect(entries[0].overridesBuiltin).toBe(true);
  });

  it('returns both global and project entries when both scopes have symbols', async () => {
    mockListSymbols.mockImplementation(async (_dir, scope) => {
      if (scope === 'global') return [makeSummary('global:a')];
      if (scope === 'project') return [makeSummary('project:b')];
      return [];
    });
    mockLoadSymbol.mockImplementation(async (_dir, id, _scope) =>
      makeSymbol(id),
    );

    const loader = new ProjectBlockLoader();
    const entries = await loader.load('/fake/project');

    const sources = entries.map((e) => e.source).sort();
    expect(sources).toEqual(['global', 'project']);
  });

  it('skips symbols whose loadSymbol call fails without crashing', async () => {
    mockListSymbols.mockImplementation(async (_dir, scope) => {
      if (scope === 'project') return [makeSummary('project:ok'), makeSummary('project:bad')];
      return [];
    });
    mockLoadSymbol.mockImplementation(async (_dir, id, _scope) => {
      if (id === 'project:bad') throw new Error('load failed');
      return makeSymbol(id);
    });

    const loader = new ProjectBlockLoader();
    const entries = await loader.load('/fake/project');

    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('project:ok');
  });
});

// ---------------------------------------------------------------------------
// BlockRegistry
// ---------------------------------------------------------------------------

describe('BlockRegistry', () => {
  let registry: BlockRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new BlockRegistry();
  });

  // -------------------------------------------------------------------------
  // initialize()
  // -------------------------------------------------------------------------

  describe('initialize()', () => {
    it('loads all builtin symbols', () => {
      registry.initialize();
      expect(registry.size).toBe(BUILTIN_SYMBOLS.size);
    });

    it('all builtin entries have source "builtin"', () => {
      registry.initialize();
      const builtins = registry.getBySource('builtin');
      expect(builtins.length).toBe(BUILTIN_SYMBOLS.size);
    });

    it('is idempotent — calling twice keeps the same size', () => {
      registry.initialize();
      const sizeAfterFirst = registry.size;
      registry.initialize();
      expect(registry.size).toBe(sizeAfterFirst);
    });

    it('does not overwrite a higher-priority custom entry on re-initialize', () => {
      registry.initialize();

      // Override a builtin with a project entry
      const customRelay = makeSymbol('builtin:relay', { name: 'My Custom Relay' });
      registry.register(customRelay, 'project');

      registry.initialize(); // should NOT restore the builtin over the project entry

      const entry = registry.get('builtin:relay');
      expect(entry?.source).toBe('project');
      expect(entry?.definition.name).toBe('My Custom Relay');
    });
  });

  // -------------------------------------------------------------------------
  // loadProjectSymbols()
  // -------------------------------------------------------------------------

  describe('loadProjectSymbols()', () => {
    const mockListSymbols = vi.mocked(symbolService.listSymbols);
    const mockLoadSymbol = vi.mocked(symbolService.loadSymbol);

    it('merges project symbols into the registry', async () => {
      registry.initialize();

      const customDef = makeSymbol('project:custom');
      mockListSymbols.mockImplementation(async (_dir, scope) => {
        if (scope === 'project') return [makeSummary('project:custom')];
        return [];
      });
      mockLoadSymbol.mockResolvedValue(customDef);

      await registry.loadProjectSymbols('/my/project');

      const entry = registry.get('project:custom');
      expect(entry).toBeDefined();
      expect(entry?.source).toBe('project');
    });

    it('project symbol overrides builtin with same ID', async () => {
      registry.initialize();

      const overrideDef = makeSymbol('builtin:relay', { name: 'Override Relay' });
      mockListSymbols.mockImplementation(async (_dir, scope) => {
        if (scope === 'project') return [makeSummary('builtin:relay')];
        return [];
      });
      mockLoadSymbol.mockResolvedValue(overrideDef);

      await registry.loadProjectSymbols('/my/project');

      const entry = registry.get('builtin:relay');
      expect(entry?.source).toBe('project');
      expect(entry?.definition.name).toBe('Override Relay');
      expect(entry?.overridesBuiltin).toBe(true);
    });

    it('global symbol overrides builtin with same ID', async () => {
      registry.initialize();

      const globalDef = makeSymbol('builtin:fuse', { name: 'Global Fuse' });
      mockListSymbols.mockImplementation(async (_dir, scope) => {
        if (scope === 'global') return [makeSummary('builtin:fuse')];
        return [];
      });
      mockLoadSymbol.mockResolvedValue(globalDef);

      await registry.loadProjectSymbols('/my/project');

      const entry = registry.get('builtin:fuse');
      expect(entry?.source).toBe('global');
      expect(entry?.overridesBuiltin).toBe(true);
    });

    it('project overrides global when both share the same symbol ID', async () => {
      registry.initialize();

      mockListSymbols.mockImplementation(async (_dir, scope) => {
        if (scope === 'global') return [makeSummary('builtin:motor')];
        if (scope === 'project') return [makeSummary('builtin:motor')];
        return [];
      });
      mockLoadSymbol.mockImplementation(async (_dir, _id, scope) => {
        if (scope === 'project') return makeSymbol('builtin:motor', { name: 'Project Motor' });
        return makeSymbol('builtin:motor', { name: 'Global Motor' });
      });

      await registry.loadProjectSymbols('/my/project');

      const entry = registry.get('builtin:motor');
      expect(entry?.source).toBe('project');
      expect(entry?.definition.name).toBe('Project Motor');
    });

    it('does not crash if backend is unavailable', async () => {
      registry.initialize();
      const initialSize = registry.size;

      mockListSymbols.mockRejectedValue(new Error('Tauri not available'));

      await expect(
        registry.loadProjectSymbols('/my/project'),
      ).resolves.not.toThrow();

      // Builtins still present
      expect(registry.size).toBe(initialSize);
    });
  });

  // -------------------------------------------------------------------------
  // register() and unregister()
  // -------------------------------------------------------------------------

  describe('register()', () => {
    it('adds a new entry to the registry', () => {
      registry.initialize();
      const def = makeSymbol('project:new-symbol');
      const entry = registry.register(def, 'project');

      expect(entry.source).toBe('project');
      expect(registry.get('project:new-symbol')).toBeDefined();
    });

    it('replaces an existing entry of equal priority', () => {
      registry.initialize();

      const v1 = makeSymbol('project:x', { name: 'v1' });
      const v2 = makeSymbol('project:x', { name: 'v2' });

      registry.register(v1, 'project');
      registry.register(v2, 'project');

      expect(registry.get('project:x')?.definition.name).toBe('v2');
    });

    it('does not replace a higher-priority entry with a lower one', () => {
      registry.initialize();

      const projectDef = makeSymbol('shared:x', { name: 'project-entry' });
      const globalDef = makeSymbol('shared:x', { name: 'global-entry' });

      registry.register(projectDef, 'project');
      registry.register(globalDef, 'global'); // lower priority → should NOT win

      expect(registry.get('shared:x')?.source).toBe('project');
      expect(registry.get('shared:x')?.definition.name).toBe('project-entry');
    });

    it('sets overridesBuiltin=true when overriding a builtin', () => {
      registry.initialize();

      const override = makeSymbol('builtin:relay');
      const entry = registry.register(override, 'project');

      expect(entry.overridesBuiltin).toBe(true);
    });
  });

  describe('unregister()', () => {
    it('removes an entry from the registry', () => {
      registry.initialize();
      registry.register(makeSymbol('project:temp'), 'project');

      registry.unregister('project:temp');

      expect(registry.get('project:temp')).toBeUndefined();
    });

    it('restores the builtin when a custom override is removed', () => {
      registry.initialize();

      // Override the builtin relay
      registry.register(makeSymbol('builtin:relay', { name: 'Custom Relay' }), 'project');
      expect(registry.get('builtin:relay')?.source).toBe('project');

      registry.unregister('builtin:relay');

      // Builtin should be restored
      const restored = registry.get('builtin:relay');
      expect(restored?.source).toBe('builtin');
      expect(restored?.overridesBuiltin).toBe(false);
    });

    it('is a no-op when the ID is not in the registry', () => {
      registry.initialize();
      const sizeBefore = registry.size;

      registry.unregister('nonexistent:id'); // should not throw

      expect(registry.size).toBe(sizeBefore);
    });
  });

  // -------------------------------------------------------------------------
  // Lookup methods
  // -------------------------------------------------------------------------

  describe('get()', () => {
    it('returns undefined for an unknown ID', () => {
      registry.initialize();
      expect(registry.get('unknown:nope')).toBeUndefined();
    });

    it('returns the entry for a known builtin ID', () => {
      registry.initialize();
      const entry = registry.get('builtin:relay');
      expect(entry).toBeDefined();
      expect(entry?.source).toBe('builtin');
    });
  });

  describe('getByBlockType()', () => {
    it('resolves "relay" to builtin:relay entry', () => {
      registry.initialize();
      const entry = registry.getByBlockType('relay');
      expect(entry?.id).toBe('builtin:relay');
      expect(entry?.source).toBe('builtin');
    });

    it('resolves "relay_coil" (alias) to builtin:relay entry', () => {
      registry.initialize();
      const entry = registry.getByBlockType('relay_coil');
      expect(entry?.id).toBe('builtin:relay');
    });

    it('returns the overriding entry when a custom version exists', () => {
      registry.initialize();

      registry.register(makeSymbol('builtin:relay', { name: 'Project Relay' }), 'project');

      const entry = registry.getByBlockType('relay');
      expect(entry?.source).toBe('project');
    });

    it('returns undefined for an unknown block type', () => {
      registry.initialize();
      expect(registry.getByBlockType('nonexistent_block')).toBeUndefined();
    });
  });

  describe('getAll()', () => {
    it('returns an array of all registered entries', () => {
      registry.initialize();
      const all = registry.getAll();
      expect(all.length).toBe(BUILTIN_SYMBOLS.size);
      expect(all[0]).toHaveProperty('id');
      expect(all[0]).toHaveProperty('source');
      expect(all[0]).toHaveProperty('definition');
      expect(all[0]).toHaveProperty('overridesBuiltin');
    });
  });

  describe('getBySource()', () => {
    it('returns only builtins when no custom symbols loaded', () => {
      registry.initialize();
      const builtins = registry.getBySource('builtin');
      expect(builtins.length).toBe(BUILTIN_SYMBOLS.size);

      const projectEntries = registry.getBySource('project');
      expect(projectEntries).toHaveLength(0);
    });

    it('returns only project entries after a project symbol is registered', () => {
      registry.initialize();
      registry.register(makeSymbol('project:a'), 'project');
      registry.register(makeSymbol('global:b'), 'global');

      expect(registry.getBySource('project')).toHaveLength(1);
      expect(registry.getBySource('global')).toHaveLength(1);
    });
  });

  describe('getOverrides()', () => {
    it('returns empty array when there are no overrides', () => {
      registry.initialize();
      expect(registry.getOverrides()).toHaveLength(0);
    });

    it('returns the overriding entry after a builtin is overridden', () => {
      registry.initialize();
      registry.register(makeSymbol('builtin:relay'), 'project');

      const overrides = registry.getOverrides();
      expect(overrides).toHaveLength(1);
      expect(overrides[0].id).toBe('builtin:relay');
    });
  });

  describe('has()', () => {
    it('returns true for a registered symbol', () => {
      registry.initialize();
      expect(registry.has('builtin:relay')).toBe(true);
    });

    it('returns false for an unregistered symbol', () => {
      registry.initialize();
      expect(registry.has('unknown:xyz')).toBe(false);
    });
  });

  describe('size', () => {
    it('equals the number of registered entries', () => {
      registry.initialize();
      expect(registry.size).toBe(BUILTIN_SYMBOLS.size);

      registry.register(makeSymbol('project:extra'), 'project');
      expect(registry.size).toBe(BUILTIN_SYMBOLS.size + 1);
    });
  });

  describe('clear()', () => {
    it('removes all entries', () => {
      registry.initialize();
      registry.clear();
      expect(registry.size).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Singleton blockRegistry
// ---------------------------------------------------------------------------

describe('blockRegistry singleton', () => {
  it('is already initialized with builtins at import time', () => {
    expect(blockRegistry.size).toBeGreaterThanOrEqual(BUILTIN_SYMBOLS.size);
  });

  it('has all builtin symbols accessible by block type', () => {
    const relay = blockRegistry.getByBlockType('relay');
    expect(relay).toBeDefined();
    expect(relay?.source).toBe('builtin');
  });

  it('all entries have required fields', () => {
    for (const entry of blockRegistry.getAll()) {
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('source');
      expect(entry).toHaveProperty('definition');
      expect(entry).toHaveProperty('overridesBuiltin');
      expect(typeof entry.id).toBe('string');
      expect(['builtin', 'project', 'global']).toContain(entry.source);
    }
  });
});
