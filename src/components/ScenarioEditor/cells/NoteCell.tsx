/**
 * NoteCell Component
 *
 * Text input with truncation in display mode and full expansion in edit mode.
 */

import { memo, useState, useRef, useCallback, useEffect, type KeyboardEvent, type FocusEvent } from 'react';

// ============================================================================
// Types
// ============================================================================

interface NoteCellProps {
  /** Current note value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
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

export const NoteCell = memo(function NoteCell({
  value,
  onChange,
  onKeyDown,
  onFocus,
  disabled = false,
  autoFocus = false,
}: NoteCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync editValue when value prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
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
    // Move cursor to end
    e.target.selectionStart = e.target.selectionEnd = e.target.value.length;
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);

    if (editValue !== value) {
      onChange(editValue);
    }
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
        setEditValue(value);
        setIsEditing(false);
        inputRef.current?.blur();
        break;
      default:
        onKeyDown?.(e);
    }
  }, [value, onKeyDown]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={editValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      placeholder="Note..."
      className={`
        w-full px-2 py-1 h-8 text-sm
        bg-transparent border-none outline-none
        focus:ring-2 focus:ring-blue-500 focus:rounded
        disabled:opacity-50 disabled:cursor-not-allowed
        ${!isEditing ? 'truncate' : ''}
      `}
    />
  );
});

export default NoteCell;
