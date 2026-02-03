/**
 * JunctionDot SVG Component
 *
 * Renders a junction as a small SVG circle in the wire layer.
 * Junctions are wire-level concepts (not blocks) that represent branching points.
 *
 * Interaction model:
 * - MouseDown on dot: starts wire drawing from the junction
 * - MouseUp on dot: ends wire drawing at the junction
 * - Click on outer hit area: select/drag the junction
 */

import { memo, useCallback } from 'react';
import type { Junction } from '../types';

// ============================================================================
// Types
// ============================================================================

interface JunctionDotProps {
  /** Junction data */
  junction: Junction;
  /** Whether the junction is selected */
  isSelected?: boolean;
  /** Selection handler */
  onSelect?: (junctionId: string, addToSelection: boolean) => void;
  /** Wire start handler (junction acts as wire endpoint) */
  onStartWire?: (junctionId: string) => void;
  /** Wire end handler (junction acts as wire endpoint) */
  onEndWire?: (junctionId: string) => void;
  /** Drag start handler */
  onDragStart?: (junctionId: string, event: React.MouseEvent) => void;
  /** Whether a wire is currently being drawn */
  isWireDrawing?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Visible dot radius */
const DOT_RADIUS = 4;
/** Invisible hit area radius for drag/select */
const HIT_RADIUS = 14;
/** Port interaction area radius */
const PORT_RADIUS = 8;

// ============================================================================
// Component
// ============================================================================

/**
 * SVG junction dot - a small circle rendered in the wire SVG layer.
 * Position is center-based (junction.position = center of dot).
 */
export const JunctionDot = memo(function JunctionDot({
  junction,
  isSelected,
  onSelect,
  onStartWire,
  onEndWire,
  onDragStart,
  isWireDrawing,
}: JunctionDotProps) {
  const cx = junction.position.x;
  const cy = junction.position.y;

  // Outer area: selection and drag
  const handleOuterMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // If wire is being drawn, don't handle selection/drag — let mouseUp handle it
      if (isWireDrawing) return;

      e.stopPropagation();
      const addToSelection = e.ctrlKey || e.metaKey;
      onSelect?.(junction.id, addToSelection);
      onDragStart?.(junction.id, e);
    },
    [junction.id, onSelect, onDragStart, isWireDrawing]
  );

  // Port area: start wire
  const handlePortMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // If wire is already drawing, don't start another
      if (isWireDrawing) return;

      e.stopPropagation();
      e.preventDefault();
      onStartWire?.(junction.id);
    },
    [junction.id, onStartWire, isWireDrawing]
  );

  // Port area: end wire
  const handlePortMouseUp = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEndWire?.(junction.id);
    },
    [junction.id, onEndWire]
  );

  return (
    <g data-junction-id={junction.id}>
      {/* Outer hit area for selection/drag */}
      <circle
        cx={cx}
        cy={cy}
        r={HIT_RADIUS}
        fill="transparent"
        style={{ pointerEvents: 'all', cursor: 'grab' }}
        onMouseDown={handleOuterMouseDown}
      />

      {/* Visible dot */}
      <circle
        cx={cx}
        cy={cy}
        r={DOT_RADIUS}
        fill={isSelected ? '#facc15' : '#3b82f6'}
        stroke={isSelected ? '#eab308' : '#1d4ed8'}
        strokeWidth={1.5}
        style={{ pointerEvents: 'none' }}
      />

      {/* Selection ring */}
      {isSelected && (
        <circle
          cx={cx}
          cy={cy}
          r={DOT_RADIUS + 3}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1.5}
          strokeDasharray="3 2"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Port interaction area (on top) for wire start/end */}
      <circle
        cx={cx}
        cy={cy}
        r={PORT_RADIUS}
        fill="transparent"
        style={{ pointerEvents: 'all', cursor: 'crosshair' }}
        onMouseDown={handlePortMouseDown}
        onMouseUp={handlePortMouseUp}
        data-junction-id={junction.id}
      />
    </g>
  );
});

export default JunctionDot;
