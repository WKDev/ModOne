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
import { snapToGrid, screenToCanvas } from '../utils/canvasCoordinates';
import { isToggleSelection } from '../selection/modifierKeys';
import type { Position } from '../types';
import type { CanvasRef } from '../Canvas';

// ============================================================================
// Types
// ============================================================================

interface UseBlockDragOptions {
  /** Reference to the canvas */
  canvasRef: React.RefObject<CanvasRef | null>;
  /** Callback to check if dragging should be prevented (e.g., during wire drawing) */
  shouldPreventDrag?: () => boolean;
  /** Optional document-aware components (overrides global store) */
  components?: Map<string, { position: Position }>;
  /** Optional document-aware moveComponent function (overrides global store) */
  moveComponent?: (id: string, position: Position, skipHistory?: boolean) => void;
  /** Optional junctions map for junction drag support */
  junctions?: Map<string, { position: Position }>;
  /** Optional moveJunction function for junction drag support */
  moveJunction?: (id: string, position: Position, skipHistory?: boolean) => void;
}

interface DragState {
  /** Whether a drag is in progress */
  isDragging: boolean;
  /** The block ID being dragged (primary drag target) */
  draggedBlockId: string | null;
  /** Starting mouse position in canvas coordinates */
  startCanvasPos: Position | null;
  /** Original positions of all blocks being dragged (for multi-select) */
  originalPositions: Map<string, Position>;
  /** IDs that are junctions (use moveJunction instead of moveComponent) */
  junctionIds: Set<string>;
  /** Whether this is the first move in the current drag (for history push) */
  isFirstMove: boolean;
  /** Cached container bounding rect (for performance) */
  containerRect: DOMRect | null;
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
  junctions: customJunctions,
  moveJunction: customMoveJunction,
}: UseBlockDragOptions): UseBlockDragReturn {
  // Store access
  const zoom = useCanvasStore((state) => state.zoom);
  const pan = useCanvasStore((state) => state.pan);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const globalComponents = useCanvasStore((state) => state.components);
  const globalMoveComponent = useCanvasStore((state) => state.moveComponent);
  const globalJunctions = useCanvasStore((state) => state.junctions);
  const globalMoveJunction = useCanvasStore((state) => state.moveJunction);
  const snapToGridEnabled = useCanvasStore((state) => state.snapToGrid);
  const gridSize = useCanvasStore((state) => state.gridSize);
  const setSelection = useCanvasStore((state) => state.setSelection);

  // Use custom (document-aware) or fall back to global store
  const components = customComponents ?? globalComponents;
  const moveComponent = customMoveComponent ?? globalMoveComponent;
  const junctions = customJunctions ?? globalJunctions;
  const moveJunction = customMoveJunction ?? globalMoveJunction;

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    draggedBlockId: null,
    startCanvasPos: null,
    originalPositions: new Map(),
    junctionIds: new Set(),
    isFirstMove: true,
    containerRect: null,
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

      // STEP 1: Capture current selection synchronously (avoid race condition)
      const currentSelection = Array.from(selectedIds);

      // STEP 2: Compute new selection locally (synchronous - no async state update yet)
      let newSelection: string[];
      let itemsToDrag: string[];

      if (selectedIds.has(blockId)) {
        // Item is already selected - drag all selected items
        newSelection = currentSelection;
        itemsToDrag = currentSelection.filter((id) => components.has(id) || junctions.has(id));
      } else {
        // Item is not selected - need to update selection
        if (isToggleSelection(event)) {
          // Add to selection (Ctrl/Cmd+click)
          newSelection = [...currentSelection, blockId];
          itemsToDrag = newSelection.filter((id) => components.has(id) || junctions.has(id));
        } else {
          // Replace selection
          newSelection = [blockId];
          itemsToDrag = [blockId];
        }
      }

      // STEP 3: Update selection atomically BEFORE starting drag
      // This ensures state is consistent before any other operations
      if (!selectedIds.has(blockId) || newSelection.length !== currentSelection.length) {
        setSelection(newSelection);
      }

      // Store original positions and track which are junctions
      const originalPositions = new Map<string, Position>();
      const junctionIdSet = new Set<string>();
      for (const id of itemsToDrag) {
        const component = components.get(id);
        if (component) {
          originalPositions.set(id, { ...component.position });
        } else {
          const junction = junctions.get(id);
          if (junction) {
            originalPositions.set(id, { ...junction.position });
            junctionIdSet.add(id);
          }
        }
      }

      // Convert initial mouse position to canvas coordinates
      const container = canvasRef.current?.getContainer();
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const screenPos = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const startCanvasPos = screenToCanvas(screenPos, pan, zoom);

      // Initialize drag state (cache rect for performance during drag)
      dragStateRef.current = {
        isDragging: true,
        draggedBlockId: blockId,
        startCanvasPos,
        originalPositions,
        junctionIds: junctionIdSet,
        isFirstMove: true,
        containerRect: rect,
      };

      setIsDragging(true);
      setDraggedBlockId(blockId);
    },
    [shouldPreventDrag, selectedIds, components, junctions, setSelection, canvasRef, pan, zoom]
  );

  // Handle mouse move during drag
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const state = dragStateRef.current;
      if (!state.isDragging || !state.startCanvasPos || !state.containerRect) return;

      // Convert current mouse position to canvas coordinates using cached rect
      const screenPos = {
        x: event.clientX - state.containerRect.left,
        y: event.clientY - state.containerRect.top,
      };
      const currentCanvasPos = screenToCanvas(screenPos, pan, zoom);

      // Calculate delta in canvas coordinates
      const canvasDeltaX = currentCanvasPos.x - state.startCanvasPos.x;
      const canvasDeltaY = currentCanvasPos.y - state.startCanvasPos.y;

      // On first move, let the store push history; on subsequent moves, skip
      const skipHistory = !state.isFirstMove;
      if (state.isFirstMove) {
        state.isFirstMove = false;
      }

      // Move all dragged items (components and junctions)
      state.originalPositions.forEach((originalPos, id) => {
        let newPosition: Position = {
          x: originalPos.x + canvasDeltaX,
          y: originalPos.y + canvasDeltaY,
        };

        // Apply snap-to-grid if enabled
        if (snapToGridEnabled) {
          newPosition = snapToGrid(newPosition, gridSize);
        }

        if (state.junctionIds.has(id)) {
          moveJunction(id, newPosition, skipHistory);
        } else {
          moveComponent(id, newPosition, skipHistory);
        }
      });
    },
    [pan, zoom, snapToGridEnabled, gridSize, moveComponent, moveJunction]
  );

  // Handle mouse up (end drag)
  const handleMouseUp = useCallback(() => {
    if (!dragStateRef.current.isDragging) return;

    // Reset drag state
    dragStateRef.current = {
      isDragging: false,
      draggedBlockId: null,
      startCanvasPos: null,
      originalPositions: new Map(),
      junctionIds: new Set(),
      isFirstMove: true,
      containerRect: null,
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
