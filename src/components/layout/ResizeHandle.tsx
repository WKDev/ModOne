/**
 * Resize Handle Component
 *
 * A draggable handle for resizing panels.
 * Used primarily for the editor/tool panel boundary.
 */

import { useCallback, useRef, useEffect } from 'react';

export interface ResizeHandleProps {
  /** Direction of resize - horizontal divides top/bottom, vertical divides left/right */
  direction: 'horizontal' | 'vertical';
  /** Callback when resize starts */
  onResizeStart?: () => void;
  /** Callback during resize with the delta in pixels */
  onResize: (delta: number) => void;
  /** Callback when resize ends */
  onResizeEnd?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export function ResizeHandle({
  direction,
  onResizeStart,
  onResize,
  onResizeEnd,
  className = '',
}: ResizeHandleProps) {
  const isDragging = useRef(false);
  const startPosition = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startPosition.current = direction === 'horizontal' ? e.clientY : e.clientX;
      onResizeStart?.();

      // Add cursor style to body during drag
      document.body.style.cursor = direction === 'horizontal' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [direction, onResizeStart]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      const currentPosition = direction === 'horizontal' ? e.clientY : e.clientX;
      const delta = startPosition.current - currentPosition;
      startPosition.current = currentPosition;

      onResize(delta);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;

      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onResizeEnd?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [direction, onResize, onResizeEnd]);

  const baseClasses =
    direction === 'horizontal'
      ? 'w-full h-1 cursor-row-resize hover:bg-blue-500/50 active:bg-blue-500'
      : 'h-full w-1 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500';

  return (
    <div
      className={`flex-shrink-0 bg-gray-700 transition-colors ${baseClasses} ${className}`}
      onMouseDown={handleMouseDown}
    />
  );
}
