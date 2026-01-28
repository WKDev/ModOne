/**
 * PLC Output Block Component
 *
 * PLC coil/output that controls circuit based on PLC state.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { PlcOutBlock as PlcOutBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface PlcOutBlockProps {
  /** Block data */
  block: PlcOutBlockType;
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
  /** Whether the output is active (from PLC state) */
  isActive?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const BLOCK_WIDTH = 80;
const BLOCK_HEIGHT = 50;

// ============================================================================
// Component
// ============================================================================

/**
 * PLC output (coil) block - acts as a relay controlled by PLC.
 */
export const PlcOutBlock = memo(function PlcOutBlock({
  block,
  isSelected,
  onSelect,
  onStartWire,
  onEndWire,
  connectedPorts,
  isActive = false,
}: PlcOutBlockProps) {
  // Determine contact state based on normally open/closed and active state
  const isClosed = block.normallyOpen ? isActive : !isActive;

  return (
    <BlockWrapper
      blockId={block.id}
      isSelected={isSelected}
      onSelect={onSelect}
      width={BLOCK_WIDTH}
      height={BLOCK_HEIGHT}
    >
      {/* Block body */}
      <div
        className={`
          w-full h-full rounded border-2
          ${isActive ? 'bg-green-900 border-green-500' : 'bg-neutral-800 border-neutral-600'}
          flex flex-col items-center justify-center
          text-white text-xs select-none
        `}
      >
        {/* Coil symbol */}
        <svg
          viewBox="0 0 60 20"
          className="w-12 h-5"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Left line */}
          <line
            x1="0"
            y1="10"
            x2="10"
            y2="10"
            stroke={isActive ? '#22c55e' : '#9ca3af'}
            strokeWidth="2"
          />
          {/* Contact switch */}
          <line
            x1="10"
            y1="10"
            x2={isClosed ? '50' : '45'}
            y2={isClosed ? '10' : '3'}
            stroke={isActive ? '#22c55e' : '#9ca3af'}
            strokeWidth="2"
          />
          {/* Right line */}
          <line
            x1="50"
            y1="10"
            x2="60"
            y2="10"
            stroke={isActive ? '#22c55e' : '#9ca3af'}
            strokeWidth="2"
          />
          {/* Contact points */}
          <circle cx="10" cy="10" r="2" fill={isActive ? '#22c55e' : '#9ca3af'} />
          <circle cx="50" cy="10" r="2" fill={isActive ? '#22c55e' : '#9ca3af'} />
        </svg>

        {/* Address label */}
        <span className="text-[10px] text-neutral-400 mt-1">
          {block.address}
        </span>

        {/* NO/NC indicator */}
        <span className="text-[8px] text-neutral-500">
          {block.normallyOpen ? 'NO' : 'NC'}
        </span>
      </div>

      {/* Ports */}
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

export default PlcOutBlock;
