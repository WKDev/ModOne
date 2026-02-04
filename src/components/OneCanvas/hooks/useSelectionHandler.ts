/**
 * Selection Handler Hook (DOM-Free)
 *
 * Manages canvas selection state using pure geometric calculations:
 * - Click to select
 * - Shift+click to add to selection
 * - Ctrl+click to toggle selection
 * - Drag-to-select with selection box (LTR=contain, RTL=intersect)
 *
 * Wire selection uses pre-computed geometry cache (no DOM queries).
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { Position, Block, Wire, Junction } from '../types';
import type { SelectionBoxState } from '../components/SelectionBox';
import { getDragDirection } from '../components/SelectionBox';
import { WireGeometryCache } from '../geometry/geometryCache';
import {
  selectWiresInBox,
  isBlockInBox,
  isJunctionInBox,
  type SelectionBox,
} from '../geometry/collision';
import {
  isToggleSelection,
  isAddToSelection,
  hasModifier,
} from '../selection/modifierKeys';

// ============================================================================
// Types
// ============================================================================

interface UseSelectionHandlerOptions {
  /** Components map to select from (pass from OneCanvasPanel) */
  components?: Map<string, Block>;
  /** Wires array to select from (pass from OneCanvasPanel) */
  wires?: Wire[];
  /** Junctions map (for wire geometry calculation) */
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

  /** Handle click on a junction */
  handleJunctionClick: (junctionId: string, e: React.MouseEvent) => void;

  /** Whether a drag-select is in progress */
  isDragSelecting: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DRAG_THRESHOLD = 5; // Pixels to move before starting drag-select

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert SelectionBoxState to SelectionBox format used by collision detection
 */
function toCollisionBox(boxState: SelectionBoxState): SelectionBox {
  return {
    startX: boxState.start.x,
    startY: boxState.start.y,
    endX: boxState.end.x,
    endY: boxState.end.y,
  };
}

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

  // State version for geometry cache invalidation
  // Increment whenever components/wires/junctions change
  const stateVersionRef = useRef(0);

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

  // Increment state version whenever data changes (triggers geometry recomputation)
  // Using useMemo with size checks to detect changes
  useMemo(() => {
    stateVersionRef.current++;
  }, [components.size, wires.length, junctions.size]);

  // Wire geometry cache (persistent across renders)
  const geometryCache = useRef(new WireGeometryCache());

  // Handle mouse down on canvas (not on a component)
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent, canvasPosition: Position) => {
      // Only handle left click
      if (e.button !== 0) return;

      // Always store initial position for drag detection
      mouseDownPos.current = canvasPosition;
      hasPassedThreshold.current = false;

      // Check if clicking on interactive elements
      const target = e.target as HTMLElement;
      const isClickingBlock = target.closest('[data-block-id]');
      const isClickingWire = target.closest('[data-wire-id]');
      const isClickingPort = target.closest('[data-port-id]');
      const isClickingJunction = target.closest('[data-junction-id]');

      // Clear selection on empty canvas click (unless modifier held or clicking interactive elements)
      const isClickingInteractive = isClickingBlock || isClickingWire || isClickingPort || isClickingJunction;
      if (!isClickingInteractive && !hasModifier(e)) {
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
        // Find all components, wires, and junctions that match the selection box
        const selectedIds: string[] = [];

        // Determine drag direction
        const dragDirection = getDragDirection(selectionBox);
        const isContainmentMode = dragDirection === 'ltr';
        const collisionMode = isContainmentMode ? 'contain' : 'intersect';

        // Convert to collision box format
        const collisionBox = toCollisionBox(selectionBox);

        // Select blocks based on drag direction
        components.forEach((component) => {
          const isSelected = isBlockInBox(component, collisionBox, collisionMode);
          if (isSelected) {
            selectedIds.push(component.id);
          }
        });

        // Select junctions based on drag direction
        junctions.forEach((junction) => {
          const isSelected = isJunctionInBox(junction, collisionBox);
          if (isSelected) {
            selectedIds.push(junction.id);
          }
        });

        // Select wires using geometry cache (DOM-free)
        const selectedWireIds = selectWiresInBox(
          wires,
          collisionBox,
          geometryCache.current,
          components,
          junctions,
          stateVersionRef.current,
          collisionMode
        );
        selectedIds.push(...selectedWireIds);

        // Apply selection based on modifier keys
        if (hasModifier(e)) {
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
    [
      selectionBox,
      isDragSelecting,
      components,
      wires,
      junctions,
      setSelection,
      addToSelection,
    ]
  );

  // Handle click on a component
  const handleComponentClick = useCallback(
    (componentId: string, e: React.MouseEvent) => {
      e.stopPropagation();

      if (isToggleSelection(e)) {
        // Ctrl/Cmd+click: Toggle selection
        toggleSelection(componentId);
      } else if (isAddToSelection(e)) {
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

      if (isToggleSelection(e)) {
        toggleSelection(wireId);
      } else if (isAddToSelection(e)) {
        addToSelection(wireId);
      } else {
        setSelection([wireId]);
      }
    },
    [setSelection, addToSelection, toggleSelection]
  );

  // Handle click on a junction
  const handleJunctionClick = useCallback(
    (junctionId: string, e: React.MouseEvent) => {
      e.stopPropagation();

      if (isToggleSelection(e)) {
        toggleSelection(junctionId);
      } else if (isAddToSelection(e)) {
        addToSelection(junctionId);
      } else {
        setSelection([junctionId]);
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
    handleJunctionClick,
    isDragSelecting,
  };
}

export default useSelectionHandler;
