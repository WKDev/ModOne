/**
 * Selector Switch Block Component
 *
 * Rotary selector switch with position indicator.
 * Shows designation and current position number.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { SelectorSwitchBlock as SelectorSwitchBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface SelectorSwitchBlockProps {
  /** Block data */
  block: SelectorSwitchBlockType;
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
 * Selector switch with rotary position indicator.
 */
export const SelectorSwitchBlock = memo(function SelectorSwitchBlock({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onDragStart,
  onStartWire,
  onEndWire,
  connectedPorts,
  portVoltages,
}: SelectorSwitchBlockProps) {
  // Calculate indicator rotation based on position
  const totalPositions = block.positions;
  const angleRange = 180; // degrees of rotation range
  const angleStep = angleRange / (totalPositions - 1);
  const indicatorAngle = -90 + block.currentPosition * angleStep;

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

        {/* Switch body */}
        <svg width="48" height="48" viewBox="0 0 48 48">
          {/* Outer circle */}
          <circle cx="24" cy="24" r="20" fill="transparent" stroke="#555" strokeWidth="2" />
          {/* Position markers */}
          {Array.from({ length: totalPositions }).map((_, i) => {
            const angle = (-90 + i * angleStep) * (Math.PI / 180);
            const mx = 24 + 16 * Math.cos(angle);
            const my = 24 + 16 * Math.sin(angle);
            return (
              <circle
                key={i}
                cx={mx}
                cy={my}
                r="2.5"
                fill={i === block.currentPosition ? '#eab308' : '#444'}
              />
            );
          })}
          {/* Position indicator line */}
          <line
            x1="24"
            y1="24"
            x2={24 + 14 * Math.cos(indicatorAngle * (Math.PI / 180))}
            y2={24 + 14 * Math.sin(indicatorAngle * (Math.PI / 180))}
            stroke="#eab308"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Center dot */}
          <circle cx="24" cy="24" r="4" fill="#333" stroke="#666" strokeWidth="1" />
        </svg>

        {/* Position number */}
        <div className="text-[9px] font-mono" style={{ color: '#aaa' }}>
          POS {block.currentPosition + 1}/{totalPositions}
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

export default SelectorSwitchBlock;
