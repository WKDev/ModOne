/**
 * Scenario Row Component
 *
 * Renders a single row in the scenario grid with cells for each column.
 */

import { memo, useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import { useScenarioStore } from '../../stores/scenarioStore';
import { ScenarioCell } from './ScenarioCell';
import type { ScenarioEvent, ScenarioExecutionState } from '../../types/scenario';
import { type ColumnKey, COLUMNS, GRID_TEMPLATE_COLUMNS } from './constants';

// ============================================================================
// Types
// ============================================================================

interface CellPosition {
  row: number;
  column: number;
}

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

// Constants imported from ./constants

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
    classes.push('bg-green-500/20 animate-pulse');
  } else if (isCompleted) {
    classes.push('bg-green-500/5');
  }

  return classes.join(' ');
}

// ============================================================================
// Component
// ============================================================================

export const ScenarioRow = memo(function ScenarioRow({
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
  const isCompleted = executionState.completedEvents.includes(event.id);

  return (
    <div
      className={rowClassName}
      style={{ gridTemplateColumns: GRID_TEMPLATE_COLUMNS }}
      data-event-id={event.id}
      onClick={(e) => onRowClick(e, rowIndex)}
      onContextMenu={(e) => onContextMenu(e, rowIndex)}
    >
      {COLUMNS.map((col, colIndex) => (
        <ScenarioCell
          key={col.key}
          event={event}
          column={col.key}
          isFocused={focusedCell?.row === rowIndex && focusedCell?.column === colIndex}
          isEditing={false}
          isCompleted={col.key === 'enabled' ? isCompleted : undefined}
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

export default ScenarioRow;
