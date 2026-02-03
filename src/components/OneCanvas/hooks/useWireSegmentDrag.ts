/**
 * useWireSegmentDrag Hook
 *
 * Manages drag behavior for wire segments (the straight section between two adjacent handles).
 * Horizontal segments move only on Y-axis, vertical segments move only on X-axis.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Position } from '../types';

// ============================================================================
// Types
// ============================================================================

interface SegmentDragState {
  wireId: string;
  handleIndexA: number;
  handleIndexB: number;
  orientation: 'horizontal' | 'vertical';
  startMouse: Position;
  startPositionA: Position;
  startPositionB: Position;
}

interface UseWireSegmentDragOptions {
  /** Function to move a wire segment (two adjacent handles) by delta */
  moveWireSegment: (
    wireId: string,
    handleIndexA: number,
    handleIndexB: number,
    delta: Position,
    isFirstMove?: boolean
  ) => void;
  /** Current zoom level */
  zoom: number;
}

interface UseWireSegmentDragResult {
  /** Start dragging a segment */
  handleSegmentDragStart: (
    wireId: string,
    handleIndexA: number,
    handleIndexB: number,
    orientation: 'horizontal' | 'vertical',
    e: React.MouseEvent,
    startPositionA: Position,
    startPositionB: Position
  ) => void;
  /** Whether currently dragging a segment */
  isDragging: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useWireSegmentDrag({
  moveWireSegment,
  zoom,
}: UseWireSegmentDragOptions): UseWireSegmentDragResult {
  const [dragging, setDragging] = useState<SegmentDragState | null>(null);
  const isFirstMoveRef = useRef(false);
  const lastMouseRef = useRef<Position>({ x: 0, y: 0 });

  const handleSegmentDragStart = useCallback(
    (
      wireId: string,
      handleIndexA: number,
      handleIndexB: number,
      orientation: 'horizontal' | 'vertical',
      e: React.MouseEvent,
      startPositionA: Position,
      startPositionB: Position
    ) => {
      e.preventDefault();
      e.stopPropagation();

      isFirstMoveRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      setDragging({
        wireId,
        handleIndexA,
        handleIndexB,
        orientation,
        startMouse: { x: e.clientX, y: e.clientY },
        startPositionA: { ...startPositionA },
        startPositionB: { ...startPositionB },
      });
    },
    []
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      // Incremental delta from last mouse position
      const dx = (e.clientX - lastMouseRef.current.x) / zoom;
      const dy = (e.clientY - lastMouseRef.current.y) / zoom;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      // Constrain based on segment orientation:
      // horizontal segment → move Y only; vertical segment → move X only
      const delta: Position =
        dragging.orientation === 'horizontal'
          ? { x: 0, y: dy }
          : { x: dx, y: 0 };

      moveWireSegment(
        dragging.wireId,
        dragging.handleIndexA,
        dragging.handleIndexB,
        delta,
        isFirstMoveRef.current
      );
      isFirstMoveRef.current = false;
    };

    const handleUp = () => {
      setDragging(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, zoom, moveWireSegment]);

  return {
    handleSegmentDragStart,
    isDragging: dragging !== null,
  };
}

export default useWireSegmentDrag;
