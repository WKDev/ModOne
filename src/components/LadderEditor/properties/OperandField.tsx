/**
 * OperandField Component
 *
 * Compound input component allowing toggle between device address and constant value.
 * Used for comparison and math operations where operands can be either addresses or constants.
 */

import { useState, useCallback, useEffect, useId } from 'react';
import { cn } from '../../../lib/utils';

export type OperandMode = 'address' | 'constant';

export interface OperandFieldProps {
  /** Field label */
  label: string;
  /** Current value (address string or number) */
  value: string | number;
  /** Called when value changes */
  onChange: (value: string | number) => void;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Called when device button is clicked for address mode */
  onDeviceSelect?: () => void;
  /** Minimum constant value */
  minConstant?: number;
  /** Maximum constant value */
  maxConstant?: number;
  /** Optional class name */
  className?: string;
}

/**
 * Determine if a value is a constant (number) or address (string)
 */
function getValueMode(value: string | number): OperandMode {
  if (typeof value === 'number') return 'constant';
  // Check if it looks like an address (starts with letter)
  if (/^[A-Z]/.test(value)) return 'address';
  // Try to parse as number
  const num = parseFloat(value);
  if (!isNaN(num)) return 'constant';
  return 'address';
}

/**
 * OperandField - Compound input for address or constant value
 */
export function OperandField({
  label,
  value,
  onChange,
  disabled = false,
  error,
  onDeviceSelect,
  minConstant = -32768,
  maxConstant = 32767,
  className,
}: OperandFieldProps) {
  const id = useId();
  const [mode, setMode] = useState<OperandMode>(() => getValueMode(value));
  const [localValue, setLocalValue] = useState(String(value));

  // Sync local value with prop value
  useEffect(() => {
    setLocalValue(String(value));
    setMode(getValueMode(value));
  }, [value]);

  const handleModeChange = useCallback(
    (newMode: OperandMode) => {
      setMode(newMode);
      if (newMode === 'constant') {
        // Switch to constant - set default value
        onChange(0);
      } else {
        // Switch to address - set empty or placeholder
        onChange('D0000');
      }
    },
    [onChange]
  );

  const handleAddressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value.toUpperCase();
      setLocalValue(newValue);
      onChange(newValue);
    },
    [onChange]
  );

  const handleConstantChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      const numValue = parseInt(newValue, 10);
      if (!isNaN(numValue)) {
        onChange(numValue);
      }
    },
    [onChange]
  );

  const inputClasses = cn(
    'flex-1 px-2 py-1.5 rounded text-sm',
    'bg-neutral-800 border border-neutral-600',
    'text-neutral-100 placeholder-neutral-500',
    'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    error && 'border-red-500 focus:border-red-500 focus:ring-red-500'
  );

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-neutral-400">
          {label}
        </label>
        {/* Mode toggle */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => handleModeChange('address')}
            disabled={disabled}
            className={cn(
              'px-2 py-0.5 text-xs rounded transition-colors',
              'focus:outline-none focus:ring-1 focus:ring-blue-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              mode === 'address'
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'
            )}
          >
            Addr
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('constant')}
            disabled={disabled}
            className={cn(
              'px-2 py-0.5 text-xs rounded transition-colors',
              'focus:outline-none focus:ring-1 focus:ring-blue-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              mode === 'constant'
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'
            )}
          >
            Const
          </button>
        </div>
      </div>

      {mode === 'address' ? (
        <div className="flex gap-1">
          <input
            id={id}
            type="text"
            value={localValue}
            onChange={handleAddressChange}
            placeholder="D0000"
            disabled={disabled}
            className={inputClasses}
          />
          {onDeviceSelect && (
            <button
              type="button"
              onClick={onDeviceSelect}
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
      ) : (
        <input
          id={id}
          type="number"
          value={localValue}
          onChange={handleConstantChange}
          min={minConstant}
          max={maxConstant}
          disabled={disabled}
          className={inputClasses}
        />
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {mode === 'constant' && (
        <p className="text-xs text-neutral-500">
          Range: {minConstant} to {maxConstant}
        </p>
      )}
    </div>
  );
}

export default OperandField;
