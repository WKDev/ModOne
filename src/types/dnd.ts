import { PanelType } from './panel';

// ============================================================================
// Tag Drag-and-Drop Types
// ============================================================================

/** Drag source type discriminator for tag browser drags */
export const TAG_DRAG_TYPE = 'tag-list-item' as const;

/** Droppable ID for the watch list drop zone */
export const WATCH_LIST_DROP_ID = 'watch-list-drop-zone' as const;

/**
 * Data carried during a tag drag operation from the tag list.
 * When multi-select is active, `tagIds` contains all selected tag IDs.
 */
export interface TagDragData {
  /** Discriminator so the handler can distinguish tag drags from panel drags */
  type: typeof TAG_DRAG_TYPE;
  /** The primary tag ID being dragged */
  tagId: string;
  /** All selected tag IDs (for multi-select drag) */
  tagIds: string[];
}

// ============================================================================
// Panel Drag-and-Drop Types
// ============================================================================

/**
 * Position where a panel can be dropped relative to another panel
 */
export type DropPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

/**
 * Data carried during a panel drag operation
 */
export interface PanelDragData {
  /** ID of the panel being dragged */
  panelId: string;
  /** Type of the panel being dragged */
  panelType: PanelType;
  /** Original grid area of the panel */
  sourceGridArea: string;
  /** Title of the panel */
  title: string;
}

/**
 * Result of a panel drop operation
 */
export interface PanelDropResult {
  /** ID of the panel that was dropped on */
  targetPanelId: string;
  /** Position relative to the target where the drop occurred */
  dropPosition: DropPosition;
  /** Grid area of the target panel */
  targetGridArea: string;
}

/**
 * Active drag state
 */
export interface DragState {
  /** The panel being dragged */
  activePanel: PanelDragData | null;
  /** The panel being hovered over */
  overPanel: string | null;
  /** The drop position being hovered */
  overPosition: DropPosition | null;
}

/**
 * Drop zone definition for a panel
 */
export interface DropZoneRect {
  position: DropPosition;
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Calculate drop zones for a panel given its bounding rect
 */
export function calculateDropZones(rect: DOMRect): DropZoneRect[] {
  const edgeSize = 0.25; // 25% of each edge for drop zones

  return [
    // Top edge
    {
      position: 'top',
      top: 0,
      left: 0,
      width: rect.width,
      height: rect.height * edgeSize,
    },
    // Bottom edge
    {
      position: 'bottom',
      top: rect.height * (1 - edgeSize),
      left: 0,
      width: rect.width,
      height: rect.height * edgeSize,
    },
    // Left edge
    {
      position: 'left',
      top: rect.height * edgeSize,
      left: 0,
      width: rect.width * edgeSize,
      height: rect.height * (1 - 2 * edgeSize),
    },
    // Right edge
    {
      position: 'right',
      top: rect.height * edgeSize,
      left: rect.width * (1 - edgeSize),
      width: rect.width * edgeSize,
      height: rect.height * (1 - 2 * edgeSize),
    },
    // Center
    {
      position: 'center',
      top: rect.height * edgeSize,
      left: rect.width * edgeSize,
      width: rect.width * (1 - 2 * edgeSize),
      height: rect.height * (1 - 2 * edgeSize),
    },
  ];
}

/**
 * Determine drop position from mouse coordinates relative to target element
 */
export function getDropPosition(
  mouseX: number,
  mouseY: number,
  rect: DOMRect
): DropPosition {
  const relX = mouseX - rect.left;
  const relY = mouseY - rect.top;
  const edgeThreshold = 0.25;

  // Check edges first
  if (relY < rect.height * edgeThreshold) {
    return 'top';
  }
  if (relY > rect.height * (1 - edgeThreshold)) {
    return 'bottom';
  }
  if (relX < rect.width * edgeThreshold) {
    return 'left';
  }
  if (relX > rect.width * (1 - edgeThreshold)) {
    return 'right';
  }

  return 'center';
}
