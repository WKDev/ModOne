/**
 * Block Renderer Component
 *
 * Dispatches to the appropriate block component based on block type.
 */

import { memo, useCallback } from 'react';
import type { Block } from '../types';
import { PowerBlock } from './blocks/PowerBlock';
import { GndBlock } from './blocks/GndBlock';
import { LedBlock } from './blocks/LedBlock';
import { PlcOutBlock } from './blocks/PlcOutBlock';
import { PlcInBlock } from './blocks/PlcInBlock';
import { ButtonBlock } from './blocks/ButtonBlock';
import { ScopeBlock } from './blocks/ScopeBlock';
// JunctionBlock is now rendered as SVG dot in the wire layer (JunctionDot.tsx)

// ============================================================================
// Types
// ============================================================================

interface BlockRendererProps {
  /** Block data */
  block: Block;
  /** Whether the block is selected */
  isSelected?: boolean;
  /** Selection handler */
  onSelect?: (blockId: string, addToSelection: boolean) => void;
  /** Wire start handler */
  onStartWire?: (blockId: string, portId: string) => void;
  /** Wire end handler */
  onEndWire?: (blockId: string, portId: string) => void;
  /** Drag start handler */
  onDragStart?: (blockId: string, event: React.MouseEvent) => void;
  /** Connected port IDs for this block */
  connectedPorts?: Set<string>;
  /** Simulation voltage at ports */
  portVoltages?: Map<string, number>;
  /** Button press handler (for button blocks) */
  onButtonPress?: (blockId: string) => void;
  /** Button release handler (for button blocks) */
  onButtonRelease?: (blockId: string) => void;
  /** PLC output active states (for plc_out blocks) */
  plcOutputStates?: Map<string, boolean>;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders the appropriate block component based on block type.
 */
export const BlockRenderer = memo(function BlockRenderer({
  block,
  isSelected,
  onSelect,
  onStartWire,
  onEndWire,
  onDragStart,
  connectedPorts,
  portVoltages,
  onButtonPress,
  onButtonRelease,
  plcOutputStates,
}: BlockRendererProps) {
  // Common props for all block types
  const commonProps = {
    isSelected,
    onSelect,
    onStartWire,
    onEndWire,
    connectedPorts,
  };

  // Position wrapper
  const style = {
    position: 'absolute' as const,
    left: block.position.x,
    top: block.position.y,
  };

  // Get voltage at first input port (for LED blocks)
  const getVoltage = () => {
    if (!portVoltages) return undefined;
    const inputPort = block.ports.find((p) => p.type === 'input');
    return inputPort ? portVoltages.get(`${block.id}:${inputPort.id}`) : undefined;
  };

  // Render based on block type
  const renderBlock = () => {
    switch (block.type) {
      case 'power_24v':
      case 'power_12v':
        return <PowerBlock block={block} {...commonProps} />;

      case 'gnd':
        return <GndBlock block={block} {...commonProps} />;

      case 'led':
        return <LedBlock block={block} {...commonProps} voltage={getVoltage()} />;

      case 'plc_out':
        return (
          <PlcOutBlock
            block={block}
            {...commonProps}
            isActiveOverride={plcOutputStates?.get(block.address)}
          />
        );

      case 'plc_in':
        return <PlcInBlock block={block} {...commonProps} voltage={getVoltage()} />;

      case 'button':
        return (
          <ButtonBlock
            block={block}
            {...commonProps}
            onPress={onButtonPress}
            onRelease={onButtonRelease}
          />
        );

      case 'scope':
        return (
          <ScopeBlock
            block={block}
            {...commonProps}
            channelVoltages={
              block.ports
                .slice(0, block.channels)
                .map((p) => portVoltages?.get(`${block.id}:${p.id}`) ?? 0)
            }
          />
        );

      default:
        // Unknown block type - render a placeholder
        return (
          <div
            className="w-16 h-16 bg-red-900 border-2 border-red-500 rounded flex items-center justify-center text-white text-xs"
          >
            Unknown
          </div>
        );
    }
  };

  // Handle mouse down for drag start
  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      onDragStart?.(block.id, event);
    },
    [block.id, onDragStart]
  );

  return (
    <div style={style} data-block-id={block.id} onMouseDown={handleMouseDown}>
      {renderBlock()}
    </div>
  );
});

export default BlockRenderer;
