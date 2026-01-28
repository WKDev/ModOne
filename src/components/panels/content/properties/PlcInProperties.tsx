/**
 * PLC Input Properties Component
 *
 * Property editor for PLC Input (discrete input) blocks.
 */

import { memo, useCallback, useState, useEffect } from 'react';
import { CommonProperties } from './CommonProperties';
import type { PlcInBlock, Block } from '../../../OneCanvas/types';
import { formatDiscreteAddress, parsePlcAddress } from '../../../OneCanvas/utils/plcAddressUtils';

// ============================================================================
// Types
// ============================================================================

interface PlcInPropertiesProps {
  component: PlcInBlock;
  onChange: (updates: Partial<Block>) => void;
}

// ============================================================================
// Component
// ============================================================================

export const PlcInProperties = memo(function PlcInProperties({
  component,
  onChange,
}: PlcInPropertiesProps) {
  const [localAddress, setLocalAddress] = useState(component.address);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [localThreshold, setLocalThreshold] = useState(component.thresholdVoltage.toString());

  // Sync local state
  useEffect(() => {
    setLocalAddress(component.address);
    setLocalThreshold(component.thresholdVoltage.toString());
    setAddressError(null);
  }, [component.id, component.address, component.thresholdVoltage]);

  // Validate and update address
  const handleAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setLocalAddress(value);

    // Validate
    const parsed = parsePlcAddress(value);
    if (!value) {
      setAddressError('Address is required');
    } else if (!parsed || parsed.type !== 'discrete') {
      setAddressError('Invalid discrete input address (e.g., X0001)');
    } else {
      setAddressError(null);
    }
  }, []);

  const handleAddressBlur = useCallback(() => {
    if (!addressError && localAddress !== component.address) {
      onChange({ address: localAddress } as Partial<PlcInBlock>);
    }
  }, [localAddress, addressError, component.address, onChange]);

  // Handle threshold voltage change
  const handleThresholdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalThreshold(e.target.value);
  }, []);

  const handleThresholdBlur = useCallback(() => {
    const value = parseFloat(localThreshold);
    if (!isNaN(value) && value >= 0 && value <= 24 && value !== component.thresholdVoltage) {
      onChange({ thresholdVoltage: value } as Partial<PlcInBlock>);
    } else {
      setLocalThreshold(component.thresholdVoltage.toString());
    }
  }, [localThreshold, component.thresholdVoltage, onChange]);

  // Handle inverted change
  const handleInvertedChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ inverted: e.target.checked } as Partial<PlcInBlock>);
    },
    [onChange]
  );

  // Get display address
  const parsed = parsePlcAddress(component.address);
  const displayAddress = parsed ? formatDiscreteAddress(parsed.address) : component.address;

  return (
    <div className="space-y-4">
      {/* Common Properties */}
      <CommonProperties component={component} onChange={onChange} />

      {/* Divider */}
      <hr className="border-neutral-700" />

      {/* PLC Input Specific */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase text-neutral-400">
          Discrete Input Settings
        </h4>

        {/* Address Input */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Modbus Address</label>
          <input
            type="text"
            value={localAddress}
            onChange={handleAddressChange}
            onBlur={handleAddressBlur}
            placeholder="X0001"
            className={`
              w-full px-2 py-1.5 bg-neutral-800 border rounded text-sm text-white font-mono
              placeholder:text-neutral-600 focus:outline-none focus:ring-1
              ${addressError
                ? 'border-red-500 focus:ring-red-500'
                : 'border-neutral-700 focus:ring-blue-500'
              }
            `}
          />
          {addressError && (
            <p className="text-xs text-red-400">{addressError}</p>
          )}
          {!addressError && parsed && (
            <p className="text-xs text-neutral-500">
              Formatted: {displayAddress}
            </p>
          )}
        </div>

        {/* Threshold Voltage */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Threshold Voltage</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={localThreshold}
              onChange={handleThresholdChange}
              onBlur={handleThresholdBlur}
              min="0"
              max="24"
              step="0.5"
              className="flex-1 px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-xs text-neutral-500">V</span>
          </div>
          <p className="text-xs text-neutral-500">
            Input triggers when voltage exceeds this threshold
          </p>
        </div>

        {/* Inverted */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={component.inverted}
            onChange={handleInvertedChange}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-sm text-neutral-300">Invert input</span>
        </label>
      </div>
    </div>
  );
});

export default PlcInProperties;
