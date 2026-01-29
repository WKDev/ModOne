/**
 * Timer Component
 *
 * Renders ladder diagram timer blocks (TON, TOF, TMR) using SVG.
 * Displays preset/elapsed time values and progress visualization in monitoring mode.
 */

import { cn } from '../../../lib/utils';
import { ELEMENT_DIMENSIONS } from './styles';

export type TimerType = 'ton' | 'tof' | 'tmr';

export interface TimerProps {
  /** Timer type */
  type: TimerType;
  /** Device address (e.g., "T0", "T100") */
  address: string;
  /** Preset time in milliseconds */
  presetTime: number;
  /** Elapsed time in milliseconds (monitoring mode) */
  elapsedTime?: number;
  /** Whether timer is running (monitoring mode) */
  isRunning?: boolean;
  /** Whether timer is done/complete (monitoring mode) */
  isDone?: boolean;
  /** Called when timer block is double-clicked */
  onDoubleClick?: () => void;
  /** Optional class name */
  className?: string;
}

/** Timer block dimensions (2 columns x 2 rows) */
const TIMER_WIDTH = ELEMENT_DIMENSIONS.width * 2; // 120px
const TIMER_HEIGHT = ELEMENT_DIMENSIONS.height * 2; // 80px

/** Timer type labels */
const TIMER_LABELS: Record<TimerType, string> = {
  ton: 'TON',
  tof: 'TOF',
  tmr: 'TMR',
};

/** Timer type full names */
const TIMER_NAMES: Record<TimerType, string> = {
  ton: 'On-Delay Timer',
  tof: 'Off-Delay Timer',
  tmr: 'Retentive Timer',
};

/**
 * Format time value for display
 */
function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

/**
 * Timer - Ladder diagram timer block element
 *
 * Visual representation:
 * ┌─────────┐
 * │  TON    │
 * │ T0      │
 * │ PT: 1000│
 * │ ET: 500 │ (monitoring only)
 * │ [====  ]│ (progress bar, monitoring)
 * └─────────┘
 */
export function Timer({
  type,
  address,
  presetTime,
  elapsedTime,
  isRunning = false,
  isDone = false,
  onDoubleClick,
  className,
}: TimerProps) {
  // Calculate progress percentage
  const progress = elapsedTime !== undefined && presetTime > 0
    ? Math.min((elapsedTime / presetTime) * 100, 100)
    : 0;

  // SVG viewBox dimensions
  const viewBoxWidth = 120;
  const viewBoxHeight = 80;

  // Connection line positions
  const lineY = viewBoxHeight / 2;
  const pinSize = 4;

  // Get background color based on state
  const getBackgroundClass = () => {
    if (isDone) return 'bg-green-900/30';
    if (isRunning) return 'bg-yellow-900/30 animate-pulse';
    return 'bg-neutral-800';
  };

  return (
    <div
      className={cn(
        'relative flex items-center justify-center',
        'cursor-pointer select-none',
        'border border-neutral-600 rounded',
        getBackgroundClass(),
        className
      )}
      style={{ width: TIMER_WIDTH, height: TIMER_HEIGHT }}
      onDoubleClick={onDoubleClick}
      title={`${TIMER_NAMES[type]}: ${address}`}
    >
      <svg
        width={TIMER_WIDTH}
        height={TIMER_HEIGHT}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="overflow-visible"
      >
        {/* Left connection line (EN input) */}
        <line
          x1={0}
          y1={lineY - 12}
          x2={8}
          y2={lineY - 12}
          stroke="rgb(163, 163, 163)"
          strokeWidth={2}
        />
        <circle
          cx={8}
          cy={lineY - 12}
          r={pinSize}
          fill="rgb(82, 82, 91)"
          stroke="rgb(163, 163, 163)"
          strokeWidth={1}
        />
        <text
          x={14}
          y={lineY - 9}
          fontSize={8}
          fill="rgb(163, 163, 163)"
          fontFamily="monospace"
        >
          EN
        </text>

        {/* Left connection line (RESET input) */}
        <line
          x1={0}
          y1={lineY + 12}
          x2={8}
          y2={lineY + 12}
          stroke="rgb(163, 163, 163)"
          strokeWidth={2}
        />
        <circle
          cx={8}
          cy={lineY + 12}
          r={pinSize}
          fill="rgb(82, 82, 91)"
          stroke="rgb(163, 163, 163)"
          strokeWidth={1}
        />
        <text
          x={14}
          y={lineY + 15}
          fontSize={8}
          fill="rgb(163, 163, 163)"
          fontFamily="monospace"
        >
          R
        </text>

        {/* Right connection line (Q output) */}
        <line
          x1={viewBoxWidth - 8}
          y1={lineY}
          x2={viewBoxWidth}
          y2={lineY}
          stroke={isDone ? 'rgb(74, 222, 128)' : 'rgb(163, 163, 163)'}
          strokeWidth={2}
        />
        <circle
          cx={viewBoxWidth - 8}
          cy={lineY}
          r={pinSize}
          fill={isDone ? 'rgba(34, 197, 94, 0.3)' : 'rgb(82, 82, 91)'}
          stroke={isDone ? 'rgb(74, 222, 128)' : 'rgb(163, 163, 163)'}
          strokeWidth={1}
        />
        <text
          x={viewBoxWidth - 22}
          y={lineY + 3}
          fontSize={8}
          fill={isDone ? 'rgb(74, 222, 128)' : 'rgb(163, 163, 163)'}
          fontFamily="monospace"
        >
          Q
        </text>

        {/* Timer type label */}
        <text
          x={viewBoxWidth / 2}
          y={14}
          textAnchor="middle"
          fontSize={12}
          fontWeight="bold"
          fill={isDone ? 'rgb(74, 222, 128)' : isRunning ? 'rgb(250, 204, 21)' : 'rgb(229, 229, 229)'}
          fontFamily="sans-serif"
        >
          {TIMER_LABELS[type]}
        </text>

        {/* Address */}
        <text
          x={viewBoxWidth / 2}
          y={28}
          textAnchor="middle"
          fontSize={10}
          fill="rgb(163, 163, 163)"
          fontFamily="monospace"
        >
          {address}
        </text>

        {/* Preset Time (PT) */}
        <text
          x={viewBoxWidth / 2}
          y={42}
          textAnchor="middle"
          fontSize={9}
          fill="rgb(115, 115, 115)"
          fontFamily="monospace"
        >
          PT: {formatTime(presetTime)}
        </text>

        {/* Elapsed Time (ET) - monitoring only */}
        {elapsedTime !== undefined && (
          <text
            x={viewBoxWidth / 2}
            y={54}
            textAnchor="middle"
            fontSize={9}
            fill={isRunning ? 'rgb(250, 204, 21)' : isDone ? 'rgb(74, 222, 128)' : 'rgb(115, 115, 115)'}
            fontFamily="monospace"
          >
            ET: {formatTime(elapsedTime)}
          </text>
        )}

        {/* Progress bar background */}
        {elapsedTime !== undefined && (
          <>
            <rect
              x={20}
              y={62}
              width={viewBoxWidth - 40}
              height={8}
              rx={2}
              fill="rgb(38, 38, 38)"
              stroke="rgb(64, 64, 64)"
              strokeWidth={1}
            />
            {/* Progress bar fill */}
            <rect
              x={21}
              y={63}
              width={Math.max(0, ((viewBoxWidth - 42) * progress) / 100)}
              height={6}
              rx={1}
              fill={isDone ? 'rgb(34, 197, 94)' : isRunning ? 'rgb(234, 179, 8)' : 'rgb(82, 82, 91)'}
            />
          </>
        )}
      </svg>
    </div>
  );
}

export default Timer;
