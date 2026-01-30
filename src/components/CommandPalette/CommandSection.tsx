/**
 * CommandSection Component
 *
 * Groups commands by category with a section header.
 * Used to organize commands in the command palette.
 */

import { memo, forwardRef, useImperativeHandle, useRef, useCallback } from 'react';
import type { Command, CommandCategory } from './types';
import { CATEGORY_LABELS } from './types';
import { CommandItem } from './CommandItem';

/**
 * Props for the CommandSection component.
 */
export interface CommandSectionProps {
  /** Category identifier */
  category: CommandCategory;
  /** Commands in this section */
  commands: Command[];
  /** Currently selected command ID */
  selectedId: string | null;
  /** Handler when a command is clicked */
  onCommandClick: (command: Command) => void;
  /** Map of command refs for scrollIntoView */
  itemRefs: Map<string, HTMLDivElement | null>;
}

/**
 * Handle for imperative actions on the section.
 */
export interface CommandSectionHandle {
  /** Scroll a specific command into view */
  scrollToCommand: (commandId: string) => void;
}

/**
 * Renders a section of commands grouped by category.
 *
 * Features:
 * - Section header with category name
 * - List of CommandItem components
 * - Manages refs for each item for keyboard navigation
 */
export const CommandSection = memo(
  forwardRef<CommandSectionHandle, CommandSectionProps>(function CommandSection(
    { category, commands, selectedId, onCommandClick, itemRefs },
    ref
  ) {
    const sectionRef = useRef<HTMLDivElement>(null);

    // Set up imperative handle for parent access
    useImperativeHandle(
      ref,
      () => ({
        scrollToCommand: (commandId: string) => {
          const element = itemRefs.get(commandId);
          if (element) {
            element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        },
      }),
      [itemRefs]
    );

    // Callback to register item refs
    const setItemRef = useCallback(
      (commandId: string) => (element: HTMLDivElement | null) => {
        itemRefs.set(commandId, element);
      },
      [itemRefs]
    );

    if (commands.length === 0) {
      return null;
    }

    return (
      <div ref={sectionRef} role="group" aria-label={CATEGORY_LABELS[category]}>
        {/* Section Header */}
        <div
          className="
            px-3 py-1.5 text-xs font-medium text-neutral-400
            uppercase tracking-wider bg-neutral-800/50
            sticky top-0 z-10
          "
        >
          {CATEGORY_LABELS[category]}
        </div>

        {/* Command Items */}
        <div role="listbox">
          {commands.map((command) => (
            <CommandItem
              key={command.id}
              ref={setItemRef(command.id)}
              command={command}
              isSelected={selectedId === command.id}
              onClick={() => onCommandClick(command)}
            />
          ))}
        </div>
      </div>
    );
  })
);

CommandSection.displayName = 'CommandSection';

export default CommandSection;
