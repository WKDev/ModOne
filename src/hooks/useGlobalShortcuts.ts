/**
 * useGlobalShortcuts Hook
 *
 * Unified keyboard shortcut handler that replaces scattered addEventListener calls.
 * Reads default shortcuts from CommandRegistry and user overrides from settingsStore.
 * Single keydown listener dispatches to matching commands.
 */

import { useEffect, useCallback, useRef } from 'react';
import { commandRegistry } from '../components/CommandPalette/commandRegistry';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Check if the event target is an input element where most shortcuts should be suppressed.
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target) return false;
  const element = target as HTMLElement;
  const tagName = element.tagName?.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.isContentEditable
  );
}

/**
 * Commands that should still fire even when focus is in an input field.
 */
const ALLOW_IN_INPUT = new Set([
  'file.save',
  'file.saveAs',
  'file.saveAll',
]);

/**
 * Parse a shortcut string like "Ctrl+Shift+S" into a structured descriptor.
 */
function parseShortcut(shortcut: string): {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string;
} | null {
  // Skip chord shortcuts like "Ctrl+K Ctrl+S" for now
  if (shortcut.includes(' ')) return null;

  const parts = shortcut.split('+');
  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1).map((m) => m.toLowerCase());

  return {
    ctrl: modifiers.includes('ctrl'),
    shift: modifiers.includes('shift'),
    alt: modifiers.includes('alt'),
    meta: modifiers.includes('meta'),
    key: key.toLowerCase(),
  };
}

/**
 * Normalize the key value from a keyboard event for comparison.
 */
function normalizeEventKey(e: KeyboardEvent): string {
  let key = e.key.toLowerCase();

  // Map special key names
  if (key === ' ') return 'space';
  if (key === 'escape') return 'escape';
  if (key === 'delete') return 'delete';
  if (key === 'backspace') return 'backspace';
  if (key === 'enter') return 'enter';

  return key;
}

/**
 * Check if a keyboard event matches a parsed shortcut descriptor.
 */
function matchesShortcut(
  e: KeyboardEvent,
  parsed: { ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; key: string }
): boolean {
  const ctrlOrCmd = e.ctrlKey || e.metaKey;

  if (parsed.ctrl !== ctrlOrCmd) return false;
  if (parsed.shift !== e.shiftKey) return false;
  if (parsed.alt !== e.altKey) return false;

  const eventKey = normalizeEventKey(e);
  return eventKey === parsed.key;
}

interface ShortcutEntry {
  commandId: string;
  shortcut: string;
  parsed: NonNullable<ReturnType<typeof parseShortcut>>;
}

/**
 * Hook for unified global keyboard shortcut handling.
 * Reads overrides from settingsStore and dispatches to commandRegistry.
 */
export function useGlobalShortcuts(): void {
  const overridesRef = useRef<Record<string, string>>({});

  // Keep overrides ref in sync with settings
  useEffect(() => {
    const update = () => {
      overridesRef.current = useSettingsStore.getState().getMergedSettings().keybindingOverrides;
    };
    update();
    return useSettingsStore.subscribe(update);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't intercept keys when recording shortcuts in settings
    const target = e.target as HTMLElement;
    if (target.closest('[data-shortcut-recorder]')) return;

    const inInput = isInputElement(e.target);
    const overrides = overridesRef.current;

    // Build effective shortcuts from registry + overrides
    const entries: ShortcutEntry[] = [];
    const allCommands = commandRegistry.getAll();

    for (const cmd of allCommands) {
      const shortcutStr = overrides[cmd.id] || cmd.shortcut;
      if (!shortcutStr) continue;

      const parsed = parseShortcut(shortcutStr);
      if (!parsed) continue;

      entries.push({ commandId: cmd.id, shortcut: shortcutStr, parsed });
    }

    // Find matching command
    for (const entry of entries) {
      if (!matchesShortcut(e, entry.parsed)) continue;

      // Skip if in input and command doesn't allow it
      if (inInput && !ALLOW_IN_INPUT.has(entry.commandId)) continue;

      // Check command availability
      const cmd = commandRegistry.get(entry.commandId);
      if (!cmd) continue;
      if (cmd.when && !cmd.when()) continue;

      e.preventDefault();
      commandRegistry.execute(entry.commandId);
      return;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleKeyDown]);
}

/**
 * Get the effective shortcut string for a command (override > default).
 * Useful for display purposes (CommandPalette, tooltips).
 */
export function getEffectiveShortcut(
  commandId: string,
  overrides: Record<string, string>
): string | undefined {
  if (overrides[commandId]) return overrides[commandId];
  const cmd = commandRegistry.get(commandId);
  return cmd?.shortcut;
}

export default useGlobalShortcuts;
