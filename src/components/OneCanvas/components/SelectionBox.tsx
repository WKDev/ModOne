/**
 * SelectionBox Component
 *
 * Visual indicator for drag-to-select operations on the canvas.
 * Renders a dashed rectangle between the start and end positions.
 */

import { memo } from 'react';
import type { Position } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface SelectionBoxState {
  /** Starting position of the drag */
  start: Position;
  /** Current/end position of the drag */
  end: Position;
}

interface SelectionBoxProps {
  /** Current selection box state (null when not dragging) */
  box: SelectionBoxState | null;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders the visual selection rectangle during drag-select operations.
 * Handles any drag direction (top-left to bottom-right, etc.).
 */
export const SelectionBox = memo(function SelectionBox({ box }: SelectionBoxProps) {
  if (!box) return null;

  // Calculate bounds regardless of drag direction
  const left = Math.min(box.start.x, box.end.x);
  const top = Math.min(box.start.y, box.end.y);
  const width = Math.abs(box.end.x - box.start.x);
  const height = Math.abs(box.end.y - box.start.y);

  // Don't render if too small (prevents accidental selections)
  if (width < 5 && height < 5) return null;

  return (
    <div
      className="pointer-events-none absolute border border-dashed border-blue-400 bg-blue-500/10"
      style={{
        left,
        top,
        width,
        height,
      }}
    />
  );
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a point is within the selection box.
 */
export function isPointInBox(point: Position, box: SelectionBoxState): boolean {
  const minX = Math.min(box.start.x, box.end.x);
  const maxX = Math.max(box.start.x, box.end.x);
  const minY = Math.min(box.start.y, box.end.y);
  const maxY = Math.max(box.start.y, box.end.y);

  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

/**
 * Check if a rectangle intersects with the selection box.
 */
export function doesRectIntersectBox(
  rect: { x: number; y: number; width: number; height: number },
  box: SelectionBoxState
): boolean {
  const boxMinX = Math.min(box.start.x, box.end.x);
  const boxMaxX = Math.max(box.start.x, box.end.x);
  const boxMinY = Math.min(box.start.y, box.end.y);
  const boxMaxY = Math.max(box.start.y, box.end.y);

  const rectMaxX = rect.x + rect.width;
  const rectMaxY = rect.y + rect.height;

  // Check for no intersection
  if (rectMaxX < boxMinX || rect.x > boxMaxX) return false;
  if (rectMaxY < boxMinY || rect.y > boxMaxY) return false;

  return true;
}

export default SelectionBox;
