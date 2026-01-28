/**
 * ValueCell Component
 *
 * Conditional input: toggle for coils (0/1), number input for registers (0-65535).
 */

import { memo, useState, useRef, useCallback, useEffect, type KeyboardEvent, type FocusEvent } from 'react';

// ============================================================================
// Types
// ============================================================================

interface ValueCellProps {
  /** Current value */
  value: number;
  /** Address type: 'coil' for toggle, others for number input */
  addressType: 'coil' | 'discrete' | 'holding' | 'input' | null;
  /** Callback when value changes */
  onChange: (value: number) => void;
  /** Callback for keyboard navigation */
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement | HTMLButtonElement>) => void;
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

export const ValueCell = memo(function ValueCell({
  value,
  addressType,
  onChange,
  onKeyDown,
  onFocus,
  disabled = false,
  autoFocus = false,
}: ValueCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Sync editValue when value prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value.toString());
    }
  }, [value, isEditing]);

  // Auto-focus when requested
  useEffect(() => {
    if (autoFocus) {
      if (addressType === 'coil' || addressType === 'discrete') {
        buttonRef.current?.focus();
      } else {
        inputRef.current?.focus();
      }
    }
  }, [autoFocus, addressType]);

  // For coil/discrete types, render toggle button
  if (addressType === 'coil' || addressType === 'discrete') {
    const isOn = value === 1;

    const handleToggle = () => {
      if (disabled) return;
      onChange(isOn ? 0 : 1);
    };

    const handleKeyDownToggle = (e: KeyboardEvent<HTMLButtonElement>) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          handleToggle();
          break;
        default:
          onKeyDown?.(e);
      }
    };

    return (
      <button
        ref={buttonRef}
        onClick={handleToggle}
        onFocus={onFocus}
        onKeyDown={handleKeyDownToggle}
        disabled={disabled}
        className={`
          w-full h-8 px-2 py-1 text-sm font-semibold rounded
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isOn
            ? 'bg-green-600 text-white hover:bg-green-500'
            : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
          }
        `}
      >
        {isOn ? 'ON' : 'OFF'}
      </button>
    );
  }

  // For register types, render number input
  const handleFocus = useCallback((e: FocusEvent<HTMLInputElement>) => {
    setIsEditing(true);
    e.target.select();
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);

    // Parse and validate value
    let newValue = parseInt(editValue, 10) || 0;
    newValue = Math.max(0, Math.min(65535, newValue)); // Clamp to u16 range

    if (newValue !== value) {
      onChange(newValue);
    }

    setEditValue(newValue.toString());
  }, [editValue, value, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  }, []);

  const handleKeyDownInput = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
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

  return (
    <input
      ref={inputRef}
      type="number"
      value={editValue}
      min="0"
      max="65535"
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDownInput}
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

export default ValueCell;
