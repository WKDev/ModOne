/**
 * PropertyField Component
 *
 * Reusable input component for property editors supporting text, number,
 * and select input types with labels and validation.
 */

import { useCallback, useState, useEffect, useId } from 'react';
import { cn } from '../../../lib/utils';

export type PropertyFieldType = 'text' | 'number' | 'select';

export interface SelectOption {
  value: string;
  label: string;
}

export interface PropertyFieldProps {
  /** Field label */
  label: string;
  /** Field type */
  type?: PropertyFieldType;
  /** Current value */
  value: string | number;
  /** Called when value changes */
  onChange: (value: string | number) => void;
  /** Options for select type */
  options?: SelectOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Minimum value for number type */
  min?: number;
  /** Maximum value for number type */
  max?: number;
  /** Step for number type */
  step?: number;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Optional class name */
  className?: string;
  /** Show button to open device selector */
  showDeviceButton?: boolean;
  /** Called when device button is clicked */
  onDeviceButtonClick?: () => void;
}

/**
 * PropertyField - Reusable form field for property editors
 */
export function PropertyField({
  label,
  type = 'text',
  value,
  onChange,
  options = [],
  placeholder,
  disabled = false,
  error,
  min,
  max,
  step,
  debounceMs = 0,
  className,
  showDeviceButton = false,
  onDeviceButtonClick,
}: PropertyFieldProps) {
  const id = useId();
  const [localValue, setLocalValue] = useState(String(value));
  const [debounceTimeout, setDebounceTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Sync local value with prop value
  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const handleChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue);

      // Clear existing timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      const commitChange = () => {
        if (type === 'number') {
          const numValue = parseFloat(newValue);
          if (!isNaN(numValue)) {
            onChange(numValue);
          }
        } else {
          onChange(newValue);
        }
      };

      if (debounceMs > 0) {
        const timeout = setTimeout(commitChange, debounceMs);
        setDebounceTimeout(timeout);
      } else {
        commitChange();
      }
    },
    [type, onChange, debounceMs, debounceTimeout]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [debounceTimeout]);

  const inputClasses = cn(
    'w-full px-2 py-1.5 rounded text-sm',
    'bg-neutral-800 border border-neutral-600',
    'text-neutral-100 placeholder-neutral-500',
    'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    error && 'border-red-500 focus:border-red-500 focus:ring-red-500'
  );

  const renderInput = () => {
    switch (type) {
      case 'select':
        return (
          <select
            id={id}
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            className={inputClasses}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'number':
        return (
          <input
            id={id}
            type="number"
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
            className={inputClasses}
          />
        );

      default:
        return (
          <div className="flex gap-1">
            <input
              id={id}
              type="text"
              value={localValue}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(inputClasses, showDeviceButton && 'flex-1')}
            />
            {showDeviceButton && (
              <button
                type="button"
                onClick={onDeviceButtonClick}
                disabled={disabled}
                className={cn(
                  'px-2 py-1.5 rounded text-sm',
                  'bg-neutral-700 border border-neutral-600',
                  'text-neutral-300 hover:bg-neutral-600',
                  'focus:outline-none focus:ring-1 focus:ring-blue-500',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                title="Select device"
              >
                ...
              </button>
            )}
          </div>
        );
    }
  };

  return (
    <div className={cn('space-y-1', className)}>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-neutral-400"
      >
        {label}
      </label>
      {renderInput()}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

export default PropertyField;
