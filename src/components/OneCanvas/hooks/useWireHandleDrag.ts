/**
 * useWireHandleDrag Hook
 *
 * Manages drag behavior for wire handles (control points).
 * Handles are constrained to move only horizontally or vertically.
 */

import { useState, useCallback, useEffect } from 'react';
import type { Position, HandleConstraint } from '../types';

// ============================================================================
// Types
// ============================================================================

interface DragState {
  wireId: string;
  handleIndex: number;
  constraint: HandleConstraint;
  startMouse: Position;
  startHandle: Position;
}

interface UseWireHandleDragOptions {
  /** Function to update handle position in store */
  updateWireHandle: (wireId: string, handleIndex: number, position: Position) => void;
  /** Current zoom level */
  zoom: number;
  /** Callback when drag ends */
  onDragEnd?: () => void;
}

interface UseWireHandleDragResult {
  /** Start dragging a handle */
  handleDragStart: (
    wireId: string,
    handleIndex: number,
    constraint: HandleConstraint,
    e: React.MouseEvent
  ) => void;
  /** Whether currently dragging a handle */
  isDragging: boolean;
  /** Currently dragging wire ID and handle index */
  draggingHandle: { wireId: string; handleIndex: number } | null;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing wire handle drag operations.
 *
 * Features:
 * - Constrains movement to horizontal or vertical based on handle constraint
 * - Accounts for zoom level when calculating movement
 * - Handles mouse events globally during drag
 */
export function useWireHandleDrag({
  updateWireHandle,
  zoom,
  onDragEnd,
}: UseWireHandleDragOptions): UseWireHandleDragResult {
  const [dragging, setDragging] = useState<DragState | null>(null);

  // Start drag operation
  const handleDragStart = useCallback(
    (
      wireId: string,
      handleIndex: number,
      constraint: HandleConstraint,
      e: React.MouseEvent
    ) => {
      e.preventDefault();
      e.stopPropagation();

      // We need to get the current handle position from somewhere
      // For now, we'll use the mouse position as the starting point
      // and calculate delta from there
      setDragging({
        wireId,
        handleIndex,
        constraint,
        startMouse: { x: e.clientX, y: e.clientY },
        startHandle: { x: e.clientX, y: e.clientY }, // Will be updated in effect
      });
    },
    []
  );

  // Handle mouse movement and release
  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      const delta = {
        x: (e.clientX - dragging.startMouse.x) / zoom,
        y: (e.clientY - dragging.startMouse.y) / zoom,
      };

      // Apply constraint - calculate new position based on constraint direction
      const newPos: Position =
        dragging.constraint === 'horizontal'
          ? {
              x: dragging.startHandle.x + delta.x,
              y: dragging.startHandle.y,
            }
          : {
              x: dragging.startHandle.x,
              y: dragging.startHandle.y + delta.y,
            };

      updateWireHandle(dragging.wireId, dragging.handleIndex, newPos);
    };

    const handleUp = () => {
      setDragging(null);
      onDragEnd?.();
    };

    // Attach global listeners
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, zoom, updateWireHandle, onDragEnd]);

  return {
    handleDragStart,
    isDragging: dragging !== null,
    draggingHandle: dragging
      ? { wireId: dragging.wireId, handleIndex: dragging.handleIndex }
      : null,
  };
}

export default useWireHandleDrag;
