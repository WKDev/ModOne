/**
 * Number Input Popover Component
 *
 * A popover with numpad for entering register values.
 * Supports DEC and HEX input modes.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import { Numpad } from './Numpad';
import { parseInputValue } from './utils/formatters';
import type { NumberInputMode } from './types';

// ============================================================================
// Types
// ============================================================================

interface NumberInputPopoverProps {
  /** Initial value to display */
  initialValue: number;
  /** Memory address being edited */
  address: number;
  /** Callback when value is applied */
  onApply: (value: number) => void;
  /** Callback when editing is cancelled */
  onCancel: () => void;
  /** Position for the popover */
  position: { x: number; y: number };
}

// ============================================================================
// Component
// ============================================================================

/**
 * Popover for entering numeric values with numpad and DEC/HEX modes.
 */
export function NumberInputPopover({
  initialValue,
  address,
  onApply,
  onCancel,
  position,
}: NumberInputPopoverProps) {
  const [inputMode, setInputMode] = useState<NumberInputMode>('DEC');
  const [inputValue, setInputValue] = useState(() =>
    inputMode === 'HEX'
      ? initialValue.toString(16).toUpperCase()
      : initialValue.toString()
  );
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Update input value when mode changes
  useEffect(() => {
    const parsed = parseInputValue(inputValue, inputMode === 'HEX' ? 'DEC' : 'HEX');
    if (parsed !== null) {
      setInputValue(
        inputMode === 'HEX'
          ? parsed.toString(16).toUpperCase()
          : parsed.toString()
      );
    }
  }, [inputMode]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Handle numpad key press
  const handleKeyPress = useCallback(
    (key: string) => {
      setInputValue((prev) => {
        // Replace if current value is just '0'
        const newValue = prev === '0' ? key : prev + key;

        // Validate the new value
        const parsed = parseInputValue(newValue, inputMode === 'HEX' ? 'HEX' : 'DEC');
        if (parsed !== null && parsed <= 65535) {
          setError(null);
          return newValue;
        }

        // Keep previous value if invalid
        return prev;
      });
    },
    [inputMode]
  );

  // Handle backspace
  const handleBackspace = useCallback(() => {
    setInputValue((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    setError(null);
  }, []);

  // Handle clear
  const handleClear = useCallback(() => {
    setInputValue('0');
    setError(null);
  }, []);

  // Handle apply
  const handleApply = useCallback(() => {
    const parsed = parseInputValue(inputValue, inputMode === 'HEX' ? 'HEX' : 'DEC');
    if (parsed !== null && parsed >= 0 && parsed <= 65535) {
      onApply(parsed);
    } else {
      setError('Invalid value (0-65535)');
    }
  }, [inputValue, inputMode, onApply]);

  // Handle input change (direct typing)
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.toUpperCase();

      // Allow empty or valid input
      if (value === '') {
        setInputValue('0');
        setError(null);
        return;
      }

      // Validate characters based on mode
      const validChars = inputMode === 'HEX' ? /^[0-9A-F]*$/ : /^[0-9]*$/;
      if (!validChars.test(value)) {
        return;
      }

      // Validate value range
      const parsed = parseInputValue(value, inputMode === 'HEX' ? 'HEX' : 'DEC');
      if (parsed !== null && parsed <= 65535) {
        setInputValue(value);
        setError(null);
      } else if (parsed !== null) {
        setError('Value exceeds 65535');
      }
    },
    [inputMode]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleApply();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, handleApply]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };

    // Delay adding listener to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onCancel]);

  // Calculate position to keep popover in viewport
  const adjustedPosition = {
    left: Math.min(position.x, window.innerWidth - 280),
    top: Math.min(position.y, window.innerHeight - 320),
  };

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 rounded-lg border border-neutral-600 bg-neutral-800 p-3 shadow-xl"
      style={adjustedPosition}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-neutral-400">Address: {address}</span>
        <div className="flex gap-1">
          <button
            type="button"
            className={`rounded px-2 py-1 text-xs transition-colors ${
              inputMode === 'DEC'
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
            }`}
            onClick={() => setInputMode('DEC')}
          >
            DEC
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 text-xs transition-colors ${
              inputMode === 'HEX'
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
            }`}
            onClick={() => setInputMode('HEX')}
          >
            HEX
          </button>
        </div>
      </div>

      {/* Input field */}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        className="mb-2 w-full rounded border border-neutral-600 bg-neutral-900 px-2 py-1 font-mono text-lg text-white"
        spellCheck={false}
      />

      {/* Error message */}
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      {/* Numpad */}
      <Numpad
        isHexMode={inputMode === 'HEX'}
        onKeyPress={handleKeyPress}
        onBackspace={handleBackspace}
        onClear={handleClear}
      />

      {/* Action buttons */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-1 rounded bg-neutral-700 py-2 text-sm text-white transition-colors hover:bg-neutral-600"
          onClick={onCancel}
        >
          <X size={16} />
          Cancel
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-1 rounded bg-blue-600 py-2 text-sm text-white transition-colors hover:bg-blue-500"
          onClick={handleApply}
        >
          <Check size={16} />
          Apply
        </button>
      </div>
    </div>
  );
}

export default NumberInputPopover;
