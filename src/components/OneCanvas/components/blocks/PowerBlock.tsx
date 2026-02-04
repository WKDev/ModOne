/**
 * Power Source Block Component
 *
 * Unified renderer for all power source blocks: +24V, +12V, custom voltages, and GND.
 * Renders voltage labels for positive/negative polarity, ground symbol for ground.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { PowerSourceBlock } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface PowerBlockProps {
  /** Block data */
  block: PowerSourceBlock;
  /** Whether the block is selected */
  isSelected?: boolean;
  /** Block click handler */
  onBlockClick?: (blockId: string, e: React.MouseEvent) => void;
  /** Legacy selection handler */
  onSelect?: (blockId: string, addToSelection: boolean) => void;
  /** Wire start handler */
  onStartWire?: (blockId: string, portId: string) => void;
  /** Wire end handler */
  onEndWire?: (blockId: string, portId: string) => void;
  /** Connected port IDs */
  connectedPorts?: Set<string>;
}

// ============================================================================
// Helpers
// ============================================================================

function getDefaultLabel(voltage: number, polarity: string): string {
  if (polarity === 'ground') return 'GND';
  const sign = polarity === 'negative' ? '-' : '+';
  return `${sign}${voltage}V`;
}

function getVoltageColor(voltage: number): string {
  if (voltage >= 24) return 'bg-red-600';
  if (voltage >= 12) return 'bg-orange-500';
  if (voltage >= 5) return 'bg-yellow-600';
  return 'bg-neutral-600';
}

// ============================================================================
// Ground Symbol Sub-component
// ============================================================================

const GroundSymbol = memo(function GroundSymbol() {
  return (
    <svg
      viewBox="0 0 40 40"
      className="w-full h-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Vertical line from top */}
      <line
        x1="20" y1="0" x2="20" y2="12"
        stroke="currentColor" strokeWidth="2"
        className="text-neutral-400"
      />
      {/* Ground symbol lines */}
      <line x1="6" y1="12" x2="34" y2="12" stroke="currentColor" strokeWidth="3" className="text-neutral-800" />
      <line x1="10" y1="20" x2="30" y2="20" stroke="currentColor" strokeWidth="3" className="text-neutral-800" />
      <line x1="14" y1="28" x2="26" y2="28" stroke="currentColor" strokeWidth="3" className="text-neutral-800" />
      <line x1="18" y1="36" x2="22" y2="36" stroke="currentColor" strokeWidth="3" className="text-neutral-800" />
    </svg>
  );
});

// ============================================================================
// Component
// ============================================================================

export const PowerBlock = memo(function PowerBlock({
  block,
  isSelected,
  onBlockClick,
  onSelect,
  onStartWire,
  onEndWire,
  connectedPorts,
}: PowerBlockProps) {
  const displayLabel = block.label || getDefaultLabel(block.voltage, block.polarity);

  return (
    <BlockWrapper
      blockId={block.id}
      isSelected={isSelected}
      onBlockClick={onBlockClick}
      onSelect={onSelect}
      width={block.size.width}
      height={block.size.height}
    >
      {block.polarity === 'ground' ? (
        <GroundSymbol />
      ) : (
        <div
          className={`
            w-full h-full rounded
            ${getVoltageColor(block.voltage)}
            flex items-center justify-center
            text-white font-bold text-sm
            select-none
          `}
        >
          {displayLabel}
        </div>
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

export default PowerBlock;
