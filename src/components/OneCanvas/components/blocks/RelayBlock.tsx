/**
 * Relay Block Component
 *
 * Relay/contactor coil with NO/NC contact status indicator.
 * Shows energized state with blue glow.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { RelayBlock as RelayBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface RelayBlockProps {
  /** Block data */
  block: RelayBlockType;
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
 * Relay block with coil symbol and contact status indicator.
 */
export const RelayBlock = memo(function RelayBlock({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onDragStart,
  onStartWire,
  onEndWire,
  connectedPorts,
  portVoltages,
}: RelayBlockProps) {
  const isEnergized = block.energized ?? false;

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

        {/* Coil symbol */}
        <div
          className="flex items-center justify-center rounded transition-all duration-200"
          style={{
            width: '44px',
            height: '28px',
            border: `2px solid ${isEnergized ? '#3b82f6' : '#555'}`,
            backgroundColor: isEnergized ? '#1e3a5f20' : 'transparent',
            boxShadow: isEnergized
              ? '0 0 12px #3b82f680, 0 0 24px #3b82f640'
              : 'none',
          }}
        >
          <span
            className="text-sm font-bold"
            style={{ color: isEnergized ? '#3b82f6' : '#888' }}
          >
            K
          </span>
        </div>

        {/* Contact status */}
        <div className="text-[9px] font-mono mt-1" style={{ color: isEnergized ? '#3b82f6' : '#666' }}>
          {block.contacts}
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

export default RelayBlock;
