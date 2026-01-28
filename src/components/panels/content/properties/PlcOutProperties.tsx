/**
 * PLC Output Properties Component
 *
 * Property editor for PLC Output (coil) blocks.
 */

import { memo, useCallback, useState, useEffect } from 'react';
import { CommonProperties } from './CommonProperties';
import type { PlcOutBlock, Block } from '../../../OneCanvas/types';
import { formatCoilAddress, parsePlcAddress } from '../../../OneCanvas/utils/plcAddressUtils';

// ============================================================================
// Types
// ============================================================================

interface PlcOutPropertiesProps {
  component: PlcOutBlock;
  onChange: (updates: Partial<Block>) => void;
}

// ============================================================================
// Component
// ============================================================================

export const PlcOutProperties = memo(function PlcOutProperties({
  component,
  onChange,
}: PlcOutPropertiesProps) {
  const [localAddress, setLocalAddress] = useState(component.address);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Sync local state
  useEffect(() => {
    setLocalAddress(component.address);
    setAddressError(null);
  }, [component.id, component.address]);

  // Validate and update address
  const handleAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setLocalAddress(value);

    // Validate
    const parsed = parsePlcAddress(value);
    if (!value) {
      setAddressError('Address is required');
    } else if (!parsed || parsed.type !== 'coil') {
      setAddressError('Invalid coil address (e.g., C:0x0001 or M0001)');
    } else {
      setAddressError(null);
    }
  }, []);

  const handleAddressBlur = useCallback(() => {
    if (!addressError && localAddress !== component.address) {
      onChange({ address: localAddress } as Partial<PlcOutBlock>);
    }
  }, [localAddress, addressError, component.address, onChange]);

  // Handle contact type change
  const handleNormallyOpenChange = useCallback(
    (normallyOpen: boolean) => {
      onChange({ normallyOpen } as Partial<PlcOutBlock>);
    },
    [onChange]
  );

  // Handle inverted change
  const handleInvertedChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ inverted: e.target.checked } as Partial<PlcOutBlock>);
    },
    [onChange]
  );

  // Get display address
  const parsed = parsePlcAddress(component.address);
  const displayAddress = parsed ? formatCoilAddress(parsed.address) : component.address;

  return (
    <div className="space-y-4">
      {/* Common Properties */}
      <CommonProperties component={component} onChange={onChange} />

      {/* Divider */}
      <hr className="border-neutral-700" />

      {/* PLC Output Specific */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase text-neutral-400">
          Coil Settings
        </h4>

        {/* Address Input */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Modbus Address</label>
          <input
            type="text"
            value={localAddress}
            onChange={handleAddressChange}
            onBlur={handleAddressBlur}
            placeholder="C:0x0001"
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

        {/* Contact Type */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Contact Type</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`contact-type-${component.id}`}
                checked={component.normallyOpen}
                onChange={() => handleNormallyOpenChange(true)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-sm text-neutral-300">Normally Open (NO)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`contact-type-${component.id}`}
                checked={!component.normallyOpen}
                onChange={() => handleNormallyOpenChange(false)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-sm text-neutral-300">Normally Closed (NC)</span>
            </label>
          </div>
        </div>

        {/* Inverted */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={component.inverted}
            onChange={handleInvertedChange}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-sm text-neutral-300">Invert output</span>
        </label>
      </div>
    </div>
  );
});

export default PlcOutProperties;
