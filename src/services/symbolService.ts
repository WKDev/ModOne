import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import type { SymbolDefinition, SymbolSummary, LibraryScope } from '../types/symbol';

export async function saveSymbol(
  projectDir: string,
  symbol: SymbolDefinition,
  scope: LibraryScope
): Promise<void> {
  try {
    await invoke('symbol_save', { projectDir, symbol, scope });
  } catch (error) {
    toast.error('Failed to save symbol', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function loadSymbol(
  projectDir: string,
  id: string,
  scope: LibraryScope
): Promise<SymbolDefinition> {
  try {
    return await invoke<SymbolDefinition>('symbol_load', { projectDir, id, scope });
  } catch (error) {
    toast.error('Failed to load symbol', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function deleteSymbol(
  projectDir: string,
  id: string,
  scope: LibraryScope
): Promise<void> {
  try {
    await invoke('symbol_delete', { projectDir, id, scope });
  } catch (error) {
    toast.error('Failed to delete symbol', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function listSymbols(
  projectDir: string,
  scope: LibraryScope
): Promise<SymbolSummary[]> {
  try {
    return await invoke<SymbolSummary[]>('symbol_list', { projectDir, scope });
  } catch (error) {
    toast.error('Failed to list symbols', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function listAllSymbols(projectDir: string): Promise<SymbolSummary[]> {
  try {
    return await invoke<SymbolSummary[]>('symbol_list_all', { projectDir });
  } catch (error) {
    toast.error('Failed to list all symbols', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
