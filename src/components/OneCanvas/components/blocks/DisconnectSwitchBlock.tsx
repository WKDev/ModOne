/**
 * Disconnect Switch Block Component
 *
 * Main disconnect/isolator switch for circuit isolation.
 * IEC symbol: Switch with multiple poles.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { DisconnectSwitchBlock as DisconnectSwitchBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface DisconnectSwitchBlockProps {
  /** Block data */
  block: DisconnectSwitchBlockType;
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
 * Disconnect switch block with IEC-style symbol.
 */
export const DisconnectSwitchBlock = memo(function DisconnectSwitchBlock({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onDragStart,
  onStartWire,
  onEndWire,
  connectedPorts,
  portVoltages,
}: DisconnectSwitchBlockProps) {
  const isOpen = block.open ?? false;

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

        {/* Disconnect switch symbol */}
        <svg
          width="48"
          height="40"
          viewBox="0 0 48 40"
          className="mt-2"
        >
          {/* Switch contacts for each pole */}
          {Array.from({ length: block.poles }).map((_, i) => {
            const x = 8 + i * 12;
            return (
              <g key={i}>
                {/* Fixed contact (top) */}
                <circle
                  cx={x}
                  cy={8}
                  r={3}
                  fill={isOpen ? '#666' : '#22c55e'}
                />
                {/* Moving contact */}
                <line
                  x1={x}
                  y1={10}
                  x2={isOpen ? x + 8 : x}
                  y2={isOpen ? 24 : 28}
                  stroke={isOpen ? '#ef4444' : '#22c55e'}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                {/* Fixed contact (bottom) */}
                <circle
                  cx={x}
                  cy={32}
                  r={3}
                  fill={isOpen ? '#666' : '#22c55e'}
                />
              </g>
            );
          })}
          
          {/* Mechanical linkage line */}
          <line
            x1={4}
            y1={20}
            x2={4 + block.poles * 12}
            y2={20}
            stroke="#555"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        </svg>

        {/* Status and rating */}
        <div
          className="text-[8px] font-mono"
          style={{ color: isOpen ? '#ef4444' : '#22c55e' }}
        >
          {isOpen ? 'OPEN' : 'CLOSED'}
        </div>
        <div className="text-[8px] text-gray-500 font-mono">
          {block.currentRating}A / {block.poles}P
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

export default DisconnectSwitchBlock;
