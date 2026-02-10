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

import { useCallback, useRef, useMemo } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import {
  useInteractionStore,
  selectIsBoxSelecting,
  selectBoxSelectingData,
} from '../../../stores/interactionStore';
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
import { DRAG_THRESHOLD_PX } from '../constants/interaction';

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
  /** Override selection setter */
  setSelection?: (ids: string[]) => void;
  /** Override add-to-selection behavior */
  addToSelection?: (id: string) => void;
  /** Override toggle-selection behavior */
  toggleSelection?: (id: string) => void;
  /** Override clear-selection behavior */
  clearSelection?: () => void;
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

const DRAG_THRESHOLD = DRAG_THRESHOLD_PX; // Pixels to move before starting drag-select

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

  const isDragSelecting = useInteractionStore(selectIsBoxSelecting);
  const boxSelectingData = useInteractionStore(selectBoxSelectingData);
  const enterBoxSelecting = useInteractionStore((s) => s.enterBoxSelecting);
  const updateBoxSelecting = useInteractionStore((s) => s.updateBoxSelecting);
  const exitBoxSelecting = useInteractionStore((s) => s.exitBoxSelecting);

  // Derive selectionBox from interactionStore data
  const selectionBox = boxSelectingData?.selectionBox ?? null;

  // State version for geometry cache invalidation
  // Increment whenever components/wires/junctions change
  const stateVersionRef = useRef(0);

  // Store actions
  const globalSetSelection = useCanvasStore((state) => state.setSelection);
  const globalAddToSelection = useCanvasStore((state) => state.addToSelection);
  const globalToggleSelection = useCanvasStore((state) => state.toggleSelection);
  const globalClearSelection = useCanvasStore((state) => state.clearSelection);

  // Use provided state or fall back to global store
  const globalComponents = useCanvasStore((state) => state.components);
  const globalWires = useCanvasStore((state) => state.wires);
  const globalJunctions = useCanvasStore((state) => state.junctions);

  const components = options.components ?? globalComponents;
  const wires = options.wires ?? globalWires;
  const junctions = options.junctions ?? globalJunctions;
  const zoom = options.zoom ?? 1;
  const setSelection = options.setSelection ?? globalSetSelection;
  const addToSelection = options.addToSelection ?? globalAddToSelection;
  const toggleSelection = options.toggleSelection ?? globalToggleSelection;
  const clearSelection = options.clearSelection ?? globalClearSelection;

  // Increment state version whenever data changes (triggers geometry recomputation)
  // Using useMemo with size checks to detect changes
  useMemo(() => {
    stateVersionRef.current++;
  }, [components.size, wires.length, junctions.size]);

  // Wire geometry cache (persistent across renders)
  const geometryCache = useRef(new WireGeometryCache());

  // Handle mouse down on canvas (not on a component)
  const handleCanvasMouseDown = useCallback(
    (_e: React.MouseEvent, canvasPosition: Position) => {
      // Only handle left click
      if (_e.button !== 0) return;

      // Check if we're in IDLE mode before starting box select
      const modeType = useInteractionStore.getState().mode.type;
      if (modeType !== 'IDLE') return;

      enterBoxSelecting(canvasPosition);
    },
    [enterBoxSelecting]
  );

  // Handle mouse move on canvas
  const handleCanvasMouseMove = useCallback(
    (_e: React.MouseEvent, canvasPosition: Position) => {
      if (!boxSelectingData) return;
      // Get latest data imperatively for threshold check
      const data = useInteractionStore.getState().mode;
      if (data.type !== 'BOX_SELECTING') return;
      const bsData = data.data;

      if (!bsData.hasPassedThreshold) {
        const dx = Math.abs(canvasPosition.x - bsData.mouseDownPos.x);
        const dy = Math.abs(canvasPosition.y - bsData.mouseDownPos.y);
        const canvasThreshold = DRAG_THRESHOLD / zoom;
        if (dx > canvasThreshold || dy > canvasThreshold) {
          updateBoxSelecting({
            hasPassedThreshold: true,
            selectionBox: { start: bsData.mouseDownPos, end: canvasPosition },
          });
        }
        return;
      }

      updateBoxSelecting({
        selectionBox: { start: bsData.mouseDownPos, end: canvasPosition },
      });
    },
    [boxSelectingData, zoom, updateBoxSelecting]
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
          if (isBlockInBox(component, collisionBox, collisionMode)) {
            selectedIds.push(component.id);
          }
        });

        // Select junctions based on drag direction
        junctions.forEach((junction) => {
          if (isJunctionInBox(junction, collisionBox)) {
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
      } else if (!isDragSelecting) {
        // Only clear selection if we did NOT drag-select
        const target = e.target as HTMLElement;
        const isClickingBlock = target.closest('[data-block-id]');
        const isClickingWire = target.closest('[data-wire-id]');
        const isClickingPort = target.closest('[data-port-id]');
        const isClickingJunction = target.closest('[data-junction-id]');

        const isClickingInteractive = isClickingBlock || isClickingWire || isClickingPort || isClickingJunction;
        if (!isClickingInteractive && !hasModifier(e)) {
          clearSelection();
        }
      }

      // Reset drag state
      exitBoxSelecting();
    },
    [
      selectionBox,
      isDragSelecting,
      components,
      wires,
      junctions,
      setSelection,
      addToSelection,
      clearSelection,
      exitBoxSelecting,
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
