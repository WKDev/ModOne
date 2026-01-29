/**
 * ScanCycleMonitor Component
 *
 * Real-time visualization of scan cycle times with a bar chart and statistics.
 */

import { memo, useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { useSimulation } from '../../hooks/useSimulation';

// ============================================================================
// Types
// ============================================================================

export interface ScanCycleMonitorProps {
  /** Optional class name */
  className?: string;
  /** Maximum number of history entries to display */
  maxHistory?: number;
  /** Warning threshold in milliseconds */
  warningThresholdMs?: number;
  /** Critical threshold in milliseconds */
  criticalThresholdMs?: number;
  /** Whether to show statistics below the chart */
  showStats?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_HISTORY = 100;
const DEFAULT_WARNING_THRESHOLD = 10; // ms
const DEFAULT_CRITICAL_THRESHOLD = 20; // ms

// ============================================================================
// Helper Functions
// ============================================================================

function getBarColor(time: number, warning: number, critical: number): string {
  if (time >= critical) {
    return 'bg-red-500';
  }
  if (time >= warning) {
    return 'bg-yellow-500';
  }
  return 'bg-green-500';
}

function formatMs(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}μs`;
  }
  return `${ms.toFixed(2)}ms`;
}

// ============================================================================
// Main Component
// ============================================================================

export const ScanCycleMonitor = memo(function ScanCycleMonitor({
  className,
  maxHistory = DEFAULT_MAX_HISTORY,
  warningThresholdMs = DEFAULT_WARNING_THRESHOLD,
  criticalThresholdMs = DEFAULT_CRITICAL_THRESHOLD,
  showStats = true,
}: ScanCycleMonitorProps) {
  const { stats, isRunning } = useSimulation();
  const [history, setHistory] = useState<number[]>([]);

  // Update history when current scan time changes
  useEffect(() => {
    if (stats.timing.current > 0 && isRunning) {
      setHistory((prev) => {
        const newHistory = [...prev.slice(-(maxHistory - 1)), stats.timing.current];
        return newHistory;
      });
    }
  }, [stats.timing.current, isRunning, maxHistory]);

  // Clear history when simulation stops
  useEffect(() => {
    if (!isRunning && history.length > 0) {
      // Keep history when paused, but clear when stopped
      if (stats.scanCount === 0) {
        setHistory([]);
      }
    }
  }, [isRunning, stats.scanCount, history.length]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (history.length === 0) {
      return { min: 0, max: 0, avg: 0, last10Avg: 0 };
    }

    const min = Math.min(...history);
    const max = Math.max(...history);
    const avg = history.reduce((a, b) => a + b, 0) / history.length;
    const last10 = history.slice(-10);
    const last10Avg = last10.reduce((a, b) => a + b, 0) / last10.length;

    return { min, max, avg, last10Avg };
  }, [history]);

  // Calculate max height for scaling
  const maxTime = useMemo(() => {
    if (history.length === 0) return criticalThresholdMs;
    return Math.max(Math.max(...history), criticalThresholdMs);
  }, [history, criticalThresholdMs]);

  return (
    <div
      className={cn(
        'bg-neutral-800 border border-neutral-700 rounded-lg p-4',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-neutral-200">Scan Cycle Monitor</h3>
        {isRunning && (
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs text-green-400">Live</span>
          </span>
        )}
      </div>

      {/* Bar Chart */}
      <div className="relative h-16 bg-neutral-900 rounded overflow-hidden">
        {/* Threshold lines */}
        <div
          className="absolute left-0 right-0 border-t border-yellow-500/30"
          style={{ bottom: `${(warningThresholdMs / maxTime) * 100}%` }}
        />
        <div
          className="absolute left-0 right-0 border-t border-red-500/30"
          style={{ bottom: `${(criticalThresholdMs / maxTime) * 100}%` }}
        />

        {/* Bars */}
        <div className="absolute inset-0 flex items-end gap-px p-1">
          {history.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-neutral-500">
              No data
            </div>
          ) : (
            history.map((time, index) => (
              <div
                key={index}
                className={cn(
                  'flex-1 min-w-[2px] max-w-[4px] rounded-t transition-all duration-75',
                  getBarColor(time, warningThresholdMs, criticalThresholdMs)
                )}
                style={{
                  height: `${Math.min(100, (time / maxTime) * 100)}%`,
                }}
                title={`${formatMs(time)}`}
              />
            ))
          )}
        </div>
      </div>

      {/* Statistics */}
      {showStats && history.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
          <div className="flex flex-col items-center">
            <span className="text-neutral-500">Min</span>
            <span className="font-mono text-neutral-300">
              {formatMs(statistics.min)}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-neutral-500">Max</span>
            <span
              className={cn(
                'font-mono',
                statistics.max >= criticalThresholdMs
                  ? 'text-red-400'
                  : statistics.max >= warningThresholdMs
                  ? 'text-yellow-400'
                  : 'text-neutral-300'
              )}
            >
              {formatMs(statistics.max)}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-neutral-500">Avg</span>
            <span className="font-mono text-neutral-300">
              {formatMs(statistics.avg)}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-neutral-500">Last 10</span>
            <span className="font-mono text-neutral-300">
              {formatMs(statistics.last10Avg)}
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-neutral-500">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>&lt;{warningThresholdMs}ms</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>{warningThresholdMs}-{criticalThresholdMs}ms</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>&gt;{criticalThresholdMs}ms</span>
        </div>
      </div>
    </div>
  );
});

export default ScanCycleMonitor;
