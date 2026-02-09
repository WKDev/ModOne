import { memo, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';

interface CanvasDropZoneProps {
  children: ReactNode;
  className?: string;
}

export const CanvasDropZone = memo(function CanvasDropZone({ children, className }: CanvasDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-dropzone',
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
    >
      {children}
    </div>
  );
});
