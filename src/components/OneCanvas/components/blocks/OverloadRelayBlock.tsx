/**
 * Overload Relay Block Component
 *
 * Thermal/electronic overload relay for motor protection.
 * IEC symbol: Bimetal element with trip contact.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { OverloadRelayBlock as OverloadRelayBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface OverloadRelayBlockProps {
  /** Block data */
  block: OverloadRelayBlockType;
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
 * Overload relay block with thermal element symbol.
 */
export const OverloadRelayBlock = memo(function OverloadRelayBlock({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onDragStart,
  onStartWire,
  onEndWire,
  connectedPorts,
  portVoltages,
}: OverloadRelayBlockProps) {
  const isTripped = block.tripped ?? false;

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

        {/* Overload relay symbol */}
        <div
          className="flex items-center justify-center rounded transition-all duration-200"
          style={{
            width: '44px',
            height: '34px',
            border: `2px solid ${isTripped ? '#ef4444' : '#555'}`,
            backgroundColor: isTripped ? '#7f1d1d20' : 'transparent',
            boxShadow: isTripped
              ? '0 0 12px #ef444480, 0 0 24px #ef444440'
              : 'none',
          }}
        >
          {/* Thermal element zigzag */}
          <svg width="28" height="18" viewBox="0 0 28 18">
            <path
              d="M2 9 L6 3 L10 15 L14 3 L18 15 L22 3 L26 9"
              stroke={isTripped ? '#ef4444' : '#888'}
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </div>

        {/* Current range */}
        <div
          className="text-[8px] font-mono mt-1"
          style={{ color: isTripped ? '#ef4444' : '#666' }}
        >
          {block.currentMin}-{block.currentMax}A
        </div>

        {/* Trip status */}
        {isTripped && (
          <div className="text-[8px] text-red-500 font-bold">TRIP</div>
        )}
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

export default OverloadRelayBlock;
