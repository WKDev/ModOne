/**
 * DurationCell Component
 *
 * Number input for duration with ms suffix, disabled when persist is true.
 */

import { memo, useState, useRef, useCallback, useEffect, type KeyboardEvent, type FocusEvent } from 'react';

// ============================================================================
// Types
// ============================================================================

interface DurationCellProps {
  /** Current duration value in milliseconds */
  value: number | undefined;
  /** Whether persist is enabled (disables this cell when true) */
  isPersisted: boolean;
  /** Callback when value changes */
  onChange: (value: number | undefined) => void;
  /** Callback for keyboard navigation */
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** Callback when cell gains focus */
  onFocus?: () => void;
  /** Whether the cell is disabled (additional to isPersisted) */
  disabled?: boolean;
  /** Whether the cell should auto-focus */
  autoFocus?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_DURATION = 500;

// ============================================================================
// Component
// ============================================================================

export const DurationCell = memo(function DurationCell({
  value,
  isPersisted,
  onChange,
  onKeyDown,
  onFocus,
  disabled = false,
  autoFocus = false,
}: DurationCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const isDisabled = disabled || isPersisted;

  // Sync editValue when value prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value?.toString() ?? '');
    }
  }, [value, isEditing]);

  // Auto-focus when requested
  useEffect(() => {
    if (autoFocus && inputRef.current && !isDisabled) {
      inputRef.current.focus();
    }
  }, [autoFocus, isDisabled]);

  const handleFocus = useCallback((e: FocusEvent<HTMLInputElement>) => {
    setIsEditing(true);
    e.target.select();
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);

    if (editValue === '') {
      onChange(undefined);
      return;
    }

    // Parse and validate value
    let newValue = parseInt(editValue, 10);
    if (isNaN(newValue)) {
      newValue = DEFAULT_DURATION;
    }
    newValue = Math.max(0, newValue); // Ensure non-negative

    if (newValue !== value) {
      onChange(newValue);
    }

    setEditValue(newValue.toString());
  }, [editValue, value, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        inputRef.current?.blur();
        break;
      case 'Escape':
        e.preventDefault();
        setEditValue(value?.toString() ?? '');
        setIsEditing(false);
        inputRef.current?.blur();
        break;
      default:
        onKeyDown?.(e);
    }
  }, [value, onKeyDown]);

  return (
    <div className={`flex items-center h-8 ${isDisabled ? 'opacity-40' : ''}`}>
      <input
        ref={inputRef}
        type="number"
        value={editValue}
        min="0"
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        placeholder={DEFAULT_DURATION.toString()}
        className={`
          flex-1 px-2 py-1 h-8 text-sm text-right
          bg-transparent border-none outline-none
          focus:ring-2 focus:ring-blue-500 focus:rounded
          disabled:cursor-not-allowed
          [appearance:textfield]
          [&::-webkit-outer-spin-button]:appearance-none
          [&::-webkit-inner-spin-button]:appearance-none
        `}
      />
      <span className="flex-shrink-0 pr-2 text-xs text-neutral-500">ms</span>
    </div>
  );
});

export default DurationCell;
