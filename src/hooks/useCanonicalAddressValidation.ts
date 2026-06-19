/**
 * Canonical Address Duplicate Validation Hook
 *
 * Provides debounced validation of canonical address uniqueness
 * by querying the Rust backend. Shows appropriate error messages
 * when a duplicate is detected.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { tagService } from '../services/tagService';

export interface CanonicalAddressInput {
  area: string;
  index: number;
  bitIndex?: number;
}

export interface CanonicalAddressValidationResult {
  /** Whether a validation check is in-flight */
  isChecking: boolean;
  /** Error message if duplicate found, null otherwise */
  duplicateError: string | null;
  /** Tag IDs that already use this address */
  conflictingTagIds: string[];
  /** Manually trigger validation (e.g. before form submission) */
  validate: (
    address: CanonicalAddressInput,
    excludeTagId?: string,
  ) => Promise<boolean>;
}

/**
 * Hook to validate canonical address uniqueness with debouncing.
 *
 * @param address - Current address input (area, index, bitIndex)
 * @param excludeTagId - Tag ID to exclude from duplicate check (for edits)
 * @param debounceMs - Debounce delay in milliseconds (default 300)
 */
export function useCanonicalAddressValidation(
  address: CanonicalAddressInput | null,
  excludeTagId?: string,
  debounceMs = 300,
): CanonicalAddressValidationResult {
  const [isChecking, setIsChecking] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [conflictingTagIds, setConflictingTagIds] = useState<string[]>([]);
  const abortRef = useRef(0);

  // Debounced auto-validation when address changes
  useEffect(() => {
    if (!address || !address.area || address.index == null) {
      setDuplicateError(null);
      setConflictingTagIds([]);
      return;
    }

    const requestId = ++abortRef.current;
    setIsChecking(true);

    const timer = setTimeout(async () => {
      try {
        const duplicates = await tagService.checkCanonicalAddressDuplicate(
          address.area,
          address.index,
          address.bitIndex,
          excludeTagId,
        );

        // Only apply if this is still the latest request
        if (abortRef.current !== requestId) return;

        if (duplicates.length > 0) {
          setDuplicateError(
            `이 주소는 이미 다른 태그에서 사용 중입니다: ${duplicates.join(', ')}`,
          );
          setConflictingTagIds(duplicates);
        } else {
          setDuplicateError(null);
          setConflictingTagIds([]);
        }
      } catch {
        // Error already toasted by service layer
        if (abortRef.current === requestId) {
          setDuplicateError(null);
          setConflictingTagIds([]);
        }
      } finally {
        if (abortRef.current === requestId) {
          setIsChecking(false);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [address?.area, address?.index, address?.bitIndex, excludeTagId, debounceMs]);

  // Imperative validation for form submission
  const validate = useCallback(
    async (
      addr: CanonicalAddressInput,
      exclude?: string,
    ): Promise<boolean> => {
      if (!addr.area || addr.index == null) {
        return true; // No address to validate
      }

      setIsChecking(true);
      try {
        const duplicates = await tagService.checkCanonicalAddressDuplicate(
          addr.area,
          addr.index,
          addr.bitIndex,
          exclude,
        );

        if (duplicates.length > 0) {
          setDuplicateError(
            `이 주소는 이미 다른 태그에서 사용 중입니다: ${duplicates.join(', ')}`,
          );
          setConflictingTagIds(duplicates);
          return false;
        }

        setDuplicateError(null);
        setConflictingTagIds([]);
        return true;
      } catch {
        // Error already toasted, treat as non-blocking
        return true;
      } finally {
        setIsChecking(false);
      }
    },
    [],
  );

  return { isChecking, duplicateError, conflictingTagIds, validate };
}
