/**
 * Solenoid Valve Block Component
 *
 * Solenoid valve with coil symbol and valve type label.
 * Blue glow when energized.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { SolenoidValveBlock as SolenoidValveBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface SolenoidValveBlockProps {
  /** Block data */
  block: SolenoidValveBlockType;
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
 * Solenoid valve block with coil symbol and valve type indicator.
 */
export const SolenoidValveBlock = memo(function SolenoidValveBlock({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onDragStart,
  onStartWire,
  onEndWire,
  connectedPorts,
  portVoltages,
}: SolenoidValveBlockProps) {
  const isEnergized = block.energized ?? false;
  const borderColor = isEnergized ? '#3b82f6' : '#555';

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

        {/* Valve body */}
        <div
          className="flex flex-col items-center justify-center transition-all duration-200"
          style={{
            width: '52px',
            height: '36px',
            border: `2px solid ${borderColor}`,
            borderRadius: '3px',
            backgroundColor: isEnergized ? '#1e3a5f20' : 'transparent',
            boxShadow: isEnergized
              ? '0 0 12px #3b82f680, 0 0 24px #3b82f640'
              : 'none',
          }}
        >
          {/* Coil symbol (zigzag) */}
          <svg width="36" height="12" viewBox="0 0 36 12">
            <polyline
              points="2,6 6,2 10,10 14,2 18,10 22,2 26,10 30,2 34,6"
              fill="none"
              stroke={isEnergized ? '#3b82f6' : '#777'}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          {/* Valve type */}
          <span
            className="text-[9px] font-mono"
            style={{ color: isEnergized ? '#3b82f6' : '#666' }}
          >
            {block.valveType}
          </span>
        </div>

        {/* Energized indicator */}
        {isEnergized && (
          <div
            className="absolute inset-0 animate-pulse pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #3b82f615 0%, transparent 70%)',
            }}
          />
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

export default SolenoidValveBlock;
