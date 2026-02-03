/**
 * Power Block Components
 *
 * Power supply blocks (+24V, +12V) with voltage labels.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { Power24vBlock, Power12vBlock } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface PowerBlockProps {
  /** Block data */
  block: Power24vBlock | Power12vBlock;
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
}

// ============================================================================
// Component
// ============================================================================

/**
 * Power supply block rendering +24V or +12V sources.
 */
export const PowerBlock = memo(function PowerBlock({
  block,
  isSelected,
  onSelect,
  onStartWire,
  onEndWire,
  connectedPorts,
}: PowerBlockProps) {
  const voltage = block.type === 'power_24v' ? '+24V' : '+12V';
  const bgColor = block.type === 'power_24v' ? 'bg-red-600' : 'bg-orange-500';

  return (
    <BlockWrapper
      blockId={block.id}
      isSelected={isSelected}
      onSelect={onSelect}
      width={block.size.width}
      height={block.size.height}
    >
      {/* Block body */}
      <div
        className={`
          w-full h-full rounded
          ${bgColor}
          flex items-center justify-center
          text-white font-bold text-sm
          select-none
        `}
      >
        {voltage}
      </div>

      {/* Output port (bottom) */}
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
