/**
 * DebuggerPanel Component
 *
 * Control panel for PLC simulation debugging with run/stop/step controls,
 * timing display, status indicators, and breakpoint hit information.
 */

import { memo, useEffect } from 'react';
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
import { PanelErrorBoundary } from '../error/PanelErrorBoundary';
import { useSimulation } from '../../hooks/useSimulation';
import { useDebugger } from './useDebugger';
import type {
  SimStatus,
  ScanTiming,
  BreakpointHit,
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

// = =========================================================================
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
  // Hooks
  const {
    status,
    stats,
    isLoading: simLoading,
    breakpointHit: simBreakpointHit,
    start,
    stop,
    pause,
    resume,
    reset,
    stepNetwork,
    stepScan,
    continue: continueExecution,
    isRunning,
    isPaused,
    isStopped,
    canStep,
  } = useSimulation();

  const {
    isLoading: debugLoading,
    continueExecution: debugContinue,
  } = useDebugger();

  const isLoading = simLoading || debugLoading;
  const breakpointHit = simBreakpointHit;

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleRun = () => start();
  const handleStop = () => stop();
  const handlePause = () => pause();
  const handleResume = () => resume();
  const handleReset = () => reset();
  const handleStepNetwork = () => stepNetwork();
  const handleStepScan = () => stepScan();
  const handleContinue = () => {
    // Both hooks have continue, use simulation one as primary for logic consistency
    continueExecution();
    debugContinue();
  };

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
          } else if (isPaused) {
            handleResume();
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
  }, [isRunning, isPaused, canStep, start, stop, pause, resume, stepNetwork, stepScan, continueExecution, debugContinue]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <PanelErrorBoundary panelName="Debugger">
      <div
        className={cn(
          'flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded-lg',
          compact ? 'px-2 py-1' : 'px-3 py-2',
          className
        )}
      >
        {/* Control Buttons */}
        <div className="flex items-center gap-1">
          {/* Run/Pause/Resume Button */}
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
          ) : isPaused ? (
            <ControlButton
              onClick={handleResume}
              disabled={isLoading}
              variant="success"
              title="Resume Simulation"
              shortcut="F5"
            >
              <Play size={16} />
              {!compact && <span className="text-sm">Resume</span>}
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
            <div className="flex items-center gap-2">
              <BreakpointHitDisplay hit={breakpointHit} />
              <button
                onClick={handleContinue}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Continue
              </button>
            </div>
          </>
        )}
      </div>
    </PanelErrorBoundary>
  );
});

export default DebuggerPanel;
