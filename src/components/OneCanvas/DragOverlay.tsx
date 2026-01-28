/**
 * Drag Overlay Component
 *
 * Visual preview shown during drag operations.
 */

import { memo } from 'react';
import { DragOverlay as DndKitDragOverlay } from '@dnd-kit/core';
import type { BlockType } from './types';

// ============================================================================
// Types
// ============================================================================

interface BlockDragOverlayProps {
  /** Type of block being dragged */
  blockType: BlockType | null;
  /** Whether a drag is active */
  isDragging: boolean;
}

// ============================================================================
// Block Previews
// ============================================================================

const BlockPreview = memo(function BlockPreview({ type }: { type: BlockType }) {
  switch (type) {
    case 'power_24v':
      return (
        <div className="w-16 h-10 bg-red-600 rounded flex items-center justify-center text-white font-bold text-sm shadow-lg">
          +24V
        </div>
      );
    case 'power_12v':
      return (
        <div className="w-16 h-10 bg-orange-500 rounded flex items-center justify-center text-white font-bold text-sm shadow-lg">
          +12V
        </div>
      );
    case 'gnd':
      return (
        <div className="w-10 h-12 flex items-center justify-center">
          <svg viewBox="0 0 40 50" className="w-full h-full" fill="none">
            <line x1="6" y1="15" x2="34" y2="15" stroke="#525252" strokeWidth="3" />
            <line x1="10" y1="25" x2="30" y2="25" stroke="#525252" strokeWidth="3" />
            <line x1="14" y1="35" x2="26" y2="35" stroke="#525252" strokeWidth="3" />
            <line x1="18" y1="45" x2="22" y2="45" stroke="#525252" strokeWidth="3" />
          </svg>
        </div>
      );
    case 'plc_out':
      return (
        <div className="w-20 h-12 bg-neutral-800 border-2 border-neutral-600 rounded flex items-center justify-center text-white text-xs shadow-lg">
          PLC OUT
        </div>
      );
    case 'plc_in':
      return (
        <div className="w-20 h-12 bg-neutral-800 border-2 border-neutral-600 rounded flex items-center justify-center text-white text-xs shadow-lg">
          PLC IN
        </div>
      );
    case 'led':
      return (
        <div className="w-10 h-16 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-red-500 shadow-lg" />
        </div>
      );
    case 'button':
      return (
        <div className="w-16 h-16 bg-neutral-800 border-2 border-neutral-600 rounded flex items-center justify-center shadow-lg">
          <div className="w-10 h-10 rounded-full bg-neutral-700 border-2 border-neutral-500" />
        </div>
      );
    case 'scope':
      return (
        <div className="w-24 h-20 bg-neutral-900 border-2 border-neutral-600 rounded flex items-center justify-center shadow-lg">
          <div className="w-20 h-14 bg-black rounded">
            <svg viewBox="0 0 100 60" className="w-full h-full">
              <line x1="0" y1="30" x2="100" y2="30" stroke="#374151" strokeWidth="1" />
              <line x1="50" y1="0" x2="50" y2="60" stroke="#374151" strokeWidth="1" />
            </svg>
          </div>
        </div>
      );
    default:
      return (
        <div className="w-16 h-16 bg-neutral-700 rounded flex items-center justify-center text-white text-xs shadow-lg">
          Block
        </div>
      );
  }
});

// ============================================================================
// Component
// ============================================================================

/**
 * Drag overlay showing preview of dragged block.
 */
export const BlockDragOverlay = memo(function BlockDragOverlay({
  blockType,
  isDragging,
}: BlockDragOverlayProps) {
  if (!isDragging || !blockType) {
    return null;
  }

  return (
    <DndKitDragOverlay dropAnimation={null}>
      <div className="opacity-80">
        <BlockPreview type={blockType} />
      </div>
    </DndKitDragOverlay>
  );
});

export default BlockDragOverlay;
