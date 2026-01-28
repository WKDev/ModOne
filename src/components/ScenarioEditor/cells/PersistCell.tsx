/**
 * PersistCell Component
 *
 * Checkbox for persist option with auto-focus behavior for duration cell.
 */

import { memo, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';

// ============================================================================
// Types
// ============================================================================

interface PersistCellProps {
  /** Whether persist is enabled */
  value: boolean;
  /** Callback when value changes */
  onChange: (value: boolean) => void;
  /** Callback to focus duration cell when unchecked */
  onFocusDuration?: () => void;
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

export const PersistCell = memo(function PersistCell({
  value,
  onChange,
  onFocusDuration,
  onKeyDown,
  onFocus,
  disabled = false,
  autoFocus = false,
}: PersistCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    onChange(newValue);

    // If unchecked, focus duration cell
    if (!newValue) {
      setTimeout(() => {
        onFocusDuration?.();
      }, 0);
    }
  }, [onChange, onFocusDuration]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case ' ':
        // Let checkbox handle space naturally
        break;
      default:
        onKeyDown?.(e);
    }
  }, [onKeyDown]);

  return (
    <div className="flex items-center justify-center h-8">
      <input
        ref={inputRef}
        type="checkbox"
        checked={value}
        onChange={handleChange}
        onFocus={onFocus}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          w-4 h-4 accent-blue-500 cursor-pointer
          focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      />
    </div>
  );
});

export default PersistCell;
