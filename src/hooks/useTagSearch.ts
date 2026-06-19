/**
 * Tag Search Hook
 *
 * Provides debounced, multi-field search over the tag registry.
 * Searches across tagId, displayName, canonicalAddress, description,
 * and vendorAliases fields with case-insensitive matching.
 */

import { useMemo } from 'react';
import { useDebouncedValue } from './useDebouncedValue';
import { useTagStore, selectTagRegistry } from '../stores/tagStore';
import type { TagDefinition } from '../types/tags';

const DEBOUNCE_MS = 300;

/**
 * Format a canonical address to a searchable string.
 * e.g. { area: "M", index: 0, bitIndex: 3 } => "M0.3"
 */
function formatCanonicalAddress(
  addr: TagDefinition['canonicalAddress'],
): string {
  const base = `${addr.area}${addr.index}`;
  return addr.bitIndex != null ? `${base}.${addr.bitIndex}` : base;
}

/**
 * Check whether a tag matches the given lowercase query.
 * Matches against tagId, displayName, canonicalAddress (formatted),
 * description, and vendorAliases.
 */
function matchesQuery(tag: TagDefinition, lowerQuery: string): boolean {
  if (tag.tagId.toLowerCase().includes(lowerQuery)) return true;
  if (tag.displayName.toLowerCase().includes(lowerQuery)) return true;
  if (formatCanonicalAddress(tag.canonicalAddress).toLowerCase().includes(lowerQuery)) return true;
  if (tag.description?.toLowerCase().includes(lowerQuery)) return true;
  if (tag.vendorAliases?.some((alias) => alias.toLowerCase().includes(lowerQuery))) return true;
  return false;
}

export interface UseTagSearchResult {
  /** The debounced query string actually used for filtering */
  debouncedQuery: string;
  /** Filtered tag definitions matching the query (or all tags if query is empty) */
  results: TagDefinition[];
}

/**
 * Debounced multi-field search hook for the tag registry.
 *
 * @param query - Raw search input string
 * @returns Debounced query and filtered tag results
 *
 * @example
 * ```tsx
 * const [search, setSearch] = useState('');
 * const { results, debouncedQuery } = useTagSearch(search);
 * ```
 */
export function useTagSearch(query: string): UseTagSearchResult {
  const registry = useTagStore(selectTagRegistry);
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

  const results = useMemo(() => {
    const trimmed = debouncedQuery.trim().toLowerCase();
    if (trimmed === '') return registry;
    return registry.filter((tag) => matchesQuery(tag, trimmed));
  }, [registry, debouncedQuery]);

  return { debouncedQuery, results };
}

export default useTagSearch;
