/**
 * ExecutionProgress Component
 *
 * Displays scenario execution progress with:
 * - Progress bar visualization
 * - Percentage and event count display
 * - Loop iteration indicator
 * - Color changes based on execution state
 */

import { memo, useMemo } from 'react';
import { useScenarioStore, selectEnabledEvents, selectExecutionState, selectSettings } from '../../stores/scenarioStore';

// ============================================================================
// Types
// ============================================================================

export interface ExecutionProgressProps {
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export const ExecutionProgress = memo(function ExecutionProgress({
  className = '',
}: ExecutionProgressProps) {
  // Store access
  const enabledEvents = useScenarioStore(selectEnabledEvents);
  const executionState = useScenarioStore(selectExecutionState);
  const settings = useScenarioStore(selectSettings);

  // Calculate progress values
  const { completedCount, totalCount, percentage } = useMemo(() => {
    const total = enabledEvents.length;
    const completed = executionState.completedEvents.length;
    const pct = total > 0 ? (completed / total) * 100 : 0;
    return {
      completedCount: completed,
      totalCount: total,
      percentage: pct,
    };
  }, [enabledEvents.length, executionState.completedEvents.length]);

  // Determine progress bar color based on status
  const progressBarColor = useMemo(() => {
    const { status } = executionState;
    const isComplete = percentage === 100;

    if (isComplete) {
      return 'bg-green-500';
    }

    switch (status) {
      case 'running':
        return 'bg-blue-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'stopped':
      case 'idle':
      default:
        return 'bg-neutral-500';
    }
  }, [executionState.status, percentage]);

  // Determine if running animation should show
  const isAnimated = executionState.status === 'running' && percentage < 100;

  // Loop display
  const loopDisplay = useMemo(() => {
    if (!settings?.loop) return null;

    const { currentLoopIteration } = executionState;
    const { loopCount } = settings;

    if (loopCount === 0) {
      // Infinite looping
      return `Loop ${currentLoopIteration}/∞`;
    }
    return `Loop ${currentLoopIteration}/${loopCount}`;
  }, [settings, executionState.currentLoopIteration]);

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 border-t border-neutral-700 bg-neutral-900 ${className}`}
    >
      {/* Progress label */}
      <span className="text-xs text-neutral-400 select-none">Progress:</span>

      {/* Progress bar */}
      <div className="flex-1 h-2 bg-neutral-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-200 ease-out ${progressBarColor} ${
            isAnimated ? 'animate-pulse' : ''
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Percentage and count display */}
      <span className="text-xs text-neutral-400 tabular-nums min-w-[90px] text-right select-none">
        {percentage.toFixed(0)}% ({completedCount}/{totalCount})
      </span>

      {/* Loop indicator */}
      {loopDisplay && (
        <span className="text-xs text-neutral-500 tabular-nums border-l border-neutral-700 pl-2 ml-1 select-none">
          {loopDisplay}
        </span>
      )}
    </div>
  );
});

export default ExecutionProgress;
