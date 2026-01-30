/**
 * CommandItem Component
 *
 * Individual command item displayed in the command palette.
 * Shows command icon, label, and keyboard shortcut.
 */

import { forwardRef, memo } from 'react';
import type { Command } from './types';

/**
 * Props for the CommandItem component.
 */
export interface CommandItemProps {
  /** The command to display */
  command: Command;
  /** Whether this item is currently selected */
  isSelected: boolean;
  /** Click handler for executing the command */
  onClick: () => void;
}

/**
 * Renders a single command item in the command palette.
 *
 * Features:
 * - Displays command icon, label, and optional shortcut
 * - Highlights when selected for keyboard navigation
 * - Supports ref forwarding for scrollIntoView
 * - Accessible with proper ARIA attributes
 */
export const CommandItem = memo(
  forwardRef<HTMLDivElement, CommandItemProps>(function CommandItem(
    { command, isSelected, onClick },
    ref
  ) {
    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isSelected}
        onClick={onClick}
        className={`
          px-3 py-2 flex items-center gap-3 cursor-pointer
          transition-colors duration-75
          ${isSelected ? 'bg-neutral-600' : 'hover:bg-neutral-700'}
        `}
      >
        {/* Command Icon */}
        {command.icon && (
          <span className="w-4 h-4 flex-shrink-0 text-neutral-400">
            {command.icon}
          </span>
        )}

        {/* Command Label and Description */}
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm text-neutral-100">{command.label}</div>
          {command.description && (
            <div className="truncate text-xs text-neutral-400">
              {command.description}
            </div>
          )}
        </div>

        {/* Keyboard Shortcut Badge */}
        {command.shortcut && (
          <kbd
            className="
              flex-shrink-0 px-1.5 py-0.5 text-xs font-mono
              bg-neutral-700 text-neutral-300 rounded
              border border-neutral-600
            "
          >
            {command.shortcut}
          </kbd>
        )}
      </div>
    );
  })
);

CommandItem.displayName = 'CommandItem';

export default CommandItem;
