/**
 * CounterProperties Component
 *
 * Property editor for counter elements (CTU, CTD, CTUD).
 */

import { useCallback, useState } from 'react';
import { PropertyField, type SelectOption } from './PropertyField';
import { validateCounterPreset } from '../utils/validation';
import { usePropertyForm } from './usePropertyForm';
import type { CounterElement, CounterType } from '../../../types/ladder';

export interface CounterPropertiesProps {
  /** Counter element to edit */
  element: CounterElement;
  /** Called when element is updated */
  onUpdate: (updates: Partial<CounterElement>) => void;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Called when device button is clicked for address field */
  onDeviceSelect?: () => void;
}

/** Counter type options */
const COUNTER_TYPE_OPTIONS: SelectOption[] = [
  { value: 'counter_ctu', label: 'CTU (Count Up)' },
  { value: 'counter_ctd', label: 'CTD (Count Down)' },
  { value: 'counter_ctud', label: 'CTUD (Up/Down)' },
];

/**
 * CounterProperties - Property editor for counter elements
 */
export function CounterProperties({
  element,
  onUpdate,
  disabled = false,
  onDeviceSelect,
}: CounterPropertiesProps) {
  const [presetError, setPresetError] = useState<string | undefined>();
  const { addressError, labelError, hasErrors, handleAddressChange, handleLabelChange } =
    usePropertyForm({
      onUpdate,
      additionalErrors: { preset: presetError },
    });

  const handleTypeChange = useCallback(
    (value: string | number) => {
      onUpdate({ type: value as CounterType });
    },
    [onUpdate]
  );

  const handlePresetValueChange = useCallback(
    (value: string | number) => {
      const numValue = typeof value === 'number' ? value : parseInt(value, 10);
      const validation = validateCounterPreset(numValue);

      if (!validation.valid) {
        setPresetError(validation.error);
        return;
      }

      setPresetError(undefined);
      onUpdate({
        properties: {
          ...element.properties,
          presetValue: numValue,
        },
      });
    },
    [onUpdate, element.properties]
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
        placeholder="C0000"
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
        options={COUNTER_TYPE_OPTIONS}
        disabled={disabled}
      />

      <PropertyField
        label="Preset Value (PV)"
        type="number"
        value={element.properties.presetValue}
        onChange={handlePresetValueChange}
        min={0}
        max={65535}
        step={1}
        disabled={disabled}
        error={presetError}
        debounceMs={300}
      />

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

export default CounterProperties;
