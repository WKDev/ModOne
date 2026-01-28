/**
 * Button Block Component
 *
 * Physical button/switch with configurable mode and contact configuration.
 */

import { memo, useCallback } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { ButtonBlock as ButtonBlockType } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface ButtonBlockProps {
  /** Block data */
  block: ButtonBlockType;
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
  /** Button press handler */
  onPress?: (blockId: string) => void;
  /** Button release handler */
  onRelease?: (blockId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const BLOCK_WIDTH = 60;
const BLOCK_HEIGHT = 60;

// ============================================================================
// Component
// ============================================================================

/**
 * Button/switch block with momentary or stationary mode.
 */
export const ButtonBlock = memo(function ButtonBlock({
  block,
  isSelected,
  onSelect,
  onStartWire,
  onEndWire,
  connectedPorts,
  onPress,
  onRelease,
}: ButtonBlockProps) {
  const isPressed = block.pressed ?? false;
  const isMomentary = block.mode === 'momentary';

  // Handle mouse down (press)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isMomentary) {
        onPress?.(block.id);
      }
    },
    [block.id, isMomentary, onPress]
  );

  // Handle mouse up (release for momentary)
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isMomentary) {
        onRelease?.(block.id);
      }
    },
    [block.id, isMomentary, onRelease]
  );

  // Handle click (toggle for stationary)
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isMomentary) {
        if (isPressed) {
          onRelease?.(block.id);
        } else {
          onPress?.(block.id);
        }
      }
    },
    [block.id, isMomentary, isPressed, onPress, onRelease]
  );

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
        className={`
          w-full h-full rounded border-2
          ${isPressed ? 'bg-yellow-900 border-yellow-500' : 'bg-neutral-800 border-neutral-600'}
          flex flex-col items-center justify-center
          text-white text-xs select-none
        `}
      >
        {/* Button symbol */}
        <div
          className={`
            w-10 h-10 rounded-full border-2 cursor-pointer
            ${isPressed ? 'bg-yellow-500 border-yellow-300' : 'bg-neutral-700 border-neutral-500'}
            flex items-center justify-center
            transition-all duration-100
            hover:border-yellow-400
            active:scale-95
          `}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={isMomentary && isPressed ? () => onRelease?.(block.id) : undefined}
          onClick={handleClick}
        >
          {/* Button indicator */}
          <div
            className={`
              w-6 h-6 rounded-full
              ${isPressed ? 'bg-yellow-300' : 'bg-neutral-600'}
              transition-colors duration-100
            `}
          />
        </div>

        {/* Mode and config label */}
        <span className="text-[8px] text-neutral-500 mt-1">
          {isMomentary ? 'MOM' : 'STAT'} · {block.contactConfig.toUpperCase()}
        </span>
      </div>

      {/* Ports */}
      {block.ports.map((port) => (
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

export default ButtonBlock;
