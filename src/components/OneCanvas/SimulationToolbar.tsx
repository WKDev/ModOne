/**
 * SimulationToolbar Component
 *
 * Controls for starting, stopping, and resetting circuit simulation.
 * Shows current simulation status and update rate.
 */

import { memo } from 'react';
import { Play, Pause, RotateCcw, Zap, Activity } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SimulationToolbarProps {
  /** Whether simulation is running */
  running: boolean;
  /** Start simulation callback */
  onStart: () => void;
  /** Stop simulation callback */
  onStop: () => void;
  /** Reset simulation callback */
  onReset: () => void;
  /** Run single step callback */
  onStep?: () => void;
  /** Target update rate in Hz */
  updateRate?: number;
  /** Actual measured update rate in Hz */
  measuredRate?: number;
  /** Number of active current paths */
  activePathCount?: number;
  /** Whether toolbar is compact mode */
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const SimulationToolbar = memo(function SimulationToolbar({
  running,
  onStart,
  onStop,
  onReset,
  onStep,
  updateRate = 20,
  measuredRate = 0,
  activePathCount = 0,
  compact = false,
}: SimulationToolbarProps) {
  return (
    <div
      className={`
        flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded-lg
        ${compact ? 'px-2 py-1' : 'px-3 py-2'}
      `}
    >
      {/* Play/Pause Button */}
      {running ? (
        <button
          onClick={onStop}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition-colors"
          title="Stop Simulation (Space)"
        >
          <Pause size={16} />
          {!compact && <span className="text-sm font-medium">Stop</span>}
        </button>
      ) : (
        <button
          onClick={onStart}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
          title="Start Simulation (Space)"
        >
          <Play size={16} />
          {!compact && <span className="text-sm font-medium">Start</span>}
        </button>
      )}

      {/* Step Button (only when not running) */}
      {onStep && !running && (
        <button
          onClick={onStep}
          className="flex items-center gap-1.5 px-2 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded transition-colors"
          title="Single Step"
        >
          <Zap size={16} />
          {!compact && <span className="text-sm">Step</span>}
        </button>
      )}

      {/* Reset Button */}
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 px-2 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded transition-colors"
        title="Reset Simulation"
      >
        <RotateCcw size={16} />
        {!compact && <span className="text-sm">Reset</span>}
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-neutral-600" />

      {/* Status Indicator */}
      <div className="flex items-center gap-2">
        {running ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            {!compact && (
              <span className="text-sm text-green-400 font-medium">Simulating</span>
            )}
          </>
        ) : (
          <>
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-500" />
            {!compact && (
              <span className="text-sm text-neutral-400">Stopped</span>
            )}
          </>
        )}
      </div>

      {/* Stats (only in expanded mode) */}
      {!compact && (
        <>
          <div className="w-px h-6 bg-neutral-600" />

          {/* Update Rate */}
          <div className="flex items-center gap-1 text-neutral-400" title="Update Rate">
            <Activity size={14} />
            <span className="text-xs font-mono">
              {measuredRate > 0 ? measuredRate : updateRate} Hz
            </span>
          </div>

          {/* Active Paths */}
          {activePathCount > 0 && (
            <div className="flex items-center gap-1 text-blue-400" title="Active Current Paths">
              <Zap size={14} />
              <span className="text-xs font-mono">{activePathCount}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default SimulationToolbar;
