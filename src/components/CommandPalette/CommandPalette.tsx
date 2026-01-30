/**
 * CommandPalette Component
 *
 * Modal-style command palette for quick access to application commands.
 * Supports keyboard navigation, fuzzy search, and category grouping.
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type KeyboardEvent,
} from 'react';
import { Search, X } from 'lucide-react';
import type { Command, CommandCategory } from './types';
import { useCommandRegistry } from './useCommandRegistry';
import { CommandSection } from './CommandSection';
import { CommandItem } from './CommandItem';

/**
 * Props for the CommandPalette component.
 */
export interface CommandPaletteProps {
  /** Whether the palette is currently open */
  isOpen: boolean;
  /** Callback when the palette should be closed */
  onClose: () => void;
  /** Optional placeholder text for the search input */
  placeholder?: string;
  /** Maximum number of recent commands to show */
  maxRecentCommands?: number;
}

/**
 * Groups commands by category.
 */
function groupCommandsByCategory(
  commands: Command[]
): Map<CommandCategory, Command[]> {
  const groups = new Map<CommandCategory, Command[]>();

  for (const command of commands) {
    const existing = groups.get(command.category) || [];
    existing.push(command);
    groups.set(command.category, existing);
  }

  return groups;
}

/**
 * Command Palette modal component.
 *
 * Features:
 * - Fuzzy search across all commands
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Category grouping with section headers
 * - Recent commands section
 * - Modal overlay with click-outside-to-close
 */
export function CommandPalette({
  isOpen,
  onClose,
  placeholder = 'Search commands...',
  maxRecentCommands = 5,
}: CommandPaletteProps) {
  const { commands, search, execute, recentCommands } = useCommandRegistry();

  // Local state
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement | null>());

  // Filter commands based on search query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show all available commands when no query
      return commands.filter((cmd) => !cmd.when || cmd.when());
    }
    return search(query).map((result) => result.command);
  }, [query, commands, search]);

  // Get recent commands (only when no query)
  const visibleRecentCommands = useMemo(() => {
    if (query.trim()) return [];
    return recentCommands
      .filter((cmd) => !cmd.when || cmd.when())
      .slice(0, maxRecentCommands);
  }, [query, recentCommands, maxRecentCommands]);

  // Group filtered commands by category
  const groupedCommands = useMemo(() => {
    return groupCommandsByCategory(filteredCommands);
  }, [filteredCommands]);

  // Flatten commands for keyboard navigation
  const flattenedCommands = useMemo(() => {
    const result: Command[] = [];

    // Add recent commands first if showing
    if (visibleRecentCommands.length > 0) {
      result.push(...visibleRecentCommands);
    }

    // Add grouped commands (skip if already in recent)
    const recentIds = new Set(visibleRecentCommands.map((c) => c.id));
    for (const [_category, cmds] of groupedCommands) {
      for (const cmd of cmds) {
        if (!recentIds.has(cmd.id)) {
          result.push(cmd);
        }
      }
    }

    return result;
  }, [visibleRecentCommands, groupedCommands]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after a brief delay to ensure DOM is ready
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!isOpen) return;
    const selectedCommand = flattenedCommands[selectedIndex];
    if (selectedCommand) {
      const element = itemRefs.current.get(selectedCommand.id);
      if (element) {
        element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, flattenedCommands, isOpen]);

  // Handle command execution
  const handleExecute = useCallback(
    (command: Command) => {
      execute(command.id);
      onClose();
    },
    [execute, onClose]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev < flattenedCommands.length - 1 ? prev + 1 : 0
          );
          break;

        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : flattenedCommands.length - 1
          );
          break;

        case 'Enter':
          event.preventDefault();
          if (flattenedCommands[selectedIndex]) {
            handleExecute(flattenedCommands[selectedIndex]);
          }
          break;

        case 'Escape':
          event.preventDefault();
          onClose();
          break;

        case 'Home':
          event.preventDefault();
          setSelectedIndex(0);
          break;

        case 'End':
          event.preventDefault();
          setSelectedIndex(Math.max(0, flattenedCommands.length - 1));
          break;
      }
    },
    [flattenedCommands, selectedIndex, handleExecute, onClose]
  );

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) {
    return null;
  }

  const selectedCommand = flattenedCommands[selectedIndex];

  return (
    <div
      className="
        fixed inset-0 z-50 flex items-start justify-center
        bg-black/50 backdrop-blur-sm pt-[15vh]
      "
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="
          w-full max-w-lg bg-neutral-800 rounded-lg shadow-2xl
          border border-neutral-700 overflow-hidden
        "
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-700">
          <Search className="w-5 h-5 text-neutral-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="
              flex-1 bg-transparent text-neutral-100 placeholder-neutral-500
              outline-none text-sm
            "
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="command-list"
            aria-activedescendant={selectedCommand?.id}
          />
          <button
            onClick={onClose}
            className="
              p-1 rounded text-neutral-400 hover:text-neutral-200
              hover:bg-neutral-700 transition-colors
            "
            aria-label="Close command palette"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command List */}
        <div
          ref={listRef}
          id="command-list"
          className="max-h-[50vh] overflow-y-auto"
          role="listbox"
        >
          {flattenedCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-neutral-400 text-sm">
              No commands found
            </div>
          ) : (
            <>
              {/* Recent Commands Section */}
              {visibleRecentCommands.length > 0 && (
                <div role="group" aria-label="Recent commands">
                  <div
                    className="
                      px-3 py-1.5 text-xs font-medium text-neutral-400
                      uppercase tracking-wider bg-neutral-800/50
                      sticky top-0 z-10
                    "
                  >
                    Recent
                  </div>
                  <div>
                    {visibleRecentCommands.map((command) => (
                      <CommandItem
                        key={`recent-${command.id}`}
                        ref={(el) => {
                          itemRefs.current.set(command.id, el);
                        }}
                        command={command}
                        isSelected={selectedCommand?.id === command.id}
                        onClick={() => handleExecute(command)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Grouped Commands */}
              {Array.from(groupedCommands.entries())
                .filter(([_category, cmds]) => {
                  // Skip commands already shown in recent
                  const recentIds = new Set(
                    visibleRecentCommands.map((c) => c.id)
                  );
                  return cmds.some((cmd) => !recentIds.has(cmd.id));
                })
                .map(([category, cmds]) => {
                  const recentIds = new Set(
                    visibleRecentCommands.map((c) => c.id)
                  );
                  const filteredCmds = cmds.filter(
                    (cmd) => !recentIds.has(cmd.id)
                  );

                  return (
                    <CommandSection
                      key={category}
                      category={category}
                      commands={filteredCmds}
                      selectedId={selectedCommand?.id || null}
                      onCommandClick={handleExecute}
                      itemRefs={itemRefs.current}
                    />
                  );
                })}
            </>
          )}
        </div>

        {/* Footer with hints */}
        <div
          className="
            px-4 py-2 border-t border-neutral-700
            flex items-center gap-4 text-xs text-neutral-500
          "
        >
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-neutral-700 rounded text-neutral-400">
              ↑↓
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-neutral-700 rounded text-neutral-400">
              ↵
            </kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-neutral-700 rounded text-neutral-400">
              Esc
            </kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
