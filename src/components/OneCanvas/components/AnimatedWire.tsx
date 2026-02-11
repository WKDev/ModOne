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
const SEGMENT_HIT_AREA_WIDTH = 12;

// Handle interaction
const HANDLE_RADIUS = 5;
const HANDLE_HIT_RADIUS = 10;

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
  // Build full point sequence: [startPos, ...handles, endPos]
  const allPoints = useMemo(() => {
    if (wire.handles && wire.handles.length > 0) {
      return [startPos, ...wire.handles.map((h) => h.position), endPos];
    }
    return calculateOrthogonalPoints(startPos, endPos);
  }, [wire.handles, startPos, endPos]);

  // For arrow positioning, use handle positions only (or fallback)
  const pathPoints = useMemo(() => {
    if (wire.handles && wire.handles.length > 0) {
      return [startPos, ...wire.handles.map((h) => h.position), endPos];
    }
    return calculateOrthogonalPoints(startPos, endPos);
  }, [wire.handles, startPos, endPos]);

  // Generate SVG path string from full point sequence
  const pathString = useMemo(() => {
    if (allPoints.length >= 2) {
      return generatePathString(allPoints);
    }
    return calculateWirePath(startPos, endPos);
  }, [allPoints, startPos, endPos]);

  // Build segment descriptors for hit areas between consecutive handles
  // Only segments between two handles (not endpoint-to-handle) are draggable
  const segments = useMemo(() => {
    const handles = wire.handles;
    if (!handles || handles.length < 2) return [];

    const result: Array<{
      handleA: number;
      handleB: number;
      posA: Position;
      posB: Position;
      orientation: 'horizontal' | 'vertical';
    }> = [];

    for (let i = 0; i < handles.length - 1; i++) {
      const posA = handles[i].position;
      const posB = handles[i + 1].position;
      const dx = Math.abs(posB.x - posA.x);
      const dy = Math.abs(posB.y - posA.y);
      // Classify orientation: if mostly horizontal (flat), it's horizontal
      const orientation: 'horizontal' | 'vertical' = dy <= dx ? 'horizontal' : 'vertical';
      result.push({ handleA: i, handleB: i + 1, posA, posB, orientation });
    }

    return result;
  }, [wire.handles]);

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
      {/* Hit area for easier selection (whole wire) */}
      <path
        d={pathString}
        stroke="transparent"
        strokeWidth={WIRE_HIT_AREA_WIDTH}
        fill="none"
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      />

      {/* Per-segment hit areas for segment dragging */}
      {segments.map((seg) => (
        <line
          key={`seg-${seg.handleA}-${seg.handleB}`}
          x1={seg.posA.x}
          y1={seg.posA.y}
          x2={seg.posB.x}
          y2={seg.posB.y}
          stroke="transparent"
          strokeWidth={SEGMENT_HIT_AREA_WIDTH}
          style={{ cursor: seg.orientation === 'horizontal' ? 'ns-resize' : 'ew-resize' }}
          data-wire-segment=""
          data-wire-id={wire.id}
          data-handle-a={seg.handleA}
          data-handle-b={seg.handleB}
          data-orientation={seg.orientation}
          data-pos-a-x={seg.posA.x}
          data-pos-a-y={seg.posA.y}
          data-pos-b-x={seg.posB.x}
          data-pos-b-y={seg.posB.y}
        />
      ))}

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
          pointerEvents: 'none',
        }}
        onClick={handleClick}
      />

      {/* Per-handle interactive circles (only when selected or always visible) */}
      {isSelected && wire.handles && wire.handles.map((handle, idx) => (
        <g key={`handle-${idx}`}>
          {/* Invisible hit area for handle */}
          <circle
            cx={handle.position.x}
            cy={handle.position.y}
            r={HANDLE_HIT_RADIUS}
            fill="transparent"
            style={{ cursor: 'grab' }}
            data-wire-handle=""
            data-wire-id={wire.id}
            data-handle-index={idx}
            data-constraint={handle.constraint}
            data-handle-x={handle.position.x}
            data-handle-y={handle.position.y}
          />
          {/* Visible handle dot */}
          <circle
            cx={handle.position.x}
            cy={handle.position.y}
            r={HANDLE_RADIUS}
            fill="#3b82f6"
            stroke="#1d4ed8"
            strokeWidth={1.5}
            style={{ pointerEvents: 'none' }}
          />
          {/* Constraint indicator */}
          {handle.constraint === 'horizontal' ? (
            <line
              x1={handle.position.x - 8}
              y1={handle.position.y}
              x2={handle.position.x + 8}
              y2={handle.position.y}
              stroke="#1d4ed8"
              strokeWidth={1.5}
              opacity={0.6}
              style={{ pointerEvents: 'none' }}
            />
          ) : handle.constraint === 'vertical' ? (
            <line
              x1={handle.position.x}
              y1={handle.position.y - 8}
              x2={handle.position.x}
              y2={handle.position.y + 8}
              stroke="#1d4ed8"
              strokeWidth={1.5}
              opacity={0.6}
              style={{ pointerEvents: 'none' }}
            />
          ) : null}
        </g>
      ))}

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
