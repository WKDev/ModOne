/**
 * TimeCell Component
 *
 * Number input for time values with precise formatting and auto-sort trigger.
 */

import { memo, useState, useRef, useCallback, useEffect, type KeyboardEvent, type FocusEvent } from 'react';

// ============================================================================
// Types
// ============================================================================

interface TimeCellProps {
  /** Current time value in seconds */
  value: number;
  /** Callback when value changes */
  onChange: (value: number) => void;
  /** Callback to request event sorting after edit */
  onSortRequest?: () => void;
  /** Callback for keyboard navigation */
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** Callback when cell gains focus */
  onFocus?: () => void;
  /** Whether the cell is disabled */
  disabled?: boolean;
  /** Whether the cell should auto-focus */
  autoFocus?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const TimeCell = memo(function TimeCell({
  value,
  onChange,
  onSortRequest,
  onKeyDown,
  onFocus,
  disabled = false,
  autoFocus = false,
}: TimeCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync editValue when value prop changes (from external updates)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value.toString());
    }
  }, [value, isEditing]);

  // Auto-focus when requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleFocus = useCallback((e: FocusEvent<HTMLInputElement>) => {
    setIsEditing(true);
    e.target.select();
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);

    // Parse and validate value
    let newValue = parseFloat(editValue) || 0;
    newValue = Math.max(0, newValue); // Clamp to non-negative

    // Update value if changed
    if (newValue !== value) {
      onChange(newValue);
      // Request sorting after value commit
      onSortRequest?.();
    }

    setEditValue(newValue.toString());
  }, [editValue, value, onChange, onSortRequest]);

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
        setEditValue(value.toString());
        setIsEditing(false);
        inputRef.current?.blur();
        break;
      default:
        onKeyDown?.(e);
    }
  }, [value, onKeyDown]);

  // Format display value
  const displayValue = isEditing ? editValue : value.toFixed(3);

  return (
    <input
      ref={inputRef}
      type="number"
      value={displayValue}
      step="0.001"
      min="0"
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={`
        w-full px-2 py-1 h-8 text-sm text-right
        bg-transparent border-none outline-none
        focus:ring-2 focus:ring-blue-500 focus:rounded
        disabled:opacity-50 disabled:cursor-not-allowed
        [appearance:textfield]
        [&::-webkit-outer-spin-button]:appearance-none
        [&::-webkit-inner-spin-button]:appearance-none
      `}
    />
  );
});

export default TimeCell;
