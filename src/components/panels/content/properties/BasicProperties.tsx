/**
 * Basic Properties Component
 *
 * Property editor for basic blocks (Power24v, Power12v, Gnd) that have
 * minimal configurable properties beyond the common ones.
 */

import { memo, useCallback, useState, useEffect } from 'react';
import { CommonProperties } from './CommonProperties';
import type {
  Block,
  Power24vBlock,
  Power12vBlock,
  GndBlock,
} from '../../../OneCanvas/types';

// ============================================================================
// Types
// ============================================================================

type BasicBlock = Power24vBlock | Power12vBlock | GndBlock;

interface BasicPropertiesProps {
  component: BasicBlock;
  onChange: (updates: Partial<Block>) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function isPowerBlock(block: BasicBlock): block is Power24vBlock | Power12vBlock {
  return block.type === 'power_24v' || block.type === 'power_12v';
}

function getVoltage(block: BasicBlock): number | null {
  switch (block.type) {
    case 'power_24v':
      return 24;
    case 'power_12v':
      return 12;
    case 'gnd':
      return 0;
  }
}

function getBlockDescription(block: BasicBlock): string {
  switch (block.type) {
    case 'power_24v':
      return 'Provides 24V DC power supply for industrial circuits';
    case 'power_12v':
      return 'Provides 12V DC power supply for low-voltage circuits';
    case 'gnd':
      return 'Ground reference (0V) for circuit completion';
  }
}

// ============================================================================
// Component
// ============================================================================

export const BasicProperties = memo(function BasicProperties({
  component,
  onChange,
}: BasicPropertiesProps) {
  const [localMaxCurrent, setLocalMaxCurrent] = useState(
    isPowerBlock(component) ? (component.maxCurrent || 1000).toString() : ''
  );

  // Sync local state
  useEffect(() => {
    if (isPowerBlock(component)) {
      setLocalMaxCurrent((component.maxCurrent || 1000).toString());
    }
  }, [component]);

  // Handle max current change (only for power blocks)
  const handleMaxCurrentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalMaxCurrent(e.target.value);
  }, []);

  const handleMaxCurrentBlur = useCallback(() => {
    if (!isPowerBlock(component)) return;

    const value = parseInt(localMaxCurrent, 10);
    if (!isNaN(value) && value >= 100 && value <= 10000 && value !== component.maxCurrent) {
      onChange({ maxCurrent: value } as Partial<Power24vBlock | Power12vBlock>);
    } else {
      setLocalMaxCurrent((component.maxCurrent || 1000).toString());
    }
  }, [localMaxCurrent, component, onChange]);

  const voltage = getVoltage(component);
  const description = getBlockDescription(component);

  return (
    <div className="space-y-4">
      {/* Common Properties */}
      <CommonProperties component={component} onChange={onChange} />

      {/* Divider */}
      <hr className="border-neutral-700" />

      {/* Block Specific Info */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase text-neutral-400">
          {component.type === 'gnd' ? 'Ground' : 'Power Supply'} Settings
        </h4>

        {/* Description */}
        <p className="text-xs text-neutral-500">{description}</p>

        {/* Voltage Display (not for junction) */}
        {voltage !== null && (
          <div className="space-y-1">
            <label className="text-xs text-neutral-500">Output Voltage</label>
            <div className="flex items-center gap-2 px-2 py-1.5 bg-neutral-800 rounded">
              <span
                className={`text-lg font-mono font-bold ${
                  voltage > 0 ? 'text-yellow-400' : 'text-green-400'
                }`}
              >
                {voltage}V
              </span>
              <span className="text-xs text-neutral-500">DC</span>
            </div>
          </div>
        )}

        {/* Max Current (only for power blocks) */}
        {isPowerBlock(component) && (
          <div className="space-y-1">
            <label className="text-xs text-neutral-500">Maximum Current</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={localMaxCurrent}
                onChange={handleMaxCurrentChange}
                onBlur={handleMaxCurrentBlur}
                min="100"
                max="10000"
                step="100"
                className="flex-1 px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-neutral-500">mA</span>
            </div>
            <p className="text-xs text-neutral-500">
              Maximum current output ({(parseInt(localMaxCurrent, 10) || 1000) / 1000} A)
            </p>
          </div>
        )}

        {/* Safety Info */}
        <div className="p-2 bg-neutral-800/50 rounded border border-neutral-700">
          <div className="text-[10px] text-neutral-400">
            {component.type === 'gnd' ? (
              <>
                <span className="text-green-400">Ground Reference</span>
                <br />
                Connect to complete circuit paths back to power supply
              </>
            ) : (
              <>
                <span className="text-yellow-400">Power Source</span>
                <br />
                Connect positive terminal to circuit input
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default BasicProperties;
