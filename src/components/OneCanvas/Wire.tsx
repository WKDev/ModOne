/**
 * Wire Component
 *
 * Renders wire connections between ports with visual feedback.
 */

import { memo } from 'react';
import type { Position } from './types';
import { calculateWirePath } from './utils/wirePathCalculator';

// ============================================================================
// Types
// ============================================================================

/** Wire visual type */
export type WireType = 'power' | 'ground' | 'signal' | 'inactive';

interface WireProps {
  /** Unique wire ID */
  id: string;
  /** Start position */
  from: Position;
  /** End position */
  to: Position;
  /** Wire type for color coding */
  type?: WireType;
  /** Whether current is flowing (enables animation) */
  isActive?: boolean;
  /** Whether wire is selected */
  isSelected?: boolean;
  /** Whether wire is being hovered */
  isHovered?: boolean;
  /** Path mode */
  pathMode?: 'straight' | 'bezier';
  /** Click handler */
  onClick?: (id: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

// Wire colors by type
const WIRE_COLORS: Record<WireType, string> = {
  power: '#ef4444',    // red-500
  ground: '#171717',   // neutral-900
  signal: '#3b82f6',   // blue-500
  inactive: '#6b7280', // gray-500
};

const SELECTED_COLOR = '#facc15'; // yellow-400
const HOVER_COLOR = '#60a5fa';    // blue-400

// Wire widths
const WIRE_WIDTH = 2;
const WIRE_WIDTH_SELECTED = 3;

// ============================================================================
// Component
// ============================================================================

/**
 * Wire component rendering a connection between two points.
 */
export const Wire = memo(function Wire({
  id,
  from,
  to,
  type = 'inactive',
  isActive = false,
  isSelected = false,
  isHovered = false,
  pathMode = 'bezier',
  onClick,
}: WireProps) {
  // Calculate path
  const pathD = calculateWirePath(from, to, pathMode);

  // Determine colors and widths
  const baseColor = WIRE_COLORS[type];
  const strokeColor = isSelected ? SELECTED_COLOR : isHovered ? HOVER_COLOR : baseColor;
  const strokeWidth = isSelected ? WIRE_WIDTH_SELECTED : WIRE_WIDTH;

  // Handle click
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(id);
  };

  return (
    <g className="wire" data-wire-id={id}>
      {/* Invisible wider path for easier selection */}
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        className="cursor-pointer"
        onClick={handleClick}
      />

      {/* Main wire path */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`
          transition-colors duration-150
          ${isActive ? 'animate-wire-flow' : ''}
        `}
        style={
          isActive
            ? {
                strokeDasharray: '8 4',
                animation: 'wire-flow 0.5s linear infinite',
              }
            : undefined
        }
        onClick={handleClick}
      />

      {/* Glow effect for active wires */}
      {isActive && (
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.3}
          className="pointer-events-none"
        />
      )}

      {/* Selection highlight */}
      {isSelected && (
        <path
          d={pathD}
          fill="none"
          stroke={SELECTED_COLOR}
          strokeWidth={strokeWidth + 6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.2}
          className="pointer-events-none"
        />
      )}
    </g>
  );
});

// ============================================================================
// Wire Preview Component
// ============================================================================

interface WirePreviewProps {
  /** Start position */
  from: Position;
  /** Current mouse/end position */
  to: Position;
  /** Whether hovering over a valid target */
  isValidTarget?: boolean;
  /** Path mode */
  pathMode?: 'straight' | 'bezier';
}

/**
 * Wire preview shown during wire drawing.
 */
export const WirePreview = memo(function WirePreview({
  from,
  to,
  isValidTarget = false,
  pathMode = 'bezier',
}: WirePreviewProps) {
  const pathD = calculateWirePath(from, to, pathMode);

  return (
    <g className="wire-preview">
      <path
        d={pathD}
        fill="none"
        stroke={isValidTarget ? '#22c55e' : '#6b7280'} // green-500 or gray-500
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="6 3"
        opacity={0.8}
        className="pointer-events-none"
      />
    </g>
  );
});

export default Wire;
