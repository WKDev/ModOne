/**
 * Scenario Grid Component
 *
 * Spreadsheet-like grid for displaying and editing scenario events.
 */

import {
  memo,
  useState,
  useCallback,
  useRef,
  useEffect,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { Plus, Trash2, Copy, ToggleLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useScenarioStore, selectEvents, selectExecutionState, selectSelectedEventIds } from '../../stores/scenarioStore';
import type { ScenarioEvent, ScenarioExecutionState } from '../../types/scenario';
import { isValidModbusAddress } from '../../types/scenario';

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

type ColumnKey = 'enabled' | 'time' | 'address' | 'value' | 'persist' | 'duration' | 'note';

// ============================================================================
// Constants
// ============================================================================

const COLUMNS: { key: ColumnKey; label: string; width: string }[] = [
  { key: 'enabled', label: '', width: '30px' },
  { key: 'time', label: 'Time (s)', width: '80px' },
  { key: 'address', label: 'Address', width: '120px' },
  { key: 'value', label: 'Value', width: '80px' },
  { key: 'persist', label: 'Persist', width: '70px' },
  { key: 'duration', label: 'Duration', width: '80px' },
  { key: 'note', label: 'Note', width: '1fr' },
];

const GRID_TEMPLATE_COLUMNS = COLUMNS.map((c) => c.width).join(' ');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get row class names based on execution state.
 */
function getRowClassName(
  event: ScenarioEvent,
  executionState: ScenarioExecutionState,
  isSelected: boolean,
  events: ScenarioEvent[]
): string {
  const baseClasses = 'grid items-center border-b border-neutral-700 transition-colors duration-200';
  const classes: string[] = [baseClasses];

  // Selection highlighting
  if (isSelected) {
    classes.push('bg-blue-900/30');
  }

  // Disabled state
  if (!event.enabled) {
    classes.push('text-neutral-500 opacity-60');
    return classes.join(' ');
  }

  // Execution state highlighting
  const eventIndex = events.findIndex((e) => e.id === event.id);
  const isCompleted = executionState.completedEvents.includes(event.id);
  const isCurrent = executionState.currentEventIndex === eventIndex && executionState.status === 'running';

  if (isCurrent) {
    classes.push('bg-yellow-900/30 animate-pulse');
  } else if (isCompleted) {
    classes.push('bg-green-900/20');
  }

  return classes.join(' ');
}

/**
 * Validate address and return error class if invalid.
 */
function getAddressCellClass(address: string): string {
  if (!isValidModbusAddress(address)) {
    return 'ring-1 ring-red-500';
  }
  return '';
}

// ============================================================================
// Cell Components
// ============================================================================

interface CellProps {
  event: ScenarioEvent;
  column: ColumnKey;
  isFocused: boolean;
  isEditing: boolean;
  onFocus: () => void;
  onEdit: () => void;
  onUpdate: (value: unknown) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  readonly?: boolean;
}

const Cell = memo(function Cell({
  event,
  column,
  isFocused,
  isEditing: _isEditing,
  onFocus,
  onEdit,
  onUpdate,
  onKeyDown,
  readonly,
}: CellProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocused]);

  const baseClasses = 'px-2 py-1 h-8 text-sm bg-transparent focus:outline-none';
  const focusClasses = isFocused ? 'ring-2 ring-blue-500 rounded' : '';

  switch (column) {
    case 'enabled':
      return (
        <div className="flex items-center justify-center h-8">
          <input
            type="checkbox"
            checked={event.enabled}
            onChange={(e) => onUpdate(e.target.checked)}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            disabled={readonly}
            className="w-4 h-4 accent-blue-500 cursor-pointer"
          />
        </div>
      );

    case 'time':
      return (
        <input
          ref={inputRef}
          type="number"
          value={event.time}
          step="0.001"
          min="0"
          onChange={(e) => onUpdate(parseFloat(e.target.value) || 0)}
          onFocus={onFocus}
          onDoubleClick={onEdit}
          onKeyDown={onKeyDown}
          disabled={readonly}
          className={`${baseClasses} ${focusClasses} w-full text-right`}
        />
      );

    case 'address':
      return (
        <input
          ref={inputRef}
          type="text"
          value={event.address}
          onChange={(e) => onUpdate(e.target.value)}
          onFocus={onFocus}
          onDoubleClick={onEdit}
          onKeyDown={onKeyDown}
          disabled={readonly}
          className={`${baseClasses} ${focusClasses} ${getAddressCellClass(event.address)} w-full font-mono`}
          placeholder="C:0x0000"
        />
      );

    case 'value':
      return (
        <input
          ref={inputRef}
          type="number"
          value={event.value}
          min="0"
          max="65535"
          onChange={(e) => onUpdate(parseInt(e.target.value, 10) || 0)}
          onFocus={onFocus}
          onDoubleClick={onEdit}
          onKeyDown={onKeyDown}
          disabled={readonly}
          className={`${baseClasses} ${focusClasses} w-full text-right`}
        />
      );

    case 'persist':
      return (
        <div className="flex items-center justify-center h-8">
          <input
            type="checkbox"
            checked={event.persist}
            onChange={(e) => onUpdate(e.target.checked)}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            disabled={readonly}
            className="w-4 h-4 accent-blue-500 cursor-pointer"
          />
        </div>
      );

    case 'duration':
      return (
        <input
          ref={inputRef}
          type="number"
          value={event.persistDuration ?? ''}
          min="0"
          onChange={(e) => onUpdate(e.target.value ? parseInt(e.target.value, 10) : undefined)}
          onFocus={onFocus}
          onDoubleClick={onEdit}
          onKeyDown={onKeyDown}
          disabled={readonly || event.persist}
          className={`${baseClasses} ${focusClasses} w-full text-right ${event.persist ? 'opacity-40' : ''}`}
          placeholder="ms"
        />
      );

    case 'note':
      return (
        <input
          ref={inputRef}
          type="text"
          value={event.note}
          onChange={(e) => onUpdate(e.target.value)}
          onFocus={onFocus}
          onDoubleClick={onEdit}
          onKeyDown={onKeyDown}
          disabled={readonly}
          className={`${baseClasses} ${focusClasses} w-full`}
          placeholder="Note..."
        />
      );

    default:
      return null;
  }
});

// ============================================================================
// Row Component
// ============================================================================

interface RowProps {
  event: ScenarioEvent;
  rowIndex: number;
  events: ScenarioEvent[];
  executionState: ScenarioExecutionState;
  isSelected: boolean;
  focusedCell: CellPosition | null;
  onCellFocus: (row: number, column: number) => void;
  onCellEdit: (row: number, column: number) => void;
  onCellKeyDown: (e: KeyboardEvent, row: number, column: number) => void;
  onRowClick: (e: MouseEvent, rowIndex: number) => void;
  onContextMenu: (e: MouseEvent, rowIndex: number) => void;
  readonly?: boolean;
}

const Row = memo(function Row({
  event,
  rowIndex,
  events,
  executionState,
  isSelected,
  focusedCell,
  onCellFocus,
  onCellEdit,
  onCellKeyDown,
  onRowClick,
  onContextMenu,
  readonly,
}: RowProps) {
  const updateEvent = useScenarioStore((state) => state.updateEvent);

  const handleUpdate = useCallback(
    (column: ColumnKey, value: unknown) => {
      const updates: Partial<ScenarioEvent> = {};
      switch (column) {
        case 'enabled':
          updates.enabled = value as boolean;
          break;
        case 'time':
          updates.time = value as number;
          break;
        case 'address':
          updates.address = value as string;
          break;
        case 'value':
          updates.value = value as number;
          break;
        case 'persist':
          updates.persist = value as boolean;
          break;
        case 'duration':
          updates.persistDuration = value as number | undefined;
          break;
        case 'note':
          updates.note = value as string;
          break;
      }
      updateEvent(event.id, updates);
    },
    [event.id, updateEvent]
  );

  const rowClassName = getRowClassName(event, executionState, isSelected, events);

  return (
    <div
      className={rowClassName}
      style={{ gridTemplateColumns: GRID_TEMPLATE_COLUMNS }}
      onClick={(e) => onRowClick(e, rowIndex)}
      onContextMenu={(e) => onContextMenu(e, rowIndex)}
    >
      {COLUMNS.map((col, colIndex) => (
        <Cell
          key={col.key}
          event={event}
          column={col.key}
          isFocused={focusedCell?.row === rowIndex && focusedCell?.column === colIndex}
          isEditing={false}
          onFocus={() => onCellFocus(rowIndex, colIndex)}
          onEdit={() => onCellEdit(rowIndex, colIndex)}
          onUpdate={(value) => handleUpdate(col.key, value)}
          onKeyDown={(e) => onCellKeyDown(e, rowIndex, colIndex)}
          readonly={readonly}
        />
      ))}
    </div>
  );
});

// ============================================================================
// Context Menu Component
// ============================================================================

interface ContextMenuProps {
  x: number;
  y: number;
  selectedCount: number;
  onClose: () => void;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
}

const ContextMenu = memo(function ContextMenu({
  x,
  y,
  selectedCount,
  onClose,
  onInsertAbove,
  onInsertBelow,
  onDuplicate,
  onDelete,
  onToggleEnabled,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const plural = selectedCount > 1 ? 's' : '';

  const menuItems = [
    { icon: ChevronUp, label: 'Insert Row Above', onClick: onInsertAbove },
    { icon: ChevronDown, label: 'Insert Row Below', onClick: onInsertBelow },
    { icon: Copy, label: `Duplicate Row${plural}`, onClick: onDuplicate },
    { icon: ToggleLeft, label: `Toggle Enabled`, onClick: onToggleEnabled },
    { icon: Trash2, label: `Delete Row${plural}`, onClick: onDelete, danger: true },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl py-1 z-50 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item, index) => (
        <button
          key={index}
          className={`
            w-full px-3 py-2 text-sm text-left flex items-center gap-2
            hover:bg-neutral-700 transition-colors
            ${item.danger ? 'text-red-400 hover:text-red-300' : 'text-neutral-200'}
          `}
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          <item.icon size={16} />
          {item.label}
        </button>
      ))}
    </div>
  );
});

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
  const {
    addEvent,
    selectEvent,
    selectRange,
    removeSelectedEvents,
    duplicateEvent,
    toggleEventEnabled,
  } = useScenarioStore();

  // Focus state
  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null);
  const [lastSelectedRow, setLastSelectedRow] = useState<number | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowIndex: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Get selected row indices
  const selectedIndices = new Set(
    events
      .map((e, i) => (selectedEventIds.includes(e.id) ? i : -1))
      .filter((i) => i >= 0)
  );

  // Handle cell focus
  const handleCellFocus = useCallback((row: number, column: number) => {
    setFocusedCell({ row, column });
  }, []);

  // Handle cell edit
  const handleCellEdit = useCallback((_row: number, _column: number) => {
    // For now, cells are always editable
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
            <Row
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
        <ContextMenu
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
