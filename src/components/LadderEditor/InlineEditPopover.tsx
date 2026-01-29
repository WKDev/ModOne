/**
 * InlineEditPopover Component
 *
 * Popover component for quick inline editing of ladder elements.
 * Triggered on double-click and allows editing primary properties.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { validateDeviceAddress } from './utils/validation';
import type { LadderElement, ContactType, CoilType } from '../../types/ladder';

export interface InlineEditPopoverProps {
  /** Element being edited */
  element: LadderElement;
  /** Position for the popover (relative to viewport) */
  position: { x: number; y: number };
  /** Called when changes are applied */
  onApply: (updates: Partial<LadderElement>) => void;
  /** Called when popover is closed without applying */
  onCancel: () => void;
  /** Called when device button is clicked */
  onDeviceSelect?: () => void;
}

/** Type options for contacts */
const CONTACT_TYPE_OPTIONS: { value: ContactType; label: string }[] = [
  { value: 'contact_no', label: 'NO' },
  { value: 'contact_nc', label: 'NC' },
  { value: 'contact_p', label: 'P' },
  { value: 'contact_n', label: 'N' },
];

/** Type options for coils */
const COIL_TYPE_OPTIONS: { value: CoilType; label: string }[] = [
  { value: 'coil', label: 'OUT' },
  { value: 'coil_set', label: 'SET' },
  { value: 'coil_reset', label: 'RST' },
];

/**
 * InlineEditPopover - Quick edit popover for ladder elements
 */
export function InlineEditPopover({
  element,
  position,
  onApply,
  onCancel,
  onDeviceSelect,
}: InlineEditPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Local state for editing
  const [address, setAddress] = useState(element.address || '');
  const [type, setType] = useState(element.type);
  const [error, setError] = useState<string | undefined>();

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  // Handle click outside to cancel
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onCancel();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleApply();
      }
    },
    [onCancel, address, type]
  );

  // Validate and apply changes
  const handleApply = useCallback(() => {
    // Validate address
    const validation = validateDeviceAddress(address);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    // Apply changes
    const updates: Partial<LadderElement> = { address };
    if (type !== element.type) {
      updates.type = type;
    }

    onApply(updates);
  }, [address, type, element.type, onApply]);

  // Handle address input change
  const handleAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    setAddress(newValue);

    // Clear error on input
    if (error) {
      const validation = validateDeviceAddress(newValue);
      if (validation.valid) {
        setError(undefined);
      }
    }
  }, [error]);

  // Get type options based on element type
  const getTypeOptions = () => {
    if (element.type.startsWith('contact')) {
      return CONTACT_TYPE_OPTIONS;
    }
    if (element.type.startsWith('coil')) {
      return COIL_TYPE_OPTIONS;
    }
    return null;
  };

  const typeOptions = getTypeOptions();

  // Calculate popover position (ensure it stays within viewport)
  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 220),
    top: Math.min(position.y, window.innerHeight - 150),
    zIndex: 9999,
  };

  return (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className={cn(
        'bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl',
        'p-3 min-w-[200px]',
        'animate-in fade-in-0 zoom-in-95'
      )}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-neutral-400">Quick Edit</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-neutral-500 hover:text-neutral-300 text-sm"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Address input */}
      <div className="space-y-1 mb-2">
        <label className="text-xs text-neutral-400">Address</label>
        <div className="flex gap-1">
          <input
            ref={inputRef}
            type="text"
            value={address}
            onChange={handleAddressChange}
            placeholder="M0000"
            className={cn(
              'flex-1 px-2 py-1.5 rounded text-sm',
              'bg-neutral-700 border',
              'text-neutral-100 placeholder-neutral-500',
              'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
              error ? 'border-red-500' : 'border-neutral-600'
            )}
          />
          {onDeviceSelect && (
            <button
              type="button"
              onClick={onDeviceSelect}
              className={cn(
                'px-2 py-1.5 rounded text-sm',
                'bg-neutral-600 border border-neutral-500',
                'text-neutral-300 hover:bg-neutral-500',
                'focus:outline-none focus:ring-1 focus:ring-blue-500'
              )}
              title="Select device"
            >
              ...
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Type selector (if applicable) */}
      {typeOptions && (
        <div className="space-y-1 mb-3">
          <label className="text-xs text-neutral-400">Type</label>
          <div className="flex gap-1">
            {typeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={cn(
                  'flex-1 px-2 py-1 rounded text-xs',
                  'transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500',
                  type === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-2 border-t border-neutral-700">
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            'flex-1 px-3 py-1.5 rounded text-sm',
            'bg-neutral-700 text-neutral-300',
            'hover:bg-neutral-600',
            'focus:outline-none focus:ring-1 focus:ring-blue-500'
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          className={cn(
            'flex-1 px-3 py-1.5 rounded text-sm',
            'bg-blue-600 text-white',
            'hover:bg-blue-500',
            'focus:outline-none focus:ring-1 focus:ring-blue-500'
          )}
        >
          Apply
        </button>
      </div>

      {/* Keyboard hint */}
      <div className="mt-2 text-center">
        <span className="text-[10px] text-neutral-500">
          Enter to apply · Escape to cancel
        </span>
      </div>
    </div>
  );
}

export default InlineEditPopover;
