/**
 * Emergency Stop Block Component
 *
 * Red mushroom button symbol for emergency stop.
 * Red appearance when engaged (circuit broken).
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { EmergencyStopBlock as EmergencyStopBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface EmergencyStopBlockProps {
  /** Block data */
  block: EmergencyStopBlockType;
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
 * Emergency stop block with mushroom button symbol.
 */
export const EmergencyStopBlock = memo(function EmergencyStopBlock({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onDragStart,
  onStartWire,
  onEndWire,
  connectedPorts,
  portVoltages,
}: EmergencyStopBlockProps) {
  const isEngaged = block.engaged ?? false;

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

        {/* Mushroom button symbol */}
        <div
          className="rounded-full flex items-center justify-center transition-all duration-200 relative"
          style={{
            width: '48px',
            height: '48px',
            backgroundColor: isEngaged ? '#ef4444' : '#7f1d1d',
            border: `3px solid ${isEngaged ? '#ef4444' : '#991b1b'}`,
            boxShadow: isEngaged
              ? '0 0 16px #ef444480, 0 0 32px #ef444440'
              : '0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          {/* Cross symbol */}
          <svg width="24" height="24" viewBox="0 0 24 24">
            <line x1="6" y1="6" x2="18" y2="18" stroke={isEngaged ? '#fff' : '#dc2626'} strokeWidth="3" strokeLinecap="round" />
            <line x1="18" y1="6" x2="6" y2="18" stroke={isEngaged ? '#fff' : '#dc2626'} strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>

        {/* Status text */}
        <div className="text-[8px] font-mono mt-0.5" style={{ color: isEngaged ? '#ef4444' : '#666' }}>
          {isEngaged ? 'ENGAGED' : 'ES'}
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

export default EmergencyStopBlock;
