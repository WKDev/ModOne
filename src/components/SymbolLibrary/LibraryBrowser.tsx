import { useMemo, useState } from 'react';
import { Search, Shapes } from 'lucide-react';
import { useSymbolLibrary } from '../../hooks/useSymbolLibrary';
import type { LibraryScope, SymbolSummary } from '../../types/symbol';

interface LibraryBrowserProps {
  projectDir: string;
  onOpenEditor?: (symbolId: string, scope: LibraryScope) => void;
}

function SymbolThumbnailPlaceholder({ name }: { name: string }) {
  return (
    <div className="w-12 h-12 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center">
      <Shapes size={20} className="text-neutral-500" />
      <span className="sr-only">{name}</span>
    </div>
  );
}

export function LibraryBrowser({ projectDir, onOpenEditor }: LibraryBrowserProps) {
  const { allSymbols, isLoading } = useSymbolLibrary(projectDir);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    allSymbols.forEach((sym) => {
      if (sym.category) cats.add(sym.category);
    });
    return Array.from(cats).sort();
  }, [allSymbols]);

  const filteredSymbols = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return allSymbols.filter((sym) => {
      if (selectedCategory && sym.category !== selectedCategory) return false;
      if (!query) return true;
      return (
        sym.name.toLowerCase().includes(query) ||
        sym.category.toLowerCase().includes(query) ||
        (sym.description ?? '').toLowerCase().includes(query)
      );
    });
  }, [allSymbols, searchQuery, selectedCategory]);

  const handleDragStart = (e: React.DragEvent, sym: SymbolSummary) => {
    e.dataTransfer.setData(
      'application/x-modone-symbol',
      JSON.stringify({ symbolId: sym.id, scope: sym.scope })
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div data-testid="symbol-library" className="flex flex-col h-full bg-neutral-800 text-neutral-200">
      {/* Search bar */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search symbols..."
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Category pills */}
      {categories.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
              selectedCategory === null
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-700 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-700 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Symbol grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {isLoading ? (
          <div className="text-center py-12 text-neutral-500 text-sm">Loading...</div>
        ) : filteredSymbols.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 text-sm">
            No symbols found. Create one in the Symbol Editor.
          </div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {filteredSymbols.map((sym) => (
              <div
                key={`${sym.scope}-${sym.id}`}
                data-testid={`symbol-entry-${sym.id}`}
                draggable
                onDragStart={(e) => handleDragStart(e, sym)}
                onDoubleClick={() => onOpenEditor?.(sym.id, sym.scope)}
                className="relative flex flex-col items-center p-2 rounded border border-neutral-700 bg-neutral-900 hover:border-neutral-500 hover:bg-neutral-800/80 cursor-pointer transition-colors"
              >
                {/* Scope badge */}
                <span
                  className={`absolute top-1.5 right-1.5 w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center ${
                    sym.scope === 'project'
                      ? 'bg-blue-900/60 text-blue-400'
                      : 'bg-emerald-900/60 text-emerald-400'
                  }`}
                >
                  {sym.scope === 'project' ? 'P' : 'G'}
                </span>

                {/* Thumbnail */}
                <div className="w-full h-16 flex items-center justify-center overflow-hidden">
                  <SymbolThumbnailPlaceholder name={sym.name} />
                </div>

                {/* Name */}
                <div className="mt-1 text-xs font-medium text-neutral-300 truncate w-full text-center">
                  {sym.name}
                </div>

                {/* Category tag */}
                <div className="text-[10px] text-neutral-500 truncate w-full text-center">
                  {sym.category}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
