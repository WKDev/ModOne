/**
 * useLadderDragDrop Hook
 *
 * Handles drag-and-drop logic for the Ladder Editor, integrating
 * with @dnd-kit and the ladder store for element placement and movement.
 */

import { useCallback } from 'react';
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import { useLadderStore, selectCurrentNetwork, selectGridConfig } from '../stores/ladderStore';
import type { LadderElementType, GridPosition, LadderNetwork, LadderGridConfig } from '../types/ladder';
import { isCoilType } from '../types/ladder';

// ============================================================================
// Types
// ============================================================================

/** Drag data for toolbox items */
export interface ToolboxDragData {
  type: 'toolbox-item';
  elementType: LadderElementType;
}

/** Drag data for grid elements */
export interface GridElementDragData {
  type: 'grid-element';
  elementId: string;
  elementType: LadderElementType;
  originalPosition: GridPosition;
}

/** Drop data for grid cells */
export interface GridCellDropData {
  type: 'grid-cell';
  row: number;
  col: number;
  hasElement: boolean;
  elementId?: string;
}

/** Union of all drag data types */
export type DragData = ToolboxDragData | GridElementDragData;

/** Union of all drop data types */
export type DropData = GridCellDropData;

/** Placement validation result */
export interface PlacementValidation {
  valid: boolean;
  reason?: string;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if a cell is occupied by an element
 */
function isCellOccupied(
  network: LadderNetwork,
  row: number,
  col: number,
  excludeId?: string
): boolean {
  for (const [id, element] of network.elements) {
    if (excludeId && id === excludeId) continue;
    if (element.position.row === row && element.position.col === col) {
      return true;
    }
  }
  return false;
}

/**
 * Check if coil can be placed at position (output columns only)
 */
function canPlaceCoil(col: number, gridConfig: LadderGridConfig): boolean {
  // Coils should be in the last 2 columns
  return col >= gridConfig.columns - 2;
}

/**
 * Check if position is within grid bounds
 */
function isWithinBounds(position: GridPosition, gridConfig: LadderGridConfig): boolean {
  return (
    position.row >= 0 &&
    position.col >= 0 &&
    position.col < gridConfig.columns
  );
}

/**
 * Validate element placement at position
 */
export function validatePlacement(
  elementType: LadderElementType,
  position: GridPosition,
  network: LadderNetwork | null,
  gridConfig: LadderGridConfig,
  excludeId?: string
): PlacementValidation {
  // Check network exists
  if (!network) {
    return { valid: false, reason: 'No network selected' };
  }

  // Check bounds
  if (!isWithinBounds(position, gridConfig)) {
    return { valid: false, reason: 'Position out of bounds' };
  }

  // Check if cell is occupied
  if (isCellOccupied(network, position.row, position.col, excludeId)) {
    return { valid: false, reason: 'Cell is occupied' };
  }

  // Check coil placement rules
  if (isCoilType(elementType)) {
    if (!canPlaceCoil(position.col, gridConfig)) {
      return {
        valid: false,
        reason: 'Coils must be placed in output columns (last 2 columns)',
      };
    }
  }

  // Check that contacts/timers/counters are not in output columns
  if (!isCoilType(elementType) && canPlaceCoil(position.col, gridConfig)) {
    // Allow comparison and other input elements in output area for flexibility
    // but warn for contacts
    if (elementType.startsWith('contact_')) {
      return {
        valid: false,
        reason: 'Contacts should not be placed in output columns',
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// Hook
// ============================================================================

export interface UseLadderDragDropResult {
  /** Handle drag start event */
  handleDragStart: (event: DragStartEvent) => void;
  /** Handle drag over event */
  handleDragOver: (event: DragOverEvent) => void;
  /** Handle drag end event */
  handleDragEnd: (event: DragEndEvent) => void;
  /** Validate if an element can be placed at position */
  canPlaceAt: (elementType: LadderElementType, position: GridPosition, excludeId?: string) => PlacementValidation;
}

/**
 * useLadderDragDrop - Manages drag-and-drop for ladder elements
 */
export function useLadderDragDrop(): UseLadderDragDropResult {
  const network = useLadderStore(selectCurrentNetwork);
  const gridConfig = useLadderStore(selectGridConfig);
  const addElement = useLadderStore((state) => state.addElement);
  const moveElement = useLadderStore((state) => state.moveElement);
  const setSelection = useLadderStore((state) => state.setSelection);

  /**
   * Check if element can be placed at position
   */
  const canPlaceAt = useCallback(
    (elementType: LadderElementType, position: GridPosition, excludeId?: string) => {
      return validatePlacement(elementType, position, network ?? null, gridConfig, excludeId);
    },
    [network, gridConfig]
  );

  /**
   * Handle drag start
   */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;

    if (!data) return;

    // If dragging a grid element, select it
    if (data.type === 'grid-element') {
      setSelection([data.elementId]);
    }
  }, [setSelection]);

  /**
   * Handle drag over (for preview/validation)
   */
  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Can be used for real-time validation feedback
    // Currently handled by DroppableCell's isOver state
  }, []);

  /**
   * Handle drag end - perform the actual drop action
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      // No drop target
      if (!over) return;

      const activeData = active.data.current as DragData | undefined;
      const overData = over.data.current as DropData | undefined;

      if (!activeData || !overData) return;

      // Only handle drops on grid cells
      if (overData.type !== 'grid-cell') return;

      const targetPosition: GridPosition = {
        row: overData.row,
        col: overData.col,
      };

      // Handle toolbox item drop -> create new element
      if (activeData.type === 'toolbox-item') {
        const validation = canPlaceAt(activeData.elementType, targetPosition);

        if (validation.valid) {
          const newId = addElement(activeData.elementType, targetPosition);
          if (newId) {
            setSelection([newId]);
          }
        } else {
          // Could show a toast notification here
          console.warn('Invalid placement:', validation.reason);
        }
        return;
      }

      // Handle grid element drop -> move existing element
      if (activeData.type === 'grid-element') {
        const validation = canPlaceAt(
          activeData.elementType,
          targetPosition,
          activeData.elementId
        );

        if (validation.valid) {
          moveElement(activeData.elementId, targetPosition);
        } else {
          console.warn('Invalid move:', validation.reason);
        }
        return;
      }
    },
    [addElement, moveElement, setSelection, canPlaceAt]
  );

  return {
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    canPlaceAt,
  };
}

export default useLadderDragDrop;
