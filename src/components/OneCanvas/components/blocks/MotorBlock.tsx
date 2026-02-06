/**
 * Motor Block Component
 *
 * IEC motor symbol (circle with M) showing designation and power rating.
 * Green glow when running.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { MotorBlock as MotorBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface MotorBlockProps {
  /** Block data */
  block: MotorBlockType;
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
 * Motor block with IEC circle-M symbol and running state glow.
 */
export const MotorBlock = memo(function MotorBlock({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onDragStart,
  onStartWire,
  onEndWire,
  connectedPorts,
  portVoltages,
}: MotorBlockProps) {
  const isRunning = block.running ?? false;

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

        {/* Motor circle symbol */}
        <div
          className="rounded-full flex items-center justify-center transition-all duration-200"
          style={{
            width: '48px',
            height: '48px',
            border: `3px solid ${isRunning ? '#22c55e' : '#555'}`,
            backgroundColor: isRunning ? '#0f1a0f' : 'transparent',
            boxShadow: isRunning
              ? '0 0 16px #22c55e80, 0 0 32px #22c55e40'
              : 'none',
          }}
        >
          <span
            className="text-lg font-bold"
            style={{ color: isRunning ? '#22c55e' : '#888' }}
          >
            M
          </span>
        </div>

        {/* Power rating */}
        <div className="text-[9px] font-mono mt-0.5" style={{ color: isRunning ? '#22c55e' : '#666' }}>
          {block.powerKw}kW
        </div>

        {/* Animated glow when running */}
        {isRunning && (
          <div
            className="absolute inset-0 rounded-full animate-pulse pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #22c55e15 0%, transparent 70%)',
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

export default MotorBlock;
