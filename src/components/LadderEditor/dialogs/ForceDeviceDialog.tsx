/**
 * ForceDeviceDialog Component
 *
 * Modal dialog for forcing device values during monitoring mode.
 * Supports boolean (switch) and numeric (input) device types.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, Zap, Unlock } from 'lucide-react';
import { cn } from '../../../lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface DeviceInfo {
  /** Device address (e.g., 'X0', 'Y0', 'D0') */
  address: string;
  /** Current value */
  currentValue: boolean | number;
  /** Whether the device is currently forced */
  isForced: boolean;
  /** Device type description */
  description?: string;
}

export interface ForceDeviceDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Device information */
  device: DeviceInfo;
  /** Called when force is confirmed */
  onForce: (address: string, value: boolean | number) => void;
  /** Called when force is released */
  onRelease: (address: string) => void;
  /** Called when dialog should close */
  onClose: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a device is an output device (requires safety warning)
 */
function isOutputDevice(address: string): boolean {
  const type = address.charAt(0).toUpperCase();
  // Y = Physical output, P = Output relay, K = Keep relay (latched)
  return type === 'Y' || type === 'P' || type === 'K';
}

/**
 * Determine if a device uses boolean or numeric values
 */
function isBooleanDevice(address: string): boolean {
  const type = address.charAt(0).toUpperCase();
  // Bit devices: X, Y, M, P, K, F, T, C
  const bitDevices = ['X', 'Y', 'M', 'P', 'K', 'F', 'T', 'C'];
  return bitDevices.includes(type);
}

// ============================================================================
// ForceDeviceDialog Component
// ============================================================================

export function ForceDeviceDialog({
  isOpen,
  device,
  onForce,
  onRelease,
  onClose,
}: ForceDeviceDialogProps) {
  const [value, setValue] = useState<boolean | number>(device.currentValue);
  const [showSafetyWarning, setShowSafetyWarning] = useState(false);
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isBool = isBooleanDevice(device.address);
  const isOutput = isOutputDevice(device.address);

  // Reset state when dialog opens or device changes
  useEffect(() => {
    if (isOpen) {
      setValue(device.currentValue);
      setShowSafetyWarning(false);
      setSafetyConfirmed(false);

      // Focus input for numeric devices
      if (!isBool) {
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 50);
      }
    }
  }, [isOpen, device.currentValue, isBool]);

  // Handle force action
  const handleForce = useCallback(() => {
    // Check if safety warning needed for output devices
    if (isOutput && !safetyConfirmed) {
      setShowSafetyWarning(true);
      return;
    }

    onForce(device.address, value);
    onClose();
  }, [device.address, value, isOutput, safetyConfirmed, onForce, onClose]);

  // Handle safety confirmation
  const handleSafetyConfirm = useCallback(() => {
    setSafetyConfirmed(true);
    setShowSafetyWarning(false);
    // Proceed with force after confirmation
    onForce(device.address, value);
    onClose();
  }, [device.address, value, onForce, onClose]);

  // Handle release action
  const handleRelease = useCallback(() => {
    onRelease(device.address);
    onClose();
  }, [device.address, onRelease, onClose]);

  // Handle toggle for boolean devices
  const handleToggle = useCallback(() => {
    setValue((prev) => !prev);
  }, []);

  // Handle numeric input change
  const handleNumericChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const numValue = parseInt(e.target.value, 10);
      if (!isNaN(numValue)) {
        // Clamp to 16-bit word range
        setValue(Math.max(-32768, Math.min(65535, numValue)));
      } else if (e.target.value === '' || e.target.value === '-') {
        setValue(0);
      }
    },
    []
  );

  // Handle key down
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleForce();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (showSafetyWarning) {
          setShowSafetyWarning(false);
        } else {
          onClose();
        }
      }
    },
    [handleForce, showSafetyWarning, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        if (showSafetyWarning) {
          setShowSafetyWarning(false);
        } else {
          onClose();
        }
      }
    },
    [showSafetyWarning, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-neutral-800 rounded-lg shadow-xl border border-neutral-700 w-[360px] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="force-dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 bg-yellow-900/20">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <h2 id="force-dialog-title" className="text-sm font-medium text-neutral-200">
              Force Device: {device.address}
            </h2>
          </div>
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

        {/* Safety Warning Overlay */}
        {showSafetyWarning && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70">
            <div className="bg-neutral-800 rounded-lg shadow-xl border border-red-600 p-4 m-4 max-w-[320px]">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-red-400 mb-1">
                    Safety Warning
                  </h3>
                  <p className="text-xs text-neutral-300">
                    Forcing output device <strong>{device.address}</strong> may
                    cause equipment to operate unexpectedly. Ensure proper safety
                    precautions are in place before proceeding.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSafetyWarning(false)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded transition-colors',
                    'bg-neutral-700 text-neutral-300 hover:bg-neutral-600',
                    'focus:outline-none focus:ring-1 focus:ring-neutral-500'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSafetyConfirm}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded transition-colors',
                    'bg-red-600 text-white hover:bg-red-500',
                    'focus:outline-none focus:ring-1 focus:ring-red-400'
                  )}
                >
                  Force Anyway
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Current Status */}
          <div className="flex items-center justify-between p-2 bg-neutral-900 rounded">
            <span className="text-xs text-neutral-400">Current Value:</span>
            <span className="text-sm font-mono text-neutral-200">
              {isBool
                ? device.currentValue
                  ? 'ON'
                  : 'OFF'
                : String(device.currentValue)}
            </span>
          </div>

          {device.isForced && (
            <div className="flex items-center gap-2 p-2 bg-yellow-900/30 border border-yellow-600/50 rounded text-xs text-yellow-400">
              <Zap className="w-4 h-4" />
              <span>This device is currently forced</span>
            </div>
          )}

          {/* Value Input */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-400">
              Force Value
            </label>

            {isBool ? (
              // Boolean toggle switch
              <button
                onClick={handleToggle}
                className={cn(
                  'w-full flex items-center justify-between p-3 rounded border transition-colors',
                  value
                    ? 'bg-green-900/30 border-green-600 text-green-400'
                    : 'bg-neutral-900 border-neutral-600 text-neutral-400'
                )}
              >
                <span className="text-sm font-medium">
                  {value ? 'ON (TRUE)' : 'OFF (FALSE)'}
                </span>
                <div
                  className={cn(
                    'w-12 h-6 rounded-full p-1 transition-colors',
                    value ? 'bg-green-600' : 'bg-neutral-600'
                  )}
                >
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full bg-white transition-transform',
                      value ? 'translate-x-6' : 'translate-x-0'
                    )}
                  />
                </div>
              </button>
            ) : (
              // Numeric input
              <input
                ref={inputRef}
                type="number"
                value={value as number}
                onChange={handleNumericChange}
                className={cn(
                  'w-full px-3 py-2 rounded text-lg font-mono',
                  'bg-neutral-900 border border-neutral-600',
                  'text-neutral-100 placeholder-neutral-500',
                  'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                )}
                min={-32768}
                max={65535}
              />
            )}

            {!isBool && (
              <p className="text-xs text-neutral-500">
                Range: -32768 to 65535 (16-bit word)
              </p>
            )}
          </div>

          {/* Device Info */}
          {device.description && (
            <p className="text-xs text-neutral-500">{device.description}</p>
          )}

          {/* Output Warning Notice */}
          {isOutput && (
            <div className="flex items-start gap-2 p-2 bg-orange-900/20 border border-orange-600/30 rounded">
              <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-orange-300">
                This is an output device. Forcing may cause physical equipment
                to operate.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-neutral-700 bg-neutral-850">
          {device.isForced ? (
            <button
              onClick={handleRelease}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm rounded transition-colors',
                'bg-neutral-700 text-neutral-300 hover:bg-neutral-600',
                'focus:outline-none focus:ring-1 focus:ring-neutral-500'
              )}
            >
              <Unlock className="w-4 h-4" />
              Release Force
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
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
              onClick={handleForce}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm rounded transition-colors',
                'bg-yellow-600 text-white hover:bg-yellow-500',
                'focus:outline-none focus:ring-1 focus:ring-yellow-400'
              )}
            >
              <Zap className="w-4 h-4" />
              Force
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForceDeviceDialog;
