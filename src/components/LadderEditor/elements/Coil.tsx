/**
 * Coil Component
 *
 * Renders ladder diagram coil/output elements (output, set, reset) using SVG.
 * Supports energized and forced state visualization for monitoring mode.
 */

import { cn } from '../../../lib/utils';
import { ELEMENT_DIMENSIONS, getElementColors } from './styles';

export type CoilType = 'output' | 'set' | 'reset';

export interface CoilProps {
  /** Coil type */
  type: CoilType;
  /** Device address (e.g., "Y0", "M100") */
  address: string;
  /** Optional label/comment */
  label?: string;
  /** Whether coil is energized (monitoring mode) */
  isEnergized?: boolean;
  /** Whether coil is forced (monitoring mode) */
  isForced?: boolean;
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Called when coil is double-clicked */
  onDoubleClick?: () => void;
  /** Optional class name */
  className?: string;
}

/**
 * Coil - Ladder diagram output coil element
 *
 * Visual representations:
 * - Output (Standard): ──( )──
 * - Set (Latch):       ──(S)──
 * - Reset (Unlatch):   ──(R)──
 */
export function Coil({
  type,
  address,
  label,
  isEnergized = false,
  isForced = false,
  width = ELEMENT_DIMENSIONS.width,
  height = ELEMENT_DIMENSIONS.height,
  onDoubleClick,
  className,
}: CoilProps) {
  const colors = getElementColors(false, isEnergized, isForced);
  const { strokeWidth, labelFontSize, symbolFontSize } = ELEMENT_DIMENSIONS;

  // SVG viewBox dimensions
  const viewBoxWidth = 60;
  const viewBoxHeight = 40;

  // Coil symbol dimensions
  const radius = 9;
  const centerX = viewBoxWidth / 2;
  const centerY = (viewBoxHeight - 10) / 2; // Offset up for label space

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center',
        'cursor-pointer select-none',
        isForced && 'ring-2 ring-yellow-500 rounded',
        className
      )}
      style={{ width, height }}
      onDoubleClick={onDoubleClick}
      title={`${getCoilTypeName(type)}: ${address}${label ? ` - ${label}` : ''}`}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="overflow-visible"
      >
        {/* Left connection line */}
        <line
          x1={0}
          y1={centerY}
          x2={centerX - radius}
          y2={centerY}
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
        />

        {/* Right connection line */}
        <line
          x1={centerX + radius}
          y1={centerY}
          x2={viewBoxWidth}
          y2={centerY}
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
        />

        {/* Coil circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill={isEnergized ? colors.fill : 'transparent'}
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
        />

        {/* Type-specific symbol (S or R) */}
        {type !== 'output' && (
          <text
            x={centerX}
            y={centerY + 4}
            textAnchor="middle"
            fontSize={symbolFontSize}
            fontWeight="bold"
            fill={colors.text}
            fontFamily="sans-serif"
          >
            {type === 'set' ? 'S' : 'R'}
          </text>
        )}

        {/* Address label */}
        <text
          x={viewBoxWidth / 2}
          y={viewBoxHeight - 2}
          textAnchor="middle"
          fontSize={labelFontSize}
          fill={colors.text}
          fontFamily="monospace"
        >
          {address}
        </text>
      </svg>
    </div>
  );
}

/** Get human-readable coil type name */
function getCoilTypeName(type: CoilType): string {
  switch (type) {
    case 'output':
      return 'Output Coil';
    case 'set':
      return 'Set Coil (Latch)';
    case 'reset':
      return 'Reset Coil (Unlatch)';
    default:
      return 'Coil';
  }
}

export default Coil;
