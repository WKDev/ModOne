/**
 * ForcedDevicesPanel Component
 *
 * Displays a list of all currently forced devices with their values
 * and provides quick release controls.
 */

import { useCallback, useMemo } from 'react';
import { Zap, Unlock, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  useLadderStore,
  selectMode,
  selectMonitoringState,
} from '../../../stores/ladderStore';

// ============================================================================
// Types
// ============================================================================

export interface ForcedDevicesPanelProps {
  /** Optional class name */
  className?: string;
  /** Whether the panel is collapsed */
  collapsed?: boolean;
  /** Called when collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
  /** Called when force device dialog should open */
  onEditForce?: (address: string) => void;
}

interface ForcedDeviceItem {
  address: string;
  value: boolean | number;
  isBit: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine if a device is a bit device
 */
function isBitDevice(address: string): boolean {
  const type = address.charAt(0).toUpperCase();
  const bitDevices = ['X', 'Y', 'M', 'P', 'K', 'F', 'T', 'C'];
  return bitDevices.includes(type);
}

/**
 * Format device value for display
 */
function formatValue(value: boolean | number, isBit: boolean): string {
  if (isBit) {
    return value ? 'ON' : 'OFF';
  }
  return String(value);
}

/**
 * Get device type description
 */
function getDeviceDescription(address: string): string {
  const type = address.charAt(0).toUpperCase();
  const descriptions: Record<string, string> = {
    X: 'Input',
    Y: 'Output',
    M: 'Internal',
    P: 'Output Relay',
    K: 'Keep Relay',
    F: 'Special',
    T: 'Timer',
    C: 'Counter',
    D: 'Data Register',
    R: 'Retentive',
    Z: 'Index',
    N: 'Constant',
  };
  return descriptions[type] || 'Unknown';
}

// ============================================================================
// ForcedDevicesPanel Component
// ============================================================================

export function ForcedDevicesPanel({
  className,
  collapsed = false,
  onCollapseChange,
  onEditForce,
}: ForcedDevicesPanelProps) {
  // Get store state
  const mode = useLadderStore(selectMode);
  const monitoringState = useLadderStore(selectMonitoringState);
  const releaseForce = useLadderStore((state) => state.releaseForce);

  const isMonitoring = mode === 'monitor';

  // Build forced devices list
  const forcedDevices = useMemo<ForcedDeviceItem[]>(() => {
    if (!monitoringState || !monitoringState.forcedDevices.size) {
      return [];
    }

    const devices: ForcedDeviceItem[] = [];
    for (const address of monitoringState.forcedDevices) {
      const value = monitoringState.deviceStates.get(address);
      if (value !== undefined) {
        devices.push({
          address,
          value,
          isBit: isBitDevice(address),
        });
      }
    }

    // Sort by address
    devices.sort((a, b) => a.address.localeCompare(b.address));
    return devices;
  }, [monitoringState]);

  // Handle release single device
  const handleRelease = useCallback(
    (address: string) => {
      releaseForce(address);
    },
    [releaseForce]
  );

  // Handle release all
  const handleReleaseAll = useCallback(() => {
    for (const device of forcedDevices) {
      releaseForce(device.address);
    }
  }, [forcedDevices, releaseForce]);

  // Handle edit click
  const handleEdit = useCallback(
    (address: string) => {
      onEditForce?.(address);
    },
    [onEditForce]
  );

  // Handle collapse toggle
  const handleCollapseToggle = useCallback(() => {
    onCollapseChange?.(!collapsed);
  }, [collapsed, onCollapseChange]);

  // Don't render if not monitoring or no forced devices
  if (!isMonitoring || forcedDevices.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'border border-yellow-600/50 rounded overflow-hidden',
        'bg-yellow-900/20',
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2',
          'bg-yellow-900/30 cursor-pointer select-none',
          'hover:bg-yellow-900/40 transition-colors'
        )}
        onClick={handleCollapseToggle}
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium text-yellow-400">
            Forced Devices
          </span>
          <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-600/30 text-yellow-300">
            {forcedDevices.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!collapsed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReleaseAll();
              }}
              className={cn(
                'flex items-center gap-1 px-2 py-1 text-xs rounded',
                'bg-neutral-700 text-neutral-300 hover:bg-neutral-600',
                'transition-colors'
              )}
              title="Release all forced devices"
            >
              <X className="w-3 h-3" />
              Release All
            </button>
          )}
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-yellow-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-yellow-400" />
          )}
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="max-h-48 overflow-y-auto">
          {forcedDevices.map((device) => (
            <div
              key={device.address}
              className={cn(
                'flex items-center justify-between px-3 py-2',
                'border-t border-yellow-600/20',
                'hover:bg-yellow-900/10 transition-colors'
              )}
            >
              {/* Device Info */}
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-sm font-mono text-yellow-300">
                    {device.address}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {getDeviceDescription(device.address)}
                  </span>
                </div>
              </div>

              {/* Value */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleEdit(device.address)}
                  className={cn(
                    'px-2 py-1 text-sm font-mono rounded',
                    device.isBit
                      ? device.value
                        ? 'bg-green-600/30 text-green-400'
                        : 'bg-neutral-600/30 text-neutral-400'
                      : 'bg-blue-600/30 text-blue-400',
                    'hover:opacity-80 transition-opacity',
                    'cursor-pointer'
                  )}
                  title="Click to modify forced value"
                >
                  {formatValue(device.value, device.isBit)}
                </button>

                {/* Release Button */}
                <button
                  onClick={() => handleRelease(device.address)}
                  className={cn(
                    'p-1 rounded',
                    'text-neutral-400 hover:text-neutral-200',
                    'hover:bg-neutral-700 transition-colors'
                  )}
                  title="Release force"
                >
                  <Unlock className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ForcedDevicesPanel;
