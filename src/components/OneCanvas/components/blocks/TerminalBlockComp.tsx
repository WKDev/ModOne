/**
 * Terminal Block Component
 *
 * Connection terminal for wire termination.
 * IEC symbol: Simple connection point.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { TerminalBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface TerminalBlockCompProps {
  /** Block data */
  block: TerminalBlockType;
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

// Terminal type colors
const TERMINAL_COLORS: Record<string, { bg: string; border: string }> = {
  feed_through: { bg: '#374151', border: '#6b7280' },
  ground: { bg: '#166534', border: '#22c55e' },
  fused: { bg: '#7c2d12', border: '#f97316' },
  disconnect: { bg: '#1e3a8a', border: '#3b82f6' },
};

// ============================================================================
// Component
// ============================================================================

/**
 * Terminal block component.
 */
export const TerminalBlockComp = memo(function TerminalBlockComp({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onDragStart,
  onStartWire,
  onEndWire,
  connectedPorts,
  portVoltages,
}: TerminalBlockCompProps) {
  const colors = TERMINAL_COLORS[block.terminalType] || TERMINAL_COLORS.feed_through;

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
        <div className="text-[9px] text-gray-400 font-mono absolute top-0 left-1/2 -translate-x-1/2">
          {block.designation}
        </div>

        {/* Terminal symbol */}
        <div
          className="flex items-center justify-center rounded-sm transition-all"
          style={{
            width: '28px',
            height: '28px',
            backgroundColor: colors.bg,
            border: `2px solid ${colors.border}`,
          }}
        >
          <span className="text-[10px] text-gray-300 font-bold">X</span>
        </div>

        {/* Wire size */}
        <div className="text-[8px] text-gray-500 font-mono mt-1">
          {block.wireSizeMm2}mm²
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

export default TerminalBlockComp;
