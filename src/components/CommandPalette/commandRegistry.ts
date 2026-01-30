/**
 * Command Registry
 *
 * Central registry for all commands that can be executed via the command palette.
 * Provides registration, search, and execution capabilities.
 */

import type { Command, CommandSearchOptions, CommandSearchResult } from './types';

/**
 * Registry for managing and executing commands.
 * Singleton instance exported as `commandRegistry`.
 */
class CommandRegistry {
  /** Map of command ID to Command */
  private commands: Map<string, Command> = new Map();

  /** Recently executed command IDs (most recent first) */
  private recentCommands: string[] = [];

  /** Maximum number of recent commands to track */
  private readonly MAX_RECENT = 10;

  /** Subscribers for registry changes */
  private subscribers: Set<() => void> = new Set();

  /** Cached snapshot of all commands (for useSyncExternalStore) */
  private cachedAllCommands: Command[] | null = null;

  /** Cached snapshot of recent commands base array */
  private cachedRecentCommands: Command[] | null = null;

  /** Cached sliced recent commands by limit (for useSyncExternalStore) */
  private cachedRecentByLimit: Map<number, Command[]> = new Map();

  /**
   * Register a command with the registry.
   * @param command The command to register
   */
  register(command: Command): void {
    this.commands.set(command.id, command);
    this.notifySubscribers();
  }

  /**
   * Register multiple commands at once.
   * @param commands Array of commands to register
   */
  registerAll(commands: Command[]): void {
    commands.forEach((cmd) => this.commands.set(cmd.id, cmd));
    this.notifySubscribers();
  }

  /**
   * Unregister a command from the registry.
   * @param commandId The ID of the command to remove
   */
  unregister(commandId: string): void {
    this.commands.delete(commandId);
    // Also remove from recent if present
    this.recentCommands = this.recentCommands.filter((id) => id !== commandId);
    this.notifySubscribers();
  }

  /**
   * Get a command by its ID.
   * @param commandId The ID of the command to retrieve
   * @returns The command if found, undefined otherwise
   */
  get(commandId: string): Command | undefined {
    return this.commands.get(commandId);
  }

  /**
   * Get all available commands (filtered by when() condition).
   * Returns a cached snapshot to prevent infinite loops with useSyncExternalStore.
   * @returns Array of all available commands
   */
  getAll(): Command[] {
    if (this.cachedAllCommands === null) {
      this.cachedAllCommands = Array.from(this.commands.values()).filter(
        (cmd) => !cmd.when || cmd.when()
      );
    }
    return this.cachedAllCommands;
  }

  /**
   * Get all commands by category.
   * @param category The category to filter by
   * @returns Array of commands in the specified category
   */
  getByCategory(category: string): Command[] {
    return this.getAll().filter((cmd) => cmd.category === category);
  }

  /**
   * Search for commands matching a query string.
   * Searches in label, keywords, category, and description.
   * @param query Search query string
   * @param options Search options
   * @returns Array of matching commands sorted by relevance
   */
  search(query: string, options: CommandSearchOptions = {}): CommandSearchResult[] {
    const { limit, categories, includeRecent = true } = options;
    const lowerQuery = query.toLowerCase().trim();

    // Get all available commands
    let availableCommands = this.getAll();

    // Filter by categories if specified
    if (categories && categories.length > 0) {
      availableCommands = availableCommands.filter((cmd) =>
        categories.includes(cmd.category)
      );
    }

    // If query is empty, return recent commands or all commands
    if (!lowerQuery) {
      if (includeRecent) {
        const recent = this.getRecent(limit || 10);
        return recent.map((cmd) => ({ command: cmd, score: 1 }));
      }
      const results = availableCommands.map((cmd) => ({ command: cmd, score: 0 }));
      return limit ? results.slice(0, limit) : results;
    }

    // Score and filter commands
    const scoredCommands: CommandSearchResult[] = [];

    for (const cmd of availableCommands) {
      const score = this.calculateMatchScore(cmd, lowerQuery);
      if (score > 0) {
        scoredCommands.push({ command: cmd, score });
      }
    }

    // Sort by score (descending)
    scoredCommands.sort((a, b) => b.score - a.score);

    // Apply limit
    return limit ? scoredCommands.slice(0, limit) : scoredCommands;
  }

  /**
   * Calculate match score for a command against a query.
   * Higher scores indicate better matches.
   */
  private calculateMatchScore(cmd: Command, query: string): number {
    let score = 0;
    const label = cmd.label.toLowerCase();
    const category = cmd.category.toLowerCase();
    const description = cmd.description?.toLowerCase() || '';
    const keywords = cmd.keywords?.map((k) => k.toLowerCase()) || [];

    // Exact label match (highest priority)
    if (label === query) {
      score += 100;
    }
    // Label starts with query
    else if (label.startsWith(query)) {
      score += 80;
    }
    // Label contains query
    else if (label.includes(query)) {
      score += 50;
    }

    // Category match
    if (category === query) {
      score += 30;
    } else if (category.includes(query)) {
      score += 15;
    }

    // Keyword matches
    for (const keyword of keywords) {
      if (keyword === query) {
        score += 40;
      } else if (keyword.startsWith(query)) {
        score += 25;
      } else if (keyword.includes(query)) {
        score += 10;
      }
    }

    // Description match (lowest priority)
    if (description.includes(query)) {
      score += 5;
    }

    // Boost recently used commands
    const recentIndex = this.recentCommands.indexOf(cmd.id);
    if (recentIndex !== -1) {
      score += Math.max(0, 20 - recentIndex * 2);
    }

    return score;
  }

  /**
   * Execute a command by its ID.
   * @param commandId The ID of the command to execute
   * @returns Promise that resolves when execution completes
   */
  async execute(commandId: string): Promise<void> {
    const cmd = this.commands.get(commandId);
    if (!cmd) {
      console.warn(`Command not found: ${commandId}`);
      return;
    }

    // Check if command is currently available
    if (cmd.when && !cmd.when()) {
      console.warn(`Command not available: ${commandId}`);
      return;
    }

    try {
      await cmd.execute();
      this.addToRecent(commandId);
    } catch (error) {
      console.error(`Error executing command ${commandId}:`, error);
      throw error;
    }
  }

  /**
   * Add a command to the recent commands list.
   * @param commandId The ID of the command to add
   */
  addToRecent(commandId: string): void {
    // Remove if already present (to move to front)
    this.recentCommands = this.recentCommands.filter((id) => id !== commandId);
    // Add to front
    this.recentCommands.unshift(commandId);
    // Trim to max size
    if (this.recentCommands.length > this.MAX_RECENT) {
      this.recentCommands = this.recentCommands.slice(0, this.MAX_RECENT);
    }
    this.notifySubscribers();
  }

  /**
   * Get recently executed commands.
   * Returns a cached snapshot to prevent infinite loops with useSyncExternalStore.
   * @param limit Maximum number of recent commands to return
   * @returns Array of recent commands (most recent first)
   */
  getRecent(limit = 5): Command[] {
    // Check if we have a cached slice for this limit
    const cachedSlice = this.cachedRecentByLimit.get(limit);
    if (cachedSlice !== undefined) {
      return cachedSlice;
    }

    // Build base cache if needed
    if (this.cachedRecentCommands === null) {
      this.cachedRecentCommands = this.recentCommands
        .slice(0, this.MAX_RECENT)
        .map((id) => this.commands.get(id))
        .filter((cmd): cmd is Command => cmd !== undefined && (!cmd.when || cmd.when()));
    }

    // Cache and return the sliced version
    const sliced = this.cachedRecentCommands.slice(0, limit);
    this.cachedRecentByLimit.set(limit, sliced);
    return sliced;
  }

  /**
   * Clear all recent commands.
   */
  clearRecent(): void {
    this.recentCommands = [];
    this.notifySubscribers();
  }

  /**
   * Subscribe to registry changes.
   * @param callback Function to call when registry changes
   * @returns Unsubscribe function
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers of a change.
   * Invalidates caches to ensure fresh data on next snapshot.
   */
  private notifySubscribers(): void {
    // Invalidate caches when data changes
    this.cachedAllCommands = null;
    this.cachedRecentCommands = null;
    this.cachedRecentByLimit.clear();
    this.subscribers.forEach((callback) => callback());
  }

  /**
   * Get the total number of registered commands.
   */
  get size(): number {
    return this.commands.size;
  }

  /**
   * Check if a command is registered.
   * @param commandId The ID to check
   */
  has(commandId: string): boolean {
    return this.commands.has(commandId);
  }

  /**
   * Clear all commands from the registry.
   * Primarily for testing purposes.
   */
  clear(): void {
    this.commands.clear();
    this.recentCommands = [];
    this.cachedAllCommands = null;
    this.cachedRecentCommands = null;
    this.cachedRecentByLimit.clear();
    this.notifySubscribers();
  }
}

/** Singleton command registry instance */
export const commandRegistry = new CommandRegistry();

export default commandRegistry;
