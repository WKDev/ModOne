/**
 * useWireSegmentDrag Hook
 *
 * Manages drag behavior for wire segments (the straight section between two adjacent handles).
 * Horizontal segments move only on Y-axis, vertical segments move only on X-axis.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { screenToCanvas } from '../utils/canvasCoordinates';
import type { Position } from '../types';
import type { CanvasRef } from '../Canvas';

// ============================================================================
// Types
// ============================================================================

interface SegmentDragState {
  wireId: string;
  handleIndexA: number;
  handleIndexB: number;
  orientation: 'horizontal' | 'vertical';
  startCanvasPos: Position;
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
  /** Remove adjacent overlapping handles after drag ends */
  cleanupOverlappingHandles?: (wireId: string) => void;
  /** Reference to the canvas */
  canvasRef: React.RefObject<CanvasRef | null>;
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
    startPositionB: Position,
    historyAlreadyPushed?: boolean
  ) => void;
  /** Whether currently dragging a segment */
  isDragging: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useWireSegmentDrag({
  moveWireSegment,
  cleanupOverlappingHandles,
  canvasRef,
}: UseWireSegmentDragOptions): UseWireSegmentDragResult {
  const [dragging, setDragging] = useState<SegmentDragState | null>(null);
  const isFirstMoveRef = useRef(false);
  const appliedDeltaRef = useRef<Position>({ x: 0, y: 0 });
  const zoom = useCanvasStore((state) => state.zoom);
  const pan = useCanvasStore((state) => state.pan);
  const snapToGridEnabled = useCanvasStore((state) => state.snapToGrid);
  const gridSize = useCanvasStore((state) => state.gridSize);

  const handleSegmentDragStart = useCallback(
    (
      wireId: string,
      handleIndexA: number,
      handleIndexB: number,
      orientation: 'horizontal' | 'vertical',
      e: React.MouseEvent,
      startPositionA: Position,
      startPositionB: Position,
      historyAlreadyPushed?: boolean
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

      // If history was already pushed (e.g. by insertEndpointHandle), skip push on first move
      isFirstMoveRef.current = !historyAlreadyPushed;
      appliedDeltaRef.current = { x: 0, y: 0 };
      setDragging({
        wireId,
        handleIndexA,
        handleIndexB,
        orientation,
        startCanvasPos,
        startPositionA: { ...startPositionA },
        startPositionB: { ...startPositionB },
      });
    },
    [canvasRef, pan, zoom]
  );

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

      // Absolute delta from drag start in canvas coordinates
      const absDx = currentCanvasPos.x - dragging.startCanvasPos.x;
      const absDy = currentCanvasPos.y - dragging.startCanvasPos.y;

      // Constrain based on segment orientation:
      // horizontal segment → move Y only; vertical segment → move X only
      let targetDelta: Position;
      if (dragging.orientation === 'horizontal') {
        let targetY = dragging.startPositionA.y + absDy;
        if (snapToGridEnabled) {
          targetY = Math.round(targetY / gridSize) * gridSize;
        }
        targetDelta = { x: 0, y: targetY - dragging.startPositionA.y };
      } else {
        let targetX = dragging.startPositionA.x + absDx;
        if (snapToGridEnabled) {
          targetX = Math.round(targetX / gridSize) * gridSize;
        }
        targetDelta = { x: targetX - dragging.startPositionA.x, y: 0 };
      }

      // Compute incremental delta to apply (total target minus what's already applied)
      const delta: Position = {
        x: targetDelta.x - appliedDeltaRef.current.x,
        y: targetDelta.y - appliedDeltaRef.current.y,
      };
      appliedDeltaRef.current = targetDelta;

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
      if (dragging && cleanupOverlappingHandles) {
        cleanupOverlappingHandles(dragging.wireId);
      }
      setDragging(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, canvasRef, pan, zoom, snapToGridEnabled, gridSize, moveWireSegment, cleanupOverlappingHandles]);

  return {
    handleSegmentDragStart,
    isDragging: dragging !== null,
  };
}

export default useWireSegmentDrag;
