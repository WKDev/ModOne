/**
 * Command Palette Types
 *
 * Types for the command registry and command palette system.
 */

import type { ReactNode } from 'react';

/**
 * Categories for organizing commands.
 * Each category groups related commands in the palette.
 */
export type CommandCategory =
  | 'file'
  | 'edit'
  | 'view'
  | 'simulation'
  | 'modbus'
  | 'ladder'
  | 'canvas'
  | 'scenario'
  | 'debug'
  | 'settings'
  | 'help';

/**
 * Represents a command that can be executed from the command palette.
 */
export interface Command {
  /** Unique identifier for the command (e.g., 'file.save', 'edit.undo') */
  id: string;
  /** Category for grouping commands */
  category: CommandCategory;
  /** Display label shown in the palette */
  label: string;
  /** Optional description for additional context */
  description?: string;
  /** Optional icon to display next to the command */
  icon?: ReactNode;
  /** Keyboard shortcut string (e.g., 'Ctrl+S', 'Ctrl+Shift+P') */
  shortcut?: string;
  /** Additional keywords for search matching */
  keywords?: string[];
  /**
   * Condition function that determines if command should be visible.
   * If not provided, command is always available.
   * @returns true if command should be shown, false otherwise
   */
  when?: () => boolean;
  /**
   * Execute the command action.
   * Can be async for operations that need to await completion.
   */
  execute: () => void | Promise<void>;
}

/**
 * Result from command search with relevance scoring.
 */
export interface CommandSearchResult {
  /** The matching command */
  command: Command;
  /** Relevance score (higher = better match) */
  score: number;
}

/**
 * Options for command search.
 */
export interface CommandSearchOptions {
  /** Maximum number of results to return */
  limit?: number;
  /** Filter to specific categories */
  categories?: CommandCategory[];
  /** Include recent commands at top of results */
  includeRecent?: boolean;
}

/**
 * Human-readable labels for command categories.
 */
export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  file: 'File',
  edit: 'Edit',
  view: 'View',
  simulation: 'Simulation',
  modbus: 'Modbus',
  ladder: 'Ladder Editor',
  canvas: 'Canvas',
  scenario: 'Scenario',
  debug: 'Debug',
  settings: 'Settings',
  help: 'Help',
};

/**
 * Icons for command categories (using Lucide icon names).
 */
export const CATEGORY_ICONS: Record<CommandCategory, string> = {
  file: 'File',
  edit: 'Edit',
  view: 'Eye',
  simulation: 'Play',
  modbus: 'Network',
  ladder: 'LayoutGrid',
  canvas: 'Palette',
  scenario: 'ListTodo',
  debug: 'Bug',
  settings: 'Settings',
  help: 'HelpCircle',
};
