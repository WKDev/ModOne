import { useEffect } from 'react';
import { useSymbolStore } from '../stores/symbolStore';
import type { SymbolDefinition, LibraryScope } from '../types/symbol';

export function useSymbolLibrary(projectDir: string) {
  const {
    projectSymbols,
    globalSymbols,
    currentSymbol,
    isLoading,
    error,
    loadLibrary,
    loadSymbol,
    saveSymbol,
    deleteSymbol,
    setCurrentSymbol,
    clearError,
  } = useSymbolStore();

  useEffect(() => {
    if (projectDir) {
      loadLibrary(projectDir);
    }
  }, [projectDir, loadLibrary]);

  return {
    projectSymbols,
    globalSymbols,
    allSymbols: [...projectSymbols, ...globalSymbols],
    currentSymbol,
    isLoading,
    error,
    loadSymbol: (id: string, scope: LibraryScope) => loadSymbol(projectDir, id, scope),
    saveSymbol: (symbol: SymbolDefinition, scope: LibraryScope) => saveSymbol(projectDir, symbol, scope),
    deleteSymbol: (id: string, scope: LibraryScope) => deleteSymbol(projectDir, id, scope),
    setCurrentSymbol,
    clearError,
    reload: () => loadLibrary(projectDir),
  };
}
