/**
 * LED Properties Component
 *
 * Property editor for LED blocks.
 */

import { memo, useCallback, useState, useEffect } from 'react';
import { CommonProperties } from './CommonProperties';
import type { LedBlock, LedColor, Block } from '../../../OneCanvas/types';

// ============================================================================
// Types
// ============================================================================

interface LedPropertiesProps {
  component: LedBlock;
  onChange: (updates: Partial<Block>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const LED_COLORS: { value: LedColor; label: string; preview: string }[] = [
  { value: 'red', label: 'Red', preview: 'bg-red-500' },
  { value: 'green', label: 'Green', preview: 'bg-green-500' },
  { value: 'blue', label: 'Blue', preview: 'bg-blue-500' },
  { value: 'yellow', label: 'Yellow', preview: 'bg-yellow-500' },
  { value: 'white', label: 'White', preview: 'bg-white' },
];

const DEFAULT_FORWARD_VOLTAGES: Record<LedColor, number> = {
  red: 2.0,
  green: 2.2,
  blue: 3.0,
  yellow: 2.1,
  white: 3.0,
};

// ============================================================================
// Component
// ============================================================================

export const LedProperties = memo(function LedProperties({
  component,
  onChange,
}: LedPropertiesProps) {
  const [localForwardVoltage, setLocalForwardVoltage] = useState(
    component.forwardVoltage.toString()
  );

  // Sync local state
  useEffect(() => {
    setLocalForwardVoltage(component.forwardVoltage.toString());
  }, [component.id, component.forwardVoltage]);

  // Handle color change
  const handleColorChange = useCallback(
    (color: LedColor) => {
      // Also update forward voltage to default for new color
      const defaultVoltage = DEFAULT_FORWARD_VOLTAGES[color];
      onChange({
        color,
        forwardVoltage: defaultVoltage,
      } as Partial<LedBlock>);
      setLocalForwardVoltage(defaultVoltage.toString());
    },
    [onChange]
  );

  // Handle forward voltage change
  const handleForwardVoltageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalForwardVoltage(e.target.value);
    },
    []
  );

  const handleForwardVoltageBlur = useCallback(() => {
    const value = parseFloat(localForwardVoltage);
    if (!isNaN(value) && value >= 1 && value <= 5 && value !== component.forwardVoltage) {
      onChange({ forwardVoltage: value } as Partial<LedBlock>);
    } else {
      setLocalForwardVoltage(component.forwardVoltage.toString());
    }
  }, [localForwardVoltage, component.forwardVoltage, onChange]);

  return (
    <div className="space-y-4">
      {/* Common Properties */}
      <CommonProperties component={component} onChange={onChange} />

      {/* Divider */}
      <hr className="border-neutral-700" />

      {/* LED Specific */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase text-neutral-400">
          LED Settings
        </h4>

        {/* Color Selection */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Color</label>
          <div className="grid grid-cols-5 gap-2">
            {LED_COLORS.map(({ value, label, preview }) => (
              <button
                key={value}
                onClick={() => handleColorChange(value)}
                className={`
                  flex flex-col items-center gap-1 p-2 rounded border transition-all
                  ${component.color === value
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-neutral-700 hover:border-neutral-600'
                  }
                `}
                title={label}
              >
                <div
                  className={`w-4 h-4 rounded-full ${preview} ${
                    component.color === value ? 'ring-2 ring-blue-400' : ''
                  }`}
                />
                <span className="text-[10px] text-neutral-400">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Forward Voltage */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Forward Voltage</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={localForwardVoltage}
              onChange={handleForwardVoltageChange}
              onBlur={handleForwardVoltageBlur}
              min="1"
              max="5"
              step="0.1"
              className="flex-1 px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-xs text-neutral-500">V</span>
          </div>
          <p className="text-xs text-neutral-500">
            Voltage drop across the LED when lit
          </p>
        </div>

        {/* Current State (Read-only) */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Current State</label>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                component.lit
                  ? LED_COLORS.find((c) => c.value === component.color)?.preview || 'bg-white'
                  : 'bg-neutral-700'
              }`}
            />
            <span className="text-sm text-neutral-300">
              {component.lit ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default LedProperties;
