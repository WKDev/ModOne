/**
 * SimStatus Component
 *
 * Displays simulation statistics including scan count and timing information.
 */

import { memo } from 'react';
import { Activity, Clock, Gauge, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSimulation } from '../../hooks/useSimulation';

// ============================================================================
// Types
// ============================================================================

export interface SimStatusProps {
  /** Optional class name */
  className?: string;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Whether to show icons */
  showIcons?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTime(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}μs`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(1)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatCount(count: number): string {
  return count.toLocaleString();
}

// ============================================================================
// Sub-components
// ============================================================================

interface StatItemProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

function StatItem({ label, value, icon, compact, className }: StatItemProps) {
  if (compact) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {icon}
        <span className="text-xs font-mono text-neutral-300">{value}</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {icon}
      <span className="text-xs text-neutral-500">{label}:</span>
      <span className="text-xs font-mono text-neutral-300">{value}</span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const SimStatus = memo(function SimStatus({
  className,
  compact = false,
  showIcons = true,
}: SimStatusProps) {
  const { stats, isRunning } = useSimulation();

  const iconSize = compact ? 12 : 14;
  const iconClass = isRunning ? 'text-green-400' : 'text-neutral-500';

  return (
    <div
      className={cn(
        'flex items-center text-neutral-400',
        compact ? 'gap-3' : 'gap-4',
        className
      )}
    >
      {/* Scan Count */}
      <StatItem
        label="Scans"
        value={formatCount(stats.scanCount)}
        icon={
          showIcons ? (
            <Activity size={iconSize} className={iconClass} />
          ) : undefined
        }
        compact={compact}
      />

      {/* Current Scan Time */}
      <StatItem
        label="Current"
        value={formatTime(stats.timing.current)}
        icon={
          showIcons ? (
            <Clock size={iconSize} className={iconClass} />
          ) : undefined
        }
        compact={compact}
      />

      {/* Average Scan Time */}
      <StatItem
        label="Avg"
        value={formatTime(stats.timing.average)}
        icon={
          showIcons ? (
            <Gauge size={iconSize} className={iconClass} />
          ) : undefined
        }
        compact={compact}
      />

      {/* Max Scan Time */}
      {!compact && (
        <StatItem
          label="Max"
          value={formatTime(stats.timing.max)}
          icon={
            showIcons ? (
              <TrendingUp size={iconSize} className={iconClass} />
            ) : undefined
          }
          compact={compact}
        />
      )}

      {/* Current Network (if available) */}
      {stats.currentNetworkId !== null && !compact && (
        <StatItem
          label="Network"
          value={String(stats.currentNetworkId)}
          compact={compact}
        />
      )}

      {/* Watchdog Warning */}
      {stats.watchdogTriggered && (
        <div className="flex items-center gap-1 text-red-400" title="Watchdog triggered">
          <span className="text-xs font-medium">WATCHDOG</span>
        </div>
      )}
    </div>
  );
});

export default SimStatus;
