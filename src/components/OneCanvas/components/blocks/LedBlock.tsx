/**
 * LED Block Component
 *
 * LED indicator with configurable color and glow effect when powered.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { LedBlock as LedBlockType, LedColor } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface LedBlockProps {
  /** Block data */
  block: LedBlockType;
  /** Whether the block is selected */
  isSelected?: boolean;
  /** Selection handler */
  onSelect?: (blockId: string, addToSelection: boolean) => void;
  /** Block click handler */
  onBlockClick?: (blockId: string, e: React.MouseEvent) => void;
  /** Wire start handler */
  onStartWire?: (blockId: string, portId: string) => void;
  /** Wire end handler */
  onEndWire?: (blockId: string, portId: string) => void;
  /** Connected port IDs */
  connectedPorts?: Set<string>;
  /** Current voltage (for glow effect) */
  voltage?: number;
}

// ============================================================================
// Constants
// ============================================================================

// Color mapping
const LED_COLORS: Record<LedColor, { base: string; glow: string }> = {
  red: { base: '#1a0f0f', glow: '#ef4444' },      // Almost black with red tint, bright red glow
  green: { base: '#0f1a0f', glow: '#22c55e' },    // Almost black with green tint, bright green glow
  blue: { base: '#0f0f1a', glow: '#3b82f6' },     // Almost black with blue tint, bright blue glow
  yellow: { base: '#1a1a0f', glow: '#eab308' },   // Almost black with yellow tint, bright yellow glow
  white: { base: '#1a1a1a', glow: '#f3f4f6' },    // Almost black, white glow
};

// ============================================================================
// Component
// ============================================================================

/**
 * LED block with configurable color and powered glow effect.
 */
export const LedBlock = memo(function LedBlock({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onStartWire,
  onEndWire,
  connectedPorts,
  voltage,
}: LedBlockProps) {
  const isPowered = block.lit || (voltage !== undefined && voltage > 0);
  const colors = LED_COLORS[block.color] || LED_COLORS.red;

  return (
    <BlockWrapper
      blockId={block.id}
      isSelected={isSelected}
      onSelect={onSelect}
      onBlockClick={onBlockClick}
      width={block.size.width}
      height={block.size.height}
    >
      {/* Simple circular LED indicator */}
      <div className="w-full h-full flex items-center justify-center relative">
        {/* Main LED circle */}
        <div
          className={`
            rounded-full transition-all duration-200
            ${isPowered ? 'shadow-2xl' : ''}
          `}
          style={{
            width: '48px',
            height: '48px',
            backgroundColor: isPowered ? colors.glow : colors.base,
            border: `3px solid ${isPowered ? colors.glow : '#404040'}`,
            boxShadow: isPowered
              ? `0 0 20px ${colors.glow}, 0 0 40px ${colors.glow}80, inset 0 0 20px ${colors.glow}40`
              : '0 2px 4px rgba(0,0,0,0.3), inset 0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          {/* Inner highlight when powered */}
          {isPowered && (
            <div
              className="absolute rounded-full"
              style={{
                width: '20px',
                height: '20px',
                top: '8px',
                left: '8px',
                backgroundColor: `${colors.glow}60`,
                filter: 'blur(4px)',
              }}
            />
          )}
        </div>

        {/* Animated glow pulse when powered */}
        {isPowered && (
          <div
            className="absolute inset-0 rounded-full animate-pulse pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${colors.glow}20 0%, transparent 70%)`,
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
          onStartWire={onStartWire}
          onEndWire={onEndWire}
        />
      ))}
    </BlockWrapper>
  );
});

export default LedBlock;
