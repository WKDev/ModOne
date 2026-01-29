/**
 * ContactProperties Component
 *
 * Property editor for contact elements (NO, NC, P, N).
 */

import { useCallback } from 'react';
import { PropertyField, type SelectOption } from './PropertyField';
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
  const handleAddressChange = useCallback(
    (value: string | number) => {
      onUpdate({ address: String(value) });
    },
    [onUpdate]
  );

  const handleTypeChange = useCallback(
    (value: string | number) => {
      onUpdate({ type: value as ContactType });
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
      />
    </div>
  );
}

export default ContactProperties;
