/**
 * TimerProperties Component
 *
 * Property editor for timer elements (TON, TOF, TMR).
 */

import { useCallback, useState, useMemo } from 'react';
import { PropertyField, type SelectOption } from './PropertyField';
import { validateDeviceAddress, validateTimerPreset, validateLabel } from '../utils/validation';
import type { TimerElement, TimerType, TimerProperties as TimerPropsType } from '../../../types/ladder';

export interface TimerPropertiesProps {
  /** Timer element to edit */
  element: TimerElement;
  /** Called when element is updated */
  onUpdate: (updates: Partial<TimerElement>) => void;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Called when device button is clicked for address field */
  onDeviceSelect?: () => void;
}

/** Timer type options */
const TIMER_TYPE_OPTIONS: SelectOption[] = [
  { value: 'timer_ton', label: 'TON (On-Delay)' },
  { value: 'timer_tof', label: 'TOF (Off-Delay)' },
  { value: 'timer_tmr', label: 'TMR (Accumulating)' },
];

/** Time base options */
const TIME_BASE_OPTIONS: SelectOption[] = [
  { value: 'ms', label: 'Milliseconds (ms)' },
  { value: 's', label: 'Seconds (s)' },
];

/**
 * TimerProperties - Property editor for timer elements
 */
export function TimerProperties({
  element,
  onUpdate,
  disabled = false,
  onDeviceSelect,
}: TimerPropertiesProps) {
  // Validation error states
  const [addressError, setAddressError] = useState<string | undefined>();
  const [presetError, setPresetError] = useState<string | undefined>();
  const [labelError, setLabelError] = useState<string | undefined>();

  // Check if there are any validation errors
  const hasErrors = useMemo(() => {
    return !!addressError || !!presetError || !!labelError;
  }, [addressError, presetError, labelError]);

  const handleAddressChange = useCallback(
    (value: string | number) => {
      const strValue = String(value);
      const validation = validateDeviceAddress(strValue);

      if (!validation.valid) {
        setAddressError(validation.error);
        return;
      }

      setAddressError(undefined);
      onUpdate({ address: strValue });
    },
    [onUpdate]
  );

  const handleTypeChange = useCallback(
    (value: string | number) => {
      onUpdate({ type: value as TimerType });
    },
    [onUpdate]
  );

  const handlePresetTimeChange = useCallback(
    (value: string | number) => {
      const numValue = typeof value === 'number' ? value : parseInt(value, 10);
      const validation = validateTimerPreset(numValue, element.properties.timeBase);

      if (!validation.valid) {
        setPresetError(validation.error);
        return;
      }

      setPresetError(undefined);
      onUpdate({
        properties: {
          ...element.properties,
          presetTime: numValue,
        },
      });
    },
    [onUpdate, element.properties]
  );

  const handleTimeBaseChange = useCallback(
    (value: string | number) => {
      const newTimeBase = value as TimerPropsType['timeBase'];
      // Re-validate preset with new time base
      const validation = validateTimerPreset(element.properties.presetTime, newTimeBase);
      if (!validation.valid) {
        setPresetError(validation.error);
      } else {
        setPresetError(undefined);
      }

      onUpdate({
        properties: {
          ...element.properties,
          timeBase: newTimeBase,
        },
      });
    },
    [onUpdate, element.properties]
  );

  const handleLabelChange = useCallback(
    (value: string | number) => {
      const strValue = String(value);
      const validation = validateLabel(strValue);

      if (!validation.valid) {
        setLabelError(validation.error);
        return;
      }

      setLabelError(undefined);
      onUpdate({ label: strValue || undefined });
    },
    [onUpdate]
  );

  return (
    <div className="space-y-3">
      {/* Error summary */}
      {hasErrors && (
        <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">
          Please fix validation errors
        </div>
      )}

      <PropertyField
        label="Address"
        type="text"
        value={element.address}
        onChange={handleAddressChange}
        placeholder="T0000"
        disabled={disabled}
        error={addressError}
        showDeviceButton
        onDeviceButtonClick={onDeviceSelect}
        debounceMs={300}
      />

      <PropertyField
        label="Type"
        type="select"
        value={element.type}
        onChange={handleTypeChange}
        options={TIMER_TYPE_OPTIONS}
        disabled={disabled}
      />

      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          label="Preset Time"
          type="number"
          value={element.properties.presetTime}
          onChange={handlePresetTimeChange}
          min={0}
          max={65535}
          step={100}
          disabled={disabled}
          error={presetError}
          debounceMs={300}
        />

        <PropertyField
          label="Time Base"
          type="select"
          value={element.properties.timeBase}
          onChange={handleTimeBaseChange}
          options={TIME_BASE_OPTIONS}
          disabled={disabled}
        />
      </div>

      <PropertyField
        label="Label"
        type="text"
        value={element.label || ''}
        onChange={handleLabelChange}
        placeholder="Optional label"
        disabled={disabled}
        error={labelError}
        debounceMs={300}
      />
    </div>
  );
}

export default TimerProperties;
