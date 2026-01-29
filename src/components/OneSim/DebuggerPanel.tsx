/**
 * DebuggerPanel Component
 *
 * Control panel for PLC simulation debugging with run/stop/step controls,
 * timing display, status indicators, and breakpoint hit information.
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import {
  Play,
  Square,
  StepForward,
  SkipForward,
  RotateCcw,
  Activity,
  AlertTriangle,
  Pause,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  SimStatus,
  SimStats,
  ScanTiming,
  BreakpointHit,
  SimStatusUpdatePayload,
  BreakpointHitPayload,
  StepType,
} from '../../types/onesim';

// ============================================================================
// Types
// ============================================================================

export interface DebuggerPanelProps {
  /** Optional class name */
  className?: string;
  /** Whether panel is in compact mode */
  compact?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const SIM_STATUS_UPDATE_EVENT = 'sim:status-update';
const BREAKPOINT_HIT_EVENT = 'sim:breakpoint-hit';

const DEFAULT_TIMING: ScanTiming = {
  current: 0,
  average: 0,
  min: 0,
  max: 0,
};

const DEFAULT_STATS: SimStats = {
  scanCount: 0,
  currentNetworkId: null,
  timing: DEFAULT_TIMING,
  watchdogTriggered: false,
};

// ============================================================================
// Sub-components
// ============================================================================

/** Control button component */
function ControlButton({
  onClick,
  disabled,
  variant = 'default',
  title,
  shortcut,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'success' | 'danger' | 'warning';
  title: string;
  shortcut?: string;
  children: React.ReactNode;
}) {
  const variantClasses = {
    default: 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200',
    success: 'bg-green-600 hover:bg-green-500 text-white',
    danger: 'bg-red-600 hover:bg-red-500 text-white',
    warning: 'bg-yellow-600 hover:bg-yellow-500 text-white',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${title} (${shortcut})` : title}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variantClasses[variant]
      )}
    >
      {children}
    </button>
  );
}

/** Status indicator component */
function StatusIndicator({
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
          className={cn('relative inline-flex rounded-full h-2.5 w-2.5', config.color)}
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

/** Timing display component */
function TimingDisplay({
  timing,
  scanCount,
  compact,
}: {
  timing: ScanTiming;
  scanCount: number;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-1 text-neutral-400" title="Cycle Time">
        <Activity size={14} />
        <span className="text-xs font-mono">{timing.current.toFixed(1)}ms</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-xs font-mono">
      <div className="flex flex-col items-center">
        <span className="text-neutral-500">Current</span>
        <span className="text-neutral-300">{timing.current.toFixed(1)}ms</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-neutral-500">Avg</span>
        <span className="text-neutral-300">{timing.average.toFixed(1)}ms</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-neutral-500">Min/Max</span>
        <span className="text-neutral-300">
          {timing.min.toFixed(1)}/{timing.max.toFixed(1)}ms
        </span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-neutral-500">Scans</span>
        <span className="text-blue-400">{scanCount.toLocaleString()}</span>
      </div>
    </div>
  );
}

/** Breakpoint hit display component */
function BreakpointHitDisplay({ hit }: { hit: BreakpointHit }) {
  const getMessage = () => {
    switch (hit.type) {
      case 'network':
        return `Network ${hit.networkId} breakpoint`;
      case 'device':
        return `${hit.address}: ${JSON.stringify(hit.oldValue)} → ${JSON.stringify(hit.newValue)}`;
      case 'condition':
        return `Condition: ${hit.condition}`;
      case 'scanCount':
        return `Scan count: ${hit.scanCount}`;
      default:
        return 'Breakpoint hit';
    }
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-yellow-900/30 border border-yellow-700 rounded text-sm">
      <Pause size={14} className="text-yellow-500" />
      <span className="text-yellow-400">{getMessage()}</span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const DebuggerPanel = memo(function DebuggerPanel({
  className,
  compact = false,
}: DebuggerPanelProps) {
  // State
  const [status, setStatus] = useState<SimStatus>('stopped');
  const [stats, setStats] = useState<SimStats>(DEFAULT_STATS);
  const [breakpointHit, setBreakpointHit] = useState<BreakpointHit | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Derived state
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isStopped = status === 'stopped';
  const canStep = isPaused || isStopped;

  // ============================================================================
  // Tauri Commands
  // ============================================================================

  const handleRun = useCallback(async () => {
    setIsLoading(true);
    setBreakpointHit(null);
    try {
      await invoke('sim_run');
      setStatus('running');
    } catch (err) {
      console.error('Failed to start simulation:', err);
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleStop = useCallback(async () => {
    setIsLoading(true);
    try {
      await invoke('sim_stop');
      setStatus('stopped');
      setBreakpointHit(null);
    } catch (err) {
      console.error('Failed to stop simulation:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePause = useCallback(async () => {
    setIsLoading(true);
    try {
      await invoke('sim_pause');
      setStatus('paused');
    } catch (err) {
      console.error('Failed to pause simulation:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleStepNetwork = useCallback(async () => {
    setIsLoading(true);
    setBreakpointHit(null);
    try {
      const stepType: StepType = 'network';
      await invoke('sim_step', { stepType });
    } catch (err) {
      console.error('Failed to step network:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleStepScan = useCallback(async () => {
    setIsLoading(true);
    setBreakpointHit(null);
    try {
      const stepType: StepType = 'scan';
      await invoke('sim_step', { stepType });
    } catch (err) {
      console.error('Failed to step scan:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReset = useCallback(async () => {
    setIsLoading(true);
    try {
      await invoke('sim_reset');
      setStatus('stopped');
      setStats(DEFAULT_STATS);
      setBreakpointHit(null);
    } catch (err) {
      console.error('Failed to reset simulation:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================================
  // Event Listeners
  // ============================================================================

  useEffect(() => {
    let unlistenStatus: UnlistenFn | null = null;
    let unlistenBreakpoint: UnlistenFn | null = null;

    const setupListeners = async () => {
      // Listen for status updates
      unlistenStatus = await listen<SimStatusUpdatePayload>(
        SIM_STATUS_UPDATE_EVENT,
        (event) => {
          setStatus(event.payload.status);
          setStats(event.payload.stats);
        }
      );

      // Listen for breakpoint hits
      unlistenBreakpoint = await listen<BreakpointHitPayload>(
        BREAKPOINT_HIT_EVENT,
        (event) => {
          setBreakpointHit(event.payload.hit);
          setStatus('paused');
        }
      );
    };

    setupListeners();

    return () => {
      if (unlistenStatus) unlistenStatus();
      if (unlistenBreakpoint) unlistenBreakpoint();
    };
  }, []);

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if in input/textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case 'F5':
          event.preventDefault();
          if (isRunning) {
            handlePause();
          } else {
            handleRun();
          }
          break;
        case 'F6':
          event.preventDefault();
          handleStop();
          break;
        case 'F10':
          event.preventDefault();
          if (canStep) {
            handleStepNetwork();
          }
          break;
        case 'F11':
          event.preventDefault();
          if (canStep) {
            handleStepScan();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, canStep, handleRun, handlePause, handleStop, handleStepNetwork, handleStepScan]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      className={cn(
        'flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded-lg',
        compact ? 'px-2 py-1' : 'px-3 py-2',
        className
      )}
    >
      {/* Control Buttons */}
      <div className="flex items-center gap-1">
        {/* Run/Pause Button */}
        {isRunning ? (
          <ControlButton
            onClick={handlePause}
            disabled={isLoading}
            variant="warning"
            title="Pause Simulation"
            shortcut="F5"
          >
            <Pause size={16} />
            {!compact && <span className="text-sm">Pause</span>}
          </ControlButton>
        ) : (
          <ControlButton
            onClick={handleRun}
            disabled={isLoading}
            variant="success"
            title="Run Simulation"
            shortcut="F5"
          >
            <Play size={16} />
            {!compact && <span className="text-sm">Run</span>}
          </ControlButton>
        )}

        {/* Stop Button */}
        <ControlButton
          onClick={handleStop}
          disabled={isLoading || isStopped}
          variant="danger"
          title="Stop Simulation"
          shortcut="F6"
        >
          <Square size={16} />
          {!compact && <span className="text-sm">Stop</span>}
        </ControlButton>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-neutral-600" />

      {/* Step Buttons */}
      <div className="flex items-center gap-1">
        <ControlButton
          onClick={handleStepNetwork}
          disabled={isLoading || !canStep}
          title="Step Network"
          shortcut="F10"
        >
          <StepForward size={16} />
          {!compact && <span className="text-sm">Step Net</span>}
        </ControlButton>

        <ControlButton
          onClick={handleStepScan}
          disabled={isLoading || !canStep}
          title="Step Scan"
          shortcut="F11"
        >
          <SkipForward size={16} />
          {!compact && <span className="text-sm">Step Scan</span>}
        </ControlButton>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-neutral-600" />

      {/* Reset Button */}
      <ControlButton onClick={handleReset} disabled={isLoading} title="Reset Simulation">
        <RotateCcw size={16} />
        {!compact && <span className="text-sm">Reset</span>}
      </ControlButton>

      {/* Divider */}
      <div className="w-px h-6 bg-neutral-600" />

      {/* Status Indicator */}
      <StatusIndicator status={status} compact={compact} />

      {/* Watchdog Warning */}
      {stats.watchdogTriggered && (
        <div
          className="flex items-center gap-1 text-red-400"
          title="Watchdog timeout - scan time exceeded"
        >
          <AlertTriangle size={14} />
          {!compact && <span className="text-xs">Watchdog</span>}
        </div>
      )}

      {/* Divider */}
      <div className="w-px h-6 bg-neutral-600" />

      {/* Timing Display */}
      <TimingDisplay timing={stats.timing} scanCount={stats.scanCount} compact={compact} />

      {/* Current Network (if available) */}
      {stats.currentNetworkId !== null && !compact && (
        <>
          <div className="w-px h-6 bg-neutral-600" />
          <div className="text-xs text-neutral-400">
            Network: <span className="text-blue-400">{stats.currentNetworkId}</span>
          </div>
        </>
      )}

      {/* Breakpoint Hit Info */}
      {breakpointHit && !compact && (
        <>
          <div className="w-px h-6 bg-neutral-600" />
          <BreakpointHitDisplay hit={breakpointHit} />
        </>
      )}
    </div>
  );
});

export default DebuggerPanel;
