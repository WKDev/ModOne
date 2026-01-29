/**
 * DeviceSelectDialog Component
 *
 * Modal dialog for selecting device addresses with device type selector,
 * address input, recently used list, and search functionality.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { parseDeviceAddress, formatDeviceAddress } from '../../../types/ladder';
import { DEVICE_RANGES } from '../../OneParser/types';
import type { DeviceType, DeviceAddress } from '../../../types/ladder';

// ============================================================================
// Types
// ============================================================================

export interface DeviceSelectDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Called when dialog should close */
  onClose: () => void;
  /** Called when a device is selected */
  onSelect: (address: string) => void;
  /** Initial device address to populate */
  initialAddress?: string;
  /** Title for the dialog */
  title?: string;
  /** Filter to specific device types */
  allowedDeviceTypes?: DeviceType[];
}

interface DeviceTypeInfo {
  type: DeviceType;
  label: string;
  description: string;
  isBit: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEVICE_TYPES: DeviceTypeInfo[] = [
  { type: 'P', label: 'P', description: 'Output Relay', isBit: true },
  { type: 'M', label: 'M', description: 'Internal Relay', isBit: true },
  { type: 'K', label: 'K', description: 'Keep Relay', isBit: true },
  { type: 'F', label: 'F', description: 'Special Relay', isBit: true },
  { type: 'T', label: 'T', description: 'Timer Contact', isBit: true },
  { type: 'C', label: 'C', description: 'Counter Contact', isBit: true },
  { type: 'D', label: 'D', description: 'Data Register', isBit: false },
  { type: 'R', label: 'R', description: 'Retentive Register', isBit: false },
  { type: 'Z', label: 'Z', description: 'Index Register', isBit: false },
  { type: 'N', label: 'N', description: 'Constant Register', isBit: false },
];

const RECENTLY_USED_KEY = 'modone:recentDevices';
const MAX_RECENT_DEVICES = 10;

// ============================================================================
// Helpers
// ============================================================================

function getRecentDevices(): string[] {
  try {
    const stored = localStorage.getItem(RECENTLY_USED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentDevice(address: string): void {
  try {
    const recent = getRecentDevices().filter((a) => a !== address);
    recent.unshift(address);
    localStorage.setItem(
      RECENTLY_USED_KEY,
      JSON.stringify(recent.slice(0, MAX_RECENT_DEVICES))
    );
  } catch {
    // Ignore storage errors
  }
}

function formatAddressNumber(num: number, deviceType: DeviceType): string {
  // Use 4 digits for most devices, 2 for Z
  const digits = deviceType === 'Z' ? 2 : 4;
  return num.toString().padStart(digits, '0');
}

// ============================================================================
// DeviceSelectDialog Component
// ============================================================================

export function DeviceSelectDialog({
  isOpen,
  onClose,
  onSelect,
  initialAddress = '',
  title = 'Select Device',
  allowedDeviceTypes,
}: DeviceSelectDialogProps) {
  // Parse initial address
  const initialParsed = useMemo(() => {
    if (initialAddress) {
      return parseDeviceAddress(initialAddress);
    }
    return null;
  }, [initialAddress]);

  // State
  const [selectedType, setSelectedType] = useState<DeviceType>(
    initialParsed?.device || 'M'
  );
  const [addressNumber, setAddressNumber] = useState(
    initialParsed ? formatAddressNumber(initialParsed.address, initialParsed.device) : '0000'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Get available device types
  const availableTypes = useMemo(() => {
    if (allowedDeviceTypes) {
      return DEVICE_TYPES.filter((d) => allowedDeviceTypes.includes(d.type));
    }
    return DEVICE_TYPES;
  }, [allowedDeviceTypes]);

  // Get recent devices filtered by search
  const recentDevices = useMemo(() => {
    const recent = getRecentDevices();
    if (!searchQuery) return recent;
    return recent.filter((addr) =>
      addr.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  // Get device range for current type
  const deviceRange = useMemo(() => {
    return DEVICE_RANGES[selectedType];
  }, [selectedType]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      const parsed = initialAddress ? parseDeviceAddress(initialAddress) : null;
      setSelectedType(parsed?.device || 'M');
      setAddressNumber(
        parsed ? formatAddressNumber(parsed.address, parsed.device) : '0000'
      );
      setSearchQuery('');
      setError(null);

      // Focus input after a short delay
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, initialAddress]);

  // Validate current address
  const validateAddress = useCallback((): DeviceAddress | null => {
    const numValue = parseInt(addressNumber, 10);

    if (isNaN(numValue)) {
      setError('Invalid address number');
      return null;
    }

    const range = DEVICE_RANGES[selectedType];
    if (numValue < range.start || numValue > range.end) {
      setError(`Address must be between ${range.start} and ${range.end}`);
      return null;
    }

    setError(null);
    return { device: selectedType, address: numValue };
  }, [selectedType, addressNumber]);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    const addr = validateAddress();
    if (addr) {
      const formatted = formatDeviceAddress(addr);
      saveRecentDevice(formatted);
      onSelect(formatted);
      onClose();
    }
  }, [validateAddress, onSelect, onClose]);

  // Handle recent device click
  const handleRecentClick = useCallback(
    (address: string) => {
      saveRecentDevice(address);
      onSelect(address);
      onClose();
    },
    [onSelect, onClose]
  );

  // Handle type change
  const handleTypeChange = useCallback((type: DeviceType) => {
    setSelectedType(type);
    setError(null);
    // Reset to 0 when changing type
    const digits = type === 'Z' ? 2 : 4;
    setAddressNumber('0'.repeat(digits));
  }, []);

  // Handle address number change
  const handleAddressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/\D/g, '');
      const digits = selectedType === 'Z' ? 2 : 4;
      setAddressNumber(value.slice(0, digits));
      setError(null);
    },
    [selectedType]
  );

  // Handle key down
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [handleConfirm, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  const currentTypeInfo = availableTypes.find((t) => t.type === selectedType);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        className="bg-neutral-800 rounded-lg shadow-xl border border-neutral-700 w-[400px] max-h-[80vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
          <h2 id="device-dialog-title" className="text-sm font-medium text-neutral-200">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Device Type Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-400">
              Device Type
            </label>
            <div className="flex flex-wrap gap-1">
              {availableTypes.map((device) => (
                <button
                  key={device.type}
                  onClick={() => handleTypeChange(device.type)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-mono rounded transition-colors',
                    'focus:outline-none focus:ring-1 focus:ring-blue-500',
                    selectedType === device.type
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                  )}
                  title={device.description}
                >
                  {device.label}
                </button>
              ))}
            </div>
            {currentTypeInfo && (
              <p className="text-xs text-neutral-500">
                {currentTypeInfo.description} ({currentTypeInfo.isBit ? 'Bit' : 'Word'}) -
                Range: {deviceRange.start} to {deviceRange.end}
              </p>
            )}
          </div>

          {/* Address Input */}
          <div className="space-y-2">
            <label
              htmlFor="device-address"
              className="block text-xs font-medium text-neutral-400"
            >
              Address Number
            </label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-mono text-blue-400">{selectedType}</span>
              <input
                ref={inputRef}
                id="device-address"
                type="text"
                value={addressNumber}
                onChange={handleAddressChange}
                className={cn(
                  'flex-1 px-3 py-2 rounded text-lg font-mono',
                  'bg-neutral-900 border border-neutral-600',
                  'text-neutral-100 placeholder-neutral-500',
                  'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                  error && 'border-red-500 focus:border-red-500 focus:ring-red-500'
                )}
                placeholder={selectedType === 'Z' ? '00' : '0000'}
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          {/* Search Recent */}
          <div className="space-y-2">
            <label
              htmlFor="device-search"
              className="block text-xs font-medium text-neutral-400"
            >
              Search Recent
            </label>
            <input
              id="device-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full px-2 py-1.5 rounded text-sm',
                'bg-neutral-900 border border-neutral-600',
                'text-neutral-100 placeholder-neutral-500',
                'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
              )}
              placeholder="Filter recent devices..."
            />
          </div>

          {/* Recent Devices List */}
          {recentDevices.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-400">
                Recently Used
              </label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {recentDevices.map((addr) => (
                  <button
                    key={addr}
                    onClick={() => handleRecentClick(addr)}
                    className={cn(
                      'px-2 py-1 text-xs font-mono rounded transition-colors',
                      'bg-neutral-700 text-neutral-300 hover:bg-neutral-600',
                      'focus:outline-none focus:ring-1 focus:ring-blue-500'
                    )}
                  >
                    {addr}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-neutral-700 bg-neutral-850">
          <button
            onClick={onClose}
            className={cn(
              'px-4 py-2 text-sm rounded transition-colors',
              'bg-neutral-700 text-neutral-300 hover:bg-neutral-600',
              'focus:outline-none focus:ring-1 focus:ring-blue-500'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={cn(
              'px-4 py-2 text-sm rounded transition-colors',
              'bg-blue-600 text-white hover:bg-blue-500',
              'focus:outline-none focus:ring-1 focus:ring-blue-400'
            )}
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeviceSelectDialog;
