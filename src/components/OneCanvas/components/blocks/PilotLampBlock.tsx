/**
 * Pilot Lamp Block Component
 *
 * Industrial pilot lamp / indicator light.
 * Colored circle with glow effect when lit.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { PilotLampBlock as PilotLampBlockType, PilotLampColor } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface PilotLampBlockProps {
  /** Block data */
  block: PilotLampBlockType;
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
// Constants
// ============================================================================

const LAMP_COLORS: Record<PilotLampColor, { off: string; on: string; border: string }> = {
  red:    { off: '#2a1010', on: '#ef4444', border: '#7f1d1d' },
  green:  { off: '#102a10', on: '#22c55e', border: '#166534' },
  yellow: { off: '#2a2a10', on: '#eab308', border: '#854d0e' },
  blue:   { off: '#10102a', on: '#3b82f6', border: '#1e3a8a' },
  white:  { off: '#1a1a1a', on: '#f3f4f6', border: '#404040' },
};

// ============================================================================
// Component
// ============================================================================

/**
 * Pilot lamp with colored glow when lit.
 */
export const PilotLampBlock = memo(function PilotLampBlock({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onDragStart,
  onStartWire,
  onEndWire,
  connectedPorts,
  portVoltages,
}: PilotLampBlockProps) {
  const isLit = block.lit ?? false;
  const colors = LAMP_COLORS[block.lampColor] || LAMP_COLORS.red;

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

        {/* Pilot lamp body - industrial style with outer ring */}
        <div
          className="rounded-full flex items-center justify-center transition-all duration-200"
          style={{
            width: '44px',
            height: '44px',
            border: `3px solid ${isLit ? colors.on : colors.border}`,
            backgroundColor: isLit ? colors.on : colors.off,
            boxShadow: isLit
              ? `0 0 16px ${colors.on}80, 0 0 32px ${colors.on}40, inset 0 0 12px ${colors.on}30`
              : '0 2px 4px rgba(0,0,0,0.3), inset 0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          {/* Inner lens highlight */}
          {isLit && (
            <div
              className="rounded-full"
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: `${colors.on}50`,
                filter: 'blur(3px)',
              }}
            />
          )}
        </div>

        {/* Animated glow when lit */}
        {isLit && (
          <div
            className="absolute inset-0 rounded-full animate-pulse pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${colors.on}20 0%, transparent 70%)`,
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

export default PilotLampBlock;
