import { useState, useCallback, useEffect, useMemo } from 'react';
import { Search, File, Replace, ChevronDown, ChevronRight } from 'lucide-react';
import { useDocumentRegistry } from '../../stores/documentRegistry';
import { useEditorAreaStore } from '../../stores/editorAreaStore';
import { isCanvasDocument } from '../../types/document';
import type { Block } from '../OneCanvas/types';
import { searchComponents, replaceInComponents, type SearchResult as CircuitSearchResult } from '../OneCanvas/utils/circuitSearch';

// ============================================================================
// Types
// ============================================================================

interface SearchResult {
  file: string;
  line: number;
  content: string;
  matchStart: number;
  matchEnd: number;
  // Extended fields for circuit search
  blockId?: string;
  fieldName?: string;
  blockType?: string;
}

interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  showReplace: boolean;
}

const EMPTY_COMPONENTS = new Map<string, Block>();

// ============================================================================
// Component
// ============================================================================

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    showReplace: false,
  });
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const tabs = useEditorAreaStore((state) => state.tabs);
  const activeTabId = useEditorAreaStore((state) => state.activeTabId);

  const activeDocumentId = useMemo(() => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    return activeTab?.data?.documentId ?? null;
  }, [tabs, activeTabId]);

  const activeCanvasDocument = useDocumentRegistry((state) => {
    if (!activeDocumentId) return null;
    const doc = state.documents.get(activeDocumentId);
    return doc && isCanvasDocument(doc) ? doc : null;
  });

  const updateCanvasData = useDocumentRegistry((state) => state.updateCanvasData);
  const components = activeCanvasDocument?.data.components ?? EMPTY_COMPONENTS;

  /**
   * Perform search across canvas components
   */
  const performSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery || searchQuery.length < 2) {
        setResults([]);
        return;
      }

      setIsSearching(true);

      // Search canvas components
      const circuitResults = searchComponents(components, searchQuery, {
        caseSensitive: options.caseSensitive,
        wholeWord: options.wholeWord,
      });

      // Convert to UI format
      const uiResults: SearchResult[] = circuitResults.map((r: CircuitSearchResult) => ({
        file: `Canvas: ${r.blockType}`,
        line: 0, // Not applicable for canvas
        content: r.fieldValue,
        matchStart: r.matchIndex,
        matchEnd: r.matchIndex + r.matchLength,
        blockId: r.blockId,
        fieldName: r.fieldName,
        blockType: r.blockType,
      }));

      setResults(uiResults);
      setIsSearching(false);

      // Auto-expand all files
      setExpandedFiles(new Set(uiResults.map((r) => r.file)));
    },
    [components, options.caseSensitive, options.wholeWord]
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  /**
   * Handle result click - select the component and pan to it
   */
  const handleResultClick = useCallback(
    (result: SearchResult) => {
      if (!result.blockId) return;
      if (!activeCanvasDocument) return;

      updateCanvasData(activeCanvasDocument.id, (data) => {
        data.components.forEach((component, id) => {
          const shouldSelect = id === result.blockId;
          if (component.selected !== shouldSelect) {
            data.components.set(id, { ...component, selected: shouldSelect });
          }
        });
      });

      // Find the component and pan to it
      const block = components.get(result.blockId);
      if (block) {
        // Get current viewport dimensions (approximate)
        const viewportWidth = window.innerWidth - 400; // Subtract sidebar widths
        const viewportHeight = window.innerHeight - 200; // Subtract header/status bar

        // Pan to center the block
        updateCanvasData(activeCanvasDocument.id, (data) => {
          data.pan = {
            x: -block.position.x + viewportWidth / 2 - block.size.width / 2,
            y: -block.position.y + viewportHeight / 2 - block.size.height / 2,
          };
          data.zoom = 1;
        });
      }
    },
    [activeCanvasDocument, components, updateCanvasData]
  );

  /**
   * Replace single occurrence
   */
  const handleReplace = useCallback(
    (result: SearchResult) => {
      if (!result.blockId || !result.fieldName) return;

      // Get the circuit search result format
      const circuitResult: CircuitSearchResult = {
        id: `sr_0`,
        blockId: result.blockId,
        blockType: result.blockType || '',
        fieldName: result.fieldName,
        fieldValue: result.content,
        matchIndex: result.matchStart,
        matchLength: result.matchEnd - result.matchStart,
      };

      const updates = replaceInComponents(components, [circuitResult], replaceText);
      if (!activeCanvasDocument) return;

      // Apply updates
      updateCanvasData(activeCanvasDocument.id, (data) => {
        for (const [blockId, update] of updates) {
          const existing = data.components.get(blockId);
          if (existing) {
            data.components.set(blockId, { ...existing, ...update } as Block);
          }
        }
      });

      // Refresh search
      performSearch(query);
    },
    [activeCanvasDocument, components, replaceText, updateCanvasData, performSearch, query]
  );

  /**
   * Replace all occurrences
   */
  const handleReplaceAll = useCallback(() => {
    if (results.length === 0) return;

    // Convert all results to circuit search format
    const circuitResults: CircuitSearchResult[] = results
      .filter((r) => r.blockId && r.fieldName)
      .map((r, index) => ({
        id: `sr_${index}`,
        blockId: r.blockId!,
        blockType: r.blockType || '',
        fieldName: r.fieldName!,
        fieldValue: r.content,
        matchIndex: r.matchStart,
        matchLength: r.matchEnd - r.matchStart,
      }));

    const updates = replaceInComponents(components, circuitResults, replaceText);
    if (!activeCanvasDocument) return;

    // Apply updates
    updateCanvasData(activeCanvasDocument.id, (data) => {
      for (const [blockId, update] of updates) {
        const existing = data.components.get(blockId);
        if (existing) {
          data.components.set(blockId, { ...existing, ...update } as Block);
        }
      }
    });

    // Refresh search
    performSearch(query);
  }, [results, activeCanvasDocument, components, replaceText, updateCanvasData, performSearch, query]);

  // Group results by file
  const groupedResults = useMemo(() => {
    return results.reduce(
      (acc, result) => {
        if (!acc[result.file]) {
          acc[result.file] = [];
        }
        acc[result.file].push(result);
        return acc;
      },
      {} as Record<string, SearchResult[]>
    );
  }, [results]);

  const toggleFileExpanded = (file: string) => {
    setExpandedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(file)) {
        newSet.delete(file);
      } else {
        newSet.add(file);
      }
      return newSet;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="p-2 space-y-2 border-b border-[var(--color-border)]">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            placeholder="Search components..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 pl-7 pr-8 text-sm text-[var(--color-text-secondary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focus)]"
          />
          <button
            onClick={() =>
              setOptions((prev) => ({ ...prev, showReplace: !prev.showReplace }))
            }
            className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--color-bg-tertiary)] ${
              options.showReplace ? 'text-[var(--color-info)]' : 'text-[var(--color-text-muted)]'
            }`}
            title="Toggle Replace"
          >
            <Replace size={14} />
          </button>
        </div>

        {/* Replace Input */}
        {options.showReplace && (
          <div className="relative">
            <Replace
              size={14}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              type="text"
              placeholder="Replace with..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5 pl-7 text-sm text-[var(--color-text-secondary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focus)]"
            />
          </div>
        )}

        {/* Search Options */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() =>
              setOptions((prev) => ({
                ...prev,
                caseSensitive: !prev.caseSensitive,
              }))
            }
            className={`px-2 py-0.5 rounded ${
              options.caseSensitive
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
             }`}
            title="Match Case"
          >
            Aa
          </button>
          <button
            onClick={() =>
              setOptions((prev) => ({ ...prev, wholeWord: !prev.wholeWord }))
            }
            className={`px-2 py-0.5 rounded ${
              options.wholeWord
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
             }`}
            title="Match Whole Word"
          >
            ab
          </button>

          {/* Replace All Button */}
          {options.showReplace && results.length > 0 && (
            <button
              onClick={handleReplaceAll}
              className="ml-auto px-2 py-0.5 rounded bg-[var(--color-warning)] text-white text-xs hover:opacity-90"
              title="Replace All"
            >
              Replace All ({results.length})
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {isSearching ? (
          <div className="p-4 text-center text-[var(--color-text-muted)] text-sm">
            Searching...
          </div>
        ) : query.length < 2 ? (
          <div className="p-4 text-center text-[var(--color-text-muted)] text-sm">
            Enter at least 2 characters to search
          </div>
        ) : results.length === 0 ? (
          <div className="p-4 text-center text-[var(--color-text-muted)] text-sm">
            No results found for "{query}"
          </div>
        ) : (
          <div className="py-1">
            {/* Results summary */}
            <div className="px-3 py-1 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
              {results.length} result{results.length > 1 ? 's' : ''} in{' '}
              {Object.keys(groupedResults).length} group
              {Object.keys(groupedResults).length > 1 ? 's' : ''}
            </div>

            {Object.entries(groupedResults).map(([file, fileResults]) => (
              <div key={file} className="border-b border-[var(--color-border)]">
                {/* File header */}
                <button
                  className="w-full px-2 py-1.5 flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                  onClick={() => toggleFileExpanded(file)}
                >
                  {expandedFiles.has(file) ? (
                    <ChevronDown size={12} />
                  ) : (
                    <ChevronRight size={12} />
                  )}
                  <File size={12} className="text-[var(--color-text-muted)]" />
                  <span className="flex-1 text-left truncate">{file}</span>
                  <span className="text-[var(--color-text-muted)] ml-1">
                    ({fileResults.length})
                  </span>
                </button>

                {/* File results */}
                {expandedFiles.has(file) && (
                  <div className="pb-1">
                    {fileResults.map((result, index) => (
                      <div
                        key={index}
                        className="group flex items-center hover:bg-[var(--color-bg-tertiary)]"
                      >
                        <button
                          className="flex-1 px-4 py-1 text-left text-sm min-w-0"
                          onClick={() => handleResultClick(result)}
                        >
                          <span className="text-[var(--color-info)] mr-2 text-xs">
                            [{result.fieldName}]
                          </span>
                          <span className="text-[var(--color-text-secondary)] break-all">
                            {result.content.slice(0, result.matchStart)}
                            <span className="bg-[var(--color-warning)]/30 text-[var(--color-warning)]">
                              {result.content.slice(
                                result.matchStart,
                                result.matchEnd
                              )}
                            </span>
                            {result.content.slice(result.matchEnd)}
                          </span>
                        </button>

                        {/* Replace single button */}
                        {options.showReplace && (
                          <button
                            onClick={() => handleReplace(result)}
                            className="hidden group-hover:block px-2 py-1 text-xs text-[var(--color-warning)] hover:opacity-90"
                            title="Replace"
                          >
                            <Replace size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
