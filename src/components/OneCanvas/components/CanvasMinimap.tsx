/**
 * Canvas Minimap Component
 *
 * A small overview map showing the entire circuit with:
 * - All components as simplified rectangles
 * - Wires as lines
 * - Viewport rectangle showing current view
 * - Click to navigate functionality
 */

import { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react';
import type { Block, Wire, Position } from '../types';

// ============================================================================
// Types
// ============================================================================

interface CanvasMinimapProps {
  /** All circuit components */
  components: Map<string, Block>;
  /** All wire connections */
  wires: Wire[];
  /** Current viewport zoom level */
  zoom: number;
  /** Current viewport pan offset */
  pan: Position;
  /** Viewport dimensions */
  viewportWidth: number;
  viewportHeight: number;
  /** Handler for viewport navigation */
  onNavigate: (pan: Position) => void;
  /** Whether minimap is collapsed */
  collapsed?: boolean;
  /** Toggle collapse state */
  onToggleCollapse?: () => void;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

// ============================================================================
// Constants
// ============================================================================

const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 120;
const MINIMAP_PADDING = 10;

// Component colors for minimap
const COMPONENT_COLORS: Record<string, string> = {
  powersource: '#22c55e',
  plc_out: '#f97316',
  plc_in: '#3b82f6',
  led: '#ef4444',
  button: '#8b5cf6',
  scope: '#06b6d4',
  text: '#9ca3af',
  relay: '#eab308',
  fuse: '#f97316',
  motor: '#10b981',
  emergency_stop: '#dc2626',
  selector_switch: '#a855f7',
  solenoid_valve: '#0ea5e9',
  sensor: '#14b8a6',
  pilot_lamp: '#84cc16',
  net_label: '#10b981',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate the bounding box of all components
 */
function calculateBounds(components: Map<string, Block>): Bounds {
  if (components.size === 0) {
    return { minX: 0, minY: 0, maxX: 500, maxY: 500, width: 500, height: 500 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const block of components.values()) {
    minX = Math.min(minX, block.position.x);
    minY = Math.min(minY, block.position.y);
    maxX = Math.max(maxX, block.position.x + block.size.width);
    maxY = Math.max(maxY, block.position.y + block.size.height);
  }

  // Add some padding
  const padding = 100;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// ============================================================================
// Component
// ============================================================================

export const CanvasMinimap = memo(function CanvasMinimap({
  components,
  wires,
  zoom,
  pan,
  viewportWidth,
  viewportHeight,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: CanvasMinimapProps) {
  const minimapRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate circuit bounds and scale
  const { bounds, scale } = useMemo(() => {
    const bounds = calculateBounds(components);
    const scaleX = (MINIMAP_WIDTH - MINIMAP_PADDING * 2) / bounds.width;
    const scaleY = (MINIMAP_HEIGHT - MINIMAP_PADDING * 2) / bounds.height;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up
    return { bounds, scale };
  }, [components]);

  // Calculate viewport rectangle in minimap coordinates
  const viewportRect = useMemo(() => {
    // Visible area in canvas coordinates
    const visibleX = -pan.x / zoom;
    const visibleY = -pan.y / zoom;
    const visibleWidth = viewportWidth / zoom;
    const visibleHeight = viewportHeight / zoom;

    // Convert to minimap coordinates
    return {
      x: MINIMAP_PADDING + (visibleX - bounds.minX) * scale,
      y: MINIMAP_PADDING + (visibleY - bounds.minY) * scale,
      width: visibleWidth * scale,
      height: visibleHeight * scale,
    };
  }, [pan, zoom, viewportWidth, viewportHeight, bounds, scale]);

  // Handle click to navigate
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!minimapRef.current) return;

      const rect = minimapRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Convert minimap click to canvas coordinates
      const canvasX = bounds.minX + (clickX - MINIMAP_PADDING) / scale;
      const canvasY = bounds.minY + (clickY - MINIMAP_PADDING) / scale;

      // Center the view on this point
      const newPan = {
        x: -(canvasX * zoom - viewportWidth / 2),
        y: -(canvasY * zoom - viewportHeight / 2),
      };

      onNavigate(newPan);
    },
    [bounds, scale, zoom, viewportWidth, viewportHeight, onNavigate]
  );

  // Handle drag for viewport rectangle
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !minimapRef.current) return;

      const rect = minimapRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Convert minimap position to canvas coordinates
      const canvasX = bounds.minX + (clickX - MINIMAP_PADDING) / scale;
      const canvasY = bounds.minY + (clickY - MINIMAP_PADDING) / scale;

      // Set pan so this point is at center
      const newPan = {
        x: -(canvasX * zoom - viewportWidth / 2),
        y: -(canvasY * zoom - viewportHeight / 2),
      };

      onNavigate(newPan);
    },
    [isDragging, bounds, scale, zoom, viewportWidth, viewportHeight, onNavigate]
  );

  // Add mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="absolute bottom-4 right-4 z-20 px-3 py-1.5 bg-gray-800/90 border border-gray-700 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-700/90 transition-colors"
        title="Show Minimap"
      >
        <span className="mr-1">🗺️</span> Map
      </button>
    );
  }

  return (
    <div
      ref={minimapRef}
      className="absolute bottom-4 right-4 z-20 bg-gray-900/95 border border-gray-700 rounded-lg shadow-lg overflow-hidden"
      style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-800/50 border-b border-gray-700">
        <span className="text-[10px] text-gray-500 font-medium">MINIMAP</span>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="text-gray-500 hover:text-gray-300 text-xs"
            title="Collapse"
          >
            ✕
          </button>
        )}
      </div>

      {/* Minimap canvas */}
      <svg
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT - 20}
        className="cursor-crosshair"
        onClick={handleClick}
        onMouseDown={handleMouseDown}
      >
        {/* Background */}
        <rect
          x={0}
          y={0}
          width={MINIMAP_WIDTH}
          height={MINIMAP_HEIGHT - 20}
          fill="#1a1a1a"
        />

        {/* Wires */}
        {wires.map((wire) => {
          // Get wire endpoints
          const fromComponent = 'componentId' in wire.from
            ? components.get(wire.from.componentId)
            : null;
          const toComponent = 'componentId' in wire.to
            ? components.get(wire.to.componentId)
            : null;

          if (!fromComponent && !toComponent) return null;

          const x1 = fromComponent
            ? MINIMAP_PADDING + (fromComponent.position.x + fromComponent.size.width / 2 - bounds.minX) * scale
            : MINIMAP_PADDING;
          const y1 = fromComponent
            ? MINIMAP_PADDING + (fromComponent.position.y + fromComponent.size.height / 2 - bounds.minY) * scale
            : MINIMAP_PADDING;
          const x2 = toComponent
            ? MINIMAP_PADDING + (toComponent.position.x + toComponent.size.width / 2 - bounds.minX) * scale
            : MINIMAP_PADDING;
          const y2 = toComponent
            ? MINIMAP_PADDING + (toComponent.position.y + toComponent.size.height / 2 - bounds.minY) * scale
            : MINIMAP_PADDING;

          return (
            <line
              key={wire.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#4a5568"
              strokeWidth={1}
            />
          );
        })}

        {/* Components */}
        {Array.from(components.values()).map((block) => {
          const x = MINIMAP_PADDING + (block.position.x - bounds.minX) * scale;
          const y = MINIMAP_PADDING + (block.position.y - bounds.minY) * scale;
          const width = Math.max(block.size.width * scale, 3);
          const height = Math.max(block.size.height * scale, 3);
          const color = COMPONENT_COLORS[block.type] || '#888';

          return (
            <rect
              key={block.id}
              x={x}
              y={y}
              width={width}
              height={height}
              fill={color}
              stroke={color}
              strokeWidth={0.5}
              rx={1}
            />
          );
        })}

        {/* Viewport rectangle */}
        <rect
          x={viewportRect.x}
          y={viewportRect.y}
          width={viewportRect.width}
          height={viewportRect.height}
          fill="transparent"
          stroke="#3b82f6"
          strokeWidth={1.5}
          rx={2}
          className="pointer-events-none"
        />
      </svg>
    </div>
  );
});

export default CanvasMinimap;
