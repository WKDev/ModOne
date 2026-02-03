/**
 * Block Drag Hook
 *
 * Manages native mouse-based dragging for canvas blocks.
 * Uses native events for finer control and to avoid conflicts with toolbox DnD.
 *
 * Features:
 * - Single block dragging
 * - Multi-selection dragging
 * - Snap-to-grid support
 * - Screen-to-canvas coordinate transformation
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { snapToGrid } from '../utils/canvasCoordinates';
import type { Position } from '../types';

// ============================================================================
// Types
// ============================================================================

interface UseBlockDragOptions {
  /** Reference to the canvas container element */
  canvasRef: React.RefObject<HTMLElement | null>;
  /** Callback to check if dragging should be prevented (e.g., during wire drawing) */
  shouldPreventDrag?: () => boolean;
  /** Optional document-aware components (overrides global store) */
  components?: Map<string, { position: Position }>;
  /** Optional document-aware moveComponent function (overrides global store) */
  moveComponent?: (id: string, position: Position) => void;
}

interface DragState {
  /** Whether a drag is in progress */
  isDragging: boolean;
  /** The block ID being dragged (primary drag target) */
  draggedBlockId: string | null;
  /** Starting mouse position in screen coordinates */
  startMousePos: Position | null;
  /** Original positions of all blocks being dragged (for multi-select) */
  originalPositions: Map<string, Position>;
}

interface UseBlockDragReturn {
  /** Whether a drag is currently in progress */
  isDragging: boolean;
  /** The block ID currently being dragged */
  draggedBlockId: string | null;
  /** Handler to attach to block's mousedown event */
  handleBlockDragStart: (blockId: string, event: React.MouseEvent) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useBlockDrag({
  canvasRef,
  shouldPreventDrag,
  components: customComponents,
  moveComponent: customMoveComponent,
}: UseBlockDragOptions): UseBlockDragReturn {
  // Store access
  const zoom = useCanvasStore((state) => state.zoom);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const globalComponents = useCanvasStore((state) => state.components);
  const globalMoveComponent = useCanvasStore((state) => state.moveComponent);
  const snapToGridEnabled = useCanvasStore((state) => state.snapToGrid);
  const gridSize = useCanvasStore((state) => state.gridSize);
  const setSelection = useCanvasStore((state) => state.setSelection);
  const addToSelection = useCanvasStore((state) => state.addToSelection);

  // Use custom (document-aware) components/moveComponent if provided, else fall back to global store
  const components = customComponents ?? globalComponents;
  const moveComponent = customMoveComponent ?? globalMoveComponent;

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    draggedBlockId: null,
    startMousePos: null,
    originalPositions: new Map(),
  });

  // Handle drag start
  const handleBlockDragStart = useCallback(
    (blockId: string, event: React.MouseEvent) => {
      // Check if drag should be prevented (e.g., during wire drawing)
      if (shouldPreventDrag?.()) {
        return;
      }

      // Don't start drag on port clicks (they handle wire drawing)
      const target = event.target as HTMLElement;
      if (target.closest('[data-port-id]')) {
        return;
      }

      // Only handle left mouse button
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      // Determine which blocks to drag
      let blocksToDrag: string[];

      if (selectedIds.has(blockId)) {
        // Block is already selected - drag all selected blocks
        blocksToDrag = Array.from(selectedIds).filter((id) => components.has(id));
      } else {
        // Block is not selected - select it and drag only this block
        if (event.ctrlKey || event.metaKey) {
          // Add to selection
          addToSelection(blockId);
          blocksToDrag = [...Array.from(selectedIds).filter((id) => components.has(id)), blockId];
        } else {
          // Replace selection
          setSelection([blockId]);
          blocksToDrag = [blockId];
        }
      }

      // Store original positions for all blocks being dragged
      const originalPositions = new Map<string, Position>();
      for (const id of blocksToDrag) {
        const component = components.get(id);
        if (component) {
          originalPositions.set(id, { ...component.position });
        }
      }

      // Initialize drag state
      dragStateRef.current = {
        isDragging: true,
        draggedBlockId: blockId,
        startMousePos: { x: event.clientX, y: event.clientY },
        originalPositions,
      };

      setIsDragging(true);
      setDraggedBlockId(blockId);
    },
    [shouldPreventDrag, selectedIds, components, addToSelection, setSelection]
  );

  // Handle mouse move during drag
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const state = dragStateRef.current;
      if (!state.isDragging || !state.startMousePos) return;

      const container = canvasRef.current;
      if (!container) return;

      // Calculate mouse delta in screen coordinates
      const deltaX = event.clientX - state.startMousePos.x;
      const deltaY = event.clientY - state.startMousePos.y;

      // Convert delta to canvas coordinates (accounting for zoom)
      const canvasDeltaX = deltaX / zoom;
      const canvasDeltaY = deltaY / zoom;

      // Move all dragged blocks
      state.originalPositions.forEach((originalPos, id) => {
        let newPosition: Position = {
          x: originalPos.x + canvasDeltaX,
          y: originalPos.y + canvasDeltaY,
        };

        // Apply snap-to-grid if enabled
        if (snapToGridEnabled) {
          newPosition = snapToGrid(newPosition, gridSize);
        }

        moveComponent(id, newPosition);
      });
    },
    [canvasRef, zoom, snapToGridEnabled, gridSize, moveComponent]
  );

  // Handle mouse up (end drag)
  const handleMouseUp = useCallback(() => {
    if (!dragStateRef.current.isDragging) return;

    // Reset drag state
    dragStateRef.current = {
      isDragging: false,
      draggedBlockId: null,
      startMousePos: null,
      originalPositions: new Map(),
    };

    setIsDragging(false);
    setDraggedBlockId(null);
  }, []);

  // Attach global mouse event listeners during drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return {
    isDragging,
    draggedBlockId,
    handleBlockDragStart,
  };
}

export default useBlockDrag;
