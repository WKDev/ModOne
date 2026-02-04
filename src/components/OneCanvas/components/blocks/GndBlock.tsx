/**
 * Ground Block Component
 *
 * Ground reference (0V) with standard ground symbol.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { GndBlock as GndBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface GndBlockProps {
  /** Block data */
  block: GndBlockType;
  /** Whether the block is selected */
  isSelected?: boolean;
  /** Selection handler */
  onSelect?: (blockId: string, addToSelection: boolean) => void;
  /** Wire start handler */
  onStartWire?: (blockId: string, portId: string) => void;
  /** Wire end handler */
  onEndWire?: (blockId: string, portId: string) => void;
  /** Connected port IDs */
  connectedPorts?: Set<string>;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Ground block with standard 三 symbol.
 */
export const GndBlock = memo(function GndBlock({
  block,
  isSelected,
  onSelect,
  onStartWire,
  onEndWire,
  connectedPorts,
}: GndBlockProps) {
  return (
    <BlockWrapper
      blockId={block.id}
      isSelected={isSelected}
      onSelect={onSelect}
      width={block.size.width}
      height={block.size.height}
    >
      {/* Ground symbol SVG */}
      <svg
        viewBox="0 0 40 40"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Vertical line from top */}
        <line
          x1="20"
          y1="0"
          x2="20"
          y2="12"
          stroke="currentColor"
          strokeWidth="2"
          className="text-neutral-400"
        />
        {/* Ground symbol lines */}
        <line
          x1="6"
          y1="12"
          x2="34"
          y2="12"
          stroke="currentColor"
          strokeWidth="3"
          className="text-neutral-800"
        />
        <line
          x1="10"
          y1="20"
          x2="30"
          y2="20"
          stroke="currentColor"
          strokeWidth="3"
          className="text-neutral-800"
        />
        <line
          x1="14"
          y1="28"
          x2="26"
          y2="28"
          stroke="currentColor"
          strokeWidth="3"
          className="text-neutral-800"
        />
        <line
          x1="18"
          y1="36"
          x2="22"
          y2="36"
          stroke="currentColor"
          strokeWidth="3"
          className="text-neutral-800"
        />
      </svg>

      {/* Input port (top) */}
      {block.ports.map((port) => (
        <Port
          key={port.id}
          port={port}
          blockId={block.id}
          blockSize={{ width: block.size.width, height: block.size.height }}
          isConnected={connectedPorts?.has(port.id)}
          onStartWire={onStartWire}
          onEndWire={onEndWire}
        />
      ))}
    </BlockWrapper>
  );
});

export default GndBlock;
