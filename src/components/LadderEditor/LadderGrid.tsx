/**
 * LadderGrid Component
 *
 * The core ladder diagram grid component that renders a configurable grid
 * with power rail (left), ladder cells (middle), and neutral rail (right).
 * Supports element placement, selection, and keyboard navigation.
 */

import { useCallback, useMemo, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useLadderStore, selectCurrentNetwork, selectSelectedElementIds, selectGridConfig } from '../../stores/ladderStore';
import { PowerRail } from './PowerRail';
import { NeutralRail } from './NeutralRail';
import { LadderCell } from './LadderCell';
import { LadderElementRenderer } from './elements';
import type { GridPosition, LadderElement } from '../../types/ladder';

export interface LadderGridProps {
  /** Network ID to render */
  networkId: string;
  /** Number of columns (default: from store config) */
  columnCount?: number;
  /** Cell width in pixels (default: from store config) */
  cellWidth?: number;
  /** Cell height in pixels (default: from store config) */
  cellHeight?: number;
  /** Minimum row count (for empty networks) */
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
  networkId: _networkId, // TODO: Use to select specific network instead of current
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

  // Store state
  const network = useLadderStore(selectCurrentNetwork);
  const selectedIds = useLadderStore(selectSelectedElementIds);
  const gridConfig = useLadderStore(selectGridConfig);

  // Store actions
  const setSelection = useLadderStore((state) => state.setSelection);
  const toggleSelection = useLadderStore((state) => state.toggleSelection);
  const addToSelection = useLadderStore((state) => state.addToSelection);
  const clearSelection = useLadderStore((state) => state.clearSelection);

  // Use props if provided, otherwise use store config
  const columnCount = columnCountProp ?? gridConfig.columns;
  const cellWidth = cellWidthProp ?? gridConfig.cellWidth;
  const cellHeight = cellHeightProp ?? gridConfig.cellHeight;

  // Calculate grid dimensions
  const { elements, rowCount } = useMemo(() => {
    if (!network) {
      return { elements: new Map<string, LadderElement>(), rowCount: minRowCount };
    }

    // Find max row from elements
    let maxRow = minRowCount - 1;
    network.elements.forEach((element) => {
      if (element.position.row > maxRow) {
        maxRow = element.position.row;
      }
    });

    return {
      elements: network.elements,
      rowCount: Math.max(minRowCount, maxRow + 1),
    };
  }, [network, minRowCount]);

  // Build element position map for quick lookup
  const elementPositionMap = useMemo(() => {
    const map = new Map<string, LadderElement>();
    elements.forEach((element) => {
      const key = `${element.position.row}-${element.position.col}`;
      map.set(key, element);
    });
    return map;
  }, [elements]);

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

  // Handle cell click
  const handleCellClick = useCallback(
    (position: GridPosition, shiftKey: boolean, ctrlKey: boolean) => {
      if (readonly) return;

      const element = getElementAt(position.row, position.col);

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
    [readonly, getElementAt, toggleSelection, addToSelection, setSelection, clearSelection]
  );

  // Handle cell double-click
  const handleCellDoubleClick = useCallback(
    (position: GridPosition) => {
      if (readonly) return;

      const element = getElementAt(position.row, position.col);
      if (element) {
        // TODO: Open element properties editor
        console.log('Double-click on element:', element);
      }
    },
    [readonly, getElementAt]
  );

  // Handle keyboard navigation
  useEffect(() => {
    const container = containerRef.current;
    if (!container || readonly) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // TODO: Implement keyboard navigation in Task 78
      // For now, just handle Delete key
      if (e.key === 'Delete' && selectedIds.size > 0) {
        // Will be implemented in Task 78
        console.log('Delete pressed, selected:', Array.from(selectedIds));
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [readonly, selectedIds]);

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
            readonly={readonly}
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
    readonly,
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
