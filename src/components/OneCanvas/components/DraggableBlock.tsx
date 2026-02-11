/**
 * Draggable Block Component
 *
 * Positioned wrapper for canvas blocks.
 * Mouse events are forwarded up for the XState interaction machine to handle.
 * Toolbox-to-canvas drag uses a separate @dnd-kit path (DraggableBlockItem).
 */

import { memo, forwardRef } from 'react';
import type { Block } from '../types';

// ============================================================================
// Types
// ============================================================================

interface DraggableBlockProps {
  /** Block data */
  block: Block;
  /** Content to render */
  children: React.ReactNode;
  /** Mouse down handler — forwarded to interaction machine */
  onMouseDown?: (event: React.MouseEvent) => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Positioned wrapper for a block on the canvas.
 * Exposes ref for transient drag DOM manipulation.
 */
export const DraggableBlock = memo(
  forwardRef<HTMLDivElement, DraggableBlockProps>(function DraggableBlock(
    { block, children, onMouseDown },
    ref
  ) {
    const style: React.CSSProperties = {
      position: 'absolute',
      left: block.position.x,
      top: block.position.y,
      transform: `rotate(${block.rotation || 0}deg)`,
      transformOrigin: 'center center',
      zIndex: 1,
    };

    return (
      <div
        ref={ref}
        style={style}
        data-block-id={block.id}
        onMouseDown={onMouseDown}
      >
        {children}
      </div>
    );
  })
);

export default DraggableBlock;
