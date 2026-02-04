/**
 * Wire Component
 *
 * Renders wire connections between ports with visual feedback.
 * Supports handles (control points) for custom wire routing.
 */

import { memo, useCallback } from 'react';
import type { Position, HandleConstraint, PortPosition, WireHandle as WireHandleData } from './types';
import { calculateWirePath, calculatePathWithHandles, calculatePathWithExitDirections } from './utils/wirePathCalculator';
import { getClosestPointOnPath } from './utils/wireHitTest';
import { WireHandle } from './components/WireHandle';

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
  pathMode?: 'straight' | 'bezier' | 'orthogonal';
  /** Click handler */
  onClick?: (id: string) => void;
  /** Right-click context menu handler */
  onContextMenu?: (wireId: string, position: Position, screenPos: { x: number; y: number }) => void;
  /** Wire handles (control points with constraints) */
  handles?: WireHandleData[];
  /** Handler for starting handle drag */
  onHandleDragStart?: (
    wireId: string,
    handleIndex: number,
    constraint: HandleConstraint,
    e: React.MouseEvent,
    handlePosition: Position
  ) => void;
  /** Handler for handle right-click (removal) */
  onHandleContextMenu?: (wireId: string, handleIndex: number, e: React.MouseEvent) => void;
  /** Handler for starting segment drag (two adjacent handles) */
  onSegmentDragStart?: (
    wireId: string,
    handleIndexA: number,
    handleIndexB: number,
    orientation: 'horizontal' | 'vertical',
    e: React.MouseEvent,
    startPositionA: Position,
    startPositionB: Position
  ) => void;
  /** Direction wire exits from source port */
  fromExitDirection?: PortPosition;
  /** Direction wire enters target port */
  toExitDirection?: PortPosition;
  /** Default from direction based on port position */
  defaultFromDirection?: PortPosition;
  /** Default to direction based on port position */
  defaultToDirection?: PortPosition;
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
  pathMode = 'straight',
  onClick,
  onContextMenu,
  handles,
  onHandleDragStart,
  onHandleContextMenu,
  onSegmentDragStart,
  fromExitDirection,
  toExitDirection,
  defaultFromDirection,
  defaultToDirection,
}: WireProps) {
  // Extract positions from handles
  const handlePositions = handles?.map((h) => h.position);

  // Calculate path based on mode and handles
  const pathD = (() => {
    // If we have handles, use path with handles
    if (handlePositions && handlePositions.length > 0) {
      return calculatePathWithHandles(
        from,
        to,
        handlePositions,
        fromExitDirection || defaultFromDirection,
        toExitDirection || defaultToDirection
      );
    }

    // If we have exit directions, use orthogonal path with directions
    if (fromExitDirection || toExitDirection || defaultFromDirection || defaultToDirection) {
      return calculatePathWithExitDirections(
        from,
        to,
        fromExitDirection,
        toExitDirection,
        defaultFromDirection,
        defaultToDirection
      );
    }

    // Default path calculation
    return calculateWirePath(from, to, pathMode === 'orthogonal' ? 'straight' : pathMode);
  })();

  // Determine colors and widths
  const baseColor = WIRE_COLORS[type];
  const strokeColor = isSelected ? SELECTED_COLOR : isHovered ? HOVER_COLOR : baseColor;
  const strokeWidth = isSelected ? WIRE_WIDTH_SELECTED : WIRE_WIDTH;

  // Calculate click position on wire from mouse event using wireHitTest utility
  const getClickPosition = useCallback((e: React.MouseEvent<SVGPathElement>): Position | null => {
    const pathElement = e.currentTarget;
    const svgElement = pathElement.ownerSVGElement;
    if (!svgElement) return null;

    const point = svgElement.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const ctm = svgElement.getScreenCTM();
    if (!ctm) return null;
    const svgPoint = point.matrixTransform(ctm.inverse());

    const result = getClosestPointOnPath(pathElement, { x: svgPoint.x, y: svgPoint.y });
    return result.point;
  }, []);

  // Handle click
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(id);
  };

  // Handle right-click for context menu
  const handleRightClick = (e: React.MouseEvent<SVGPathElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!onContextMenu) return;

    const position = getClickPosition(e);
    if (!position) return;

    onContextMenu(id, position, { x: e.clientX, y: e.clientY });
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
        style={{ pointerEvents: 'auto' }}
        onClick={handleClick}
        onContextMenu={handleRightClick}
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

      {/* Segment drag hit areas (between adjacent handles) */}
      {isSelected && handles && handles.length >= 2 && onSegmentDragStart &&
        handles.slice(0, -1).map((handle, i) => {
          const next = handles[i + 1];
          const dx = Math.abs(handle.position.x - next.position.x);
          const dy = Math.abs(handle.position.y - next.position.y);
          // Skip diagonal segments (threshold tolerates minor floating-point drift)
          if (dx > 10 && dy > 10) return null;
          const orientation = dx <= 10 ? 'vertical' : 'horizontal';
          const cursor = orientation === 'vertical' ? 'ew-resize' : 'ns-resize';
          return (
            <line
              key={`seg-${i}`}
              x1={handle.position.x} y1={handle.position.y}
              x2={next.position.x} y2={next.position.y}
              stroke="transparent" strokeWidth={12}
              style={{ pointerEvents: 'auto', cursor }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onSegmentDragStart(id, i, i + 1, orientation, e,
                  handle.position, next.position);
              }}
            />
          );
        })
      }

      {/* Render handles when wire is selected */}
      {isSelected && handles && handles.length > 0 && onHandleDragStart && (
        <>
          {handles.map((handle, index) => (
            <WireHandle
              key={`${id}-handle-${index}`}
              position={handle.position}
              wireId={id}
              handleIndex={index}
              constraint={handle.constraint}
              onDragStart={onHandleDragStart}
              onContextMenu={onHandleContextMenu}
            />
          ))}
        </>
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
  /** Direction wire exits from source port (user drag direction) */
  fromExitDirection?: PortPosition;
  /** Default from direction based on port position */
  defaultFromDirection?: PortPosition;
}

/**
 * Wire preview shown during wire drawing.
 */
export const WirePreview = memo(function WirePreview({
  from,
  to,
  isValidTarget = false,
  pathMode = 'straight',
  fromExitDirection,
  defaultFromDirection,
}: WirePreviewProps) {
  // Use exit-direction-aware path when available, matching actual wire rendering
  const fromDir = fromExitDirection || defaultFromDirection;
  const pathD = fromDir
    ? calculatePathWithExitDirections(from, to, fromExitDirection, undefined, defaultFromDirection, undefined)
    : calculateWirePath(from, to, pathMode);

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
