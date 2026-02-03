/**
 * WireHandle Component
 *
 * Renders a draggable control point (handle) on a wire.
 * Handles can be constrained to move only horizontally or vertically.
 */

import { memo } from 'react';
import type { Position, HandleConstraint } from '../types';

// ============================================================================
// Types
// ============================================================================

interface WireHandleProps {
  /** Handle position in canvas coordinates */
  position: Position;
  /** Wire ID this handle belongs to */
  wireId: string;
  /** Index of this handle in the wire's points array */
  handleIndex: number;
  /** Movement constraint direction */
  constraint: HandleConstraint;
  /** Called when user starts dragging the handle */
  onDragStart: (
    wireId: string,
    handleIndex: number,
    constraint: HandleConstraint,
    e: React.MouseEvent
  ) => void;
  /** Called when handle is right-clicked (for removal) */
  onContextMenu?: (
    wireId: string,
    handleIndex: number,
    e: React.MouseEvent
  ) => void;
}

// ============================================================================
// Constants
// ============================================================================

const HANDLE_RADIUS = 5;
const HIT_AREA_RADIUS = 10;
const INDICATOR_LENGTH = 8;

// ============================================================================
// Component
// ============================================================================

/**
 * WireHandle - Draggable control point on a wire.
 *
 * Features:
 * - Visible handle circle with constraint indicator
 * - Larger invisible hit area for easier interaction
 * - Shows direction constraint (horizontal/vertical line through handle)
 */
export const WireHandle = memo(function WireHandle({
  position,
  wireId,
  handleIndex,
  constraint,
  onDragStart,
  onContextMenu,
}: WireHandleProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDragStart(wireId, handleIndex, constraint, e);
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onContextMenu?.(wireId, handleIndex, e);
  };

  return (
    <g className="wire-handle" style={{ pointerEvents: 'auto' }}>
      {/* Larger invisible hit area */}
      <circle
        cx={position.x}
        cy={position.y}
        r={HIT_AREA_RADIUS}
        fill="transparent"
        className="cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onContextMenu={handleRightClick}
      />

      {/* Constraint indicator line */}
      {constraint === 'horizontal' ? (
        <line
          x1={position.x - INDICATOR_LENGTH}
          y1={position.y}
          x2={position.x + INDICATOR_LENGTH}
          y2={position.y}
          stroke="#1d4ed8"
          strokeWidth={1.5}
          opacity={0.6}
          className="pointer-events-none"
        />
      ) : (
        <line
          x1={position.x}
          y1={position.y - INDICATOR_LENGTH}
          x2={position.x}
          y2={position.y + INDICATOR_LENGTH}
          stroke="#1d4ed8"
          strokeWidth={1.5}
          opacity={0.6}
          className="pointer-events-none"
        />
      )}

      {/* Visible handle circle */}
      <circle
        cx={position.x}
        cy={position.y}
        r={HANDLE_RADIUS}
        fill="#3b82f6"
        stroke="#1d4ed8"
        strokeWidth={1.5}
        className="pointer-events-none"
      />
    </g>
  );
});

export default WireHandle;
