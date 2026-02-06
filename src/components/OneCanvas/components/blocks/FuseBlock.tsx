/**
 * Fuse Block Component
 *
 * Fuse/circuit breaker with type indicator and tripped state.
 * Turns red when tripped/blown.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { FuseBlock as FuseBlockType, FuseType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface FuseBlockProps {
  /** Block data */
  block: FuseBlockType;
  /** Whether the block is selected */
  isSelected?: boolean;
  /** Selection handler */
  onSelect?: (blockId: string, addToSelection: boolean) => void;
  /** Block click handler */
  onBlockClick?: (blockId: string, e: React.MouseEvent) => void;
  /** Drag start handler */
  onDragStart?: (blockId: string, event: React.MouseEvent) => void;
  /** Wire start handler */
  onStartWire?: (blockId: string, portId: string) => void;
  /** Wire end handler */
  onEndWire?: (blockId: string, portId: string) => void;
  /** Connected port IDs */
  connectedPorts?: Set<string>;
  /** Port voltage map for simulation display */
  portVoltages?: Map<string, number>;
}

// ============================================================================
// Constants
// ============================================================================

const FUSE_TYPE_LABELS: Record<FuseType, string> = {
  fuse: 'F',
  mcb: 'MCB',
  mpcb: 'MPCB',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Fuse block with standard fuse symbol, rating display, and tripped state.
 */
export const FuseBlock = memo(function FuseBlock({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onDragStart,
  onStartWire,
  onEndWire,
  connectedPorts,
  portVoltages,
}: FuseBlockProps) {
  const isTripped = block.tripped ?? false;
  const strokeColor = isTripped ? '#ef4444' : '#888';

  return (
    <BlockWrapper
      blockId={block.id}
      isSelected={isSelected}
      onSelect={onSelect}
      onBlockClick={onBlockClick}
      onDragStart={onDragStart}
      width={block.size.width}
      height={block.size.height}
    >
      <div className="w-full h-full flex flex-col items-center justify-center relative">
        {/* Designation label */}
        <div className="text-[10px] text-gray-400 font-mono absolute top-1 left-1/2 -translate-x-1/2">
          {block.designation}
        </div>

        {/* Fuse symbol (SVG) */}
        <svg width="48" height="24" viewBox="0 0 48 24">
          {/* Wire in */}
          <line x1="0" y1="12" x2="10" y2="12" stroke={strokeColor} strokeWidth="2" />
          {/* Fuse body */}
          <rect
            x="10" y="4" width="28" height="16" rx="2"
            fill={isTripped ? '#1a0f0f' : 'transparent'}
            stroke={strokeColor}
            strokeWidth="2"
          />
          {/* Fuse wire inside */}
          {!isTripped && (
            <line x1="14" y1="12" x2="34" y2="12" stroke={strokeColor} strokeWidth="1.5" />
          )}
          {/* Broken wire when tripped */}
          {isTripped && (
            <>
              <line x1="14" y1="12" x2="21" y2="12" stroke="#ef4444" strokeWidth="1.5" />
              <line x1="27" y1="12" x2="34" y2="12" stroke="#ef4444" strokeWidth="1.5" />
            </>
          )}
          {/* Wire out */}
          <line x1="38" y1="12" x2="48" y2="12" stroke={strokeColor} strokeWidth="2" />
        </svg>

        {/* Rating and type */}
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[9px] font-mono" style={{ color: isTripped ? '#ef4444' : '#aaa' }}>
            {block.ratingAmps}A
          </span>
          <span className="text-[8px] font-mono" style={{ color: isTripped ? '#ef4444' : '#666' }}>
            {FUSE_TYPE_LABELS[block.fuseType]}
          </span>
        </div>
      </div>

      {/* Ports */}
      {block.ports.map((port) => (
        <Port
          key={port.id}
          port={port}
          blockId={block.id}
          blockSize={{ width: block.size.width, height: block.size.height }}
          isConnected={connectedPorts?.has(port.id)}
          voltage={portVoltages?.get(`${block.id}:${port.id}`)}
          onStartWire={onStartWire}
          onEndWire={onEndWire}
        />
      ))}
    </BlockWrapper>
  );
});

export default FuseBlock;
