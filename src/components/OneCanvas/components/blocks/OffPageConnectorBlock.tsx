/**
 * Off-Page Connector Block Component
 *
 * Represents a signal that continues on another schematic page.
 * Outgoing: pentagon pointing right (signal leaves this page)
 * Incoming: pentagon pointing left (signal arrives on this page)
 * Dangling state shown with dashed border when no paired connector exists.
 */

import { memo } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { OffPageConnectorBlock as OffPageConnectorBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface OffPageConnectorBlockProps {
  /** Block data */
  block: OffPageConnectorBlockType;
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

const SHAPE_WIDTH = 80;
const SHAPE_HEIGHT = 32;
const ARROW_DEPTH = 10;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get SVG polygon points for the pentagon/arrow shape.
 * Outgoing: flat left side, arrow pointing right
 * Incoming: arrow pointing left, flat right side
 */
function getShapePoints(direction: 'outgoing' | 'incoming'): string {
  if (direction === 'outgoing') {
    // Flat left, arrow right: ▷
    return `0,0 ${SHAPE_WIDTH - ARROW_DEPTH},0 ${SHAPE_WIDTH},${SHAPE_HEIGHT / 2} ${SHAPE_WIDTH - ARROW_DEPTH},${SHAPE_HEIGHT} 0,${SHAPE_HEIGHT}`;
  }
  // Arrow left, flat right: ◁
  return `${ARROW_DEPTH},0 ${SHAPE_WIDTH},0 ${SHAPE_WIDTH},${SHAPE_HEIGHT} ${ARROW_DEPTH},${SHAPE_HEIGHT} 0,${SHAPE_HEIGHT / 2}`;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Off-page connector block for multi-page schematic cross-references.
 */
export const OffPageConnectorBlock = memo(function OffPageConnectorBlock({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onDragStart,
  onStartWire,
  onEndWire,
  connectedPorts,
  portVoltages,
}: OffPageConnectorBlockProps) {
  const direction = block.direction || 'outgoing';
  const isDangling = block.dangling !== false;

  // Port on the flat side (opposite to arrow)
  const port = {
    ...block.ports[0],
    position: (direction === 'outgoing' ? 'left' : 'right') as 'left' | 'right',
  };

  // Build target page label
  const targetLabel = block.targetPageNumber != null
    ? `→ P${block.targetPageNumber}`
    : '';

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
      <div className="w-full h-full relative">
        {/* SVG pentagon shape */}
        <svg
          width={SHAPE_WIDTH}
          height={SHAPE_HEIGHT}
          viewBox={`0 0 ${SHAPE_WIDTH} ${SHAPE_HEIGHT}`}
          className="absolute inset-0"
        >
          <polygon
            points={getShapePoints(direction)}
            fill={isDangling ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)'}
            stroke={isDangling ? '#ef4444' : '#3b82f6'}
            strokeWidth="1.5"
            strokeDasharray={isDangling ? '4 2' : 'none'}
          />
        </svg>

        {/* Signal label (centered) */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            paddingLeft: direction === 'incoming' ? ARROW_DEPTH + 2 : 4,
            paddingRight: direction === 'outgoing' ? ARROW_DEPTH + 2 : 4,
          }}
        >
          <span
            className={`text-[10px] font-mono font-medium truncate ${
              isDangling ? 'text-red-400' : 'text-blue-400'
            }`}
            title={`${block.signalLabel}${targetLabel ? ` ${targetLabel}` : ''}${isDangling ? ' (dangling)' : ''}`}
          >
            {block.signalLabel}
          </span>
        </div>

        {/* Target page indicator (small text below shape) */}
        {targetLabel && (
          <div
            className="absolute -bottom-3 left-0 right-0 text-center pointer-events-none"
          >
            <span className="text-[8px] text-neutral-500 font-mono">
              {targetLabel}
            </span>
          </div>
        )}
      </div>

      {/* Connection port */}
      <Port
        port={port}
        blockId={block.id}
        blockSize={{ width: block.size.width, height: block.size.height }}
        isConnected={connectedPorts?.has(port.id)}
        voltage={portVoltages?.get(`${block.id}:${port.id}`)}
        onStartWire={onStartWire}
        onEndWire={onEndWire}
      />
    </BlockWrapper>
  );
});

export default OffPageConnectorBlock;
