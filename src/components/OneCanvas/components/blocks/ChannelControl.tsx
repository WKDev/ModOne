/**
 * Channel Control Component
 *
 * Per-channel settings for oscilloscope including enable toggle,
 * scale selector, offset control, and coupling mode.
 */

import { memo, useCallback } from 'react';
import { CHANNEL_COLORS } from './waveformRenderer';

// ============================================================================
// Types
// ============================================================================

/** Channel coupling mode */
export type CouplingMode = 'DC' | 'AC' | 'GND';

/** Channel settings */
export interface ChannelSettings {
  /** Whether channel is enabled */
  enabled: boolean;
  /** Voltage scale (V/div) */
  scale: number;
  /** Vertical offset in divisions */
  offset: number;
  /** Input coupling mode */
  coupling: CouplingMode;
}

interface ChannelControlProps {
  /** Channel index (0-based) */
  channel: number;
  /** Current channel settings */
  settings: ChannelSettings;
  /** Callback when settings change */
  onUpdate: (settings: Partial<ChannelSettings>) => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Available voltage scale options (V/div) */
const SCALE_OPTIONS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20];

/** Coupling mode options */
const COUPLING_OPTIONS: CouplingMode[] = ['DC', 'AC', 'GND'];

// ============================================================================
// Component
// ============================================================================

/**
 * Channel control panel for oscilloscope settings.
 */
export const ChannelControl = memo(function ChannelControl({
  channel,
  settings,
  onUpdate,
}: ChannelControlProps) {
  const color = CHANNEL_COLORS[channel % CHANNEL_COLORS.length];
  const channelLabel = `CH${channel + 1}`;

  const handleEnableToggle = useCallback(() => {
    onUpdate({ enabled: !settings.enabled });
  }, [settings.enabled, onUpdate]);

  const handleScaleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onUpdate({ scale: Number(e.target.value) });
    },
    [onUpdate]
  );

  const handleOffsetChange = useCallback(
    (delta: number) => {
      onUpdate({ offset: settings.offset + delta });
    },
    [settings.offset, onUpdate]
  );

  const handleCouplingChange = useCallback(
    (coupling: CouplingMode) => {
      onUpdate({ coupling });
    },
    [onUpdate]
  );

  return (
    <div
      className={`p-2 rounded border ${
        settings.enabled ? 'border-opacity-100' : 'border-opacity-30 opacity-50'
      }`}
      style={{ borderColor: color }}
    >
      {/* Header with enable toggle */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={handleEnableToggle}
          className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors ${
            settings.enabled ? 'bg-current' : 'bg-transparent'
          }`}
          style={{ borderColor: color, color }}
          title={settings.enabled ? 'Disable channel' : 'Enable channel'}
        >
          {settings.enabled && (
            <svg
              className="w-3 h-3 text-black"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </button>
        <span className="text-sm font-medium" style={{ color }}>
          {channelLabel}
        </span>
      </div>

      {/* Scale selector */}
      <div className="mb-2">
        <label className="text-[10px] text-neutral-500 block mb-0.5">
          Scale
        </label>
        <select
          value={settings.scale}
          onChange={handleScaleChange}
          disabled={!settings.enabled}
          className="w-full bg-neutral-800 text-white text-xs px-1 py-0.5 rounded border border-neutral-600 disabled:opacity-50"
        >
          {SCALE_OPTIONS.map((scale) => (
            <option key={scale} value={scale}>
              {scale} V/div
            </option>
          ))}
        </select>
      </div>

      {/* Offset control */}
      <div className="mb-2">
        <label className="text-[10px] text-neutral-500 block mb-0.5">
          Offset
        </label>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOffsetChange(-0.5)}
            disabled={!settings.enabled}
            className="w-6 h-5 bg-neutral-700 hover:bg-neutral-600 rounded text-xs text-white disabled:opacity-50"
          >
            -
          </button>
          <span className="flex-1 text-center text-xs text-neutral-300">
            {settings.offset.toFixed(1)}
          </span>
          <button
            onClick={() => handleOffsetChange(0.5)}
            disabled={!settings.enabled}
            className="w-6 h-5 bg-neutral-700 hover:bg-neutral-600 rounded text-xs text-white disabled:opacity-50"
          >
            +
          </button>
        </div>
      </div>

      {/* Coupling toggle */}
      <div>
        <label className="text-[10px] text-neutral-500 block mb-0.5">
          Coupling
        </label>
        <div className="flex gap-0.5">
          {COUPLING_OPTIONS.map((mode) => (
            <button
              key={mode}
              onClick={() => handleCouplingChange(mode)}
              disabled={!settings.enabled}
              className={`flex-1 text-[10px] py-0.5 rounded transition-colors ${
                settings.coupling === mode
                  ? 'bg-neutral-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              } disabled:opacity-50`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export default ChannelControl;
