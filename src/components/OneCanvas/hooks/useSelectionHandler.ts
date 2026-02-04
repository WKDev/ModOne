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
import type { Position, Block, Wire, Junction } from '../types';
import {
  type SelectionBoxState,
  doesRectIntersectBox,
  isRectContainedInBox,
  getDragDirection,
} from '../components/SelectionBox';
import {
  getWirePathElement,
  sampleWirePath,
  isWireContainedInBox,
  doesWireIntersectBox,
  getWireBoundingBox,
} from '../utils/wireSelectionUtils';

// ============================================================================
// Types
// ============================================================================

interface UseSelectionHandlerOptions {
  /** Components map to select from (pass from OneCanvasPanel) */
  components?: Map<string, Block>;
  /** Wires array to select from (pass from OneCanvasPanel) */
  wires?: Wire[];
  /** Junctions map (for wire bounding box calculation) */
  junctions?: Map<string, Junction>;
  /** Current zoom level (needed for threshold calculation) */
  zoom?: number;
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

const DRAG_THRESHOLD = 5; // Pixels to move before starting drag-select

// ============================================================================
// Hook
// ============================================================================

export function useSelectionHandler(
  options: UseSelectionHandlerOptions = {}
): SelectionHandlerResult {

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

  // Use provided state or fall back to global store
  const globalComponents = useCanvasStore((state) => state.components);
  const globalWires = useCanvasStore((state) => state.wires);
  const globalJunctions = useCanvasStore((state) => state.junctions);

  const components = options.components ?? globalComponents;
  const wires = options.wires ?? globalWires;
  const junctions = options.junctions ?? globalJunctions;
  const zoom = options.zoom ?? 1;

  // Handle mouse down on canvas (not on a component)
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent, canvasPosition: Position) => {
      // Only handle left click
      if (e.button !== 0) return;

      // Check if clicking on a block or wire (don't clear selection)
      const target = e.target as HTMLElement;
      const isClickingBlock = target.closest('[data-block-id]');
      const isClickingWire = target.closest('[data-wire-id]');

      // Store initial position only if not clicking on interactive elements
      if (!isClickingBlock && !isClickingWire) {
        mouseDownPos.current = canvasPosition;
        hasPassedThreshold.current = false;

        // Clear selection on empty canvas click (unless shift/ctrl held)
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          clearSelection();
        }
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

        // Threshold is in screen pixels, so adjust for zoom when comparing in canvas space
        const canvasThreshold = DRAG_THRESHOLD / zoom;

        if (dx > canvasThreshold || dy > canvasThreshold) {
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
    [zoom]
  );

  // Handle mouse up on canvas
  const handleCanvasMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (selectionBox && isDragSelecting) {
        // Find all components and wires that match the selection box
        const selectedIds: string[] = [];

        // Determine drag direction
        const dragDirection = getDragDirection(selectionBox);
        const isContainmentMode = dragDirection === 'ltr';

        // Select components based on drag direction
        components.forEach((component) => {
          const rect = {
            x: component.position.x,
            y: component.position.y,
            width: component.size.width,
            height: component.size.height,
          };

          // Use appropriate selection mode based on drag direction
          const isSelected = isContainmentMode
            ? isRectContainedInBox(rect, selectionBox)
            : doesRectIntersectBox(rect, selectionBox);

          if (isSelected) {
            selectedIds.push(component.id);
          }
        });

        // Select wires based on drag direction
        wires.forEach((wire) => {
          // Performance: Skip if wire bounding box doesn't intersect selection
          const wireBounds = getWireBoundingBox(wire, components, junctions);
          if (wireBounds) {
            const boundsRect = {
              x: wireBounds.minX,
              y: wireBounds.minY,
              width: wireBounds.maxX - wireBounds.minX,
              height: wireBounds.maxY - wireBounds.minY,
            };

            // Quick rejection if bounds don't intersect
            if (!doesRectIntersectBox(boundsRect, selectionBox)) {
              return;
            }
          }

          // Get wire SVG path from DOM
          const pathElement = getWirePathElement(wire.id);
          if (!pathElement) return;

          // Sample points along wire path
          const wirePoints = sampleWirePath(pathElement);

          // Check selection based on drag direction
          const isSelected = isContainmentMode
            ? isWireContainedInBox(wirePoints, selectionBox)
            : doesWireIntersectBox(wirePoints, selectionBox);

          if (isSelected) {
            selectedIds.push(wire.id);
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

        // CRITICAL: Prevent click event after drag-select
        // This prevents Canvas onClick from clearing the selection
        e.preventDefault();
        e.stopPropagation();
      }

      // Reset drag state
      mouseDownPos.current = null;
      hasPassedThreshold.current = false;
      setSelectionBox(null);
      setIsDragSelecting(false);
    },
    [selectionBox, isDragSelecting, components, wires, junctions, setSelection, addToSelection]
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
