/**
 * JunctionDot SVG Component
 *
 * Renders a junction as a small SVG circle in the wire layer,
 * replacing the old HTML-based JunctionBlock that was forced to 60x60 by BlockWrapper.
 * Supports selection, wire start/end, and dragging.
 *
 * Interaction model:
 * - MouseDown on dot: starts wire drawing from the 'hub' port (same as Port component)
 * - MouseUp on dot: ends wire drawing at the 'hub' port
 * - Click on outer hit area: select/drag the junction block
 */

import { memo, useCallback } from 'react';
import type { JunctionBlock } from '../types';

// ============================================================================
// Types
// ============================================================================

interface JunctionDotProps {
  /** Junction block data */
  block: JunctionBlock;
  /** Whether the junction is selected */
  isSelected?: boolean;
  /** Selection handler */
  onSelect?: (blockId: string, addToSelection: boolean) => void;
  /** Wire start handler */
  onStartWire?: (blockId: string, portId: string) => void;
  /** Wire end handler */
  onEndWire?: (blockId: string, portId: string) => void;
  /** Drag start handler */
  onDragStart?: (blockId: string, event: React.MouseEvent) => void;
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
 * Position is center-based (block.position = center of dot).
 */
export const JunctionDot = memo(function JunctionDot({
  block,
  isSelected,
  onSelect,
  onStartWire,
  onEndWire,
  onDragStart,
  isWireDrawing,
}: JunctionDotProps) {
  const cx = block.position.x;
  const cy = block.position.y;

  // Outer area: selection and drag
  const handleOuterMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // If wire is being drawn, don't handle selection/drag — let mouseUp handle it
      if (isWireDrawing) return;

      e.stopPropagation();
      const addToSelection = e.ctrlKey || e.metaKey;
      onSelect?.(block.id, addToSelection);
      onDragStart?.(block.id, e);
    },
    [block.id, onSelect, onDragStart, isWireDrawing]
  );

  // Port area: start wire
  const handlePortMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // If wire is already drawing, don't start another
      if (isWireDrawing) return;

      e.stopPropagation();
      e.preventDefault();
      onStartWire?.(block.id, 'hub');
    },
    [block.id, onStartWire, isWireDrawing]
  );

  // Port area: end wire
  const handlePortMouseUp = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEndWire?.(block.id, 'hub');
    },
    [block.id, onEndWire]
  );

  return (
    <g data-block-id={block.id}>
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
        data-port-id="hub"
        data-block-id={block.id}
      />
    </g>
  );
});

export default JunctionDot;
