/**
 * CounterProperties Component
 *
 * Property editor for counter elements (CTU, CTD, CTUD).
 */

import { useCallback } from 'react';
import { PropertyField, type SelectOption } from './PropertyField';
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
  const handleAddressChange = useCallback(
    (value: string | number) => {
      onUpdate({ address: String(value) });
    },
    [onUpdate]
  );

  const handleTypeChange = useCallback(
    (value: string | number) => {
      onUpdate({ type: value as CounterType });
    },
    [onUpdate]
  );

  const handlePresetValueChange = useCallback(
    (value: string | number) => {
      const numValue = typeof value === 'number' ? value : parseInt(value, 10);
      if (!isNaN(numValue)) {
        onUpdate({
          properties: {
            ...element.properties,
            presetValue: numValue,
          },
        });
      }
    },
    [onUpdate, element.properties]
  );

  const handleLabelChange = useCallback(
    (value: string | number) => {
      onUpdate({ label: String(value) || undefined });
    },
    [onUpdate]
  );

  return (
    <div className="space-y-3">
      <PropertyField
        label="Address"
        type="text"
        value={element.address}
        onChange={handleAddressChange}
        placeholder="C0000"
        disabled={disabled}
        showDeviceButton
        onDeviceButtonClick={onDeviceSelect}
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
        debounceMs={300}
      />

      <PropertyField
        label="Label"
        type="text"
        value={element.label || ''}
        onChange={handleLabelChange}
        placeholder="Optional label"
        disabled={disabled}
      />
    </div>
  );
}

export default CounterProperties;
