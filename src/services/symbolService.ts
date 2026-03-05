import { invoke } from '@tauri-apps/api/core';
import type { SymbolDefinition, SymbolSummary, LibraryScope } from '../types/symbol';

export async function saveSymbol(
  projectDir: string,
  symbol: SymbolDefinition,
  scope: LibraryScope
): Promise<void> {
  await invoke('symbol_save', { projectDir, symbol, scope });
}

export async function loadSymbol(
  projectDir: string,
  id: string,
  scope: LibraryScope
): Promise<SymbolDefinition> {
  return await invoke<SymbolDefinition>('symbol_load', { projectDir, id, scope });
}

export async function deleteSymbol(
  projectDir: string,
  id: string,
  scope: LibraryScope
): Promise<void> {
  await invoke('symbol_delete', { projectDir, id, scope });
}

export async function listSymbols(
  projectDir: string,
  scope: LibraryScope
): Promise<SymbolSummary[]> {
  return await invoke<SymbolSummary[]>('symbol_list', { projectDir, scope });
}

export async function listAllSymbols(projectDir: string): Promise<SymbolSummary[]> {
  return await invoke<SymbolSummary[]>('symbol_list_all', { projectDir });
}
