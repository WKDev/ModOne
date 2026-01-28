/**
 * Grid Background Component
 *
 * SVG pattern-based grid that scales with zoom level for optimal performance.
 * Shows minor grid lines (every cell) and major grid lines (every 5 cells).
 */

import { memo, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

interface GridBackgroundProps {
  /** Base grid cell size in pixels (default: 20) */
  gridSize?: number;
  /** Toggle grid visibility */
  showGrid?: boolean;
  /** Current zoom level for pattern scaling */
  zoom?: number;
  /** Minor grid line color */
  minorColor?: string;
  /** Major grid line color */
  majorColor?: string;
  /** Background color */
  backgroundColor?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_GRID_SIZE = 20;
const MAJOR_LINE_INTERVAL = 5;
const MIN_ZOOM_FOR_MINOR_LINES = 0.5;

// ============================================================================
// Component
// ============================================================================

/**
 * GPU-accelerated grid background using SVG patterns.
 */
export const GridBackground = memo(function GridBackground({
  gridSize = DEFAULT_GRID_SIZE,
  showGrid = true,
  zoom = 1,
  minorColor = '#2a2a2a',
  majorColor = '#3a3a3a',
  backgroundColor = '#1a1a1a',
}: GridBackgroundProps) {
  // Calculate scaled grid size
  const scaledSize = gridSize * zoom;
  const majorSize = scaledSize * MAJOR_LINE_INTERVAL;

  // Determine stroke width (thinner at higher zoom for consistent visual weight)
  const minorStroke = Math.max(0.5, 1 / zoom);
  const majorStroke = Math.max(1, 1.5 / zoom);

  // Hide minor lines at low zoom levels for clarity
  const showMinorLines = zoom >= MIN_ZOOM_FOR_MINOR_LINES;

  // Generate unique pattern IDs to avoid conflicts
  const patternId = useMemo(() => `grid-pattern-${Math.random().toString(36).substr(2, 9)}`, []);
  const majorPatternId = useMemo(() => `grid-major-${Math.random().toString(36).substr(2, 9)}`, []);

  if (!showGrid) {
    return (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundColor }}
      />
    );
  }

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ backgroundColor }}
    >
      <defs>
        {/* Minor grid pattern */}
        {showMinorLines && (
          <pattern
            id={patternId}
            width={scaledSize}
            height={scaledSize}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${scaledSize} 0 L 0 0 0 ${scaledSize}`}
              fill="none"
              stroke={minorColor}
              strokeWidth={minorStroke}
            />
          </pattern>
        )}

        {/* Major grid pattern */}
        <pattern
          id={majorPatternId}
          width={majorSize}
          height={majorSize}
          patternUnits="userSpaceOnUse"
        >
          {/* Fill with minor grid if visible */}
          {showMinorLines && (
            <rect width={majorSize} height={majorSize} fill={`url(#${patternId})`} />
          )}
          {/* Major lines */}
          <path
            d={`M ${majorSize} 0 L 0 0 0 ${majorSize}`}
            fill="none"
            stroke={majorColor}
            strokeWidth={majorStroke}
          />
        </pattern>
      </defs>

      {/* Fill entire viewport with grid pattern */}
      <rect width="100%" height="100%" fill={`url(#${majorPatternId})`} />
    </svg>
  );
});

export default GridBackground;
