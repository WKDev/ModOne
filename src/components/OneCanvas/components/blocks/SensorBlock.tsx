/**
 * Sensor Block Component
 *
 * Industrial sensor with type-specific symbol.
 * Supports proximity (inductive/capacitive), photoelectric, and limit switch types.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { SensorBlock as SensorBlockType, SensorType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface SensorBlockProps {
  /** Block data */
  block: SensorBlockType;
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

const SENSOR_LABELS: Record<SensorType, string> = {
  proximity_inductive: 'IND',
  proximity_capacitive: 'CAP',
  photoelectric: 'PE',
  limit_switch: 'LS',
};

// ============================================================================
// Sub-components
// ============================================================================

/** Proximity sensor symbol - square with inward arrows */
function ProximitySensorSymbol({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <rect x="4" y="4" width="28" height="28" rx="2" fill="transparent" stroke={color} strokeWidth="2" />
      {/* Sensing arrows pointing inward */}
      <line x1="12" y1="2" x2="12" y2="10" stroke={color} strokeWidth="1.5" />
      <polyline points="9,7 12,10 15,7" fill="none" stroke={color} strokeWidth="1.5" />
      <line x1="24" y1="2" x2="24" y2="10" stroke={color} strokeWidth="1.5" />
      <polyline points="21,7 24,10 27,7" fill="none" stroke={color} strokeWidth="1.5" />
      {/* Active dot */}
      {active && <circle cx="18" cy="18" r="4" fill={color} opacity="0.8" />}
    </svg>
  );
}

/** Photoelectric sensor symbol - square with light beam */
function PhotoelectricSensorSymbol({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <rect x="4" y="4" width="28" height="28" rx="2" fill="transparent" stroke={color} strokeWidth="2" />
      {/* Light beam lines */}
      <line x1="10" y1="18" x2="18" y2="18" stroke={color} strokeWidth="1.5" />
      <line x1="14" y1="13" x2="20" y2="18" stroke={color} strokeWidth="1" />
      <line x1="14" y1="23" x2="20" y2="18" stroke={color} strokeWidth="1" />
      {/* Receiver */}
      <line x1="22" y1="14" x2="22" y2="22" stroke={color} strokeWidth="2" />
      {/* Active dot */}
      {active && <circle cx="18" cy="18" r="3" fill={color} opacity="0.6" />}
    </svg>
  );
}

/** Limit switch symbol */
function LimitSwitchSymbol({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <rect x="4" y="4" width="28" height="28" rx="2" fill="transparent" stroke={color} strokeWidth="2" />
      {/* Switch lever */}
      <circle cx="12" cy="24" r="2" fill={color} />
      <line
        x1="12" y1="24"
        x2={active ? '26' : '24'}
        y2={active ? '18' : '12'}
        stroke={color} strokeWidth="2" strokeLinecap="round"
      />
      <circle cx={active ? 26 : 24} cy={active ? 18 : 12} r="2" fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * Sensor block with type-specific symbol and active state indication.
 */
export const SensorBlock = memo(function SensorBlock({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onDragStart,
  onStartWire,
  onEndWire,
  connectedPorts,
  portVoltages,
}: SensorBlockProps) {
  const isDetecting = block.detecting ?? false;
  const activeColor = isDetecting ? '#22c55e' : '#777';

  const renderSymbol = () => {
    switch (block.sensorType) {
      case 'proximity_inductive':
      case 'proximity_capacitive':
        return <ProximitySensorSymbol active={isDetecting} color={activeColor} />;
      case 'photoelectric':
        return <PhotoelectricSensorSymbol active={isDetecting} color={activeColor} />;
      case 'limit_switch':
        return <LimitSwitchSymbol active={isDetecting} color={activeColor} />;
    }
  };

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

        {/* Sensor symbol */}
        <div
          className="transition-all duration-200"
          style={{
            boxShadow: isDetecting ? '0 0 12px #22c55e60' : 'none',
          }}
        >
          {renderSymbol()}
        </div>

        {/* Type indicator + output type */}
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[8px] font-mono" style={{ color: isDetecting ? '#22c55e' : '#666' }}>
            {SENSOR_LABELS[block.sensorType]}
          </span>
          <span className="text-[8px] font-mono" style={{ color: '#555' }}>
            {block.outputType}
          </span>
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

export default SensorBlock;
