/**
 * Wire Component
 *
 * Renders ladder diagram wire connections using SVG.
 * Supports horizontal, vertical, corner, junction, and cross wire types.
 * Visualizes energized state with color change and optional glow effect.
 */

import { cn } from '../../../lib/utils';
import { ELEMENT_COLORS, ELEMENT_DIMENSIONS } from './styles';

export type WireType =
  | 'horizontal'
  | 'vertical'
  | 'corner_tl'
  | 'corner_tr'
  | 'corner_bl'
  | 'corner_br'
  | 'junction_t'
  | 'junction_b'
  | 'junction_l'
  | 'junction_r'
  | 'cross';

export interface WireProps {
  /** Wire type determining the SVG path */
  type: WireType;
  /** Whether wire is energized (monitoring mode) */
  isEnergized?: boolean;
  /** Whether to show flow animation */
  showFlowAnimation?: boolean;
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Optional class name */
  className?: string;
}

/** Wire styling constants */
const WIRE_STYLES = {
  default: {
    stroke: ELEMENT_COLORS.wire.stroke,
    strokeWidth: 2,
  },
  energized: {
    stroke: ELEMENT_COLORS.wire.strokeEnergized,
    strokeWidth: 3,
  },
} as const;

/** Get SVG path for wire type */
function getWirePath(
  type: WireType,
  width: number,
  height: number
): { d: string; type: 'path' } | { lines: Array<{ x1: number; y1: number; x2: number; y2: number }> } {
  const centerY = height / 2;
  // Vertical wires render on the LEFT side of the cell (1px offset for stroke visibility)
  const leftX = 1;

  switch (type) {
    case 'horizontal':
      // ────────
      return {
        lines: [{ x1: 0, y1: centerY, x2: width, y2: centerY }],
      };

    case 'vertical':
      // │ (left-aligned)
      return {
        lines: [{ x1: leftX, y1: 0, x2: leftX, y2: height }],
      };

    case 'corner_tl':
      // ┌── (vertical from bottom to center, then horizontal to right)
      return {
        d: `M ${leftX} ${height} L ${leftX} ${centerY} L ${width} ${centerY}`,
        type: 'path',
      };

    case 'corner_tr':
      // ──┐ (horizontal from left to leftX, then vertical down)
      return {
        d: `M 0 ${centerY} L ${leftX} ${centerY} L ${leftX} ${height}`,
        type: 'path',
      };

    case 'corner_bl':
      // └── (vertical from top to center, then horizontal to right)
      return {
        d: `M ${leftX} 0 L ${leftX} ${centerY} L ${width} ${centerY}`,
        type: 'path',
      };

    case 'corner_br':
      // ──┘ (horizontal from left to leftX, then vertical up)
      return {
        d: `M 0 ${centerY} L ${leftX} ${centerY} L ${leftX} 0`,
        type: 'path',
      };

    case 'junction_t':
      // ──┬── (full horizontal + vertical down from leftX)
      return {
        lines: [
          { x1: 0, y1: centerY, x2: width, y2: centerY },
          { x1: leftX, y1: centerY, x2: leftX, y2: height },
        ],
      };

    case 'junction_b':
      // ──┴── (full horizontal + vertical up from leftX)
      return {
        lines: [
          { x1: 0, y1: centerY, x2: width, y2: centerY },
          { x1: leftX, y1: 0, x2: leftX, y2: centerY },
        ],
      };

    case 'junction_l':
      // ├── (full vertical at leftX + horizontal from leftX to right)
      return {
        lines: [
          { x1: leftX, y1: 0, x2: leftX, y2: height },
          { x1: leftX, y1: centerY, x2: width, y2: centerY },
        ],
      };

    case 'junction_r':
      // ──┤ (full vertical at leftX + horizontal from left to leftX)
      return {
        lines: [
          { x1: leftX, y1: 0, x2: leftX, y2: height },
          { x1: 0, y1: centerY, x2: leftX, y2: centerY },
        ],
      };

    case 'cross':
      // ──┼── (full horizontal + full vertical at leftX)
      return {
        lines: [
          { x1: 0, y1: centerY, x2: width, y2: centerY },
          { x1: leftX, y1: 0, x2: leftX, y2: height },
        ],
      };

    default:
      console.warn(`[Wire] Unknown wire type: "${type}", falling back to horizontal`);
      return {
        lines: [{ x1: 0, y1: height / 2, x2: width, y2: height / 2 }],
      };
  }
}

/**
 * Wire - Ladder diagram wire connection element
 *
 * Visual representations:
 * - horizontal:  ────────
 * - vertical:    │
 * - corner_tl:   ┌──
 * - corner_tr:   ──┐
 * - corner_bl:   └──
 * - corner_br:   ──┘
 * - junction_t:  ──┬──
 * - junction_b:  ──┴──
 * - junction_l:  ├──
 * - junction_r:  ──┤
 * - cross:       ──┼──
 */
export function Wire({
  type,
  isEnergized = false,
  showFlowAnimation = false,
  width = ELEMENT_DIMENSIONS.width,
  height = ELEMENT_DIMENSIONS.height,
  className,
}: WireProps) {
  const style = isEnergized ? WIRE_STYLES.energized : WIRE_STYLES.default;
  const pathData = getWirePath(type, width, height);

  // Flow animation style
  const animationStyle = showFlowAnimation && isEnergized
    ? {
        strokeDasharray: '8 4',
        animation: 'wireFlow 0.5s linear infinite',
      }
    : {};

  // Glow filter for energized state
  const filterStyle = isEnergized
    ? { filter: 'drop-shadow(0 0 2px rgb(34 197 94))' }
    : {};

  return (
    <div
      className={cn('relative', className)}
      style={{ width, height }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        style={filterStyle}
      >
        {'d' in pathData ? (
          // Render path for corners
          <path
            d={pathData.d}
            fill="none"
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={animationStyle}
          />
        ) : (
          // Render lines for straight and junction wires
          pathData.lines.map((line, index) => (
            <line
              key={index}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              strokeLinecap="round"
              style={animationStyle}
            />
          ))
        )}

        {/* Junction dot at intersection point (leftX for vertical, centerY for horizontal) */}
        {(type.startsWith('junction_') || type === 'cross') && (
          <circle
            cx={1}
            cy={height / 2}
            r={isEnergized ? 4 : 3}
            fill={style.stroke}
          />
        )}
      </svg>

      {/* CSS for flow animation (injected once via style tag) */}
      {showFlowAnimation && (
        <style>{`
          @keyframes wireFlow {
            0% { stroke-dashoffset: 12; }
            100% { stroke-dashoffset: 0; }
          }
        `}</style>
      )}
    </div>
  );
}

export default Wire;
