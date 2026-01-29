/**
 * DebugPanel Component
 *
 * Container panel integrating BreakpointList, WatchList, and step execution controls
 * for the OneSim debugger UI.
 */

import { memo } from 'react';
import {
  SkipForward,
  FastForward,
  Play,
  Pause,
  Bug,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSimulation } from '../../hooks/useSimulation';
import { useDebugger } from './useDebugger';
import { BreakpointList } from './BreakpointList';
import { WatchList } from './WatchList';

// ============================================================================
// Types
// ============================================================================

export interface DebugPanelProps {
  /** Optional class name */
  className?: string;
  /** Whether the panel is expanded */
  expanded?: boolean;
  /** Called when expand state changes */
  onExpandChange?: (expanded: boolean) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Format pause reason for display */
function formatPauseReason(hit: NonNullable<ReturnType<typeof useDebugger>['pauseReason']>): string {
  switch (hit.type) {
    case 'network':
      return `Network ${hit.networkId}`;
    case 'device':
      return `${hit.address} changed`;
    case 'condition':
      return `Condition: ${hit.condition}`;
    case 'scanCount':
      return `Scan ${hit.scanCount}`;
    default:
      return 'Breakpoint hit';
  }
}

// ============================================================================
// StepControls Component
// ============================================================================

interface StepControlsProps {
  isPaused: boolean;
  canStep: boolean;
  isLoading: boolean;
  pauseReason: ReturnType<typeof useDebugger>['pauseReason'];
  onStepNetwork: () => void;
  onStepScan: () => void;
  onContinue: () => void;
}

function StepControls({
  isPaused,
  canStep,
  isLoading,
  pauseReason,
  onStepNetwork,
  onStepScan,
  onContinue,
}: StepControlsProps) {
  return (
    <div className="flex items-center gap-2 px-2 py-2 border-b border-neutral-700">
      {/* Step Network */}
      <button
        onClick={onStepNetwork}
        disabled={!canStep || isLoading}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
          canStep
            ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200'
            : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
        )}
        title="Step Network (F10)"
      >
        <SkipForward size={14} />
        <span>Step Net</span>
      </button>

      {/* Step Scan */}
      <button
        onClick={onStepScan}
        disabled={!canStep || isLoading}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
          canStep
            ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200'
            : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
        )}
        title="Step Scan (F11)"
      >
        <FastForward size={14} />
        <span>Step Scan</span>
      </button>

      {/* Continue */}
      <button
        onClick={onContinue}
        disabled={!isPaused || isLoading}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
          isPaused
            ? 'bg-green-700 hover:bg-green-600 text-white'
            : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
        )}
        title="Continue (F5)"
      >
        <Play size={14} />
        <span>Continue</span>
      </button>

      {/* Pause Reason */}
      {isPaused && pauseReason && (
        <div className="flex items-center gap-1 ml-auto text-xs text-amber-400">
          <Pause size={12} />
          <span>{formatPauseReason(pauseReason)}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DebugPanel Component
// ============================================================================

export const DebugPanel = memo(function DebugPanel({
  className,
  expanded = true,
}: DebugPanelProps) {
  const {
    isPaused: simIsPaused,
    canStep,
    isLoading: simIsLoading,
    stepNetwork,
    stepScan,
    continue: continueExecution,
  } = useSimulation();

  const { isPaused, pauseReason, isLoading, refreshWatches } = useDebugger();

  // Combine pause states
  const combinedIsPaused = simIsPaused || isPaused;
  const combinedIsLoading = simIsLoading || isLoading;

  const handleStepNetwork = async () => {
    await stepNetwork();
    await refreshWatches();
  };

  const handleStepScan = async () => {
    await stepScan();
    await refreshWatches();
  };

  const handleContinue = async () => {
    await continueExecution();
  };

  if (!expanded) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded',
          className
        )}
      >
        <Bug size={16} className="text-neutral-400" />
        <span className="text-sm text-neutral-400">Debug Panel (collapsed)</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-neutral-800 border border-neutral-700 rounded overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900/50 border-b border-neutral-700">
        <Bug size={16} className="text-blue-400" />
        <span className="text-sm font-medium text-neutral-200">Debug</span>
        {combinedIsPaused && (
          <span className="px-1.5 py-0.5 text-xs bg-amber-600/30 text-amber-400 rounded">
            Paused
          </span>
        )}
      </div>

      {/* Step Controls */}
      <StepControls
        isPaused={combinedIsPaused}
        canStep={canStep}
        isLoading={combinedIsLoading}
        pauseReason={pauseReason}
        onStepNetwork={handleStepNetwork}
        onStepScan={handleStepScan}
        onContinue={handleContinue}
      />

      {/* Content - Breakpoints and Watches */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Breakpoints Section */}
        <div className="flex-shrink-0 border-b border-neutral-700 max-h-48 overflow-hidden flex flex-col">
          <BreakpointList className="flex-1 min-h-0" />
        </div>

        {/* Watches Section */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <WatchList className="flex-1 min-h-0" />
        </div>
      </div>
    </div>
  );
});

export default DebugPanel;
