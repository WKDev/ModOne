/**
 * Counter Component
 *
 * Renders ladder diagram counter blocks (CTU, CTD, CTUD) using SVG.
 * Displays preset/current values and progress visualization in monitoring mode.
 */

import { cn } from '../../../lib/utils';
import { ELEMENT_DIMENSIONS } from './styles';

export type CounterType = 'ctu' | 'ctd' | 'ctud';

export interface CounterProps {
  /** Counter type */
  type: CounterType;
  /** Device address (e.g., "C0", "C100") */
  address: string;
  /** Preset value */
  presetValue: number;
  /** Current value (monitoring mode) */
  currentValue?: number;
  /** Whether counter has reached preset (monitoring mode) */
  isDone?: boolean;
  /** Called when counter block is double-clicked */
  onDoubleClick?: () => void;
  /** Optional class name */
  className?: string;
}

/** Counter block dimensions (2 columns x 2 rows) */
const COUNTER_WIDTH = ELEMENT_DIMENSIONS.width * 2; // 120px
const COUNTER_HEIGHT = ELEMENT_DIMENSIONS.height * 2; // 80px

/** Counter type labels */
const COUNTER_LABELS: Record<CounterType, string> = {
  ctu: 'CTU',
  ctd: 'CTD',
  ctud: 'CTUD',
};

/** Counter type full names */
const COUNTER_NAMES: Record<CounterType, string> = {
  ctu: 'Count Up',
  ctd: 'Count Down',
  ctud: 'Count Up/Down',
};

/**
 * Counter - Ladder diagram counter block element
 *
 * Visual representation:
 * ┌─────────┐
 * │  CTU    │
 * │ C0      │
 * │ PV: 10  │
 * │ CV: 5   │ (monitoring only)
 * └─────────┘
 */
export function Counter({
  type,
  address,
  presetValue,
  currentValue,
  isDone = false,
  onDoubleClick,
  className,
}: CounterProps) {
  // Calculate progress percentage
  const isCounting = currentValue !== undefined && currentValue > 0 && !isDone;
  const progress = currentValue !== undefined && presetValue > 0
    ? type === 'ctd'
      ? Math.min(((presetValue - currentValue) / presetValue) * 100, 100)
      : Math.min((currentValue / presetValue) * 100, 100)
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
    if (isCounting) return 'bg-blue-900/30';
    return 'bg-neutral-800';
  };

  // Check if this is an up/down counter
  const isUpDown = type === 'ctud';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center',
        'cursor-pointer select-none',
        'border border-neutral-600 rounded',
        getBackgroundClass(),
        className
      )}
      style={{ width: COUNTER_WIDTH, height: COUNTER_HEIGHT }}
      onDoubleClick={onDoubleClick}
      title={`${COUNTER_NAMES[type]}: ${address}`}
    >
      <svg
        width={COUNTER_WIDTH}
        height={COUNTER_HEIGHT}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="overflow-visible"
      >
        {/* Left connection lines based on counter type */}
        {isUpDown ? (
          <>
            {/* CU (Count Up) input */}
            <line
              x1={0}
              y1={lineY - 16}
              x2={8}
              y2={lineY - 16}
              stroke="rgb(163, 163, 163)"
              strokeWidth={2}
            />
            <circle
              cx={8}
              cy={lineY - 16}
              r={pinSize}
              fill="rgb(82, 82, 91)"
              stroke="rgb(163, 163, 163)"
              strokeWidth={1}
            />
            <text
              x={14}
              y={lineY - 13}
              fontSize={7}
              fill="rgb(163, 163, 163)"
              fontFamily="monospace"
            >
              CU
            </text>

            {/* CD (Count Down) input */}
            <line
              x1={0}
              y1={lineY}
              x2={8}
              y2={lineY}
              stroke="rgb(163, 163, 163)"
              strokeWidth={2}
            />
            <circle
              cx={8}
              cy={lineY}
              r={pinSize}
              fill="rgb(82, 82, 91)"
              stroke="rgb(163, 163, 163)"
              strokeWidth={1}
            />
            <text
              x={14}
              y={lineY + 3}
              fontSize={7}
              fill="rgb(163, 163, 163)"
              fontFamily="monospace"
            >
              CD
            </text>

            {/* RESET input */}
            <line
              x1={0}
              y1={lineY + 16}
              x2={8}
              y2={lineY + 16}
              stroke="rgb(163, 163, 163)"
              strokeWidth={2}
            />
            <circle
              cx={8}
              cy={lineY + 16}
              r={pinSize}
              fill="rgb(82, 82, 91)"
              stroke="rgb(163, 163, 163)"
              strokeWidth={1}
            />
            <text
              x={14}
              y={lineY + 19}
              fontSize={7}
              fill="rgb(163, 163, 163)"
              fontFamily="monospace"
            >
              R
            </text>
          </>
        ) : (
          <>
            {/* CU or CD input (depending on type) */}
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
              {type === 'ctu' ? 'CU' : 'CD'}
            </text>

            {/* RESET input */}
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
          </>
        )}

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

        {/* Counter type label */}
        <text
          x={viewBoxWidth / 2}
          y={14}
          textAnchor="middle"
          fontSize={12}
          fontWeight="bold"
          fill={isDone ? 'rgb(74, 222, 128)' : isCounting ? 'rgb(96, 165, 250)' : 'rgb(229, 229, 229)'}
          fontFamily="sans-serif"
        >
          {COUNTER_LABELS[type]}
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

        {/* Preset Value (PV) */}
        <text
          x={viewBoxWidth / 2}
          y={42}
          textAnchor="middle"
          fontSize={9}
          fill="rgb(115, 115, 115)"
          fontFamily="monospace"
        >
          PV: {presetValue}
        </text>

        {/* Current Value (CV) - monitoring only */}
        {currentValue !== undefined && (
          <text
            x={viewBoxWidth / 2}
            y={54}
            textAnchor="middle"
            fontSize={9}
            fill={isDone ? 'rgb(74, 222, 128)' : isCounting ? 'rgb(96, 165, 250)' : 'rgb(115, 115, 115)'}
            fontFamily="monospace"
          >
            CV: {currentValue}
          </text>
        )}

        {/* Progress bar background */}
        {currentValue !== undefined && (
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
              fill={isDone ? 'rgb(34, 197, 94)' : isCounting ? 'rgb(59, 130, 246)' : 'rgb(82, 82, 91)'}
            />
          </>
        )}
      </svg>
    </div>
  );
}

export default Counter;
