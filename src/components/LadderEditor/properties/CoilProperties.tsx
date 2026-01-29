/**
 * CoilProperties Component
 *
 * Property editor for coil elements (normal, set, reset).
 */

import { useCallback } from 'react';
import { PropertyField, type SelectOption } from './PropertyField';
import type { CoilElement, CoilType } from '../../../types/ladder';

export interface CoilPropertiesProps {
  /** Coil element to edit */
  element: CoilElement;
  /** Called when element is updated */
  onUpdate: (updates: Partial<CoilElement>) => void;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Called when device button is clicked for address field */
  onDeviceSelect?: () => void;
}

/** Coil type options */
const COIL_TYPE_OPTIONS: SelectOption[] = [
  { value: 'coil', label: 'OUT (Normal)' },
  { value: 'coil_set', label: 'SET (Latch)' },
  { value: 'coil_reset', label: 'RST (Unlatch)' },
];

/**
 * CoilProperties - Property editor for coil elements
 */
export function CoilProperties({
  element,
  onUpdate,
  disabled = false,
  onDeviceSelect,
}: CoilPropertiesProps) {
  const handleAddressChange = useCallback(
    (value: string | number) => {
      onUpdate({ address: String(value) });
    },
    [onUpdate]
  );

  const handleTypeChange = useCallback(
    (value: string | number) => {
      onUpdate({ type: value as CoilType });
    },
    [onUpdate]
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
        placeholder="M0000"
        disabled={disabled}
        showDeviceButton
        onDeviceButtonClick={onDeviceSelect}
      />

      <PropertyField
        label="Type"
        type="select"
        value={element.type}
        onChange={handleTypeChange}
        options={COIL_TYPE_OPTIONS}
        disabled={disabled}
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

export default CoilProperties;
