/**
 * LadderGrid Component
 *
 * The core ladder diagram grid component that renders a configurable grid
 * with power rail (left), ladder cells (middle), and neutral rail (right).
 * Supports element placement, selection, and keyboard navigation.
 */

import { useCallback, useMemo, useRef } from 'react';
import { useDndContext } from '@dnd-kit/core';
import { cn } from '../../lib/utils';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { useLadderDocument } from '../../stores/hooks/useLadderDocument';
import { useLadderUIStore } from '../../stores/ladderUIStore';
import { PowerRail } from './PowerRail';
import { NeutralRail } from './NeutralRail';
import { LadderCell } from './LadderCell';
import { LadderElementRenderer } from './elements';
import { DEFAULT_LADDER_GRID_CONFIG, isWireType } from '../../types/ladder';
import { validatePlacement } from '../../hooks/useLadderDragDrop';
import type { ToolboxDragData, GridElementDragData } from '../../hooks/useLadderDragDrop';
import type { GridPosition, LadderElement, LadderElementType } from '../../types/ladder';

export interface LadderGridProps {
  /** Number of columns (default: from store config) */
  columnCount?: number;
  /** Cell width in pixels (default: from store config) */
  cellWidth?: number;
  /** Cell height in pixels (default: from store config) */
  cellHeight?: number;
  /** Minimum row count (for empty grids) */
  minRowCount?: number;
  /** Whether the grid is in readonly mode */
  readonly?: boolean;
  /** Whether to show row numbers */
  showRowNumbers?: boolean;
  /** Optional additional class names */
  className?: string;
}

/** Default minimum rows to display */
const DEFAULT_MIN_ROWS = 5;

/**
 * LadderGrid - Main ladder diagram grid component
 */
export function LadderGrid({
  columnCount: columnCountProp,
  cellWidth: cellWidthProp,
  cellHeight: cellHeightProp,
  minRowCount = DEFAULT_MIN_ROWS,
  readonly = false,
  showRowNumbers = false,
  className,
}: LadderGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const { documentId } = useDocumentContext();
  const ladderDoc = useLadderDocument(documentId);

  // Document state
  const elements = ladderDoc?.elements ?? new Map<string, LadderElement>();
  const gridConfig = ladderDoc?.gridConfig ?? DEFAULT_LADDER_GRID_CONFIG;

  // UI state/actions
  const selectedIds = useLadderUIStore((state) => state.selectedElementIds);
  const mode = useLadderUIStore((state) => state.mode);
  const monitoringState = useLadderUIStore((state) => state.monitoringState);
  const activeTool = useLadderUIStore((state) => state.activeTool);
  const setSelection = useLadderUIStore((state) => state.setSelection);
  const toggleSelection = useLadderUIStore((state) => state.toggleSelection);
  const addToSelection = useLadderUIStore((state) => state.addToSelection);
  const clearSelection = useLadderUIStore((state) => state.clearSelection);
  const isReadonly = readonly || (mode === 'monitor' && monitoringState !== null);

  // Use props if provided, otherwise use store config
  const columnCount = columnCountProp ?? gridConfig.columns;
  const cellWidth = cellWidthProp ?? gridConfig.cellWidth;
  const cellHeight = cellHeightProp ?? gridConfig.cellHeight;

  // Calculate grid dimensions
  const { elementsMap, rowCount } = useMemo(() => {
    // Find max row from elements
    let maxRow = minRowCount - 1;
    elements.forEach((element) => {
      if (element.position.row > maxRow) {
        maxRow = element.position.row;
      }
    });

    return {
      elementsMap: elements,
      rowCount: Math.max(minRowCount, maxRow + 1),
    };
  }, [elements, minRowCount]);

  // Build element position map for quick lookup
  const elementPositionMap = useMemo(() => {
    const map = new Map<string, LadderElement>();
    elementsMap.forEach((element) => {
      const key = `${element.position.row}-${element.position.col}`;
      map.set(key, element);
    });
    return map;
  }, [elementsMap]);

  // Get element at position
  const getElementAt = useCallback(
    (row: number, col: number): LadderElement | undefined => {
      const key = `${row}-${col}`;
      return elementPositionMap.get(key);
    },
    [elementPositionMap]
  );

  // Check if element is selected
  const isElementSelected = useCallback(
    (element: LadderElement | undefined): boolean => {
      if (!element) return false;
      return selectedIds.has(element.id);
    },
    [selectedIds]
  );

  // Get active drag element type for real-time drop validation
  const { active: activeDrag } = useDndContext();
  const activeDragType: LadderElementType | null = useMemo(() => {
    if (!activeDrag?.data.current) return null;
    const data = activeDrag.data.current as ToolboxDragData | GridElementDragData;
    return data.elementType ?? null;
  }, [activeDrag]);
  const activeDragExcludeId: string | undefined = useMemo(() => {
    if (!activeDrag?.data.current) return undefined;
    const data = activeDrag.data.current as ToolboxDragData | GridElementDragData;
    return data.type === 'grid-element' ? data.elementId : undefined;
  }, [activeDrag]);

  // Validate drop target for a specific cell during drag
  const isValidDropTarget = useCallback(
    (row: number, col: number): boolean => {
      if (!activeDragType) return true; // No drag active, default valid
      const result = validatePlacement(
        activeDragType,
        { row, col },
        elements,
        gridConfig,
        activeDragExcludeId
      );
      return result.valid;
    },
    [activeDragType, activeDragExcludeId, elements, gridConfig]
  );

  // Wire-specific UI state
  const lastWireVPlacement = useLadderUIStore((state) => state.lastWireVPlacement);
  const setLastWireVPlacement = useLadderUIStore((state) => state.setLastWireVPlacement);

  // Handle cell click — includes click-to-place for active tool
  const handleCellClick = useCallback(
    (position: GridPosition, shiftKey: boolean, ctrlKey: boolean) => {
      if (isReadonly) return;

      const element = getElementAt(position.row, position.col);

      // === Wire-specific tool behavior ===
      if (activeTool && ladderDoc) {
        // Feature 2: Shift+Click vertical spanning (wire_v tool + Shift + same column)
        if (activeTool === 'wire_v' && shiftKey && lastWireVPlacement && lastWireVPlacement.col === position.col) {
          ladderDoc.placeVerticalWireSpan(position.col, lastWireVPlacement.row, position.row);
          setLastWireVPlacement(position);
          return;
        }

        // Feature 1: Wire-on-wire merge (wire tool on existing wire element)
        if (element && isWireType(activeTool) && isWireType(element.type)) {
          ladderDoc.mergeWireElement(element.id, activeTool as 'wire_h' | 'wire_v');
          // Track placement for vertical spanning
          if (activeTool === 'wire_v') {
            setLastWireVPlacement(position);
          }
          return;
        }

        // Standard tool placement on empty cell
        if (!element) {
          const validation = validatePlacement(
            activeTool,
            position,
            elements,
            gridConfig,
          );
          if (validation.valid) {
            const newId = ladderDoc.addElement(activeTool, position);
            if (newId) {
              setSelection([newId]);
              // Track wire_v placement for Shift+Click spanning
              if (activeTool === 'wire_v') {
                setLastWireVPlacement(position);
              }
            }
          }
          return;
        }
      }

      // === Standard selection behavior ===
      if (ctrlKey && element) {
        // Toggle selection
        toggleSelection(element.id);
      } else if (shiftKey && element) {
        // Add to selection
        addToSelection(element.id);
      } else if (element) {
        // Single selection
        setSelection([element.id]);
      } else {
        // Click on empty cell - clear selection
        clearSelection();
      }
    },
    [isReadonly, getElementAt, activeTool, elements, gridConfig, ladderDoc, lastWireVPlacement, toggleSelection, addToSelection, setSelection, clearSelection, setLastWireVPlacement]
  );

  // Handle cell double-click
  const handleCellDoubleClick = useCallback(
    (position: GridPosition) => {
      if (isReadonly) return;

      const element = getElementAt(position.row, position.col);
      if (element) {
        // InlineEditPopover is triggered via context menu or keyboard shortcut
      }
    },
    [isReadonly, getElementAt]
  );

  // NOTE: Keyboard shortcuts (Delete, Ctrl+Z, Ctrl+C, etc.) are handled
  // globally by useLadderKeyboardShortcuts hook in LadderEditor.
  // Do NOT add local keydown handlers here to avoid duplicate actions.

  // Calculate total grid width
  const railWidth = 30;
  const rowNumberWidth = showRowNumbers ? 30 : 0;
  const gridWidth = columnCount * cellWidth;
  const totalWidth = rowNumberWidth + railWidth + gridWidth + railWidth;

  // Render rows
  const rows = useMemo(() => {
    const result: React.ReactNode[] = [];

    for (let row = 0; row < rowCount; row++) {
      const cells: React.ReactNode[] = [];

      for (let col = 0; col < columnCount; col++) {
        const element = getElementAt(row, col);
        const isSelected = isElementSelected(element);

        cells.push(
          <LadderCell
            key={`${row}-${col}`}
            row={row}
            col={col}
            width={cellWidth}
            height={cellHeight}
            element={element}
            isSelected={isSelected}
            isValidDropTarget={isValidDropTarget(row, col)}
            hasActiveTool={!!activeTool}
            readonly={isReadonly}
            onClick={handleCellClick}
            onDoubleClick={handleCellDoubleClick}
          >
            {/* Element renderer */}
            {element && (
              <LadderElementRenderer
                element={element}
                width={cellWidth - 4}
                height={cellHeight - 4}
              />
            )}
          </LadderCell>
        );
      }

      result.push(
        <div key={row} className="flex">
          {cells}
        </div>
      );
    }

    return result;
  }, [
    rowCount,
    columnCount,
    cellWidth,
    cellHeight,
    isReadonly,
    isValidDropTarget,
    getElementAt,
    isElementSelected,
    handleCellClick,
    handleCellDoubleClick,
  ]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-auto',
        'bg-neutral-900 border border-neutral-700 rounded',
        className
      )}
      tabIndex={0}
      role="grid"
      aria-label="Ladder diagram grid"
    >
      <div
        ref={gridRef}
        className="inline-flex"
        style={{ minWidth: totalWidth }}
      >
        {/* Row numbers (optional) */}
        {showRowNumbers && (
          <div className="flex flex-col bg-neutral-800 border-r border-neutral-700">
            {Array.from({ length: rowCount }).map((_, row) => (
              <div
                key={row}
                className="flex items-center justify-center text-xs text-neutral-500"
                style={{ width: rowNumberWidth, height: cellHeight }}
              >
                {row + 1}
              </div>
            ))}
          </div>
        )}

        {/* Power Rail (Left) */}
        <PowerRail rowCount={rowCount} cellHeight={cellHeight} />

        {/* Grid Cells */}
        <div className="flex flex-col">{rows}</div>

        {/* Neutral Rail (Right) */}
        <NeutralRail rowCount={rowCount} cellHeight={cellHeight} />
      </div>
    </div>
  );
}

export default LadderGrid;
