/**
 * Junction Block Component
 *
 * A small circular junction point for wire branching.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { JunctionBlock as JunctionBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface JunctionBlockProps {
  /** Block data */
  block: JunctionBlockType;
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
// Constants
// ============================================================================

const BLOCK_WIDTH = 12;
const BLOCK_HEIGHT = 12;

// ============================================================================
// Component
// ============================================================================

/**
 * Junction block - a small circular connection point for wire branching.
 */
export const JunctionBlock = memo(function JunctionBlock({
  block,
  isSelected,
  onSelect,
  onStartWire,
  onEndWire,
  connectedPorts,
}: JunctionBlockProps) {
  return (
    <BlockWrapper
      blockId={block.id}
      isSelected={isSelected}
      onSelect={onSelect}
      width={BLOCK_WIDTH}
      height={BLOCK_HEIGHT}
    >
      {/* Junction circle */}
      <svg
        viewBox="0 0 12 12"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Filled circle for junction point */}
        <circle
          cx="6"
          cy="6"
          r="5"
          fill={isSelected ? '#facc15' : '#3b82f6'}
          stroke={isSelected ? '#eab308' : '#1d4ed8'}
          strokeWidth="1.5"
          className="transition-colors duration-150"
        />
        {/* Inner highlight */}
        <circle
          cx="5"
          cy="5"
          r="1.5"
          fill="rgba(255, 255, 255, 0.3)"
        />
      </svg>

      {/* Hub port (center) */}
      {block.ports.map((port) => (
        <Port
          key={port.id}
          port={port}
          blockId={block.id}
          blockSize={{ width: BLOCK_WIDTH, height: BLOCK_HEIGHT }}
          isConnected={connectedPorts?.has(port.id)}
          onStartWire={onStartWire}
          onEndWire={onEndWire}
        />
      ))}
    </BlockWrapper>
  );
});

export default JunctionBlock;
