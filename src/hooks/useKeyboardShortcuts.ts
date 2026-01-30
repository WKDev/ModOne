/**
 * useKeyboardShortcuts Hook
 *
 * Handles global keyboard shortcuts for the application.
 */

import { useEffect, useCallback } from 'react';

interface KeyboardShortcutCallbacks {
  onNewProject?: () => void;
  onOpenProject?: () => void;
  onSaveProject?: () => void;
  onSaveProjectAs?: () => void;
  onSaveAll?: () => void;
  onCloseProject?: () => void;
  onOpenSettings?: () => void;
}

/**
 * Check if the event target is an input element
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
 * Hook for handling global keyboard shortcuts
 */
export function useKeyboardShortcuts({
  onNewProject,
  onOpenProject,
  onSaveProject,
  onSaveProjectAs,
  onSaveAll,
  onCloseProject,
  onOpenSettings,
}: KeyboardShortcutCallbacks) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if typing in an input field
      if (isInputElement(e.target)) {
        // Still allow Ctrl+S in inputs for saving
        if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) {
          return;
        }
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (!isCtrlOrCmd) return;

      switch (e.key.toLowerCase()) {
        case 'n':
          // Ctrl+N: New Project
          if (onNewProject) {
            e.preventDefault();
            onNewProject();
          }
          break;

        case 'o':
          // Ctrl+O: Open Project
          if (onOpenProject) {
            e.preventDefault();
            onOpenProject();
          }
          break;

        case 's':
          if (e.altKey) {
            // Ctrl+Alt+S: Save All
            if (onSaveAll) {
              e.preventDefault();
              onSaveAll();
            }
          } else if (e.shiftKey) {
            // Ctrl+Shift+S: Save As
            if (onSaveProjectAs) {
              e.preventDefault();
              onSaveProjectAs();
            }
          } else {
            // Ctrl+S: Save
            if (onSaveProject) {
              e.preventDefault();
              onSaveProject();
            }
          }
          break;

        case 'w':
          // Ctrl+W: Close Project
          if (onCloseProject) {
            e.preventDefault();
            onCloseProject();
          }
          break;

        case ',':
          // Ctrl+,: Open Settings
          if (onOpenSettings) {
            e.preventDefault();
            onOpenSettings();
          }
          break;
      }
    },
    [onNewProject, onOpenProject, onSaveProject, onSaveProjectAs, onSaveAll, onCloseProject, onOpenSettings]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useKeyboardShortcuts;
