/**
 * CoilProperties Component
 *
 * Property editor for coil elements (normal, set, reset).
 */

import { useCallback, useState, useMemo } from 'react';
import { PropertyField, type SelectOption } from './PropertyField';
import { validateDeviceAddress, validateLabel } from '../utils/validation';
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
  // Validation error states
  const [addressError, setAddressError] = useState<string | undefined>();
  const [labelError, setLabelError] = useState<string | undefined>();

  // Check if there are any validation errors
  const hasErrors = useMemo(() => {
    return !!addressError || !!labelError;
  }, [addressError, labelError]);

  const handleAddressChange = useCallback(
    (value: string | number) => {
      const strValue = String(value);
      const validation = validateDeviceAddress(strValue);

      if (!validation.valid) {
        setAddressError(validation.error);
        return; // Don't update store with invalid address
      }

      setAddressError(undefined);
      onUpdate({ address: strValue });
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
        placeholder="M0000"
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
        error={labelError}
        debounceMs={300}
      />
    </div>
  );
}

export default CoilProperties;
