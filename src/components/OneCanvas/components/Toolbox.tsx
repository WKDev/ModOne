/**
 * Toolbox Component
 *
 * Left sidebar panel for the OneCanvas schematic editor.
 * Provides a categorised, searchable list of circuit symbols that can be
 * placed on the canvas via click-to-place.
 *
 * This matches the handlers in OneCanvasPanel (handleDragStart / handleDragEnd).
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Library, PenTool, Search, Spline, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { SymbolRenderer } from './SymbolRenderer';
import {
  SYMBOL_CATEGORIES,
  SYMBOL_LABELS,
  preloadAllThumbnails,
  type SymbolCategory,
} from '../utils/symbolThumbnails';
import type { BlockType } from '../../../types/circuit';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const THUMBNAIL_SIZE = 36;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single clickable symbol item inside a category. */
function ClickableSymbolItem({ type, onSelect }: { type: BlockType; onSelect?: (type: BlockType) => void }) {
  const label = SYMBOL_LABELS[type] ?? type;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer select-none',
        'hover:bg-neutral-700/60 active:bg-neutral-600/60 transition-colors',
      )}
      title={label}
      onClick={() => onSelect?.(type)}
    >
      <SymbolRenderer
        symbolId={type}
        width={THUMBNAIL_SIZE}
        height={THUMBNAIL_SIZE}
      />
      <span className="text-xs text-neutral-300 leading-tight truncate">
        {label}
      </span>
    </div>
  );
}

/** Collapsible category section. */
const CategorySection = memo(function CategorySection({
  category,
  expanded,
  onToggle,
  filter,
  onSelect,
}: {
  category: SymbolCategory;
  expanded: boolean;
  onToggle: () => void;
  filter: string;
  onSelect?: (type: BlockType) => void;
}) {
  const visibleItems = useMemo(() => {
    if (!filter) return category.items;
    const lower = filter.toLowerCase();
    return category.items.filter((type) => {
      const label = SYMBOL_LABELS[type] ?? type;
      return label.toLowerCase().includes(lower) || type.toLowerCase().includes(lower);
    });
  }, [category.items, filter]);

  if (filter && visibleItems.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex items-center gap-1.5 w-full px-2 py-1.5 text-left',
          'text-xs font-semibold text-neutral-400 uppercase tracking-wider',
          'hover:text-neutral-200 hover:bg-neutral-800/60 rounded transition-colors',
        )}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="flex-1 truncate">{category.label}</span>
        <span className="text-[10px] font-normal text-neutral-600">{visibleItems.length}</span>
      </button>

      {expanded && (
        <div className="ml-1 mt-0.5 flex flex-col gap-0.5">
          {visibleItems.map((type) => (
            <ClickableSymbolItem key={type} type={type} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ToolboxProps {
  className?: string;
  onOpenLibrary?: () => void;
  onOpenSymbolEditor?: () => void;
  onSelectSymbol?: (blockType: BlockType) => void;
  onStartWireMode?: () => void;
  isWireMode?: boolean;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const Toolbox = memo(function Toolbox({
  className,
  onOpenLibrary,
  onOpenSymbolEditor,
  onSelectSymbol,
  onStartWireMode,
  isWireMode = false,
}: ToolboxProps) {
  // -- State ----------------------------------------------------------------

  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(SYMBOL_CATEGORIES.map((c) => c.id)),
  );

  // Pre-render all thumbnails on mount (fire-and-forget)
  useEffect(() => {
    void preloadAllThumbnails(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  }, []);

  // -- Handlers -------------------------------------------------------------

  const toggleCategory = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSearch = useCallback(() => setSearch(''), []);

  // -- Derive visible categories (for "no results" state) -------------------

  const hasResults = useMemo(() => {
    if (!search) return true;
    const lower = search.toLowerCase();
    return SYMBOL_CATEGORIES.some((cat) =>
      cat.items.some((type) => {
        const label = SYMBOL_LABELS[type] ?? type;
        return label.toLowerCase().includes(lower) || type.toLowerCase().includes(lower);
      }),
    );
  }, [search]);

  // -- Render ---------------------------------------------------------------

  return (
    <div
      className={cn(
        'flex flex-col w-56 bg-neutral-900 border-r border-neutral-800 overflow-hidden flex-shrink-0',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
          Toolbox
        </span>
        <div className="flex items-center gap-1">
          {onOpenSymbolEditor && (
            <button
              type="button"
              onClick={onOpenSymbolEditor}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 rounded transition-colors"
              title="Open Symbol Editor"
            >
              <PenTool size={12} />
            </button>
          )}
          {onOpenLibrary && (
            <button
              type="button"
              onClick={onOpenLibrary}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 rounded transition-colors"
              title="Open Symbol Library"
            >
              <Library size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="px-2 py-1.5 border-b border-neutral-800">
        <button
          type="button"
          onClick={() => onStartWireMode?.()}
          className={cn(
            'flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors',
            isWireMode
              ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
              : 'text-neutral-300 hover:bg-neutral-700/60',
          )}
        >
          <Spline size={16} />
          <span>Wire Tool</span>
          <span className="ml-auto text-[10px] text-neutral-500">W</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-neutral-800">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search symbols…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'w-full pl-7 pr-7 py-1 rounded text-xs',
              'bg-neutral-800 text-neutral-200 placeholder:text-neutral-600',
              'border border-neutral-700 focus:border-blue-600 focus:outline-none',
              'transition-colors',
            )}
          />
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Category list */}
      <div className="flex-1 overflow-y-auto px-1 py-1 space-y-0.5 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
        {SYMBOL_CATEGORIES.map((cat) => (
          <CategorySection
            key={cat.id}
            category={cat}
            expanded={expandedIds.has(cat.id)}
            onToggle={() => toggleCategory(cat.id)}
            filter={search}
            onSelect={onSelectSymbol}
          />
        ))}

        {!hasResults && (
          <div className="px-2 py-6 text-center text-xs text-neutral-600">
            No symbols match "{search}"
          </div>
        )}
      </div>
    </div>
  );
});
