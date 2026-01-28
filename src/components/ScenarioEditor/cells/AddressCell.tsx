/**
 * AddressCell Component
 *
 * Input with autocomplete dropdown, validation, and type icon display.
 */

import { memo, useState, useRef, useCallback, useEffect, type KeyboardEvent, type FocusEvent } from 'react';
import { parseAddress, type ParsedAddress } from '../utils/addressParser';

// ============================================================================
// Types
// ============================================================================

interface AddressCellProps {
  /** Current address value */
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
// Constants
// ============================================================================

const SUGGESTIONS = [
  'C:0x0000',
  'C:0x0001',
  'C:0x0002',
  'DI:0x0000',
  'DI:0x0001',
  'H:0x0000',
  'H:0x0001',
  'H:0x0064',
  'IR:0x0000',
  'IR:0x0001',
];

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  coil: { label: 'C', color: 'bg-blue-600' },
  discrete: { label: 'DI', color: 'bg-green-600' },
  holding: { label: 'H', color: 'bg-purple-600' },
  input: { label: 'IR', color: 'bg-orange-600' },
};

// ============================================================================
// Component
// ============================================================================

export const AddressCell = memo(function AddressCell({
  value,
  onChange,
  onKeyDown,
  onFocus,
  disabled = false,
  autoFocus = false,
}: AddressCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [parsedAddress, setParsedAddress] = useState<ParsedAddress | null>(() => parseAddress(value));

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync editValue when value prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
      setParsedAddress(parseAddress(value));
    }
  }, [value, isEditing]);

  // Auto-focus when requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Filter suggestions based on input
  const filteredSuggestions = editValue
    ? SUGGESTIONS.filter((s) => s.toLowerCase().includes(editValue.toLowerCase()))
    : SUGGESTIONS;

  const handleFocus = useCallback((e: FocusEvent<HTMLInputElement>) => {
    setIsEditing(true);
    setShowDropdown(true);
    e.target.select();
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    // Delay to allow click on dropdown
    setTimeout(() => {
      setIsEditing(false);
      setShowDropdown(false);
      setSelectedIndex(-1);

      // Validate and commit
      const parsed = parseAddress(editValue);
      setParsedAddress(parsed);

      if (editValue !== value) {
        onChange(editValue);
      }
    }, 150);
  }, [editValue, value, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    setEditValue(newValue);
    setParsedAddress(parseAddress(newValue));
    setShowDropdown(true);
    setSelectedIndex(-1);
  }, []);

  const handleSelectSuggestion = useCallback((suggestion: string) => {
    setEditValue(suggestion);
    setParsedAddress(parseAddress(suggestion));
    onChange(suggestion);
    setShowDropdown(false);
    inputRef.current?.focus();
  }, [onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown && filteredSuggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredSuggestions.length - 1 ? prev + 1 : 0
          );
          return;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredSuggestions.length - 1
          );
          return;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0) {
            handleSelectSuggestion(filteredSuggestions[selectedIndex]);
          } else {
            inputRef.current?.blur();
          }
          return;
        case 'Escape':
          e.preventDefault();
          setShowDropdown(false);
          setSelectedIndex(-1);
          return;
      }
    }

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
  }, [showDropdown, filteredSuggestions, selectedIndex, value, onKeyDown, handleSelectSuggestion]);

  const isValid = parsedAddress !== null || editValue === '';
  const typeBadge = parsedAddress ? TYPE_BADGES[parsedAddress.type] : null;

  return (
    <div className="relative flex items-center h-8">
      {/* Type badge */}
      {typeBadge && (
        <span
          className={`
            flex-shrink-0 ml-1 px-1 py-0.5 text-[10px] font-bold rounded
            ${typeBadge.color} text-white
          `}
        >
          {typeBadge.label}
        </span>
      )}

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="C:0x0000"
        className={`
          flex-1 px-2 py-1 h-8 text-sm font-mono
          bg-transparent border-none outline-none
          focus:ring-2 focus:ring-blue-500 focus:rounded
          disabled:opacity-50 disabled:cursor-not-allowed
          ${!isValid && editValue ? 'ring-1 ring-red-500 rounded' : ''}
        `}
      />

      {/* Autocomplete dropdown */}
      {showDropdown && filteredSuggestions.length > 0 && isEditing && (
        <div
          ref={dropdownRef}
          className="
            absolute top-full left-0 right-0 z-50 mt-1
            bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl
            max-h-40 overflow-auto
          "
        >
          {filteredSuggestions.map((suggestion, index) => {
            const parsed = parseAddress(suggestion);
            const badge = parsed ? TYPE_BADGES[parsed.type] : null;

            return (
              <button
                key={suggestion}
                className={`
                  w-full px-2 py-1.5 text-sm text-left flex items-center gap-2
                  hover:bg-neutral-700 transition-colors
                  ${index === selectedIndex ? 'bg-neutral-700' : ''}
                `}
                onMouseDown={() => handleSelectSuggestion(suggestion)}
              >
                {badge && (
                  <span
                    className={`
                      px-1 py-0.5 text-[10px] font-bold rounded
                      ${badge.color} text-white
                    `}
                  >
                    {badge.label}
                  </span>
                )}
                <span className="font-mono">{suggestion}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default AddressCell;
