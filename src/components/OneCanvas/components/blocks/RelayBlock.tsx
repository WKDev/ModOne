/**
 * Relay Block Component
 *
 * Relay/contactor coil with NO/NC contact status indicator.
 * Shows energized state with blue glow.
 * Includes cross-reference indicator for related components.
 */

import { memo, useState } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { RelayBlock as RelayBlockType } from '../../types';
import type { CrossReferenceInfo } from '../../utils/crossReference';

// ============================================================================
// Types
// ============================================================================

interface RelayBlockProps {
  /** Block data */
  block: RelayBlockType;
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
  /** Cross-reference info for related components */
  crossReferenceInfo?: CrossReferenceInfo | null;
  /** Handler to navigate to a related component */
  onNavigateToBlock?: (blockId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Relay block with coil symbol and contact status indicator.
 */
export const RelayBlock = memo(function RelayBlock({
  block,
  isSelected,
  onSelect,
  onBlockClick,
  onDragStart,
  onStartWire,
  onEndWire,
  connectedPorts,
  portVoltages,
  crossReferenceInfo,
  onNavigateToBlock,
}: RelayBlockProps) {
  const isEnergized = block.energized ?? false;
  const [showXrefTooltip, setShowXrefTooltip] = useState(false);

  const hasReferences = crossReferenceInfo && crossReferenceInfo.relatedBlocks.length > 0;

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

        {/* Cross-reference indicator */}
        {hasReferences && (
          <div
            className="absolute -top-1 -right-1 z-10"
            onMouseEnter={() => setShowXrefTooltip(true)}
            onMouseLeave={() => setShowXrefTooltip(false)}
          >
            <div
              className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center cursor-pointer hover:bg-amber-400 transition-colors"
              title="Cross-references"
            >
              {crossReferenceInfo!.relatedBlocks.length}
            </div>

            {/* Tooltip */}
            {showXrefTooltip && (
              <div
                className="absolute right-0 top-5 bg-gray-900 border border-gray-700 rounded-md shadow-lg p-2 min-w-[160px] z-50"
                style={{ pointerEvents: 'auto' }}
              >
                <div className="text-[10px] text-gray-400 mb-1 font-semibold border-b border-gray-700 pb-1">
                  {crossReferenceInfo!.designation} References
                </div>
                <div className="space-y-1">
                  {crossReferenceInfo!.relatedBlocks.map((ref) => (
                    <button
                      key={ref.id}
                      className="w-full text-left text-[10px] text-gray-300 hover:text-white hover:bg-gray-800 px-1 py-0.5 rounded flex items-center justify-between gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToBlock?.(ref.id);
                      }}
                    >
                      <span>
                        {ref.label}
                        {ref.info && <span className="text-gray-500 ml-1">[{ref.info}]</span>}
                      </span>
                      <span className="text-gray-600 text-[9px]">
                        ({Math.round(ref.position.x)},{Math.round(ref.position.y)})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Coil symbol */}
        <div
          className="flex items-center justify-center rounded transition-all duration-200"
          style={{
            width: '44px',
            height: '28px',
            border: `2px solid ${isEnergized ? '#3b82f6' : '#555'}`,
            backgroundColor: isEnergized ? '#1e3a5f20' : 'transparent',
            boxShadow: isEnergized
              ? '0 0 12px #3b82f680, 0 0 24px #3b82f640'
              : 'none',
          }}
        >
          <span
            className="text-sm font-bold"
            style={{ color: isEnergized ? '#3b82f6' : '#888' }}
          >
            K
          </span>
        </div>

        {/* Contact status */}
        <div className="text-[9px] font-mono mt-1" style={{ color: isEnergized ? '#3b82f6' : '#666' }}>
          {block.contacts}
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

export default RelayBlock;
