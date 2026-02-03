/**
 * PLC Output Block Component
 *
 * PLC coil/output that controls circuit based on PLC state.
 * Integrates with Modbus store for real-time coil value reading.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import { usePlcOutBlock } from '../../hooks/usePlcBlock';
import { formatCoilAddress, parsePlcAddress } from '../../utils/plcAddressUtils';
import type { PlcOutBlock as PlcOutBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface PlcOutBlockProps {
  /** Block data */
  block: PlcOutBlockType;
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
  /** Override active state (if not using Modbus integration) */
  isActiveOverride?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * PLC output (coil) block - acts as a relay controlled by PLC.
 */
export const PlcOutBlock = memo(function PlcOutBlock({
  block,
  isSelected,
  onSelect,
  onStartWire,
  onEndWire,
  connectedPorts,
  isActiveOverride,
}: PlcOutBlockProps) {
  // Parse address from string format (e.g., "C:0x0001" -> 1)
  const parsedAddress = parsePlcAddress(block.address);
  const numericAddress = parsedAddress?.address ?? 0;

  // Use Modbus integration hook
  const { coilValue, isConnected } = usePlcOutBlock({
    address: numericAddress,
    normallyOpen: block.normallyOpen,
    inverted: block.inverted,
  });

  // Use override if provided, otherwise use Modbus value
  const isActive = isActiveOverride ?? coilValue ?? false;
  const isClosed = isConnected;

  // Format address for display
  const displayAddress = formatCoilAddress(numericAddress);

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
          w-full h-full rounded border-2
          ${isActive ? 'bg-green-900 border-green-500' : 'bg-neutral-800 border-neutral-600'}
          flex flex-col items-center justify-center
          text-white text-xs select-none
        `}
      >
        {/* Coil symbol */}
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
            x2="10"
            y2="10"
            stroke={isActive ? '#22c55e' : '#9ca3af'}
            strokeWidth="2"
          />
          {/* Contact switch */}
          <line
            x1="10"
            y1="10"
            x2={isClosed ? '50' : '45'}
            y2={isClosed ? '10' : '3'}
            stroke={isActive ? '#22c55e' : '#9ca3af'}
            strokeWidth="2"
          />
          {/* Right line */}
          <line
            x1="50"
            y1="10"
            x2="60"
            y2="10"
            stroke={isActive ? '#22c55e' : '#9ca3af'}
            strokeWidth="2"
          />
          {/* Contact points */}
          <circle cx="10" cy="10" r="2" fill={isActive ? '#22c55e' : '#9ca3af'} />
          <circle cx="50" cy="10" r="2" fill={isActive ? '#22c55e' : '#9ca3af'} />
        </svg>

        {/* Address label */}
        <span className="text-[10px] text-neutral-400 mt-1">
          {displayAddress}
        </span>

        {/* NO/NC indicator */}
        <span className="text-[8px] text-neutral-500">
          {block.normallyOpen ? 'NO' : 'NC'}
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

export default PlcOutBlock;
