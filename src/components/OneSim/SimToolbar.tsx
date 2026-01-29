/**
 * SimToolbar Component
 *
 * Simulation control toolbar with play/pause/stop buttons and status indicator.
 */

import { memo } from 'react';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSimulation } from '../../hooks/useSimulation';
import type { SimStatus } from '../../types/onesim';

// ============================================================================
// Types
// ============================================================================

export interface SimToolbarProps {
  /** Optional class name */
  className?: string;
  /** Whether toolbar is in compact mode */
  compact?: boolean;
  /** Program ID to run (optional) */
  programId?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

/** Status indicator showing simulation state */
function SimStatusIndicator({
  status,
  compact,
}: {
  status: SimStatus;
  compact?: boolean;
}) {
  const statusConfig = {
    stopped: {
      color: 'bg-neutral-500',
      label: 'Stopped',
      textColor: 'text-neutral-400',
      pulse: false,
    },
    running: {
      color: 'bg-green-500',
      label: 'Running',
      textColor: 'text-green-400',
      pulse: true,
    },
    paused: {
      color: 'bg-yellow-500',
      label: 'Paused',
      textColor: 'text-yellow-400',
      pulse: false,
    },
    error: {
      color: 'bg-red-500',
      label: 'Error',
      textColor: 'text-red-400',
      pulse: false,
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {config.pulse && (
          <span
            className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              config.color
            )}
          />
        )}
        <span
          className={cn(
            'relative inline-flex rounded-full h-2.5 w-2.5',
            config.color
          )}
        />
      </span>
      {!compact && (
        <span className={cn('text-sm font-medium', config.textColor)}>
          {config.label}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const SimToolbar = memo(function SimToolbar({
  className,
  compact = false,
  programId,
}: SimToolbarProps) {
  const {
    status,
    isLoading,
    start,
    stop,
    pause,
    resume,
    reset,
    isRunning,
    isPaused,
    isStopped,
  } = useSimulation();

  const handleStart = () => {
    start(programId);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded-lg',
        compact ? 'px-2 py-1' : 'px-3 py-2',
        className
      )}
    >
      {/* Start/Pause/Resume Button */}
      {isStopped && (
        <button
          type="button"
          onClick={handleStart}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors',
            'bg-green-600 hover:bg-green-500 text-white',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
          title="Start Simulation (Space)"
        >
          <Play size={16} />
          {!compact && <span className="text-sm font-medium">Start</span>}
        </button>
      )}

      {isRunning && (
        <button
          type="button"
          onClick={pause}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors',
            'bg-yellow-600 hover:bg-yellow-500 text-white',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
          title="Pause Simulation"
        >
          <Pause size={16} />
          {!compact && <span className="text-sm font-medium">Pause</span>}
        </button>
      )}

      {isPaused && (
        <button
          type="button"
          onClick={resume}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors',
            'bg-green-600 hover:bg-green-500 text-white',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
          title="Resume Simulation"
        >
          <Play size={16} />
          {!compact && <span className="text-sm font-medium">Resume</span>}
        </button>
      )}

      {/* Stop Button */}
      {!isStopped && (
        <button
          type="button"
          onClick={stop}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors',
            'bg-red-600 hover:bg-red-500 text-white',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
          title="Stop Simulation"
        >
          <Square size={16} />
          {!compact && <span className="text-sm">Stop</span>}
        </button>
      )}

      {/* Reset Button */}
      <button
        type="button"
        onClick={reset}
        disabled={isLoading}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors',
          'bg-neutral-700 hover:bg-neutral-600 text-neutral-200',
          'disabled:opacity-40 disabled:cursor-not-allowed'
        )}
        title="Reset Simulation"
      >
        <RotateCcw size={16} />
        {!compact && <span className="text-sm">Reset</span>}
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-neutral-600" />

      {/* Status Indicator */}
      <SimStatusIndicator status={status} compact={compact} />
    </div>
  );
});

export default SimToolbar;
