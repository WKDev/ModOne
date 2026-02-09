/**
 * Scenario Cell Component
 *
 * Wrapper component that delegates to individual cell implementations based on column type.
 */

import { memo, useEffect, useRef, type KeyboardEvent } from 'react';
import { Check } from 'lucide-react';
import { TimeCell } from './cells/TimeCell';
import { AddressCell } from './cells/AddressCell';
import { ValueCell } from './cells/ValueCell';
import { PersistCell } from './cells/PersistCell';
import { DurationCell } from './cells/DurationCell';
import { NoteCell } from './cells/NoteCell';
import { parseAddress } from './utils/addressParser';
import type { ScenarioEvent } from '../../types/scenario';

// ============================================================================
// Types
// ============================================================================

type ColumnKey = 'enabled' | 'time' | 'address' | 'value' | 'persist' | 'duration' | 'note';

interface ScenarioCellProps {
  event: ScenarioEvent;
  column: ColumnKey;
  isFocused: boolean;
  isEditing: boolean;
  isCompleted?: boolean;
  onFocus: () => void;
  onEdit: () => void;
  onUpdate: (value: unknown) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  readonly?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const ScenarioCell = memo(function ScenarioCell({
  event,
  column,
  isFocused,
  isEditing: _isEditing,
  isCompleted,
  onFocus,
  onEdit: _onEdit,
  onUpdate,
  onKeyDown,
  readonly,
}: ScenarioCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocused]);

  switch (column) {
    case 'enabled':
      return (
        <div className="flex items-center justify-center h-8 relative">
          <input
            type="checkbox"
            checked={event.enabled}
            onChange={(e) => onUpdate(e.target.checked)}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            disabled={readonly}
            className="w-4 h-4 accent-blue-500 cursor-pointer"
          />
          {isCompleted && (
            <Check
              size={12}
              className="absolute -top-0.5 -right-0.5 text-green-500 bg-neutral-800 rounded-full p-0.5"
            />
          )}
        </div>
      );

    case 'time':
      return (
        <TimeCell
          value={event.time}
          onChange={(value) => onUpdate(value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          disabled={readonly}
          autoFocus={isFocused}
        />
      );

    case 'address':
      return (
        <AddressCell
          value={event.address}
          onChange={(value) => onUpdate(value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          disabled={readonly}
          autoFocus={isFocused}
        />
      );

    case 'value': {
      const parsed = parseAddress(event.address);
      const addressType = parsed?.type ?? null;
      return (
        <ValueCell
          value={event.value}
          addressType={addressType}
          onChange={(value) => onUpdate(value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          disabled={readonly}
          autoFocus={isFocused}
        />
      );
    }

    case 'persist':
      return (
        <PersistCell
          value={event.persist}
          onChange={(value) => onUpdate(value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          disabled={readonly}
          autoFocus={isFocused}
        />
      );

    case 'duration':
      return (
        <DurationCell
          value={event.persistDuration}
          isPersisted={event.persist}
          onChange={(value) => onUpdate(value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          disabled={readonly}
          autoFocus={isFocused}
        />
      );

    case 'note':
      return (
        <NoteCell
          value={event.note}
          onChange={(value) => onUpdate(value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          disabled={readonly}
          autoFocus={isFocused}
        />
      );

    default:
      return null;
  }
});

export default ScenarioCell;
