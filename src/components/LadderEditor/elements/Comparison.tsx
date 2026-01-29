/**
 * Comparison Component
 *
 * Renders ladder diagram comparison blocks (EQ, GT, LT, GE, LE, NE) using SVG.
 * Displays two operands and comparison result in monitoring mode.
 */

import { cn } from '../../../lib/utils';
import { ELEMENT_DIMENSIONS } from './styles';

export type ComparisonType = 'eq' | 'gt' | 'lt' | 'ge' | 'le' | 'ne';

export interface ComparisonOperand {
  /** Operand type */
  type: 'device' | 'constant';
  /** Value (device address string or numeric constant) */
  value: string | number;
}

export interface ComparisonProps {
  /** Comparison type */
  type: ComparisonType;
  /** First operand */
  operand1: ComparisonOperand;
  /** Second operand */
  operand2: ComparisonOperand;
  /** Comparison result (monitoring mode) */
  result?: boolean;
  /** Called when comparison block is double-clicked */
  onDoubleClick?: () => void;
  /** Optional class name */
  className?: string;
}

/** Comparison block dimensions (2 columns x 2 rows) */
const COMPARISON_WIDTH = ELEMENT_DIMENSIONS.width * 2; // 120px
const COMPARISON_HEIGHT = ELEMENT_DIMENSIONS.height * 2; // 80px

/** Comparison type symbols */
const COMPARISON_SYMBOLS: Record<ComparisonType, string> = {
  eq: '=',
  gt: '>',
  lt: '<',
  ge: '>=',
  le: '<=',
  ne: '<>',
};

/** Comparison type labels */
const COMPARISON_LABELS: Record<ComparisonType, string> = {
  eq: 'EQ',
  gt: 'GT',
  lt: 'LT',
  ge: 'GE',
  le: 'LE',
  ne: 'NE',
};

/** Comparison type full names */
const COMPARISON_NAMES: Record<ComparisonType, string> = {
  eq: 'Equal',
  gt: 'Greater Than',
  lt: 'Less Than',
  ge: 'Greater Than or Equal',
  le: 'Less Than or Equal',
  ne: 'Not Equal',
};

/**
 * Format operand for display
 */
function formatOperand(operand: ComparisonOperand): string {
  if (operand.type === 'device') {
    return String(operand.value);
  }
  return String(operand.value);
}

/**
 * Comparison - Ladder diagram comparison block element
 *
 * Visual representation:
 * ┌─────────┐
 * │   CMP   │
 * │   EQ    │
 * │ D0 = 10 │
 * └─────────┘
 */
export function Comparison({
  type,
  operand1,
  operand2,
  result,
  onDoubleClick,
  className,
}: ComparisonProps) {
  const isTrue = result === true;

  // SVG viewBox dimensions
  const viewBoxWidth = 120;
  const viewBoxHeight = 80;

  // Connection line positions
  const lineY = viewBoxHeight / 2;
  const pinSize = 4;

  // Get background color based on state
  const getBackgroundClass = () => {
    if (isTrue) return 'bg-green-900/30';
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
      style={{ width: COMPARISON_WIDTH, height: COMPARISON_HEIGHT }}
      onDoubleClick={onDoubleClick}
      title={`${COMPARISON_NAMES[type]}: ${formatOperand(operand1)} ${COMPARISON_SYMBOLS[type]} ${formatOperand(operand2)}`}
    >
      <svg
        width={COMPARISON_WIDTH}
        height={COMPARISON_HEIGHT}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="overflow-visible"
      >
        {/* Left connection line (input) */}
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

        {/* Right connection line (output) */}
        <line
          x1={viewBoxWidth - 8}
          y1={lineY}
          x2={viewBoxWidth}
          y2={lineY}
          stroke={isTrue ? 'rgb(74, 222, 128)' : 'rgb(163, 163, 163)'}
          strokeWidth={2}
        />
        <circle
          cx={viewBoxWidth - 8}
          cy={lineY}
          r={pinSize}
          fill={isTrue ? 'rgba(34, 197, 94, 0.3)' : 'rgb(82, 82, 91)'}
          stroke={isTrue ? 'rgb(74, 222, 128)' : 'rgb(163, 163, 163)'}
          strokeWidth={1}
        />

        {/* CMP label */}
        <text
          x={viewBoxWidth / 2}
          y={14}
          textAnchor="middle"
          fontSize={10}
          fill="rgb(115, 115, 115)"
          fontFamily="sans-serif"
        >
          CMP
        </text>

        {/* Comparison type label */}
        <text
          x={viewBoxWidth / 2}
          y={28}
          textAnchor="middle"
          fontSize={12}
          fontWeight="bold"
          fill={isTrue ? 'rgb(74, 222, 128)' : 'rgb(229, 229, 229)'}
          fontFamily="sans-serif"
        >
          {COMPARISON_LABELS[type]}
        </text>

        {/* Comparison expression */}
        <text
          x={viewBoxWidth / 2}
          y={48}
          textAnchor="middle"
          fontSize={10}
          fill="rgb(163, 163, 163)"
          fontFamily="monospace"
        >
          {formatOperand(operand1)}
        </text>

        {/* Comparison symbol */}
        <text
          x={viewBoxWidth / 2}
          y={62}
          textAnchor="middle"
          fontSize={14}
          fontWeight="bold"
          fill={isTrue ? 'rgb(74, 222, 128)' : 'rgb(163, 163, 163)'}
          fontFamily="sans-serif"
        >
          {COMPARISON_SYMBOLS[type]}
        </text>

        {/* Second operand */}
        <text
          x={viewBoxWidth / 2}
          y={74}
          textAnchor="middle"
          fontSize={10}
          fill="rgb(163, 163, 163)"
          fontFamily="monospace"
        >
          {formatOperand(operand2)}
        </text>
      </svg>
    </div>
  );
}

export default Comparison;
