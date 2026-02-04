/**
 * PowerSource Properties Component
 *
 * Property editor for unified power source blocks.
 * Allows editing voltage, polarity, max current, and label.
 */

import { memo, useCallback, useState, useEffect } from 'react';
import { CommonProperties } from './CommonProperties';
import type { Block, PowerSourceBlock, PowerPolarity } from '../../../OneCanvas/types';
import { getPowerSourcePorts } from '../../../OneCanvas/blockDefinitions';

// ============================================================================
// Types
// ============================================================================

interface PowerSourcePropertiesProps {
  component: PowerSourceBlock;
  onChange: (updates: Partial<Block>) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function getDefaultLabel(voltage: number, polarity: PowerPolarity): string {
  if (polarity === 'ground') return 'GND';
  const sign = polarity === 'negative' ? '-' : '+';
  return `${sign}${voltage}V`;
}

// ============================================================================
// Component
// ============================================================================

export const PowerSourceProperties = memo(function PowerSourceProperties({
  component,
  onChange,
}: PowerSourcePropertiesProps) {
  const [localVoltage, setLocalVoltage] = useState(component.voltage.toString());
  const [localMaxCurrent, setLocalMaxCurrent] = useState(
    (component.maxCurrent || 1000).toString()
  );

  // Sync local state when component changes
  useEffect(() => {
    setLocalVoltage(component.voltage.toString());
    setLocalMaxCurrent((component.maxCurrent || 1000).toString());
  }, [component.voltage, component.maxCurrent]);

  // Handle voltage change
  const handleVoltageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVoltage(e.target.value);
  }, []);

  const handleVoltageBlur = useCallback(() => {
    const value = parseFloat(localVoltage);
    if (!isNaN(value) && value >= 0 && value <= 1000 && value !== component.voltage) {
      const updates: Partial<PowerSourceBlock> = { voltage: value };
      // Update default label if current label matches the old default
      const oldDefault = getDefaultLabel(component.voltage, component.polarity);
      if (!component.label || component.label === oldDefault) {
        updates.label = getDefaultLabel(value, component.polarity);
      }
      onChange(updates as Partial<Block>);
    } else {
      setLocalVoltage(component.voltage.toString());
    }
  }, [localVoltage, component, onChange]);

  // Handle polarity change
  const handlePolarityChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPolarity = e.target.value as PowerPolarity;
    if (newPolarity === component.polarity) return;

    const newPorts = getPowerSourcePorts(newPolarity);
    const updates: Partial<PowerSourceBlock> = {
      polarity: newPolarity,
      ports: newPorts,
    };

    // Update default label
    const oldDefault = getDefaultLabel(component.voltage, component.polarity);
    if (!component.label || component.label === oldDefault) {
      updates.label = getDefaultLabel(component.voltage, newPolarity);
    }

    // Set voltage to 0 for ground
    if (newPolarity === 'ground' && component.voltage !== 0) {
      updates.voltage = 0;
    }

    onChange(updates as Partial<Block>);
  }, [component, onChange]);

  // Handle max current change
  const handleMaxCurrentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalMaxCurrent(e.target.value);
  }, []);

  const handleMaxCurrentBlur = useCallback(() => {
    const value = parseInt(localMaxCurrent, 10);
    if (!isNaN(value) && value >= 100 && value <= 10000 && value !== component.maxCurrent) {
      onChange({ maxCurrent: value } as Partial<Block>);
    } else {
      setLocalMaxCurrent((component.maxCurrent || 1000).toString());
    }
  }, [localMaxCurrent, component, onChange]);

  const isGround = component.polarity === 'ground';

  return (
    <div className="space-y-4">
      {/* Common Properties */}
      <CommonProperties component={component} onChange={onChange} />

      {/* Divider */}
      <hr className="border-neutral-700" />

      {/* Power Source Settings */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase text-neutral-400">
          Power Source Settings
        </h4>

        {/* Polarity */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Polarity</label>
          <select
            value={component.polarity}
            onChange={handlePolarityChange}
            className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="positive">Positive (+)</option>
            <option value="negative">Negative (-)</option>
            <option value="ground">Ground (GND)</option>
          </select>
        </div>

        {/* Voltage */}
        {!isGround && (
          <div className="space-y-1">
            <label className="text-xs text-neutral-500">Voltage</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={localVoltage}
                onChange={handleVoltageChange}
                onBlur={handleVoltageBlur}
                min="0"
                max="1000"
                step="1"
                className="flex-1 px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-neutral-500">V</span>
            </div>
          </div>
        )}

        {/* Voltage Display */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Output</label>
          <div className="flex items-center gap-2 px-2 py-1.5 bg-neutral-800 rounded">
            <span
              className={`text-lg font-mono font-bold ${
                isGround ? 'text-green-400' : 'text-yellow-400'
              }`}
            >
              {isGround ? '0V' : `${component.voltage}V`}
            </span>
            <span className="text-xs text-neutral-500">DC</span>
          </div>
        </div>

        {/* Max Current (only for non-ground) */}
        {!isGround && (
          <div className="space-y-1">
            <label className="text-xs text-neutral-500">Maximum Current</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={localMaxCurrent}
                onChange={handleMaxCurrentChange}
                onBlur={handleMaxCurrentBlur}
                min="100"
                max="10000"
                step="100"
                className="flex-1 px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-neutral-500">mA</span>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="p-2 bg-neutral-800/50 rounded border border-neutral-700">
          <div className="text-[10px] text-neutral-400">
            {isGround ? (
              <>
                <span className="text-green-400">Ground Reference</span>
                <br />
                Connect to complete circuit paths back to power supply
              </>
            ) : (
              <>
                <span className="text-yellow-400">Power Source</span>
                <br />
                Connect {component.polarity} terminal to circuit
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default PowerSourceProperties;
