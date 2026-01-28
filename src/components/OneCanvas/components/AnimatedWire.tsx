/**
 * Animated Wire Component
 *
 * Wire component that shows current flow animation with direction indicator
 * for powered wires in the circuit simulation.
 */

import { memo, useMemo } from 'react';
import type { Wire as WireType, Position } from '../types';
import { calculateWirePath } from '../utils/wirePathCalculator';

/**
 * Calculate orthogonal wire path as array of points.
 */
function calculateOrthogonalPoints(start: Position, end: Position): Position[] {
  const midX = (start.x + end.x) / 2;

  // Create an orthogonal path with 4 points
  return [
    start,
    { x: midX, y: start.y },
    { x: midX, y: end.y },
    end,
  ];
}

// ============================================================================
// Types
// ============================================================================

interface AnimatedWireProps {
  /** Wire data */
  wire: WireType;
  /** Start position */
  startPos: Position;
  /** End position */
  endPos: Position;
  /** Whether the wire is powered (has current flowing) */
  isPowered?: boolean;
  /** Current flow direction (forward = from -> to, reverse = to -> from) */
  currentDirection?: 'forward' | 'reverse' | null;
  /** Voltage level for coloring */
  voltage?: number;
  /** Whether the wire is selected */
  isSelected?: boolean;
  /** Whether this wire is part of a short circuit */
  isShortCircuit?: boolean;
  /** Click handler */
  onClick?: (wireId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

// Animation timing
const ANIMATION_DURATION = '0.5s';
const SHORT_CIRCUIT_PULSE_DURATION = '0.3s';

// Wire styles
const WIRE_STROKE_WIDTH = 2;
const WIRE_STROKE_WIDTH_SELECTED = 3;
const WIRE_HIT_AREA_WIDTH = 10;

// Colors by voltage level
const VOLTAGE_COLORS: Record<number, string> = {
  24: '#3b82f6', // Blue for 24V
  12: '#22c55e', // Green for 12V
  0: '#6b7280',  // Gray for unpowered
};

const DEFAULT_UNPOWERED_COLOR = '#6b7280';
const SELECTED_COLOR = '#f59e0b';
const SHORT_CIRCUIT_COLOR = '#ef4444';

// Dash pattern for animation
const DASH_ARRAY = '8 4';
const DASH_OFFSET_FORWARD = -12;
const DASH_OFFSET_REVERSE = 12;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get wire color based on voltage level.
 */
function getVoltageColor(voltage: number, isPowered: boolean): string {
  if (!isPowered) {
    return DEFAULT_UNPOWERED_COLOR;
  }
  return VOLTAGE_COLORS[voltage] ?? VOLTAGE_COLORS[24];
}

/**
 * Generate SVG path string from positions.
 */
function generatePathString(points: Position[]): string {
  if (points.length < 2) return '';

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  return path;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Animated wire component with current flow visualization.
 */
export const AnimatedWire = memo(function AnimatedWire({
  wire,
  startPos,
  endPos,
  isPowered = false,
  currentDirection = null,
  voltage = 0,
  isSelected = false,
  isShortCircuit = false,
  onClick,
}: AnimatedWireProps) {
  // Calculate wire path as points for arrow positioning
  const pathPoints = useMemo(() => {
    // Use provided points or calculate orthogonal path
    if (wire.points && wire.points.length > 0) {
      return wire.points;
    }
    return calculateOrthogonalPoints(startPos, endPos);
  }, [wire.points, startPos, endPos]);

  // Generate SVG path string
  const pathString = useMemo(() => {
    // If we have points, convert to path string
    if (pathPoints.length > 0) {
      return generatePathString(pathPoints);
    }
    // Fallback to bezier path
    return calculateWirePath(startPos, endPos);
  }, [pathPoints, startPos, endPos]);

  // Determine stroke color
  const strokeColor = useMemo(() => {
    if (isSelected) return SELECTED_COLOR;
    if (isShortCircuit) return SHORT_CIRCUIT_COLOR;
    return getVoltageColor(voltage, isPowered);
  }, [isSelected, isShortCircuit, voltage, isPowered]);

  // Determine animation class/style
  const animationStyle = useMemo(() => {
    if (!isPowered || currentDirection === null) {
      return undefined;
    }

    const offset = currentDirection === 'forward' ? DASH_OFFSET_FORWARD : DASH_OFFSET_REVERSE;

    return {
      strokeDasharray: DASH_ARRAY,
      animation: `wire-flow ${ANIMATION_DURATION} linear infinite`,
      // Use CSS custom property for direction
      '--dash-offset': `${offset}px`,
    } as React.CSSProperties;
  }, [isPowered, currentDirection]);

  // Short circuit pulsing style
  const shortCircuitStyle = useMemo(() => {
    if (!isShortCircuit) return undefined;

    return {
      animation: `wire-pulse ${SHORT_CIRCUIT_PULSE_DURATION} ease-in-out infinite`,
    } as React.CSSProperties;
  }, [isShortCircuit]);

  // Handle click
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(wire.id);
  };

  return (
    <g className="animated-wire" data-wire-id={wire.id}>
      {/* Hit area for easier selection */}
      <path
        d={pathString}
        stroke="transparent"
        strokeWidth={WIRE_HIT_AREA_WIDTH}
        fill="none"
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      />

      {/* Main wire path */}
      <path
        d={pathString}
        stroke={strokeColor}
        strokeWidth={isSelected ? WIRE_STROKE_WIDTH_SELECTED : WIRE_STROKE_WIDTH}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          ...animationStyle,
          ...shortCircuitStyle,
          transition: 'stroke 0.2s ease',
        }}
        onClick={handleClick}
      />

      {/* Direction indicator arrow for powered wires */}
      {isPowered && currentDirection && (
        <DirectionArrow
          pathPoints={pathPoints}
          direction={currentDirection}
          color={strokeColor}
        />
      )}
    </g>
  );
});

// ============================================================================
// Direction Arrow Sub-component
// ============================================================================

interface DirectionArrowProps {
  pathPoints: Position[];
  direction: 'forward' | 'reverse';
  color: string;
}

/**
 * Small arrow indicating current flow direction.
 */
const DirectionArrow = memo(function DirectionArrow({
  pathPoints,
  direction,
  color,
}: DirectionArrowProps) {
  // Calculate arrow position (middle of wire)
  const arrowData = useMemo(() => {
    if (pathPoints.length < 2) return null;

    // Find the middle segment
    const midIndex = Math.floor(pathPoints.length / 2);
    const p1 = pathPoints[Math.max(0, midIndex - 1)];
    const p2 = pathPoints[Math.min(pathPoints.length - 1, midIndex)];

    // Calculate midpoint
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    // Calculate angle
    let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);

    // Reverse direction if needed
    if (direction === 'reverse') {
      angle += 180;
    }

    return { x: midX, y: midY, angle };
  }, [pathPoints, direction]);

  if (!arrowData) return null;

  return (
    <polygon
      points="-4,-3 4,0 -4,3"
      fill={color}
      transform={`translate(${arrowData.x}, ${arrowData.y}) rotate(${arrowData.angle})`}
      style={{
        opacity: 0.8,
        pointerEvents: 'none',
      }}
    />
  );
});

// ============================================================================
// CSS Keyframes (to be added to global styles)
// ============================================================================

/**
 * CSS styles for wire animations.
 * Add these to your global CSS or styled-components.
 */
export const wireAnimationStyles = `
  @keyframes wire-flow {
    from {
      stroke-dashoffset: 0;
    }
    to {
      stroke-dashoffset: var(--dash-offset, -12px);
    }
  }

  @keyframes wire-pulse {
    0%, 100% {
      opacity: 1;
      stroke-width: 2;
    }
    50% {
      opacity: 0.5;
      stroke-width: 4;
    }
  }

  .animated-wire {
    transition: filter 0.2s ease;
  }

  .animated-wire:hover {
    filter: brightness(1.2);
  }
`;

export default AnimatedWire;
