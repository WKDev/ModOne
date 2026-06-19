/**
 * ProjectBlockLoader Service
 *
 * TypeScript service for loading and managing user-defined XML symbol blocks
 * stored in a project's `.modone/symbols/` directory.
 *
 * This service wraps the Tauri `project_block_*` commands that are backed by
 * the Rust `ProjectBlockLoader` module.  It is complementary to
 * `symbolService.ts` which manages JSON-serialised symbols.
 *
 * ## Directory layout
 * ```
 * {projectDir}/
 * └── .modone/
 *     └── symbols/
 *         ├── custom_sensor.symbol.xml
 *         ├── my_relay.symbol.xml
 *         └── ...
 * ```
 *
 * ## Usage
 * ```ts
 * import * as projectBlockLoader from '@/services/projectBlockLoader';
 *
 * // List all XML blocks in the project
 * const summaries = await projectBlockLoader.listProjectBlocks(projectDir);
 *
 * // Load a specific block
 * const def = await projectBlockLoader.loadProjectBlock(projectDir, 'custom:sensor');
 *
 * // Import a hand-authored XML file
 * const def = await projectBlockLoader.importXmlBlock(projectDir, xmlString);
 * ```
 */

import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import type { SymbolDefinition } from '../types/symbol';

// ============================================================================
// Types (mirrors Rust XmlSymbolSummary / XmlSymbolLoadResult)
// ============================================================================

/** Lightweight summary of an XML symbol block (no full definition). */
export interface XmlSymbolSummary {
  /** Symbol ID from the `id` attribute of `<ms:SymbolDefinition>`. */
  id: string;
  /** Display name. */
  name: string;
  /** Semantic version. */
  version: string;
  /** Category (e.g., "sensor", "relay"). */
  category: string;
  /** Optional description. */
  description?: string;
  /** Absolute path to the `.symbol.xml` file. */
  filePath: string;
  /** Domain from the `domain` attribute (e.g., "circuit", "plc"). */
  domain?: string;
  /** Canonical block type from the `canonicalType` attribute. */
  canonicalType?: string;
}

/** A fully loaded XML symbol with definition and parse warnings. */
export interface XmlSymbolLoadResult {
  /** Lightweight summary. */
  summary: XmlSymbolSummary;
  /** Full parsed symbol definition. */
  definition: SymbolDefinition;
  /** Non-fatal warnings from parsing (e.g., "no ports defined"). */
  warnings: string[];
}

// ============================================================================
// Service functions
// ============================================================================

/**
 * List all `.symbol.xml` files in `{projectDir}/.modone/symbols/`.
 *
 * Returns lightweight summaries; the full definitions are not loaded.
 * Files that cannot be parsed are silently skipped by the backend.
 *
 * Returns an empty array if the directory does not exist.
 */
export async function listProjectBlocks(
  projectDir: string
): Promise<XmlSymbolSummary[]> {
  try {
    return await invoke<XmlSymbolSummary[]>('project_block_list', { projectDir });
  } catch (error) {
    toast.error('Failed to list project XML blocks', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Load a single XML symbol by its ID.
 *
 * The backend tries the canonical filename first, then scans all XML files
 * for a matching `id` attribute.
 */
export async function loadProjectBlock(
  projectDir: string,
  id: string
): Promise<SymbolDefinition> {
  try {
    return await invoke<SymbolDefinition>('project_block_load', { projectDir, id });
  } catch (error) {
    toast.error(`Failed to load project block '${id}'`, {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Load every `.symbol.xml` file and return full `SymbolDefinition` objects.
 *
 * Invalid files are skipped.  Use `loadAllProjectBlocksWithWarnings` if you
 * need to surface parse warnings to the user.
 */
export async function loadAllProjectBlocks(
  projectDir: string
): Promise<SymbolDefinition[]> {
  try {
    return await invoke<SymbolDefinition[]>('project_block_load_all', { projectDir });
  } catch (error) {
    toast.error('Failed to load project XML blocks', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Load every `.symbol.xml` file and return both definitions and warnings.
 *
 * This is the detailed variant of `loadAllProjectBlocks`.
 */
export async function loadAllProjectBlocksWithWarnings(
  projectDir: string
): Promise<XmlSymbolLoadResult[]> {
  try {
    return await invoke<XmlSymbolLoadResult[]>('project_block_load_all_with_warnings', {
      projectDir,
    });
  } catch (error) {
    toast.error('Failed to load project XML blocks', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Delete the `.symbol.xml` file for a symbol with the given ID.
 */
export async function deleteProjectBlock(
  projectDir: string,
  id: string
): Promise<void> {
  try {
    await invoke('project_block_delete', { projectDir, id });
  } catch (error) {
    toast.error(`Failed to delete project block '${id}'`, {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Ensure the `.modone/symbols/` directory exists, creating it if needed.
 *
 * Returns the absolute path to the directory.
 */
export async function ensureProjectBlocksDir(
  projectDir: string
): Promise<string> {
  try {
    return await invoke<string>('project_block_ensure_dir', { projectDir });
  } catch (error) {
    toast.error('Failed to create project blocks directory', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Validate and import an XML symbol string into the project's `.modone/symbols/`.
 *
 * The XML must contain a valid `<ms:SymbolDefinition>` root element.
 * On success the parsed `SymbolDefinition` is returned so the caller can
 * immediately use it without a second round-trip.
 *
 * @param projectDir - Absolute path to the project directory.
 * @param xmlContent - Full XML string of the symbol definition.
 */
export async function importXmlBlock(
  projectDir: string,
  xmlContent: string
): Promise<SymbolDefinition> {
  try {
    return await invoke<SymbolDefinition>('project_block_import_xml', {
      projectDir,
      xmlContent,
    });
  } catch (error) {
    toast.error('Failed to import XML symbol block', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Return the path to the `.modone/symbols/` directory for the given project.
 *
 * The directory is NOT created; use `ensureProjectBlocksDir` to create it.
 */
export async function getProjectBlocksDir(projectDir: string): Promise<string> {
  try {
    return await invoke<string>('project_block_symbols_dir', { projectDir });
  } catch (error) {
    toast.error('Failed to get project blocks directory', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
