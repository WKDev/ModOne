/**
 * Transformer Block Component
 *
 * Power/control transformer with primary and secondary windings.
 * IEC symbol: Two coils with magnetic core.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { TransformerBlock as TransformerBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface TransformerBlockProps {
  /** Block data */
  block: TransformerBlockType;
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
// Component
// ============================================================================

/**
 * Transformer block with IEC-style coil symbols.
 */
export const TransformerBlock = memo(function TransformerBlock({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onDragStart,
  onStartWire,
  onEndWire,
  connectedPorts,
  portVoltages,
}: TransformerBlockProps) {
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

        {/* Transformer symbol */}
        <svg
          width="50"
          height="60"
          viewBox="0 0 50 60"
          className="mt-2"
        >
          {/* Primary winding (top) */}
          <path
            d="M10 5 Q15 10 10 15 Q5 20 10 25 Q15 30 10 35"
            stroke="#888"
            strokeWidth="2"
            fill="none"
          />
          {/* Secondary winding (bottom) */}
          <path
            d="M40 5 Q35 10 40 15 Q45 20 40 25 Q35 30 40 35"
            stroke="#888"
            strokeWidth="2"
            fill="none"
          />
          {/* Core lines */}
          <line x1="22" y1="3" x2="22" y2="37" stroke="#555" strokeWidth="2" />
          <line x1="28" y1="3" x2="28" y2="37" stroke="#555" strokeWidth="2" />
        </svg>

        {/* Voltage info */}
        <div className="text-[8px] text-gray-500 font-mono mt-1">
          {block.primaryVoltage}V / {block.secondaryVoltage}V
        </div>

        {/* Power rating */}
        <div className="text-[8px] text-gray-600 font-mono">
          {block.powerVa}VA
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

export default TransformerBlock;
