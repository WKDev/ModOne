/**
 * useCommandRegistry Hook
 *
 * React hook for interacting with the command registry.
 * Provides reactive access to commands and search functionality.
 */

import { useSyncExternalStore, useCallback, useMemo } from 'react';
import { commandRegistry } from './commandRegistry';
import type { Command, CommandCategory, CommandSearchOptions, CommandSearchResult } from './types';

/**
 * Hook return type for useCommandRegistry.
 */
export interface UseCommandRegistryResult {
  /** All available commands */
  commands: Command[];
  /** Recently executed commands */
  recentCommands: Command[];
  /** Search for commands */
  search: (query: string, options?: CommandSearchOptions) => CommandSearchResult[];
  /** Execute a command by ID */
  execute: (commandId: string) => Promise<void>;
  /** Get commands by category */
  getByCategory: (category: CommandCategory) => Command[];
  /** Check if a command exists */
  has: (commandId: string) => boolean;
  /** Get a specific command */
  get: (commandId: string) => Command | undefined;
}

/**
 * Subscribe function for useSyncExternalStore.
 */
const subscribe = (callback: () => void) => {
  return commandRegistry.subscribe(callback);
};

/**
 * Get snapshot of all commands.
 */
const getSnapshot = () => {
  return commandRegistry.getAll();
};

/**
 * Get snapshot of recent commands.
 */
const getRecentSnapshot = () => {
  return commandRegistry.getRecent();
};

/**
 * Hook for accessing the command registry with reactive updates.
 * Re-renders component when commands are registered, unregistered, or executed.
 */
export function useCommandRegistry(): UseCommandRegistryResult {
  // Subscribe to command changes
  const commands = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const recentCommands = useSyncExternalStore(subscribe, getRecentSnapshot, getRecentSnapshot);

  // Memoized search function
  const search = useCallback(
    (query: string, options?: CommandSearchOptions): CommandSearchResult[] => {
      return commandRegistry.search(query, options);
    },
    []
  );

  // Memoized execute function
  const execute = useCallback(async (commandId: string): Promise<void> => {
    await commandRegistry.execute(commandId);
  }, []);

  // Memoized getByCategory function
  const getByCategory = useCallback((category: CommandCategory): Command[] => {
    return commandRegistry.getByCategory(category);
  }, []);

  // Memoized has function
  const has = useCallback((commandId: string): boolean => {
    return commandRegistry.has(commandId);
  }, []);

  // Memoized get function
  const get = useCallback((commandId: string): Command | undefined => {
    return commandRegistry.get(commandId);
  }, []);

  return useMemo(
    () => ({
      commands,
      recentCommands,
      search,
      execute,
      getByCategory,
      has,
      get,
    }),
    [commands, recentCommands, search, execute, getByCategory, has, get]
  );
}

/**
 * Hook for searching commands with debouncing support.
 * @param query Search query string
 * @param options Search options
 */
export function useCommandSearch(
  query: string,
  options?: CommandSearchOptions
): CommandSearchResult[] {
  // Subscribe to ensure we get updates when commands change
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return useMemo(() => {
    return commandRegistry.search(query, options);
  }, [query, options]);
}

/**
 * Hook for getting recent commands.
 * @param limit Maximum number of recent commands to return
 */
export function useRecentCommands(limit = 5): Command[] {
  const recentCommands = useSyncExternalStore(subscribe, getRecentSnapshot, getRecentSnapshot);
  return useMemo(() => recentCommands.slice(0, limit), [recentCommands, limit]);
}

export default useCommandRegistry;
