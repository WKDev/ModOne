/**
 * Scenario Grid Component
 *
 * Spreadsheet-like grid for displaying and editing scenario events.
 */

import {
  memo,
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { Plus } from 'lucide-react';
import { useScenarioStore, selectEvents, selectExecutionState, selectSelectedEventIds } from '../../stores/scenarioStore';
import { ScenarioRow } from './ScenarioRow';
import { ScenarioContextMenu } from './ScenarioContextMenu';
import { COLUMNS, GRID_TEMPLATE_COLUMNS } from './constants';

// ============================================================================
// Types
// ============================================================================

interface ScenarioGridProps {
  /** Whether the grid is in readonly mode */
  readonly?: boolean;
  /** Height of the grid container */
  height?: string;
}

interface CellPosition {
  row: number;
  column: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

// (Moved to ScenarioRow.tsx)

// ============================================================================
// Main Component
// ============================================================================

export const ScenarioGrid = memo(function ScenarioGrid({
  readonly = false,
  height = '400px',
}: ScenarioGridProps) {
  const events = useScenarioStore(selectEvents);
  const executionState = useScenarioStore(selectExecutionState);
  const selectedEventIds = useScenarioStore(selectSelectedEventIds);
  const addEvent = useScenarioStore((state) => state.addEvent);
  const selectEvent = useScenarioStore((state) => state.selectEvent);
  const selectRange = useScenarioStore((state) => state.selectRange);
  const removeSelectedEvents = useScenarioStore((state) => state.removeSelectedEvents);
  const duplicateEvent = useScenarioStore((state) => state.duplicateEvent);
  const toggleEventEnabled = useScenarioStore((state) => state.toggleEventEnabled);

  // Focus state
  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null);
  const [lastSelectedRow, setLastSelectedRow] = useState<number | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowIndex: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active event row during execution
  useEffect(() => {
    if (
      executionState.status === 'running' &&
      executionState.currentEventIndex !== null &&
      executionState.currentEventIndex >= 0 &&
      executionState.currentEventIndex < events.length
    ) {
      const activeEvent = events[executionState.currentEventIndex];
      if (activeEvent) {
        const row = containerRef.current?.querySelector(
          `[data-event-id="${activeEvent.id}"]`
        ) as HTMLElement | null;
        if (row) {
          // Check if row is visible in the container
          const container = containerRef.current;
          if (container) {
            const containerRect = container.getBoundingClientRect();
            const rowRect = row.getBoundingClientRect();
            const isVisible =
              rowRect.top >= containerRect.top &&
              rowRect.bottom <= containerRect.bottom;
            if (!isVisible) {
              row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }
        }
      }
    }
  }, [executionState.currentEventIndex, executionState.status, events]);

  // Get selected row indices (memoized to avoid creating new Set every render)
  const selectedIndices = useMemo(
    () =>
      new Set(
        events
          .map((e, i) => (selectedEventIds.includes(e.id) ? i : -1))
          .filter((i) => i >= 0)
      ),
    [events, selectedEventIds]
  );

  // Handle cell focus
  const handleCellFocus = useCallback((row: number, column: number) => {
    setFocusedCell({ row, column });
  }, []);

  // Handle cell edit (no-op: cells are always editable, kept for ScenarioRow API)
  const handleCellEdit = useCallback((_row: number, _column: number) => {
    // Intentionally empty — cells are always editable
  }, []);

  // Handle keyboard navigation
  const handleCellKeyDown = useCallback(
    (e: KeyboardEvent, row: number, column: number) => {
      const totalRows = events.length;
      const totalCols = COLUMNS.length;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (row > 0) {
            setFocusedCell({ row: row - 1, column });
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (row < totalRows - 1) {
            setFocusedCell({ row: row + 1, column });
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (column > 0) {
            setFocusedCell({ row, column: column - 1 });
          } else if (row > 0) {
            setFocusedCell({ row: row - 1, column: totalCols - 1 });
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (column < totalCols - 1) {
            setFocusedCell({ row, column: column + 1 });
          } else if (row < totalRows - 1) {
            setFocusedCell({ row: row + 1, column: 0 });
          }
          break;

        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            // Move backward
            if (column > 0) {
              setFocusedCell({ row, column: column - 1 });
            } else if (row > 0) {
              setFocusedCell({ row: row - 1, column: totalCols - 1 });
            }
          } else {
            // Move forward
            if (column < totalCols - 1) {
              setFocusedCell({ row, column: column + 1 });
            } else if (row < totalRows - 1) {
              setFocusedCell({ row: row + 1, column: 0 });
            }
          }
          break;

        case 'Enter':
          e.preventDefault();
          // Move to next row
          if (row < totalRows - 1) {
            setFocusedCell({ row: row + 1, column });
          }
          break;

        case 'Delete':
          if (selectedEventIds.length > 0) {
            e.preventDefault();
            removeSelectedEvents();
          }
          break;

        case 'd':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (selectedEventIds.length > 0) {
              selectedEventIds.forEach((id) => duplicateEvent(id));
            }
          }
          break;

        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            events.forEach((event) => selectEvent(event.id, true));
          }
          break;
      }
    },
    [events, selectedEventIds, removeSelectedEvents, duplicateEvent, selectEvent]
  );

  // Handle row click for selection
  const handleRowClick = useCallback(
    (e: MouseEvent, rowIndex: number) => {
      const event = events[rowIndex];
      if (!event) return;

      if (e.shiftKey && lastSelectedRow !== null) {
        // Range selection
        const fromEvent = events[lastSelectedRow];
        if (fromEvent) {
          selectRange(fromEvent.id, event.id);
        }
      } else if (e.ctrlKey || e.metaKey) {
        // Toggle selection
        selectEvent(event.id, true);
      } else {
        // Single selection
        selectEvent(event.id, false);
        setLastSelectedRow(rowIndex);
      }
    },
    [events, lastSelectedRow, selectEvent, selectRange]
  );

  // Handle context menu
  const handleContextMenu = useCallback(
    (e: MouseEvent, rowIndex: number) => {
      e.preventDefault();
      const event = events[rowIndex];
      if (event && !selectedEventIds.includes(event.id)) {
        selectEvent(event.id, false);
      }
      setContextMenu({ x: e.clientX, y: e.clientY, rowIndex });
    },
    [events, selectedEventIds, selectEvent]
  );

  // Context menu actions
  const handleInsertAbove = useCallback(() => {
    if (contextMenu === null) return;
    const refEvent = events[contextMenu.rowIndex];
    addEvent({
      time: refEvent ? Math.max(0, refEvent.time - 0.1) : 0,
      address: 'C:0x0000',
      value: 0,
      persist: true,
      note: '',
      enabled: true,
    });
  }, [contextMenu, events, addEvent]);

  const handleInsertBelow = useCallback(() => {
    if (contextMenu === null) return;
    const refEvent = events[contextMenu.rowIndex];
    addEvent({
      time: refEvent ? refEvent.time + 0.1 : 0,
      address: 'C:0x0000',
      value: 0,
      persist: true,
      note: '',
      enabled: true,
    });
  }, [contextMenu, events, addEvent]);

  const handleDuplicate = useCallback(() => {
    selectedEventIds.forEach((id) => duplicateEvent(id));
  }, [selectedEventIds, duplicateEvent]);

  const handleToggleEnabled = useCallback(() => {
    selectedEventIds.forEach((id) => toggleEventEnabled(id));
  }, [selectedEventIds, toggleEventEnabled]);

  // Add new event
  const handleAddEvent = useCallback(() => {
    const lastEvent = events[events.length - 1];
    addEvent({
      time: lastEvent ? lastEvent.time + 1 : 0,
      address: 'C:0x0000',
      value: 0,
      persist: true,
      note: '',
      enabled: true,
    });
  }, [events, addEvent]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col bg-neutral-900 rounded-lg border border-neutral-700 overflow-hidden"
      style={{ height }}
    >
      {/* Header */}
      <div
        className="grid bg-neutral-800 border-b border-neutral-600 sticky top-0 z-10"
        style={{ gridTemplateColumns: GRID_TEMPLATE_COLUMNS }}
      >
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className="px-2 py-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider"
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
            No events. Click "Add Event" to create one.
          </div>
        ) : (
          events.map((event, index) => (
            <ScenarioRow
              key={event.id}
              event={event}
              rowIndex={index}
              events={events}
              executionState={executionState}
              isSelected={selectedIndices.has(index)}
              focusedCell={focusedCell}
              onCellFocus={handleCellFocus}
              onCellEdit={handleCellEdit}
              onCellKeyDown={handleCellKeyDown}
              onRowClick={handleRowClick}
              onContextMenu={handleContextMenu}
              readonly={readonly}
            />
          ))
        )}
      </div>

      {/* Footer - Add Event Button */}
      {!readonly && (
        <div className="border-t border-neutral-700 p-2">
          <button
            onClick={handleAddEvent}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-700 rounded transition-colors"
          >
            <Plus size={16} />
            Add Event
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ScenarioContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectedCount={selectedEventIds.length}
          onClose={() => setContextMenu(null)}
          onInsertAbove={handleInsertAbove}
          onInsertBelow={handleInsertBelow}
          onDuplicate={handleDuplicate}
          onDelete={removeSelectedEvents}
          onToggleEnabled={handleToggleEnabled}
        />
      )}
    </div>
  );
});

export default ScenarioGrid;
