/**
 * Schematic Service - Tauri Command Wrappers
 *
 * Provides type-safe wrappers around Tauri backend commands
 * for schematic file operations (save/load multi-page schematics).
 */

import { invoke } from '@tauri-apps/api/core';
import type { MultiPageSchematic, SchematicPage } from '../components/OneCanvas/utils/multiPageSchematic';
import type { SerializableCircuitState } from '../components/OneCanvas/types';
import { createSelectionState } from '../components/OneCanvas/types';
import { circuitToYaml, yamlToCircuit } from '../components/OneCanvas/utils/serialization';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown by schematic service operations.
 */
export class SchematicServiceError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly path?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SchematicServiceError';
  }
}

// ============================================================================
// Types
// ============================================================================

/** Page data for Tauri save command */
interface PageSaveData {
  filename: string;
  content: string;
}

/** Result from Tauri load command */
interface SchematicLoadResult {
  manifest: string;
  pages: Array<{ filename: string; content: string }>;
}

// ============================================================================
// Serialization Helpers
// ============================================================================

/**
 * Convert a SchematicPage's circuit to YAML string.
 * Uses existing circuitToYaml() for the circuit body.
 */
function serializePageCircuit(circuit: SerializableCircuitState): string {
  const circuitState = {
    components: new Map(Object.entries(circuit.components)),
    junctions: circuit.junctions ? new Map(Object.entries(circuit.junctions)) : new Map(),
    wires: circuit.wires,
    metadata: circuit.metadata,
    selection: createSelectionState([]),
  };

  return circuitToYaml(circuitState);
}

/**
 * Convert a YAML string back to SerializableCircuitState.
 * Uses existing yamlToCircuit() for parsing.
 */
function deserializePageCircuit(yamlStr: string): SerializableCircuitState {
  const circuitState = yamlToCircuit(yamlStr);
  return {
    components: Object.fromEntries(circuitState.components),
    junctions: circuitState.junctions.size > 0 ? Object.fromEntries(circuitState.junctions) : undefined,
    wires: circuitState.wires,
    metadata: circuitState.metadata,
    viewport: circuitState.viewport,
  };
}

// ============================================================================
// Manifest Serialization
// ============================================================================

/** Serialize manifest to JSON string */
function serializeManifest(schematic: MultiPageSchematic): string {
  const manifest = {
    id: schematic.id,
    name: schematic.name,
    description: schematic.description,
    version: schematic.version,
    active_page_id: schematic.activePageId,
    page_count: schematic.pages.length,
    pages: schematic.pages.map((page, index) => ({
      file: `page_${index + 1}.yaml`,
      id: page.id,
      number: page.number,
      name: page.name,
    })),
    metadata: {
      name: schematic.metadata.name,
      description: schematic.metadata.description || '',
      tags: schematic.metadata.tags || [],
      author: schematic.metadata.author || '',
      created: schematic.metadata.createdAt || schematic.createdAt,
      modified: schematic.metadata.modifiedAt || schematic.updatedAt,
    },
    created_at: schematic.createdAt,
    updated_at: schematic.updatedAt,
  };

  return JSON.stringify(manifest, null, 2);
}

/** Serialize a page to save payload structure */
function serializePage(page: SchematicPage, index: number): PageSaveData {
  const circuitYaml = serializePageCircuit(page.circuit);

  const pageHeader = {
    page_id: page.id,
    page_name: page.name,
    page_number: page.number,
    page_size: page.pageSize,
    orientation: page.orientation,
    description: page.description,
    created_at: page.createdAt,
    updated_at: page.updatedAt,
    references: page.references.map((ref) => ({
      page_id: ref.pageId,
      page_number: ref.pageNumber,
      page_name: ref.pageName,
      type: ref.type,
      local_id: ref.localId,
      remote_id: ref.remoteId,
      label: ref.label,
    })),
  };

  const content = JSON.stringify({ ...pageHeader, circuit: circuitYaml }, null, 2);

  return {
    filename: `page_${index + 1}.yaml`,
    content,
  };
}

// ============================================================================
// Deserialization
// ============================================================================

/** Parse manifest from persisted content */
function parseManifest(content: string): {
  id: string;
  name: string;
  description: string;
  version: string;
  activePageId: string;
  metadata: {
    name: string;
    description: string;
    tags: string[];
    author: string;
    createdAt?: string;
    modifiedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
  pageIndex: Array<{ file: string; id: string; number: number; name: string }>;
} {
  const data = JSON.parse(content) as Record<string, unknown>;
  const metadata = (data.metadata as Record<string, unknown> | undefined) ?? {};

  return {
    id: String(data.id ?? ''),
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    version: String(data.version ?? '1.0'),
    activePageId: String(data.active_page_id ?? ''),
    metadata: {
      name: String(metadata.name ?? data.name ?? ''),
      description: String(metadata.description ?? ''),
      tags: Array.isArray(metadata.tags) ? metadata.tags.map((tag) => String(tag)) : [],
      author: String(metadata.author ?? ''),
      createdAt: metadata.created ? String(metadata.created) : undefined,
      modifiedAt: metadata.modified ? String(metadata.modified) : undefined,
    },
    createdAt: String(data.created_at ?? new Date().toISOString()),
    updatedAt: String(data.updated_at ?? new Date().toISOString()),
    pageIndex: Array.isArray(data.pages)
      ? data.pages.map((page) => {
          const p = page as Record<string, unknown>;
          return {
            file: String(p.file ?? ''),
            id: String(p.id ?? ''),
            number: Number(p.number ?? 0),
            name: String(p.name ?? ''),
          };
        })
      : [],
  };
}

/** Parse page from persisted content */
function parsePage(content: string): SchematicPage {
  const data = JSON.parse(content) as Record<string, unknown>;

  const fallbackCircuit: SerializableCircuitState = {
    components: {},
    wires: [],
    metadata: { name: '', description: '', tags: [] },
  };

  const circuit =
    typeof data.circuit === 'string'
      ? deserializePageCircuit(data.circuit)
      : ((data.circuit as SerializableCircuitState | undefined) ?? fallbackCircuit);

  return {
    id: String(data.page_id ?? ''),
    number: Number(data.page_number ?? 1),
    name: String(data.page_name ?? 'Page'),
    description: String(data.description ?? ''),
    pageSize: (data.page_size as SchematicPage['pageSize'] | undefined) ?? 'A4',
    orientation: (data.orientation as SchematicPage['orientation'] | undefined) ?? 'landscape',
    circuit,
    references: (Array.isArray(data.references) ? data.references : []).map((ref) => {
      const r = ref as Record<string, unknown>;
      return {
        pageId: String(r.page_id ?? ''),
        pageNumber: Number(r.page_number ?? 0),
        pageName: String(r.page_name ?? ''),
        type: (r.type as 'outgoing' | 'incoming' | undefined) ?? 'outgoing',
        localId: String(r.local_id ?? ''),
        remoteId: String(r.remote_id ?? ''),
        label: String(r.label ?? ''),
      };
    }),
    createdAt: String(data.created_at ?? new Date().toISOString()),
    updatedAt: String(data.updated_at ?? new Date().toISOString()),
  };
}

// ============================================================================
// Schematic Service
// ============================================================================

export const schematicService = {
  /**
   * Save a multi-page schematic to the project.
   *
   * @param path - Base directory path for the schematic (e.g., schematics/my_schematic/)
   * @param schematic - MultiPageSchematic data to save
   * @throws SchematicServiceError if save fails
   */
  async saveSchematic(path: string, schematic: MultiPageSchematic): Promise<void> {
    try {
      const manifest = serializeManifest(schematic);
      const pages = schematic.pages.map((page, index) => serializePage(page, index));

      await invoke('schematic_save', {
        path,
        manifest,
        pages,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SchematicServiceError(
        `Failed to save schematic: ${message}`,
        'saveSchematic',
        path,
        error instanceof Error ? error : undefined
      );
    }
  },

  /**
   * Load a multi-page schematic from the project.
   *
   * @param path - Base directory path for the schematic
   * @returns MultiPageSchematic data
   * @throws SchematicServiceError if load fails
   */
  async loadSchematic(path: string): Promise<MultiPageSchematic> {
    try {
      const result = await invoke<SchematicLoadResult>('schematic_load', { path });

      const manifest = parseManifest(result.manifest);
      const pages: SchematicPage[] = [];

      for (const pageInfo of manifest.pageIndex) {
        const pageData = result.pages.find((p) => p.filename === pageInfo.file);
        if (!pageData) {
          throw new Error(`Page file not found: ${pageInfo.file}`);
        }
        pages.push(parsePage(pageData.content));
      }

      return {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        pages,
        activePageId: manifest.activePageId || pages[0]?.id || '',
        metadata: {
          name: manifest.metadata.name,
          description: manifest.metadata.description,
          tags: manifest.metadata.tags,
          author: manifest.metadata.author,
          createdAt: manifest.metadata.createdAt || manifest.createdAt,
          modifiedAt: manifest.metadata.modifiedAt || manifest.updatedAt,
        },
        createdAt: manifest.createdAt,
        updatedAt: manifest.updatedAt,
      };
    } catch (error) {
      if (error instanceof SchematicServiceError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SchematicServiceError(
        `Failed to load schematic: ${message}`,
        'loadSchematic',
        path,
        error instanceof Error ? error : undefined
      );
    }
  },
};

export default schematicService;
