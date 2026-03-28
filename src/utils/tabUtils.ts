/**
 * Shared tab management utilities.
 *
 * Extracted from editorAreaStore and panelStore to eliminate
 * duplicate "next active tab" logic.
 */

/**
 * Determines which tab should become active after removing a tab.
 *
 * Strategy: if the removed tab was active, activate the tab at the same
 * index (or the last tab if the removed tab was last). If the removed tab
 * was not active, keep the current active tab.
 *
 * @param tabs        - The tab list *after* the tab has been removed.
 * @param removedIndex - The index the removed tab occupied in the original list.
 * @param currentActiveId - The currently active tab id (before removal).
 * @param removedTabId - The id of the tab being removed.
 * @returns The id of the tab that should be active, or null if no tabs remain.
 */
export function getNextActiveTabId(
  tabs: { id: string }[],
  removedIndex: number,
  currentActiveId: string | null | undefined,
  removedTabId: string,
): string | null {
  if (currentActiveId !== removedTabId) {
    return currentActiveId ?? null;
  }
  if (tabs.length === 0) {
    return null;
  }
  if (removedIndex >= tabs.length) {
    return tabs[tabs.length - 1].id;
  }
  return tabs[removedIndex].id;
}
