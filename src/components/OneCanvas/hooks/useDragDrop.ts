/**
 * Drag and Drop Hook
 *
 * Manages drag-and-drop state for both toolbox items and canvas components.
 */

import { useState, useCallback } from 'react';
import type { DragEndEvent, DragStartEvent, DragMoveEvent } from '@dnd-kit/core';
import { useCanvasStore } from '../../../stores/canvasStore';
import { screenToCanvas, snapToGrid } from '../utils/canvasCoordinates';
import type { BlockType, Position } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface DragState {
  /** Whether a drag operation is in progress */
  isDragging: boolean;
  /** Type of item being dragged */
  dragType: 'toolbox-item' | 'canvas-component' | null;
  /** Block type if dragging from toolbox */
  blockType: BlockType | null;
  /** Component ID if dragging existing component */
  componentId: string | null;
  /** Current drag position */
  position: Position | null;
}

interface UseDragDropOptions {
  /** Canvas container element for coordinate transformation */
  canvasRef: React.RefObject<HTMLElement | null>;
}

interface UseDragDropReturn {
  /** Current drag state */
  dragState: DragState;
  /** Handler for drag start event */
  handleDragStart: (event: DragStartEvent) => void;
  /** Handler for drag move event */
  handleDragMove: (event: DragMoveEvent) => void;
  /** Handler for drag end event */
  handleDragEnd: (event: DragEndEvent) => void;
  /** Handler for drag cancel */
  handleDragCancel: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialDragState: DragState = {
  isDragging: false,
  dragType: null,
  blockType: null,
  componentId: null,
  position: null,
};

// ============================================================================
// Hook
// ============================================================================

export function useDragDrop({ canvasRef }: UseDragDropOptions): UseDragDropReturn {
  const [dragState, setDragState] = useState<DragState>(initialDragState);

  // Store access
  const zoom = useCanvasStore((state) => state.zoom);
  const pan = useCanvasStore((state) => state.pan);
  const gridSize = useCanvasStore((state) => state.gridSize);
  const snapToGridEnabled = useCanvasStore((state) => state.snapToGrid);
  const addComponent = useCanvasStore((state) => state.addComponent);
  const moveComponent = useCanvasStore((state) => state.moveComponent);
  const selectedIds = useCanvasStore((state) => state.selectedIds);

  // Get canvas-relative position from screen coordinates
  const getCanvasPosition = useCallback(
    (screenX: number, screenY: number): Position | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const relativePos = {
        x: screenX - rect.left,
        y: screenY - rect.top,
      };

      const canvasPos = screenToCanvas(relativePos, pan, zoom);

      if (snapToGridEnabled) {
        return snapToGrid(canvasPos, gridSize);
      }

      return canvasPos;
    },
    [canvasRef, pan, zoom, gridSize, snapToGridEnabled]
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;

    if (data?.type === 'toolbox-item') {
      setDragState({
        isDragging: true,
        dragType: 'toolbox-item',
        blockType: data.blockType as BlockType,
        componentId: null,
        position: null,
      });
    } else if (data?.type === 'canvas-component') {
      setDragState({
        isDragging: true,
        dragType: 'canvas-component',
        blockType: null,
        componentId: data.componentId as string,
        position: null,
      });
    }
  }, []);

  // Handle drag move
  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const { activatorEvent } = event;
      if (activatorEvent instanceof MouseEvent || activatorEvent instanceof TouchEvent) {
        const clientX = 'clientX' in activatorEvent
          ? activatorEvent.clientX
          : activatorEvent.touches[0]?.clientX ?? 0;
        const clientY = 'clientY' in activatorEvent
          ? activatorEvent.clientY
          : activatorEvent.touches[0]?.clientY ?? 0;

        const position = getCanvasPosition(clientX, clientY);

        setDragState((prev) => ({
          ...prev,
          position,
        }));
      }
    },
    [getCanvasPosition]
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const data = active.data.current;

      // Check if dropped on canvas
      if (over?.id === 'canvas-drop-zone') {
        const { activatorEvent } = event;

        if (activatorEvent instanceof MouseEvent || activatorEvent instanceof TouchEvent) {
          const clientX = 'clientX' in activatorEvent
            ? activatorEvent.clientX
            : activatorEvent.touches[0]?.clientX ?? 0;
          const clientY = 'clientY' in activatorEvent
            ? activatorEvent.clientY
            : activatorEvent.touches[0]?.clientY ?? 0;

          const position = getCanvasPosition(clientX, clientY);

          if (position) {
            if (data?.type === 'toolbox-item') {
              // Add new component from toolbox
              const blockType = data.blockType as BlockType;
              addComponent(blockType, position);
            } else if (data?.type === 'canvas-component') {
              // Move existing component
              const componentId = data.componentId as string;

              // If component is part of selection, move all selected
              if (selectedIds.has(componentId)) {
                // Calculate delta from original position
                const originalPos = data.originalPosition as Position;
                const delta = {
                  x: position.x - originalPos.x,
                  y: position.y - originalPos.y,
                };

                // Move all selected components
                selectedIds.forEach((id) => {
                  const comp = useCanvasStore.getState().components.get(id);
                  if (comp) {
                    const newPos = {
                      x: comp.position.x + delta.x,
                      y: comp.position.y + delta.y,
                    };
                    moveComponent(id, snapToGridEnabled ? snapToGrid(newPos, gridSize) : newPos);
                  }
                });
              } else {
                // Move single component
                moveComponent(componentId, position);
              }
            }
          }
        }
      }

      // Reset drag state
      setDragState(initialDragState);
    },
    [getCanvasPosition, addComponent, moveComponent, selectedIds, snapToGridEnabled, gridSize]
  );

  // Handle drag cancel (e.g., Escape key)
  const handleDragCancel = useCallback(() => {
    setDragState(initialDragState);
  }, []);

  return {
    dragState,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
  };
}

export default useDragDrop;
