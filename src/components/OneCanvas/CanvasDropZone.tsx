/**
 * Canvas Drop Zone Component
 *
 * Wrapper that makes the canvas a valid drop target for dragged blocks.
 */

import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';

// ============================================================================
// Types
// ============================================================================

interface CanvasDropZoneProps {
  /** Content to render inside the drop zone */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Drop zone wrapper for the canvas.
 */
export const CanvasDropZone = memo(function CanvasDropZone({
  children,
  className = '',
}: CanvasDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-drop-zone',
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        relative w-full h-full
        ${isOver ? 'ring-2 ring-blue-500 ring-inset' : ''}
        ${className}
      `}
    >
      {children}

      {/* Drop indicator overlay */}
      {isOver && (
        <div className="absolute inset-0 bg-blue-500/10 pointer-events-none z-50" />
      )}
    </div>
  );
});

export default CanvasDropZone;
