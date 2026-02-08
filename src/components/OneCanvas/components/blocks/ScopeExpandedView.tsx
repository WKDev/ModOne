/**
 * Scope Expanded View Component
 *
 * Full-screen modal for detailed oscilloscope viewing with
 * interactive controls for time base, trigger, and channels.
 */

import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Play, Square, Zap, ArrowUp, ArrowDown, Crosshair } from 'lucide-react';
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

/** Trigger edge type */
export type TriggerEdge = 'rising' | 'falling';

/** Cursor position on the scope */
interface CursorPosition {
  /** X position as 0-1 normalized (time) */
  x: number;
  /** Y position as voltage */
  y: number;
}

/** Cursor state for measurement */
interface CursorState {
  /** Whether cursors are enabled */
  enabled: boolean;
  /** Cursor 1 position */
  cursor1: CursorPosition;
  /** Cursor 2 position */
  cursor2: CursorPosition;
  /** Which cursor is currently active for editing */
  activeCursor: 1 | 2;
}

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

/**
 * Calculate RMS (Root Mean Square) of channel points.
 * Points are [x, y] tuples where y is voltage.
 * RMS = sqrt(sum(v^2) / n)
 */
function calculateRMS(points: [number, number][]): number {
  if (points.length === 0) return 0;
  const sumOfSquares = points.reduce((sum, [, y]) => sum + y * y, 0);
  return Math.sqrt(sumOfSquares / points.length);
}

/** Cursor colors */
const CURSOR_COLORS = {
  cursor1: '#ff6b6b', // Red
  cursor2: '#4ecdc4', // Cyan
};

/**
 * Draw measurement cursors on the scope canvas.
 */
function drawCursors(
  ctx: CanvasRenderingContext2D,
  cursorState: CursorState,
  timeBase: number,
  width: number,
  height: number
): void {
  const { cursor1, cursor2 } = cursorState;

  // Draw cursor 1 (vertical line)
  const x1 = cursor1.x * width;
  ctx.strokeStyle = CURSOR_COLORS.cursor1;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(x1, 0);
  ctx.lineTo(x1, height);
  ctx.stroke();

  // Draw cursor 2 (vertical line)
  const x2 = cursor2.x * width;
  ctx.strokeStyle = CURSOR_COLORS.cursor2;
  ctx.beginPath();
  ctx.moveTo(x2, 0);
  ctx.lineTo(x2, height);
  ctx.stroke();

  // Reset line dash
  ctx.setLineDash([]);

  // Draw cursor labels
  ctx.font = '10px monospace';
  ctx.fillStyle = CURSOR_COLORS.cursor1;
  const time1 = (cursor1.x * 10 * timeBase).toFixed(2);
  ctx.fillText(`C1: ${time1}ms`, x1 + 3, 12);

  ctx.fillStyle = CURSOR_COLORS.cursor2;
  const time2 = (cursor2.x * 10 * timeBase).toFixed(2);
  ctx.fillText(`C2: ${time2}ms`, x2 + 3, 24);

  // Draw delta time
  const deltaT = Math.abs(cursor2.x - cursor1.x) * 10 * timeBase;
  const freq = deltaT > 0 ? (1000 / deltaT).toFixed(2) : '∞';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`ΔT: ${deltaT.toFixed(2)}ms  f: ${freq}Hz`, 5, height - 5);
}

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

  // Trigger settings state
  const [triggerLevel, setTriggerLevel] = useState(0);
  const [triggerEdge, setTriggerEdge] = useState<TriggerEdge>('rising');
  const [triggerChannel, setTriggerChannel] = useState(0);

  // Cursor state for measurements
  const [cursorState, setCursorState] = useState<CursorState>({
    enabled: false,
    cursor1: { x: 0.25, y: 0 },
    cursor2: { x: 0.75, y: 0 },
    activeCursor: 1,
  });

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

    // Draw cursors if enabled
    if (cursorState.enabled) {
      drawCursors(ctx, cursorState, timeBase, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }, [displayData, channelSettings, cursorState, timeBase]);

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

  // Force trigger handler
  const handleForceTrigger = useCallback(async () => {
    try {
      await invoke('scope_arm_trigger', { scopeId: block.id });
    } catch (e) {
      console.debug('Failed to force trigger:', e);
    }
  }, [block.id]);

  // Trigger level change handler
  const handleTriggerLevelChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newLevel = parseFloat(e.target.value) || 0;
      setTriggerLevel(newLevel);
      try {
        await invoke('scope_update_settings', {
          scopeId: block.id,
          settings: { triggerLevel: newLevel },
        });
      } catch (e) {
        console.debug('Failed to update trigger level:', e);
      }
    },
    [block.id]
  );

  // Trigger edge change handler
  const handleTriggerEdgeChange = useCallback(async () => {
    const newEdge: TriggerEdge = triggerEdge === 'rising' ? 'falling' : 'rising';
    setTriggerEdge(newEdge);
    try {
      await invoke('scope_update_settings', {
        scopeId: block.id,
        settings: { triggerEdge: newEdge },
      });
    } catch (e) {
      console.debug('Failed to update trigger edge:', e);
    }
  }, [block.id, triggerEdge]);

  // Trigger channel change handler
  const handleTriggerChannelChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newChannel = parseInt(e.target.value, 10);
      setTriggerChannel(newChannel);
      try {
        await invoke('scope_update_settings', {
          scopeId: block.id,
          settings: { triggerChannel: newChannel },
        });
      } catch (e) {
        console.debug('Failed to update trigger channel:', e);
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

  // Toggle cursors
  const handleToggleCursors = useCallback(() => {
    setCursorState((prev) => ({
      ...prev,
      enabled: !prev.enabled,
    }));
  }, []);

  // Handle canvas click for cursor positioning
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!cursorState.enabled) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const x = ((e.clientX - rect.left) * scaleX) / canvas.width;

      setCursorState((prev) => ({
        ...prev,
        [prev.activeCursor === 1 ? 'cursor1' : 'cursor2']: {
          ...prev[prev.activeCursor === 1 ? 'cursor1' : 'cursor2'],
          x: Math.max(0, Math.min(1, x)),
        },
        // Toggle to other cursor after placing
        activeCursor: prev.activeCursor === 1 ? 2 : 1,
      }));
    },
    [cursorState.enabled]
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

          {/* Trigger controls group */}
          <div className="flex items-center gap-2 border-l border-neutral-600 pl-3">
            <label className="text-xs text-neutral-400">Trigger:</label>

            {/* Trigger mode */}
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

            {/* Trigger channel */}
            <select
              value={triggerChannel}
              onChange={handleTriggerChannelChange}
              className="bg-neutral-800 text-white text-sm px-2 py-1 rounded border border-neutral-600"
              style={{ color: CHANNEL_COLORS[triggerChannel] }}
            >
              {Array.from({ length: block.channels }, (_, i) => (
                <option key={i} value={i} style={{ color: CHANNEL_COLORS[i] }}>
                  CH{i + 1}
                </option>
              ))}
            </select>

            {/* Trigger level */}
            <input
              type="number"
              value={triggerLevel}
              onChange={handleTriggerLevelChange}
              step={0.1}
              className="bg-neutral-800 text-white text-sm px-2 py-1 rounded border border-neutral-600 w-16"
              title="Trigger level (V)"
            />
            <span className="text-xs text-neutral-400">V</span>

            {/* Trigger edge toggle */}
            <button
              onClick={handleTriggerEdgeChange}
              className="flex items-center gap-1 px-2 py-1 rounded text-sm bg-neutral-700 hover:bg-neutral-600 transition-colors"
              title={`Trigger on ${triggerEdge} edge`}
            >
              {triggerEdge === 'rising' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            </button>

            {/* Force trigger button */}
            <button
              onClick={handleForceTrigger}
              className="flex items-center gap-1 px-2 py-1 rounded text-sm bg-amber-600 hover:bg-amber-500 text-white transition-colors"
              title="Force Trigger"
            >
              <Zap size={14} />
            </button>
          </div>

          {/* Cursor toggle */}
          <button
            onClick={handleToggleCursors}
            className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
              cursorState.enabled
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
            }`}
            title={cursorState.enabled ? 'Disable Cursors' : 'Enable Cursors'}
          >
            <Crosshair size={14} />
            Cursors
          </button>

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
              className={`bg-black rounded w-full ${cursorState.enabled ? 'cursor-crosshair' : ''}`}
              onClick={handleCanvasClick}
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
        <div className="px-4 py-2 border-t border-neutral-700">
          {/* Status row */}
          <div className="flex items-center gap-4 mb-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Trigger:</span>
              <span
                className={`px-2 py-0.5 rounded ${
                  displayData?.triggered
                    ? 'bg-green-600 text-white'
                    : 'bg-neutral-700 text-neutral-300'
                }`}
              >
                {displayData?.triggered ? 'Triggered' : runMode === 'run' ? 'Armed' : 'Idle'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Time/div:</span>
              <span className="text-neutral-300">
                {displayData?.timePerDiv || timeBase} ms
              </span>
            </div>

            {/* Cursor measurements */}
            {cursorState.enabled && (
              <>
                <div className="border-l border-neutral-600 pl-4 flex items-center gap-3">
                  <span style={{ color: CURSOR_COLORS.cursor1 }}>
                    C1: {(cursorState.cursor1.x * 10 * timeBase).toFixed(2)}ms
                  </span>
                  <span style={{ color: CURSOR_COLORS.cursor2 }}>
                    C2: {(cursorState.cursor2.x * 10 * timeBase).toFixed(2)}ms
                  </span>
                  <span className="text-neutral-300">
                    ΔT: {(Math.abs(cursorState.cursor2.x - cursorState.cursor1.x) * 10 * timeBase).toFixed(2)}ms
                  </span>
                  <span className="text-neutral-300">
                    f: {(() => {
                      const dt = Math.abs(cursorState.cursor2.x - cursorState.cursor1.x) * 10 * timeBase;
                      return dt > 0 ? (1000 / dt).toFixed(2) : '∞';
                    })()}Hz
                  </span>
                </div>
                <span className="text-neutral-500 text-[10px]">
                  Click canvas to place {cursorState.activeCursor === 1 ? 'C1' : 'C2'}
                </span>
              </>
            )}
          </div>

          {/* Channel measurements */}
          <div className="flex flex-wrap gap-4 text-xs">
            {displayData?.channels.map((ch, i) => {
              const rms = calculateRMS(ch.points);
              return (
                <div
                  key={i}
                  className="flex items-center gap-2"
                  style={{ color: CHANNEL_COLORS[i] }}
                >
                  <span className="font-medium">CH{i + 1}:</span>
                  <span className="text-neutral-300">Vpp={(ch.max - ch.min).toFixed(2)}V</span>
                  <span className="text-neutral-400">Avg={ch.average.toFixed(2)}V</span>
                  <span className="text-neutral-400">Min={ch.min.toFixed(2)}V</span>
                  <span className="text-neutral-400">Max={ch.max.toFixed(2)}V</span>
                  <span className="text-neutral-400">RMS={rms.toFixed(2)}V</span>
                </div>
              );
            })}
            {!displayData && (
              <span className="text-neutral-500">No data - Start simulation</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default ScopeExpandedView;
