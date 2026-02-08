/**
 * Net Label Block Component
 *
 * Virtual connection point that electrically connects all net labels
 * with the same name. Used to avoid wire spaghetti for common signals
 * like +24V, GND, MOTOR_RUN, etc.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { NetLabelBlock as NetLabelBlockType, NetLabelDirection } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface NetLabelBlockProps {
  /** Block data */
  block: NetLabelBlockType;
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
// Helper Functions
// ============================================================================

/**
 * Get arrow path based on direction
 */
function getArrowPath(direction: NetLabelDirection): string {
  // Arrow pointing in the specified direction
  switch (direction) {
    case 'right':
      return 'M 0 4 L 6 4 L 4 2 M 6 4 L 4 6';
    case 'left':
      return 'M 6 4 L 0 4 L 2 2 M 0 4 L 2 6';
    case 'up':
      return 'M 4 6 L 4 0 L 2 2 M 4 0 L 6 2';
    case 'down':
      return 'M 4 0 L 4 6 L 2 4 M 4 6 L 6 4';
  }
}

/**
 * Get port position based on direction (port is opposite to arrow)
 */
function getPortPosition(direction: NetLabelDirection): 'left' | 'right' | 'top' | 'bottom' {
  switch (direction) {
    case 'right':
      return 'left';
    case 'left':
      return 'right';
    case 'up':
      return 'bottom';
    case 'down':
      return 'top';
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * Net label block for virtual electrical connections.
 * All net labels with the same name are electrically connected.
 */
export const NetLabelBlock = memo(function NetLabelBlock({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onDragStart,
  onStartWire,
  onEndWire,
  connectedPorts,
  portVoltages,
}: NetLabelBlockProps) {
  const direction = block.direction || 'right';
  const isHorizontal = direction === 'left' || direction === 'right';

  // Override port position based on direction
  const port = {
    ...block.ports[0],
    position: getPortPosition(direction),
  };

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
      <div
        className="w-full h-full flex items-center justify-center relative"
        style={{
          flexDirection: isHorizontal ? 'row' : 'column',
        }}
      >
        {/* Arrow indicator */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 8 8"
          className={`${direction === 'left' || direction === 'up' ? 'order-2' : 'order-0'}`}
          style={{
            margin: isHorizontal ? '0 2px' : '2px 0',
          }}
        >
          <path
            d={getArrowPath(direction)}
            stroke="#10b981"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Net name label */}
        <div
          className={`
            px-2 py-0.5 rounded text-[11px] font-mono font-medium
            bg-emerald-900/40 border border-emerald-600/50 text-emerald-400
            ${direction === 'left' || direction === 'up' ? 'order-0' : 'order-2'}
          `}
          style={{
            maxWidth: isHorizontal ? block.size.width - 20 : '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={block.description || block.netName}
        >
          {block.netName}
        </div>
      </div>

      {/* Port */}
      <Port
        port={port}
        blockId={block.id}
        blockSize={{ width: block.size.width, height: block.size.height }}
        isConnected={connectedPorts?.has(port.id)}
        voltage={portVoltages?.get(`${block.id}:${port.id}`)}
        onStartWire={onStartWire}
        onEndWire={onEndWire}
      />
    </BlockWrapper>
  );
});

export default NetLabelBlock;
