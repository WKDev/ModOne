import { create } from 'zustand';
import type { SymbolDefinition, SymbolSummary, LibraryScope } from '../types/symbol';
import * as symbolService from '../services/symbolService';

interface SymbolStoreState {
  projectSymbols: SymbolSummary[];
  globalSymbols: SymbolSummary[];
  currentSymbol: SymbolDefinition | null;
  isLoading: boolean;
  error: string | null;

  /** Open the Symbol Editor in a new floating window */
  openEditor: (symbol?: SymbolDefinition | null) => void;
  /** @deprecated Modal editor is replaced by floating window panel */
  closeEditor: () => void;
}

export const useSymbolStore = create<SymbolStoreState>((set) => ({
  projectSymbols: [],
  globalSymbols: [],
  currentSymbol: null,
  isLoading: false,
  error: null,

  loadLibrary: async (projectDir: string) => {
    set({ isLoading: true, error: null });
    try {
      const [projectSymbols, globalSymbols] = await Promise.all([
        symbolService.listSymbols(projectDir, 'project'),
        symbolService.listSymbols(projectDir, 'global'),
      ]);
      set({ projectSymbols, globalSymbols, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  loadSymbol: async (projectDir: string, id: string, scope: LibraryScope) => {
    set({ isLoading: true, error: null });
    try {
      const symbol = await symbolService.loadSymbol(projectDir, id, scope);
      set({ currentSymbol: symbol, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  saveSymbol: async (projectDir: string, symbol: SymbolDefinition, scope: LibraryScope) => {
    set({ isLoading: true, error: null });
    try {
      await symbolService.saveSymbol(projectDir, symbol, scope);

      const symbols = await symbolService.listSymbols(projectDir, scope);
      if (scope === 'project') {
        set({ projectSymbols: symbols, isLoading: false });
      } else {
        set({ globalSymbols: symbols, isLoading: false });
      }
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  deleteSymbol: async (projectDir: string, id: string, scope: LibraryScope) => {
    set({ isLoading: true, error: null });
    try {
      await symbolService.deleteSymbol(projectDir, id, scope);
      const symbols = await symbolService.listSymbols(projectDir, scope);
      if (scope === 'project') {
        set({ projectSymbols: symbols, isLoading: false });
      } else {
        set({ globalSymbols: symbols, isLoading: false });
      }
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  setCurrentSymbol: (symbol: SymbolDefinition | null) => set({ currentSymbol: symbol }),
  clearError: () => set({ error: null }),

  openEditor: async (symbol: SymbolDefinition | null = null) => {
    // Dynamically import to avoid circular dependency if any
    const { usePanelStore } = await import('./panelStore');
    const panelStore = usePanelStore.getState();

    // 1. Create a transient panel to hold the editor
    // We use a dummy grid area since it will be undocked immediately
    const panelId = panelStore.addPanel('symbol-editor', '1 / 1 / 2 / 2');

    // 2. Add a tab with the symbol data
    panelStore.addTab(panelId, 'symbol-editor', symbol?.name || 'New Symbol', { symbol });

    // 3. Undock it into a floating window
    await panelStore.undockPanel(panelId, {
      x: 100,
      y: 100,
      width: 1000,
      height: 800,
    });
  },
  closeEditor: () => {
    // No-op - removed modal editor
  },
}));
