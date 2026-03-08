import { create } from 'zustand';
import type { SymbolDefinition, SymbolSummary, LibraryScope } from '../types/symbol';
import * as symbolService from '../services/symbolService';

interface SymbolStoreState {
  projectSymbols: SymbolSummary[];
  globalSymbols: SymbolSummary[];
  currentSymbol: SymbolDefinition | null;
  isLoading: boolean;
  error: string | null;

  /** Symbol Editor popup state */
  editorOpen: boolean;
  editorSymbol: SymbolDefinition | null;

  loadLibrary: (projectDir: string) => Promise<void>;
  loadSymbol: (projectDir: string, id: string, scope: LibraryScope) => Promise<void>;
  saveSymbol: (projectDir: string, symbol: SymbolDefinition, scope: LibraryScope) => Promise<void>;
  deleteSymbol: (projectDir: string, id: string, scope: LibraryScope) => Promise<void>;
  setCurrentSymbol: (symbol: SymbolDefinition | null) => void;
  clearError: () => void;

  /** Open the Symbol Editor popup, optionally with a symbol to edit */
  openEditor: (symbol?: SymbolDefinition | null) => void;
  /** Close the Symbol Editor popup */
  closeEditor: () => void;
}

export const useSymbolStore = create<SymbolStoreState>((set) => ({
  projectSymbols: [],
  globalSymbols: [],
  currentSymbol: null,
  isLoading: false,
  error: null,

  loadLibrary: async (projectDir) => {
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

  loadSymbol: async (projectDir, id, scope) => {
    set({ isLoading: true, error: null });
    try {
      const symbol = await symbolService.loadSymbol(projectDir, id, scope);
      set({ currentSymbol: symbol, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  saveSymbol: async (projectDir, symbol, scope) => {
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

  deleteSymbol: async (projectDir, id, scope) => {
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

  setCurrentSymbol: (symbol) => set({ currentSymbol: symbol }),
  clearError: () => set({ error: null }),

  editorOpen: false,
  editorSymbol: null,
  openEditor: (symbol) => set({ editorOpen: true, editorSymbol: symbol ?? null }),
  closeEditor: () => set({ editorOpen: false, editorSymbol: null }),
}));
