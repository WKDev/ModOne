/**
 * usePropertyForm Hook
 *
 * Shared hook for handling address and label validation state + handlers
 * across Contact, Coil, Timer, and Counter property components.
 */

import { useCallback, useState, useMemo } from 'react';
import { validateDeviceAddress, validateLabel } from '../utils/validation';

export interface UsePropertyFormOptions {
  onUpdate: (updates: Record<string, unknown>) => void;
  additionalErrors?: Record<string, string | undefined>;
}

export interface UsePropertyFormResult {
  addressError: string | undefined;
  labelError: string | undefined;
  hasErrors: boolean;
  handleAddressChange: (value: string | number) => void;
  handleLabelChange: (value: string | number) => void;
}

/**
 * Hook for managing address and label validation in property components
 * @param options - Configuration options
 * @returns Object with error states and handlers
 */
export function usePropertyForm({
  onUpdate,
  additionalErrors = {},
}: UsePropertyFormOptions): UsePropertyFormResult {
  const [addressError, setAddressError] = useState<string | undefined>();
  const [labelError, setLabelError] = useState<string | undefined>();

  // Check if there are any validation errors (including additional ones)
  const hasErrors = useMemo(() => {
    const additionalHasErrors = Object.values(additionalErrors).some(
      (error) => error !== undefined
    );
    return !!addressError || !!labelError || additionalHasErrors;
  }, [addressError, labelError, additionalErrors]);

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

  return {
    addressError,
    labelError,
    hasErrors,
    handleAddressChange,
    handleLabelChange,
  };
}
