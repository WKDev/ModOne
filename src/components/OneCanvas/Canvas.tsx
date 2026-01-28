/**
 * Canvas Component
 *
 * Main canvas container with pan/zoom transformation, grid background,
 * and coordinate system management.
 */

import { useRef, forwardRef, useImperativeHandle } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { GridBackground } from './GridBackground';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';

// ============================================================================
// Types
// ============================================================================

interface CanvasProps {
  /** Canvas content (blocks, wires, etc.) */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Grid cell size in pixels */
  gridSize?: number;
  /** Whether to show the grid */
  showGrid?: boolean;
  /** Callback when canvas is clicked (not on a component) */
  onCanvasClick?: (event: React.MouseEvent) => void;
  /** Callback when canvas is double-clicked */
  onCanvasDoubleClick?: (event: React.MouseEvent) => void;
}

export interface CanvasRef {
  /** Get the canvas container element */
  getContainer: () => HTMLDivElement | null;
  /** Get the content element */
  getContent: () => HTMLDivElement | null;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Infinite canvas with pan, zoom, and grid support.
 */
export const Canvas = forwardRef<CanvasRef, CanvasProps>(function Canvas(
  {
    children,
    className = '',
    gridSize: propGridSize,
    showGrid: propShowGrid,
    onCanvasClick,
    onCanvasDoubleClick,
  },
  ref
) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Store state
  const zoom = useCanvasStore((state) => state.zoom);
  const pan = useCanvasStore((state) => state.pan);
  const storeGridSize = useCanvasStore((state) => state.gridSize);
  const storeShowGrid = useCanvasStore((state) => state.showGrid);
  const clearSelection = useCanvasStore((state) => state.clearSelection);

  // Use prop values if provided, otherwise use store values
  const gridSize = propGridSize ?? storeGridSize;
  const showGrid = propShowGrid ?? storeShowGrid;

  // Canvas interaction (pan/zoom)
  const { cursor } = useCanvasInteraction(containerRef);

  // Expose ref methods
  useImperativeHandle(ref, () => ({
    getContainer: () => containerRef.current,
    getContent: () => contentRef.current,
  }));

  // Calculate transform
  const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;

  // Handle canvas click (clear selection if clicking on empty space)
  const handleClick = (event: React.MouseEvent) => {
    // Only handle if clicking directly on the canvas container
    if (event.target === containerRef.current || event.target === contentRef.current) {
      clearSelection();
      onCanvasClick?.(event);
    }
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    if (event.target === containerRef.current || event.target === contentRef.current) {
      onCanvasDoubleClick?.(event);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none ${className}`}
      style={{ cursor }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Grid background */}
      <GridBackground
        gridSize={gridSize}
        showGrid={showGrid}
        zoom={zoom}
      />

      {/* Transformed content layer */}
      <div
        ref={contentRef}
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform }}
      >
        {children}
      </div>
    </div>
  );
});

export default Canvas;
