/**
 * useWireHandleDrag Hook
 *
 * Manages drag behavior for wire handles (control points).
 * Handles are constrained to move only horizontally or vertically.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { snapToGrid, screenToCanvas } from '../utils/canvasCoordinates';
import type { Position, HandleConstraint } from '../types';
import type { CanvasRef } from '../Canvas';

// ============================================================================
// Types
// ============================================================================

interface DragState {
  wireId: string;
  handleIndex: number;
  constraint: HandleConstraint;
  startCanvasPos: Position;
  startHandle: Position;
}

interface UseWireHandleDragOptions {
  /** Function to update handle position in store */
  updateWireHandle: (wireId: string, handleIndex: number, position: Position, isFirstMove?: boolean) => void;
  /** Reference to the canvas */
  canvasRef: React.RefObject<CanvasRef | null>;
  /** Callback when drag ends */
  onDragEnd?: () => void;
  /** Remove adjacent overlapping/collinear handles after drag ends */
  cleanupOverlappingHandles?: (wireId: string) => void;
}

interface UseWireHandleDragResult {
  /** Start dragging a handle */
  handleDragStart: (
    wireId: string,
    handleIndex: number,
    constraint: HandleConstraint,
    e: React.MouseEvent,
    handlePosition: Position
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
  canvasRef,
  onDragEnd,
  cleanupOverlappingHandles,
}: UseWireHandleDragOptions): UseWireHandleDragResult {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const isFirstMoveRef = useRef(false);
  const zoom = useCanvasStore((state) => state.zoom);
  const pan = useCanvasStore((state) => state.pan);
  const snapToGridEnabled = useCanvasStore((state) => state.snapToGrid);
  const gridSize = useCanvasStore((state) => state.gridSize);

  // Start drag operation
  const handleDragStart = useCallback(
    (
      wireId: string,
      handleIndex: number,
      constraint: HandleConstraint,
      e: React.MouseEvent,
      handlePosition: Position
    ) => {
      e.preventDefault();
      e.stopPropagation();

      // Convert initial mouse position to canvas coordinates
      const container = canvasRef.current?.getContainer();
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const screenPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      const startCanvasPos = screenToCanvas(screenPos, pan, zoom);

      isFirstMoveRef.current = true;
      setDragging({
        wireId,
        handleIndex,
        constraint,
        startCanvasPos,
        startHandle: handlePosition,
      });
    },
    [canvasRef, pan, zoom]
  );

  // Handle mouse movement and release
  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      const container = canvasRef.current?.getContainer();
      if (!container) return;

      // Convert current mouse position to canvas coordinates
      const rect = container.getBoundingClientRect();
      const screenPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      const currentCanvasPos = screenToCanvas(screenPos, pan, zoom);

      // Calculate delta in canvas coordinates
      const delta = {
        x: currentCanvasPos.x - dragging.startCanvasPos.x,
        y: currentCanvasPos.y - dragging.startCanvasPos.y,
      };

      // Apply constraint - calculate new position based on constraint direction
      let newPos: Position;
      if (dragging.constraint === 'free') {
        newPos = {
          x: dragging.startHandle.x + delta.x,
          y: dragging.startHandle.y + delta.y,
        };
      } else if (dragging.constraint === 'horizontal') {
        newPos = {
          x: dragging.startHandle.x + delta.x,
          y: dragging.startHandle.y,
        };
      } else {
        newPos = {
          x: dragging.startHandle.x,
          y: dragging.startHandle.y + delta.y,
        };
      }

      if (snapToGridEnabled) {
        newPos = snapToGrid(newPos, gridSize);
      }

      updateWireHandle(dragging.wireId, dragging.handleIndex, newPos, isFirstMoveRef.current);
      isFirstMoveRef.current = false;
    };

    const handleUp = () => {
      if (dragging && cleanupOverlappingHandles) {
        cleanupOverlappingHandles(dragging.wireId);
      }
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
  }, [dragging, canvasRef, pan, zoom, snapToGridEnabled, gridSize, updateWireHandle, onDragEnd, cleanupOverlappingHandles]);

  return {
    handleDragStart,
    isDragging: dragging !== null,
    draggingHandle: dragging
      ? { wireId: dragging.wireId, handleIndex: dragging.handleIndex }
      : null,
  };
}

export default useWireHandleDrag;
