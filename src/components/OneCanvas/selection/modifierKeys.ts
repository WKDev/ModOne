/**
 * Modifier Key Utilities
 *
 * Centralized logic for interpreting modifier key combinations in selection operations.
 * Ensures consistent behavior across all handlers.
 */

/**
 * Check if toggle selection modifier is pressed (Ctrl on Windows/Linux, Cmd on Mac)
 * Used for: toggle individual item in/out of selection
 */
export function isToggleSelection(e: MouseEvent | React.MouseEvent): boolean {
  return e.ctrlKey || e.metaKey;
}

/**
 * Check if add to selection modifier is pressed (Shift)
 * Used for: add item to existing selection without deselecting others
 */
export function isAddToSelection(e: MouseEvent | React.MouseEvent): boolean {
  return e.shiftKey;
}

/**
 * Check if range selection modifier is pressed (Shift without Ctrl/Cmd)
 * Used for: select range of items (e.g., from last selected to current)
 */
export function isRangeSelection(e: MouseEvent | React.MouseEvent): boolean {
  return e.shiftKey && !e.ctrlKey && !e.metaKey;
}

/**
 * Check if any modifier key is pressed
 * Used for: determining if click should modify existing selection
 */
export function hasModifier(e: MouseEvent | React.MouseEvent): boolean {
  return e.ctrlKey || e.metaKey || e.shiftKey;
}
