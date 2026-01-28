/**
 * Draggable Block Component
 *
 * Wrapper that makes canvas blocks draggable for repositioning.
 */

import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Block } from '../types';

// ============================================================================
// Types
// ============================================================================

interface DraggableBlockProps {
  /** Block data */
  block: Block;
  /** Content to render */
  children: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Wrapper that makes a block draggable on the canvas.
 */
export const DraggableBlock = memo(function DraggableBlock({
  block,
  children,
}: DraggableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `canvas-block-${block.id}`,
    data: {
      type: 'canvas-component',
      componentId: block.id,
      originalPosition: block.position,
    },
  });

  const style = {
    position: 'absolute' as const,
    left: block.position.x,
    top: block.position.y,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      data-block-id={block.id}
    >
      {children}
    </div>
  );
});

export default DraggableBlock;
