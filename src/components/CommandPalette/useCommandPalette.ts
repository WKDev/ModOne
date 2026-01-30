/**
 * useCommandPalette Hook
 *
 * Manages command palette open/close state and keyboard shortcut.
 * Provides a simple interface for toggling the command palette.
 */

import { useState, useCallback, useEffect } from 'react';

/**
 * Return type for useCommandPalette hook.
 */
export interface UseCommandPaletteReturn {
  /** Whether the command palette is currently open */
  isOpen: boolean;
  /** Open the command palette */
  open: () => void;
  /** Close the command palette */
  close: () => void;
  /** Toggle the command palette open/closed state */
  toggle: () => void;
}

/**
 * Options for configuring the command palette hook.
 */
export interface UseCommandPaletteOptions {
  /**
   * Keyboard shortcut to toggle the palette.
   * Default is 'Ctrl+Shift+P' (or 'Cmd+Shift+P' on Mac).
   */
  shortcut?: {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  };
  /** Whether the keyboard shortcut is enabled */
  enableShortcut?: boolean;
}

const DEFAULT_SHORTCUT: UseCommandPaletteOptions['shortcut'] = {
  key: 'p',
  ctrl: true,
  shift: true,
};

/**
 * Hook for managing command palette state and keyboard shortcuts.
 *
 * @param options Configuration options
 * @returns Object with isOpen state and control functions
 *
 * @example
 * ```tsx
 * function App() {
 *   const { isOpen, open, close } = useCommandPalette();
 *
 *   return (
 *     <>
 *       <button onClick={open}>Open Command Palette</button>
 *       <CommandPalette isOpen={isOpen} onClose={close} />
 *     </>
 *   );
 * }
 * ```
 */
export function useCommandPalette(
  options: UseCommandPaletteOptions = {}
): UseCommandPaletteReturn {
  const {
    shortcut = DEFAULT_SHORTCUT,
    enableShortcut = true,
  } = options;

  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Set up keyboard shortcut listener
  useEffect(() => {
    if (!enableShortcut || !shortcut) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

      // Check modifier keys
      const ctrlMatch = shortcut.ctrl
        ? isMac
          ? event.metaKey
          : event.ctrlKey
        : true;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      const metaMatch = shortcut.meta ? event.metaKey : true;

      // Check key
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

      if (ctrlMatch && shiftMatch && altMatch && metaMatch && keyMatch) {
        event.preventDefault();
        toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcut, enableShortcut, toggle]);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
}

export default useCommandPalette;
