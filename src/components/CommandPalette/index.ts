/**
 * Command Palette Module
 *
 * Exports command registry, types, and hooks for the command palette system.
 */

// Types
export type {
  Command,
  CommandCategory,
  CommandSearchResult,
  CommandSearchOptions,
} from './types';

export { CATEGORY_LABELS, CATEGORY_ICONS } from './types';

// Registry
export { commandRegistry } from './commandRegistry';
export type { default as CommandRegistry } from './commandRegistry';

// Hooks
export {
  useCommandRegistry,
  useCommandSearch,
  useRecentCommands,
} from './useCommandRegistry';
export type { UseCommandRegistryResult } from './useCommandRegistry';

export { useCommandPalette } from './useCommandPalette';
export type {
  UseCommandPaletteReturn,
  UseCommandPaletteOptions,
} from './useCommandPalette';

// Components
export { CommandItem } from './CommandItem';
export type { CommandItemProps } from './CommandItem';

export { CommandSection } from './CommandSection';
export type { CommandSectionProps, CommandSectionHandle } from './CommandSection';

export { CommandPalette } from './CommandPalette';
export type { CommandPaletteProps } from './CommandPalette';

// Command registration
export { registerAllCommands } from './commands';
