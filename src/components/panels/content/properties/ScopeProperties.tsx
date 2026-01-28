/**
 * Scope Properties Component
 *
 * Property editor for Oscilloscope blocks.
 */

import { memo, useCallback, useState, useEffect } from 'react';
import { CommonProperties } from './CommonProperties';
import type { ScopeBlock, TriggerMode, Block } from '../../../OneCanvas/types';

// ============================================================================
// Types
// ============================================================================

interface ScopePropertiesProps {
  component: ScopeBlock;
  onChange: (updates: Partial<Block>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const TRIGGER_MODES: { value: TriggerMode; label: string; description: string }[] = [
  { value: 'auto', label: 'Auto', description: 'Continuous capture with auto-trigger' },
  { value: 'normal', label: 'Normal', description: 'Wait for trigger condition' },
  { value: 'single', label: 'Single', description: 'Capture once on trigger' },
];

const CHANNEL_OPTIONS: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];

const TIME_BASE_PRESETS = [
  { value: 1, label: '1 ms/div' },
  { value: 2, label: '2 ms/div' },
  { value: 5, label: '5 ms/div' },
  { value: 10, label: '10 ms/div' },
  { value: 20, label: '20 ms/div' },
  { value: 50, label: '50 ms/div' },
  { value: 100, label: '100 ms/div' },
  { value: 200, label: '200 ms/div' },
  { value: 500, label: '500 ms/div' },
  { value: 1000, label: '1 s/div' },
];

const VOLTAGE_SCALE_PRESETS = [
  { value: 0.5, label: '0.5 V/div' },
  { value: 1, label: '1 V/div' },
  { value: 2, label: '2 V/div' },
  { value: 5, label: '5 V/div' },
  { value: 10, label: '10 V/div' },
  { value: 12, label: '12 V/div' },
  { value: 24, label: '24 V/div' },
];

// ============================================================================
// Component
// ============================================================================

export const ScopeProperties = memo(function ScopeProperties({
  component,
  onChange,
}: ScopePropertiesProps) {
  const [localTimeBase, setLocalTimeBase] = useState(component.timeBase.toString());
  const [localVoltageScale, setLocalVoltageScale] = useState(
    (component.voltageScale || 5).toString()
  );

  // Sync local state
  useEffect(() => {
    setLocalTimeBase(component.timeBase.toString());
    setLocalVoltageScale((component.voltageScale || 5).toString());
  }, [component.id, component.timeBase, component.voltageScale]);

  // Handle channel count change
  const handleChannelsChange = useCallback(
    (channels: 1 | 2 | 3 | 4) => {
      onChange({ channels } as Partial<ScopeBlock>);
    },
    [onChange]
  );

  // Handle trigger mode change
  const handleTriggerModeChange = useCallback(
    (triggerMode: TriggerMode) => {
      onChange({ triggerMode } as Partial<ScopeBlock>);
    },
    [onChange]
  );

  // Handle time base change
  const handleTimeBaseChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value, 10);
    setLocalTimeBase(value.toString());
    onChange({ timeBase: value } as Partial<ScopeBlock>);
  }, [onChange]);

  const handleTimeBaseInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalTimeBase(e.target.value);
  }, []);

  const handleTimeBaseBlur = useCallback(() => {
    const value = parseInt(localTimeBase, 10);
    if (!isNaN(value) && value >= 1 && value <= 10000 && value !== component.timeBase) {
      onChange({ timeBase: value } as Partial<ScopeBlock>);
    } else {
      setLocalTimeBase(component.timeBase.toString());
    }
  }, [localTimeBase, component.timeBase, onChange]);

  // Handle voltage scale change
  const handleVoltageScaleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseFloat(e.target.value);
    setLocalVoltageScale(value.toString());
    onChange({ voltageScale: value } as Partial<ScopeBlock>);
  }, [onChange]);

  const handleVoltageScaleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVoltageScale(e.target.value);
  }, []);

  const handleVoltageScaleBlur = useCallback(() => {
    const value = parseFloat(localVoltageScale);
    if (!isNaN(value) && value >= 0.1 && value <= 50 && value !== component.voltageScale) {
      onChange({ voltageScale: value } as Partial<ScopeBlock>);
    } else {
      setLocalVoltageScale((component.voltageScale || 5).toString());
    }
  }, [localVoltageScale, component.voltageScale, onChange]);

  return (
    <div className="space-y-4">
      {/* Common Properties */}
      <CommonProperties component={component} onChange={onChange} />

      {/* Divider */}
      <hr className="border-neutral-700" />

      {/* Scope Specific */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase text-neutral-400">
          Oscilloscope Settings
        </h4>

        {/* Channel Count */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Channels</label>
          <div className="flex gap-2">
            {CHANNEL_OPTIONS.map((count) => (
              <button
                key={count}
                onClick={() => handleChannelsChange(count)}
                className={`
                  flex-1 py-1.5 rounded border text-sm transition-all
                  ${component.channels === count
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                  }
                `}
              >
                {count} CH
              </button>
            ))}
          </div>
        </div>

        {/* Trigger Mode */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Trigger Mode</label>
          <div className="flex gap-1">
            {TRIGGER_MODES.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => handleTriggerModeChange(value)}
                className={`
                  flex-1 py-1.5 px-2 rounded border text-xs transition-all
                  ${component.triggerMode === value
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                  }
                `}
                title={description}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Time Base */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Time Base</label>
          <div className="flex gap-2">
            <select
              value={TIME_BASE_PRESETS.find((p) => p.value === component.timeBase)?.value || ''}
              onChange={handleTimeBaseChange}
              className="flex-1 px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="" disabled>
                Custom
              </option>
              {TIME_BASE_PRESETS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={localTimeBase}
                onChange={handleTimeBaseInputChange}
                onBlur={handleTimeBaseBlur}
                min="1"
                max="10000"
                className="w-20 px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-neutral-500">ms</span>
            </div>
          </div>
        </div>

        {/* Voltage Scale */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Voltage Scale</label>
          <div className="flex gap-2">
            <select
              value={VOLTAGE_SCALE_PRESETS.find((p) => p.value === component.voltageScale)?.value || ''}
              onChange={handleVoltageScaleChange}
              className="flex-1 px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="" disabled>
                Custom
              </option>
              {VOLTAGE_SCALE_PRESETS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={localVoltageScale}
                onChange={handleVoltageScaleInputChange}
                onBlur={handleVoltageScaleBlur}
                min="0.1"
                max="50"
                step="0.1"
                className="w-20 px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-neutral-500">V</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ScopeProperties;
