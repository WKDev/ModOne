/**
 * Contact Component
 *
 * Renders ladder diagram contact elements (NO, NC, P, N) using SVG.
 * Supports energized and forced state visualization for monitoring mode.
 */

import { cn } from '../../../lib/utils';
import { ELEMENT_DIMENSIONS, getElementColors } from './styles';

export type ContactType = 'no' | 'nc' | 'p' | 'n';

export interface ContactProps {
  /** Contact type */
  type: ContactType;
  /** Device address (e.g., "X0", "M100") */
  address: string;
  /** Optional label/comment */
  label?: string;
  /** Whether contact is energized (monitoring mode) */
  isEnergized?: boolean;
  /** Whether contact is forced (monitoring mode) */
  isForced?: boolean;
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Called when contact is double-clicked */
  onDoubleClick?: () => void;
  /** Optional class name */
  className?: string;
}

/**
 * Contact - Ladder diagram contact element
 *
 * Visual representations:
 * - NO (Normally Open):  ──[ ]──
 * - NC (Normally Closed): ──[/]──
 * - P (Positive Edge):   ──[↑]──
 * - N (Negative Edge):   ──[↓]──
 */
export function Contact({
  type,
  address,
  label,
  isEnergized = false,
  isForced = false,
  width = ELEMENT_DIMENSIONS.width,
  height = ELEMENT_DIMENSIONS.height,
  onDoubleClick,
  className,
}: ContactProps) {
  const colors = getElementColors(true, isEnergized, isForced);
  const { strokeWidth, labelFontSize } = ELEMENT_DIMENSIONS;

  // SVG viewBox dimensions
  const viewBoxWidth = 60;
  const viewBoxHeight = 40;

  // Contact symbol dimensions
  const symbolWidth = 20;
  const symbolHeight = 20;
  const symbolX = (viewBoxWidth - symbolWidth) / 2;
  const symbolY = (viewBoxHeight - symbolHeight) / 2 - 4; // Offset up for label space

  // Connection line positions
  const lineY = symbolY + symbolHeight / 2;

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
      title={`${getContactTypeName(type)}: ${address}${label ? ` - ${label}` : ''}`}
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
          y1={lineY}
          x2={symbolX}
          y2={lineY}
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
        />

        {/* Right connection line */}
        <line
          x1={symbolX + symbolWidth}
          y1={lineY}
          x2={viewBoxWidth}
          y2={lineY}
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
        />

        {/* Contact symbol */}
        <g>
          {/* Background fill for energized state */}
          {isEnergized && (
            <rect
              x={symbolX}
              y={symbolY}
              width={symbolWidth}
              height={symbolHeight}
              fill={colors.fill}
              rx={2}
            />
          )}

          {/* Left vertical line */}
          <line
            x1={symbolX}
            y1={symbolY}
            x2={symbolX}
            y2={symbolY + symbolHeight}
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
          />

          {/* Right vertical line */}
          <line
            x1={symbolX + symbolWidth}
            y1={symbolY}
            x2={symbolX + symbolWidth}
            y2={symbolY + symbolHeight}
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
          />

          {/* Type-specific symbol */}
          {renderContactSymbol(type, symbolX, symbolY, symbolWidth, symbolHeight, colors.stroke, strokeWidth)}
        </g>

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

/** Render type-specific symbol inside contact */
function renderContactSymbol(
  type: ContactType,
  x: number,
  y: number,
  width: number,
  height: number,
  stroke: string,
  strokeWidth: number
) {
  const centerX = x + width / 2;

  switch (type) {
    case 'no':
      // Normally Open: empty (just the brackets)
      return null;

    case 'nc':
      // Normally Closed: diagonal line
      return (
        <line
          x1={x + 3}
          y1={y + height - 3}
          x2={x + width - 3}
          y2={y + 3}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );

    case 'p':
      // Positive (Rising) Edge: up arrow
      return (
        <g>
          <line
            x1={centerX}
            y1={y + height - 4}
            x2={centerX}
            y2={y + 4}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <polyline
            points={`${centerX - 4},${y + 8} ${centerX},${y + 4} ${centerX + 4},${y + 8}`}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        </g>
      );

    case 'n':
      // Negative (Falling) Edge: down arrow
      return (
        <g>
          <line
            x1={centerX}
            y1={y + 4}
            x2={centerX}
            y2={y + height - 4}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <polyline
            points={`${centerX - 4},${y + height - 8} ${centerX},${y + height - 4} ${centerX + 4},${y + height - 8}`}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        </g>
      );

    default:
      return null;
  }
}

/** Get human-readable contact type name */
function getContactTypeName(type: ContactType): string {
  switch (type) {
    case 'no':
      return 'Normally Open Contact';
    case 'nc':
      return 'Normally Closed Contact';
    case 'p':
      return 'Positive Edge Contact';
    case 'n':
      return 'Negative Edge Contact';
    default:
      return 'Contact';
  }
}

export default Contact;
