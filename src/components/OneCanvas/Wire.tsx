/**
 * Wire Component
 *
 * Renders wire connections between ports with visual feedback.
 * Supports handles (control points) for custom wire routing.
 */

import { memo, useCallback } from 'react';
import type { Position, HandleConstraint, PortPosition } from './types';
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
  /** Double-click handler for adding handle */
  onAddHandle?: (wireId: string, position: Position) => void;
  /** Right-click context menu handler */
  onContextMenu?: (wireId: string, position: Position, screenPos: { x: number; y: number }) => void;
  /** Double-click handler for creating junction (deprecated - use context menu) */
  onCreateJunction?: (wireId: string, position: Position) => void;
  /** Handle positions (control points) */
  handles?: Position[];
  /** Constraints for each handle */
  handleConstraints?: HandleConstraint[];
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
  onAddHandle,
  onContextMenu,
  onCreateJunction,
  handles,
  handleConstraints,
  onHandleDragStart,
  onHandleContextMenu,
  fromExitDirection,
  toExitDirection,
  defaultFromDirection,
  defaultToDirection,
}: WireProps) {
  // Calculate path based on mode and handles
  const pathD = (() => {
    // If we have handles, use path with handles
    if (handles && handles.length > 0) {
      return calculatePathWithHandles(
        from,
        to,
        handles,
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

  // Handle double-click for adding handle or creating junction (legacy)
  const handleDoubleClick = (e: React.MouseEvent<SVGPathElement>) => {
    e.stopPropagation();

    const position = getClickPosition(e);
    if (!position) return;

    // Prefer adding handle if handler is provided
    if (onAddHandle) {
      onAddHandle(id, position);
    } else if (onCreateJunction) {
      // Legacy: create junction on double-click
      onCreateJunction(id, position);
    }
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
        onDoubleClick={handleDoubleClick}
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

      {/* Render handles when wire is selected */}
      {isSelected && handles && handles.length > 0 && onHandleDragStart && (
        <>
          {handles.map((handle, index) => (
            <WireHandle
              key={`${id}-handle-${index}`}
              position={handle}
              wireId={id}
              handleIndex={index}
              constraint={handleConstraints?.[index] || 'horizontal'}
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
