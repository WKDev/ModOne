/**
 * Scope Expanded View Component
 *
 * Full-screen modal for detailed oscilloscope viewing with
 * interactive controls for time base, trigger, and channels.
 */

import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Play, Square } from 'lucide-react';
import { drawWaveform, drawEmptyScope, CHANNEL_COLORS } from './waveformRenderer';
import { ChannelControl, type ChannelSettings } from './ChannelControl';
import type { ScopeBlock as ScopeBlockType } from '../../types';
import type { ScopeDisplayData } from '../../../../types/onesim';

// ============================================================================
// Types
// ============================================================================

/** Trigger mode options */
export type TriggerMode = 'auto' | 'normal' | 'single';

/** Scope run mode */
export type RunMode = 'run' | 'stop';

interface ScopeExpandedViewProps {
  /** Block data */
  block: ScopeBlockType;
  /** Current display data */
  displayData: ScopeDisplayData | null;
  /** Whether scope is currently running */
  isRunning: boolean;
  /** Close handler */
  onClose: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Canvas dimensions for expanded view */
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 400;

/** Time base options (ms/div) */
const TIME_BASE_OPTIONS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

/** Trigger mode options */
const TRIGGER_MODE_OPTIONS: { value: TriggerMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'normal', label: 'Normal' },
  { value: 'single', label: 'Single' },
];

/** Default channel settings */
const DEFAULT_CHANNEL_SETTINGS: ChannelSettings = {
  enabled: true,
  scale: 5,
  offset: 0,
  coupling: 'DC',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Expanded scope view with detailed controls and larger display.
 */
export const ScopeExpandedView = memo(function ScopeExpandedView({
  block,
  displayData,
  isRunning,
  onClose,
}: ScopeExpandedViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Local settings state
  const [timeBase, setTimeBase] = useState(block.timeBase);
  const [triggerMode, setTriggerMode] = useState<TriggerMode>(
    block.triggerMode as TriggerMode
  );
  const [runMode, setRunMode] = useState<RunMode>(isRunning ? 'run' : 'stop');

  // Channel settings (initialize from block.channels count)
  const [channelSettings, setChannelSettings] = useState<ChannelSettings[]>(() =>
    Array.from({ length: block.channels }, () => ({ ...DEFAULT_CHANNEL_SETTINGS }))
  );

  // Draw waveform when data updates
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (displayData) {
      // Filter channels by enabled state
      const filteredData: ScopeDisplayData = {
        ...displayData,
        channels: displayData.channels.filter(
          (_, i) => channelSettings[i]?.enabled ?? true
        ),
      };
      drawWaveform(ctx, filteredData, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
      drawEmptyScope(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }, [displayData, channelSettings]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        handleRunStop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, runMode]);

  // Run/Stop handler
  const handleRunStop = useCallback(async () => {
    const newMode = runMode === 'run' ? 'stop' : 'run';
    setRunMode(newMode);
    try {
      await invoke('scope_run_stop', {
        scopeId: block.id,
        run: newMode === 'run',
      });
    } catch (e) {
      console.debug('Failed to toggle scope run/stop:', e);
    }
  }, [block.id, runMode]);

  // Time base change handler
  const handleTimeBaseChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newTimeBase = Number(e.target.value);
      setTimeBase(newTimeBase);
      try {
        await invoke('scope_update_settings', {
          scopeId: block.id,
          settings: { timeBase: newTimeBase },
        });
      } catch (e) {
        console.debug('Failed to update time base:', e);
      }
    },
    [block.id]
  );

  // Trigger mode change handler
  const handleTriggerModeChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newMode = e.target.value as TriggerMode;
      setTriggerMode(newMode);
      try {
        await invoke('scope_update_settings', {
          scopeId: block.id,
          settings: { triggerMode: newMode },
        });
      } catch (e) {
        console.debug('Failed to update trigger mode:', e);
      }
    },
    [block.id]
  );

  // Channel settings update handler
  const handleChannelUpdate = useCallback(
    (channelIndex: number, updates: Partial<ChannelSettings>) => {
      setChannelSettings((prev) => {
        const next = [...prev];
        next[channelIndex] = { ...next[channelIndex], ...updates };
        return next;
      });
    },
    []
  );

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 rounded-lg flex flex-col max-w-[900px] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-neutral-700">
          {/* Run/Stop button */}
          <button
            onClick={handleRunStop}
            className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
              runMode === 'run'
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-green-600 hover:bg-green-500 text-white'
            }`}
            title={runMode === 'run' ? 'Stop (Space)' : 'Run (Space)'}
          >
            {runMode === 'run' ? (
              <>
                <Square size={14} />
                Stop
              </>
            ) : (
              <>
                <Play size={14} />
                Run
              </>
            )}
          </button>

          {/* Time base selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-400">Time:</label>
            <select
              value={timeBase}
              onChange={handleTimeBaseChange}
              className="bg-neutral-800 text-white text-sm px-2 py-1 rounded border border-neutral-600"
            >
              {TIME_BASE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t} ms/div
                </option>
              ))}
            </select>
          </div>

          {/* Trigger mode selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-400">Trigger:</label>
            <select
              value={triggerMode}
              onChange={handleTriggerModeChange}
              className="bg-neutral-800 text-white text-sm px-2 py-1 rounded border border-neutral-600"
            >
              {TRIGGER_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Title */}
          <span className="text-sm text-neutral-300">
            {block.label || block.id}
          </span>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors"
            title="Close (Escape)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Canvas area */}
          <div className="flex-1 p-4">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="bg-black rounded w-full"
            />
          </div>

          {/* Channel controls sidebar */}
          <div className="w-36 border-l border-neutral-700 p-2 space-y-2 overflow-y-auto">
            {channelSettings.map((settings, i) => (
              <ChannelControl
                key={i}
                channel={i}
                settings={settings}
                onUpdate={(updates) => handleChannelUpdate(i, updates)}
              />
            ))}
          </div>
        </div>

        {/* Measurements bar */}
        <div className="px-4 py-2 border-t border-neutral-700 flex flex-wrap gap-4 text-xs">
          {displayData?.channels.map((ch, i) => (
            <div
              key={i}
              className="flex items-center gap-2"
              style={{ color: CHANNEL_COLORS[i] }}
            >
              <span className="font-medium">CH{i + 1}:</span>
              <span className="text-neutral-300">
                Vpp={(ch.max - ch.min).toFixed(2)}V
              </span>
              <span className="text-neutral-400">
                Avg={ch.average.toFixed(2)}V
              </span>
            </div>
          ))}
          {!displayData && (
            <span className="text-neutral-500">No data - Start simulation</span>
          )}
        </div>
      </div>
    </div>
  );
});

export default ScopeExpandedView;
