/**
 * Canvas Interaction Constants
 *
 * Shared constants for mouse interaction logic across all canvas hooks.
 * Single source of truth to prevent inconsistent threshold values.
 */

/**
 * Minimum mouse movement in screen pixels before a drag is detected.
 * Used consistently across:
 * - useBlockDrag (block dragging)
 * - useSelectionHandler (drag-to-select)
 * - useMouseInteraction (generic mouse state machine)
 */
export const DRAG_THRESHOLD_PX = 5;
