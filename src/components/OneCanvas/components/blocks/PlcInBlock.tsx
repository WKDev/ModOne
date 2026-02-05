/**
 * PLC Input Block Component
 *
 * PLC discrete input that sends circuit state to PLC.
 * Integrates with Modbus store for real-time discrete input writing.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import { usePlcInBlock } from '../../hooks/usePlcBlock';
import { formatDiscreteAddress, parsePlcAddress } from '../../utils/plcAddressUtils';
import type { PlcInBlock as PlcInBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface PlcInBlockProps {
  /** Block data */
  block: PlcInBlockType;
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
  /** Current input voltage */
  voltage?: number;
}

// ============================================================================
// Component
// ============================================================================

/**
 * PLC input (discrete input) block - senses voltage and reports to PLC.
 */
export const PlcInBlock = memo(function PlcInBlock({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onDragStart,
  onStartWire,
  onEndWire,
  connectedPorts,
  voltage = 0,
}: PlcInBlockProps) {
  // Parse address from string format (e.g., "DI:0x0001" -> 1)
  const parsedAddress = parsePlcAddress(block.address);
  const numericAddress = parsedAddress?.address ?? 0;

  // Use Modbus integration hook - writes to discrete input based on voltage
  const { inputState } = usePlcInBlock({
    address: numericAddress,
    thresholdVoltage: block.thresholdVoltage,
    inverted: block.inverted,
    voltage,
  });

  const finalState = inputState;

  // Format address for display
  const displayAddress = formatDiscreteAddress(numericAddress);

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
      {/* Block body */}
      <div
        className={`
          w-full h-full rounded border-2
          ${finalState ? 'bg-blue-900 border-blue-500' : 'bg-neutral-800 border-neutral-600'}
          flex flex-col items-center justify-center
          text-white text-xs select-none
        `}
      >
        {/* Input sensor symbol */}
        <svg
          viewBox="0 0 60 20"
          className="w-12 h-5"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Left line */}
          <line
            x1="0"
            y1="10"
            x2="15"
            y2="10"
            stroke={finalState ? '#3b82f6' : '#9ca3af'}
            strokeWidth="2"
          />
          {/* Sensor circle */}
          <circle
            cx="30"
            cy="10"
            r="8"
            fill="none"
            stroke={finalState ? '#3b82f6' : '#9ca3af'}
            strokeWidth="2"
          />
          {/* Arrow indicator */}
          <path
            d="M26 10 L34 10 M31 7 L34 10 L31 13"
            stroke={finalState ? '#3b82f6' : '#9ca3af'}
            strokeWidth="1.5"
            fill="none"
          />
          {/* Right line */}
          <line
            x1="45"
            y1="10"
            x2="60"
            y2="10"
            stroke={finalState ? '#3b82f6' : '#9ca3af'}
            strokeWidth="2"
          />
        </svg>

        {/* Address label */}
        <span className="text-[10px] text-neutral-400 mt-1">
          {displayAddress}
        </span>

        {/* Threshold indicator */}
        <span className="text-[8px] text-neutral-500">
          {`≥${block.thresholdVoltage}V`}
          {block.inverted && ' INV'}
        </span>
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

export default PlcInBlock;
