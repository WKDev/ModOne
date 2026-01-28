/**
 * Scope Block Component
 *
 * Oscilloscope for monitoring voltage signals.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { ScopeBlock as ScopeBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface ScopeBlockProps {
  /** Block data */
  block: ScopeBlockType;
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
  /** Channel voltages for display */
  channelVoltages?: number[];
}

// ============================================================================
// Constants
// ============================================================================

const BLOCK_WIDTH = 100;
const BLOCK_HEIGHT = 80;

// Channel colors
const CHANNEL_COLORS = ['#eab308', '#22c55e', '#3b82f6', '#ef4444'];

// ============================================================================
// Component
// ============================================================================

/**
 * Oscilloscope block for monitoring voltage signals.
 */
export const ScopeBlock = memo(function ScopeBlock({
  block,
  isSelected,
  onSelect,
  onStartWire,
  onEndWire,
  connectedPorts,
  channelVoltages = [],
}: ScopeBlockProps) {
  return (
    <BlockWrapper
      blockId={block.id}
      isSelected={isSelected}
      onSelect={onSelect}
      width={BLOCK_WIDTH}
      height={BLOCK_HEIGHT}
    >
      {/* Block body */}
      <div
        className="
          w-full h-full rounded border-2 border-neutral-600
          bg-neutral-900
          flex flex-col
          text-white text-xs select-none
          overflow-hidden
        "
      >
        {/* Screen area */}
        <div className="flex-1 bg-black m-1 rounded relative">
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 60">
            {/* Vertical grid lines */}
            {[20, 40, 60, 80].map((x) => (
              <line
                key={`v${x}`}
                x1={x}
                y1="0"
                x2={x}
                y2="60"
                stroke="#1f2937"
                strokeWidth="0.5"
              />
            ))}
            {/* Horizontal grid lines */}
            {[15, 30, 45].map((y) => (
              <line
                key={`h${y}`}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="#1f2937"
                strokeWidth="0.5"
              />
            ))}
            {/* Center lines */}
            <line x1="50" y1="0" x2="50" y2="60" stroke="#374151" strokeWidth="1" />
            <line x1="0" y1="30" x2="100" y2="30" stroke="#374151" strokeWidth="1" />
          </svg>

          {/* Waveform placeholder - in real implementation this would show actual signals */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 60">
            {channelVoltages.map((voltage, i) => {
              if (i >= block.channels) return null;
              // Simple voltage level display (horizontal line)
              const y = 30 - (voltage / 24) * 25; // Scale to view
              return (
                <line
                  key={i}
                  x1="0"
                  y1={y}
                  x2="100"
                  y2={y}
                  stroke={CHANNEL_COLORS[i]}
                  strokeWidth="1.5"
                  strokeDasharray={i > 0 ? '4 2' : undefined}
                />
              );
            })}
          </svg>
        </div>

        {/* Status bar */}
        <div className="flex justify-between items-center px-1 py-0.5 bg-neutral-800 text-[8px] text-neutral-400">
          <span>{block.timeBase}ms/div</span>
          <span>{block.triggerMode.toUpperCase()}</span>
          <span>{block.channels}CH</span>
        </div>
      </div>

      {/* Ports (channel inputs on left) */}
      {block.ports.slice(0, block.channels).map((port) => (
        <Port
          key={port.id}
          port={port}
          blockId={block.id}
          blockSize={{ width: BLOCK_WIDTH, height: BLOCK_HEIGHT }}
          isConnected={connectedPorts?.has(port.id)}
          onStartWire={onStartWire}
          onEndWire={onEndWire}
        />
      ))}
    </BlockWrapper>
  );
});

export default ScopeBlock;
