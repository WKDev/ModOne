import { useState } from 'react';
import { Trash2, Copy, Loader2, AlertCircle, Edit2 } from 'lucide-react';
import { useSymbolLibrary } from '../../hooks/useSymbolLibrary';
import type { LibraryScope, SymbolSummary } from '../../types/symbol';
import { loadSymbol } from '../../services/symbolService';

interface LibraryManagerProps {
  projectDir: string;
  onOpenEditor?: (symbolId: string, scope: LibraryScope) => void;
}

type ActiveTab = 'project' | 'global';

interface DeleteConfirm {
  symbol: SymbolSummary;
}

export function LibraryManager({ projectDir, onOpenEditor }: LibraryManagerProps) {
  const {
    projectSymbols,
    globalSymbols,
    isLoading,
    error,
    deleteSymbol,
    saveSymbol,
    clearError,
    reload,
  } = useSymbolLibrary(projectDir);

  const [activeTab, setActiveTab] = useState<ActiveTab>('project');
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const symbols = activeTab === 'project' ? projectSymbols : globalSymbols;
  const otherScope: LibraryScope = activeTab === 'project' ? 'global' : 'project';

  const handleDelete = async (sym: SymbolSummary) => {
    await deleteSymbol(sym.id, sym.scope);
    setDeleteConfirm(null);
  };

  const handleCopyToOtherScope = async (sym: SymbolSummary) => {
    setCopyingId(sym.id);
    try {
      const full = await loadSymbol(projectDir, sym.id, sym.scope);
      await saveSymbol(full, otherScope);
      reload();
    } catch (err) {
      console.error('Failed to copy symbol:', err);
    } finally {
      setCopyingId(null);
    }
  };

  return (
    <div data-testid="symbol-library" className="flex flex-col h-full bg-neutral-800 text-neutral-200">
      {/* Tab bar */}
      <div className="flex border-b border-neutral-700">
        {(['project', 'global'] as const).map((tab) => (
          <button
            key={tab}
            data-testid={tab === 'project' ? 'library-tab-project' : 'library-tab-global'}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-white border-b-2 border-blue-500 bg-neutral-750'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
            }`}
          >
            {tab} Library
            <span className="ml-2 text-xs text-neutral-500">
              ({tab === 'project' ? projectSymbols.length : globalSymbols.length})
            </span>
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-3 mt-3 p-2 bg-red-900/30 border border-red-800 rounded flex items-center gap-2">
          <AlertCircle size={14} className="text-red-400 shrink-0" />
          <span className="text-xs text-red-300 flex-1">{error}</span>
          <button type="button" onClick={clearError} className="text-xs text-red-400 hover:text-red-200">
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-neutral-500" />
          </div>
        ) : symbols.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 text-sm">
            No symbols in this library.
          </div>
        ) : (
          <div className="space-y-1">
            {symbols.map((sym) => (
              <div
                key={sym.id}
                data-testid={`symbol-entry-${sym.id}`}
                className="flex items-center gap-3 px-3 py-2 rounded hover:bg-neutral-700/50 group"
              >
                {/* Scope badge */}
                <span
                  className={`shrink-0 w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
                    sym.scope === 'project'
                      ? 'bg-blue-900/50 text-blue-400'
                      : 'bg-emerald-900/50 text-emerald-400'
                  }`}
                >
                  {sym.scope === 'project' ? 'P' : 'G'}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-neutral-200 truncate">{sym.name}</div>
                  <div className="text-xs text-neutral-500 truncate">
                    {sym.category} &middot; v{sym.version}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onOpenEditor && (
                    <button
                      data-testid="symbol-edit-btn"
                      type="button"
                      onClick={() => onOpenEditor(sym.id, sym.scope)}
                      className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-600"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopyToOtherScope(sym)}
                    disabled={copyingId === sym.id}
                    className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-600 disabled:opacity-50"
                    title={`Copy to ${otherScope}`}
                  >
                    {copyingId === sym.id ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                  </button>
                  <button
                    data-testid="symbol-delete-btn"
                    type="button"
                    onClick={() => setDeleteConfirm({ symbol: sym })}
                    className="p-1.5 rounded text-neutral-400 hover:text-red-400 hover:bg-neutral-600"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl p-5 max-w-sm w-full mx-4">
            <h3 className="text-sm font-semibold text-white mb-2">Delete Symbol</h3>
            <p className="text-sm text-neutral-300 mb-4">
              Delete <strong>{deleteConfirm.symbol.name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-sm rounded bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirm.symbol)}
                className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
