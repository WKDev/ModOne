/**
 * Selection Handler Hook
 *
 * Manages canvas selection state including:
 * - Click to select
 * - Shift+click to add to selection
 * - Ctrl+click to toggle selection
 * - Drag-to-select with selection box
 */

import { useState, useCallback, useRef } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { Position } from '../types';
import { type SelectionBoxState, doesRectIntersectBox } from '../components/SelectionBox';

// ============================================================================
// Types
// ============================================================================

interface UseSelectionHandlerOptions {
  /** Default block size for hit testing (width, height) */
  blockSize?: { width: number; height: number };
}

interface SelectionHandlerResult {
  /** Current selection box state (null when not dragging) */
  selectionBox: SelectionBoxState | null;

  /** Handle mouse down on canvas (start potential drag-select) */
  handleCanvasMouseDown: (e: React.MouseEvent, canvasPosition: Position) => void;

  /** Handle mouse move on canvas (update drag-select) */
  handleCanvasMouseMove: (e: React.MouseEvent, canvasPosition: Position) => void;

  /** Handle mouse up on canvas (complete drag-select) */
  handleCanvasMouseUp: (e: React.MouseEvent) => void;

  /** Handle click on a component */
  handleComponentClick: (componentId: string, e: React.MouseEvent) => void;

  /** Handle click on a wire */
  handleWireClick: (wireId: string, e: React.MouseEvent) => void;

  /** Whether a drag-select is in progress */
  isDragSelecting: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_BLOCK_SIZE = { width: 60, height: 60 };
const DRAG_THRESHOLD = 5; // Pixels to move before starting drag-select

// ============================================================================
// Hook
// ============================================================================

export function useSelectionHandler(
  options: UseSelectionHandlerOptions = {}
): SelectionHandlerResult {
  const { blockSize = DEFAULT_BLOCK_SIZE } = options;

  // Selection box state
  const [selectionBox, setSelectionBox] = useState<SelectionBoxState | null>(null);
  const [isDragSelecting, setIsDragSelecting] = useState(false);

  // Track initial mouse down position to detect drag threshold
  const mouseDownPos = useRef<Position | null>(null);
  const hasPassedThreshold = useRef(false);

  // Store actions
  const setSelection = useCanvasStore((state) => state.setSelection);
  const addToSelection = useCanvasStore((state) => state.addToSelection);
  const toggleSelection = useCanvasStore((state) => state.toggleSelection);
  const clearSelection = useCanvasStore((state) => state.clearSelection);
  const components = useCanvasStore((state) => state.components);

  // Handle mouse down on canvas (not on a component)
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent, canvasPosition: Position) => {
      // Only handle left click
      if (e.button !== 0) return;

      // Store initial position
      mouseDownPos.current = canvasPosition;
      hasPassedThreshold.current = false;

      // Clear selection on empty canvas click (unless shift/ctrl held)
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        clearSelection();
      }
    },
    [clearSelection]
  );

  // Handle mouse move on canvas
  const handleCanvasMouseMove = useCallback(
    (_e: React.MouseEvent, canvasPosition: Position) => {
      if (!mouseDownPos.current) return;

      // Check if passed drag threshold
      if (!hasPassedThreshold.current) {
        const dx = Math.abs(canvasPosition.x - mouseDownPos.current.x);
        const dy = Math.abs(canvasPosition.y - mouseDownPos.current.y);

        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          hasPassedThreshold.current = true;
          setIsDragSelecting(true);
        } else {
          return;
        }
      }

      // Update selection box
      setSelectionBox({
        start: mouseDownPos.current,
        end: canvasPosition,
      });
    },
    []
  );

  // Handle mouse up on canvas
  const handleCanvasMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (selectionBox && isDragSelecting) {
        // Find all components that intersect the selection box
        const selectedIds: string[] = [];

        components.forEach((component) => {
          const rect = {
            x: component.position.x,
            y: component.position.y,
            width: blockSize.width,
            height: blockSize.height,
          };

          if (doesRectIntersectBox(rect, selectionBox)) {
            selectedIds.push(component.id);
          }
        });

        // Apply selection based on modifier keys
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          // Add to existing selection
          selectedIds.forEach((id) => addToSelection(id));
        } else {
          // Replace selection
          setSelection(selectedIds);
        }
      }

      // Reset drag state
      mouseDownPos.current = null;
      hasPassedThreshold.current = false;
      setSelectionBox(null);
      setIsDragSelecting(false);
    },
    [selectionBox, isDragSelecting, components, blockSize, setSelection, addToSelection]
  );

  // Handle click on a component
  const handleComponentClick = useCallback(
    (componentId: string, e: React.MouseEvent) => {
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
        // Ctrl+click: Toggle selection
        toggleSelection(componentId);
      } else if (e.shiftKey) {
        // Shift+click: Add to selection
        addToSelection(componentId);
      } else {
        // Regular click: Select only this component
        setSelection([componentId]);
      }
    },
    [setSelection, addToSelection, toggleSelection]
  );

  // Handle click on a wire
  const handleWireClick = useCallback(
    (wireId: string, e: React.MouseEvent) => {
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
        toggleSelection(wireId);
      } else if (e.shiftKey) {
        addToSelection(wireId);
      } else {
        setSelection([wireId]);
      }
    },
    [setSelection, addToSelection, toggleSelection]
  );

  return {
    selectionBox,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleComponentClick,
    handleWireClick,
    isDragSelecting,
  };
}

export default useSelectionHandler;
