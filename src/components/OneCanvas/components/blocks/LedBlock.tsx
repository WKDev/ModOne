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
      width={block.size.width}
      height={block.size.height}
    >
      {/* LED SVG */}
      <svg
        viewBox="0 0 40 60"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Anode lead (top) */}
        <line
          x1="20"
          y1="0"
          x2="20"
          y2="10"
          stroke="#9ca3af"
          strokeWidth="2"
        />

        {/* LED dome */}
        <ellipse
          cx="20"
          cy="22"
          rx="14"
          ry="12"
          fill={isPowered ? colors.glow : colors.base}
          stroke="#525252"
          strokeWidth="1"
          style={
            isPowered
              ? {
                  filter: `drop-shadow(0 0 8px ${colors.glow}) drop-shadow(0 0 16px ${colors.glow})`,
                }
              : undefined
          }
        />

        {/* LED body (rectangular part) */}
        <rect
          x="6"
          y="30"
          width="28"
          height="15"
          fill={isPowered ? colors.glow : colors.base}
          stroke="#525252"
          strokeWidth="1"
          rx="1"
          style={
            isPowered
              ? {
                  filter: `drop-shadow(0 0 4px ${colors.glow})`,
                }
              : undefined
          }
        />

        {/* LED base */}
        <rect
          x="10"
          y="45"
          width="20"
          height="5"
          fill="#525252"
        />

        {/* Cathode lead (bottom) */}
        <line
          x1="20"
          y1="50"
          x2="20"
          y2="60"
          stroke="#9ca3af"
          strokeWidth="2"
        />

        {/* Flat edge indicator (cathode side) */}
        <line
          x1="6"
          y1="28"
          x2="6"
          y2="35"
          stroke="#525252"
          strokeWidth="2"
        />
      </svg>

      {/* Glow overlay when powered */}
      {isPowered && (
        <div
          className="absolute inset-0 rounded pointer-events-none animate-pulse"
          style={{
            background: `radial-gradient(ellipse at center, ${colors.glow}40 0%, transparent 70%)`,
          }}
        />
      )}

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
