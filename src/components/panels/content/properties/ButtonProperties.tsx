/**
 * Button Properties Component
 *
 * Property editor for Button/Switch blocks.
 */

import { memo, useCallback } from 'react';
import { CommonProperties } from './CommonProperties';
import type { ButtonBlock, ButtonMode, ContactConfig, Block } from '../../../OneCanvas/types';

// ============================================================================
// Types
// ============================================================================

interface ButtonPropertiesProps {
  component: ButtonBlock;
  onChange: (updates: Partial<Block>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const BUTTON_MODES: { value: ButtonMode; label: string; description: string }[] = [
  { value: 'momentary', label: 'Momentary', description: 'Press and hold to activate' },
  { value: 'stationary', label: 'Stationary', description: 'Toggle on/off with each click' },
];

const CONTACT_CONFIGS: { value: ContactConfig; label: string; description: string }[] = [
  { value: '1a', label: '1a (1NO)', description: '1 Normally Open contact' },
  { value: '1b', label: '1b (1NC)', description: '1 Normally Closed contact' },
  { value: '1a1b', label: '1a1b (1NO+1NC)', description: '1 NO and 1 NC contact' },
  { value: '2a', label: '2a (2NO)', description: '2 Normally Open contacts' },
  { value: '2b', label: '2b (2NC)', description: '2 Normally Closed contacts' },
  { value: '2a2b', label: '2a2b (2NO+2NC)', description: '2 NO and 2 NC contacts' },
  { value: '3a3b', label: '3a3b (3NO+3NC)', description: '3 NO and 3 NC contacts' },
];

// ============================================================================
// Component
// ============================================================================

export const ButtonProperties = memo(function ButtonProperties({
  component,
  onChange,
}: ButtonPropertiesProps) {
  // Handle mode change
  const handleModeChange = useCallback(
    (mode: ButtonMode) => {
      onChange({ mode } as Partial<ButtonBlock>);
    },
    [onChange]
  );

  // Handle contact config change
  const handleContactConfigChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({ contactConfig: e.target.value as ContactConfig } as Partial<ButtonBlock>);
    },
    [onChange]
  );

  return (
    <div className="space-y-4">
      {/* Common Properties */}
      <CommonProperties component={component} onChange={onChange} />

      {/* Divider */}
      <hr className="border-neutral-700" />

      {/* Button Specific */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase text-neutral-400">
          Button Settings
        </h4>

        {/* Operation Mode */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Operation Mode</label>
          <div className="flex gap-2">
            {BUTTON_MODES.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => handleModeChange(value)}
                className={`
                  flex-1 p-2 rounded border text-left transition-all
                  ${component.mode === value
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-neutral-700 hover:border-neutral-600'
                  }
                `}
                title={description}
              >
                <div className="text-sm text-neutral-200">{label}</div>
                <div className="text-[10px] text-neutral-500">{description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Contact Configuration */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Contact Configuration</label>
          <select
            value={component.contactConfig}
            onChange={handleContactConfigChange}
            className="w-full px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {CONTACT_CONFIGS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-500">
            {CONTACT_CONFIGS.find((c) => c.value === component.contactConfig)?.description}
          </p>
        </div>

        {/* Contact Legend */}
        <div className="p-2 bg-neutral-800/50 rounded border border-neutral-700">
          <div className="text-[10px] text-neutral-400 mb-1">Contact Legend:</div>
          <div className="flex gap-3 text-[10px]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full border border-green-400 bg-transparent" />
              <span className="text-neutral-500">NO (a) - open when idle</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm border border-green-400 bg-green-500" />
              <span className="text-neutral-500">NC (b) - closed when idle</span>
            </div>
          </div>
        </div>

        {/* Current State (Read-only) */}
        <div className="space-y-1">
          <label className="text-xs text-neutral-500">Current State</label>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                component.pressed ? 'bg-yellow-500' : 'bg-neutral-700'
              }`}
            />
            <span className="text-sm text-neutral-300">
              {component.pressed ? 'PRESSED' : 'RELEASED'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ButtonProperties;
