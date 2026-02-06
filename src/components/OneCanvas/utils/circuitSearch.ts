/**
 * Circuit Search & Replace Utility
 *
 * Provides search and replace functionality across canvas circuit components.
 * Searches through block labels, addresses, designations, text content, and IDs.
 */

import type { Block } from '../types';

// ============================================================================
// Types
// ============================================================================

/** A single search match result */
export interface SearchResult {
  /** Unique result ID */
  id: string;
  /** Component block ID */
  blockId: string;
  /** Block type */
  blockType: string;
  /** Which field matched (label, address, designation, etc.) */
  fieldName: string;
  /** The matched value */
  fieldValue: string;
  /** Position of match in value */
  matchIndex: number;
  /** Length of the matched substring */
  matchLength: number;
}

/** Options for controlling search behavior */
export interface SearchOptions {
  /** Whether to match case (default: false) */
  caseSensitive?: boolean;
  /** Whether to match whole words only (default: false) */
  wholeWord?: boolean;
  /** Which fields to search (default: all searchable fields) */
  searchFields?: string[];
}

// ============================================================================
// Field Extraction
// ============================================================================

/** Block types that have an `address` field */
const ADDRESS_BLOCK_TYPES: ReadonlySet<string> = new Set(['plc_out', 'plc_in']);

/** Block types that have a `designation` field */
const DESIGNATION_BLOCK_TYPES: ReadonlySet<string> = new Set([
  'relay',
  'fuse',
  'motor',
  'emergency_stop',
  'selector_switch',
  'solenoid_valve',
  'sensor',
  'pilot_lamp',
]);

/**
 * Get all searchable field name/value pairs for a block.
 *
 * Fields extracted per block type:
 * - `id` — all blocks
 * - `label` — all blocks (when defined)
 * - `address` — plc_out, plc_in
 * - `designation` — relay, fuse, motor, emergency_stop, selector_switch,
 *                    solenoid_valve, sensor, pilot_lamp
 * - `content` — text blocks
 */
export function getSearchableFields(
  block: Block,
): { field: string; value: string }[] {
  const fields: { field: string; value: string }[] = [];

  // id — always present
  fields.push({ field: 'id', value: block.id });

  // label — present on BaseBlock but optional
  if (block.label != null && block.label !== '') {
    fields.push({ field: 'label', value: block.label });
  }

  // address — plc_out / plc_in
  if (ADDRESS_BLOCK_TYPES.has(block.type)) {
    const addr = (block as Extract<Block, { address: string }>).address;
    if (addr != null && addr !== '') {
      fields.push({ field: 'address', value: addr });
    }
  }

  // designation — industrial components
  if (DESIGNATION_BLOCK_TYPES.has(block.type)) {
    const desig = (block as Extract<Block, { designation: string }>).designation;
    if (desig != null && desig !== '') {
      fields.push({ field: 'designation', value: desig });
    }
  }

  // content — text blocks
  if (block.type === 'text') {
    const content = block.content;
    if (content != null && content !== '') {
      fields.push({ field: 'content', value: content });
    }
  }

  return fields;
}

// ============================================================================
// Search
// ============================================================================

/**
 * Build a RegExp from the query string respecting the given options.
 * The query is escaped so that special regex characters are treated as literals.
 */
function buildSearchRegex(query: string, options: SearchOptions): RegExp {
  // Escape regex special characters
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const pattern = options.wholeWord ? `\\b${escaped}\\b` : escaped;
  const flags = options.caseSensitive ? 'g' : 'gi';

  return new RegExp(pattern, flags);
}

/**
 * Search across all components in the circuit.
 *
 * Returns an array of `SearchResult` objects, one per match. A single field
 * may produce multiple results if the query appears more than once in the
 * field value.
 */
export function searchComponents(
  components: Map<string, Block>,
  query: string,
  options: SearchOptions = {},
): SearchResult[] {
  if (!query) return [];

  const regex = buildSearchRegex(query, options);
  const fieldFilter = options.searchFields
    ? new Set(options.searchFields)
    : null;

  const results: SearchResult[] = [];
  let resultCounter = 0;

  for (const [blockId, block] of components) {
    const fields = getSearchableFields(block);

    for (const { field, value } of fields) {
      // Skip fields not in the filter (when specified)
      if (fieldFilter && !fieldFilter.has(field)) continue;

      // Reset regex state for each field
      regex.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = regex.exec(value)) !== null) {
        results.push({
          id: `sr_${resultCounter++}`,
          blockId,
          blockType: block.type,
          fieldName: field,
          fieldValue: value,
          matchIndex: match.index,
          matchLength: match[0].length,
        });

        // Prevent infinite loops on zero-length matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    }
  }

  return results;
}

// ============================================================================
// Replace
// ============================================================================

/**
 * Compute replacement updates for matched components.
 *
 * Given a set of search results and a replacement string, returns a map of
 * `blockId` → partial block updates. The updates contain the new field values
 * with all matched occurrences replaced.
 *
 * When multiple search results target the same field on the same block, all
 * matches are replaced in a single pass. Replacements are applied from the
 * last match to the first so that earlier match indices remain valid.
 */
export function replaceInComponents(
  components: Map<string, Block>,
  searchResults: SearchResult[],
  replacement: string,
): Map<string, Partial<Block>> {
  const updates = new Map<string, Partial<Block>>();

  if (searchResults.length === 0) return updates;

  // Group results by blockId + fieldName so we can batch replacements
  // for the same field on the same block.
  const grouped = new Map<string, SearchResult[]>();

  for (const result of searchResults) {
    const key = `${result.blockId}::${result.fieldName}`;
    let group = grouped.get(key);
    if (!group) {
      group = [];
      grouped.set(key, group);
    }
    group.push(result);
  }

  for (const [, group] of grouped) {
    const { blockId, fieldName } = group[0];

    const block = components.get(blockId);
    if (!block) continue;

    // Read the current field value from the live block.
    const currentFields = getSearchableFields(block);
    const currentField = currentFields.find((f) => f.field === fieldName);
    if (!currentField) continue;

    // Sort matches by matchIndex descending so that splicing from the end
    // preserves earlier indices.
    const sortedDesc = [...group].sort((a, b) => b.matchIndex - a.matchIndex);

    let newValue = currentField.value;
    for (const result of sortedDesc) {
      const before = newValue.slice(0, result.matchIndex);
      const after = newValue.slice(result.matchIndex + result.matchLength);
      newValue = before + replacement + after;
    }

    // Merge into the updates map
    let blockUpdate = updates.get(blockId);
    if (!blockUpdate) {
      blockUpdate = {};
      updates.set(blockId, blockUpdate);
    }

    // Assign the updated field value
    (blockUpdate as Record<string, unknown>)[fieldName] = newValue;
  }

  return updates;
}
