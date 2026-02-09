/**
 * ContactProperties Component
 *
 * Property editor for contact elements (NO, NC, P, N).
 */

import { useCallback } from 'react';
import { PropertyField, type SelectOption } from './PropertyField';
import { usePropertyForm } from './usePropertyForm';
import type { ContactElement, ContactType } from '../../../types/ladder';

export interface ContactPropertiesProps {
  /** Contact element to edit */
  element: ContactElement;
  /** Called when element is updated */
  onUpdate: (updates: Partial<ContactElement>) => void;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Called when device button is clicked for address field */
  onDeviceSelect?: () => void;
}

/** Contact type options */
const CONTACT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'contact_no', label: 'NO (Normally Open)' },
  { value: 'contact_nc', label: 'NC (Normally Closed)' },
  { value: 'contact_p', label: 'P (Rising Edge)' },
  { value: 'contact_n', label: 'N (Falling Edge)' },
];

/**
 * ContactProperties - Property editor for contact elements
 */
export function ContactProperties({
  element,
  onUpdate,
  disabled = false,
  onDeviceSelect,
}: ContactPropertiesProps) {
  const { addressError, labelError, hasErrors, handleAddressChange, handleLabelChange } =
    usePropertyForm({ onUpdate });

  const handleTypeChange = useCallback(
    (value: string | number) => {
      onUpdate({ type: value as ContactType });
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
        options={CONTACT_TYPE_OPTIONS}
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

export default ContactProperties;
