/**
 * WirePreview Component (Overlay Layer)
 *
 * Displays a preview of a wire being drawn from a port to the cursor.
 * Renders in Container Space using coordinate transformation from Canvas Space.
 */

import { memo } from 'react';
import { useCoordinateSystemContext } from '../coordinate-system/CoordinateSystemContext';
import type { WireEndpoint, Position, PortPosition } from '../types';
import { toCanvasPos } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface WirePreviewState {
  /** Starting endpoint (Canvas Space) */
  from: WireEndpoint;
  /** Current mouse position (Container Space - already converted) */
  tempPosition: Position;
  /** Starting port position for direction detection (Canvas Space) */
  startPosition?: Position;
  /** Detected exit direction from initial drag */
  exitDirection?: PortPosition;
}

interface WirePreviewProps {
  /** Wire preview state */
  preview: WirePreviewState | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate SVG path for orthogonal wire routing
 */
function generateWirePath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  exitDirection?: PortPosition
): string {
  // If no exit direction, draw straight line
  if (!exitDirection) {
    return `M ${fromX} ${fromY} L ${toX} ${toY}`;
  }

  // Calculate exit distance (20px from port)
  const exitDistance = 20;
  let exitX = fromX;
  let exitY = fromY;

  switch (exitDirection) {
    case 'top':
      exitY = fromY - exitDistance;
      break;
    case 'bottom':
      exitY = fromY + exitDistance;
      break;
    case 'left':
      exitX = fromX - exitDistance;
      break;
    case 'right':
      exitX = fromX + exitDistance;
      break;
  }

  // Create orthogonal path with one bend
  if (exitDirection === 'top' || exitDirection === 'bottom') {
    // Vertical exit: go vertical first, then horizontal to cursor
    return `M ${fromX} ${fromY} L ${exitX} ${exitY} L ${exitX} ${toY} L ${toX} ${toY}`;
  } else {
    // Horizontal exit: go horizontal first, then vertical to cursor
    return `M ${fromX} ${fromY} L ${exitX} ${exitY} L ${toX} ${exitY} L ${toX} ${toY}`;
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a wire preview during drag operations in Container Space.
 * Automatically converts Canvas Space coordinates (from) to Container Space.
 * tempPosition is already in Container Space.
 */
export const WirePreview = memo(function WirePreview({ preview }: WirePreviewProps) {
  const coordinateSystem = useCoordinateSystemContext();

  if (!preview || !preview.startPosition) {
    return null;
  }

  // Convert Canvas Space start position to Container Space
  const fromContainer = coordinateSystem.toContainer(toCanvasPos(preview.startPosition));

  // tempPosition is already in Container Space (from mouse event)
  const toContainer = preview.tempPosition;

  // Generate path in Container Space
  const path = generateWirePath(
    fromContainer.x,
    fromContainer.y,
    toContainer.x,
    toContainer.y,
    preview.exitDirection
  );

  return (
    <svg
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ overflow: 'visible' }}
    >
      <path
        d={path}
        stroke="#3b82f6"
        strokeWidth="2"
        fill="none"
        strokeDasharray="5,5"
        opacity="0.8"
      />
      {/* Draw a dot at the cursor position */}
      <circle
        cx={toContainer.x}
        cy={toContainer.y}
        r="4"
        fill="#3b82f6"
        opacity="0.8"
      />
    </svg>
  );
});

export default WirePreview;
