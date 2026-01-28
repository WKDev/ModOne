/**
 * Button Block Component
 *
 * Physical button/switch with configurable mode and contact configuration.
 * Supports momentary (press-hold) and stationary (toggle) modes.
 * Contact configurations: 1a, 1b, 1a1b, 2a, 2b, 2a2b, 3a3b
 */

import { memo, useCallback, type KeyboardEvent } from 'react';
import { BlockWrapper } from './BlockWrapper';
import { Port } from '../Port';
import type { ButtonBlock as ButtonBlockType, ContactConfig, Port as PortType } from '../../types';

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

/**
 * Contact state for simulation.
 */
export interface ContactState {
  portId: string;
  type: 'no' | 'nc';
  isClosed: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const BLOCK_WIDTH = 60;
const BLOCK_HEIGHT = 60;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Determine if a port is NO (normally open) or NC (normally closed) based on its ID.
 */
function getPortContactType(port: PortType): 'no' | 'nc' | 'common' {
  const id = port.id.toLowerCase();
  if (id.includes('common') || id === 'c') return 'common';
  if (id.includes('nc') || id.endsWith('b')) return 'nc';
  return 'no';
}

/**
 * Calculate contact states based on button pressed state and configuration.
 */
export function getContactStates(
  ports: PortType[],
  isPressed: boolean
): ContactState[] {
  return ports
    .filter((port) => getPortContactType(port) !== 'common')
    .map((port) => {
      const contactType = getPortContactType(port);
      return {
        portId: port.id,
        type: contactType as 'no' | 'nc',
        // NO contacts: closed when pressed, open when released
        // NC contacts: open when pressed, closed when released
        isClosed: contactType === 'no' ? isPressed : !isPressed,
      };
    });
}

/**
 * Get the number of NO and NC contacts from config.
 */
function getContactCounts(config: ContactConfig): { no: number; nc: number } {
  switch (config) {
    case '1a':
      return { no: 1, nc: 0 };
    case '1b':
      return { no: 0, nc: 1 };
    case '1a1b':
      return { no: 1, nc: 1 };
    case '2a':
      return { no: 2, nc: 0 };
    case '2b':
      return { no: 0, nc: 2 };
    case '2a2b':
      return { no: 2, nc: 2 };
    case '3a3b':
      return { no: 3, nc: 3 };
    default:
      return { no: 1, nc: 0 };
  }
}

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
  const contactCounts = getContactCounts(block.contactConfig);
  const contactStates = getContactStates(block.ports, isPressed);

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

  // Handle mouse leave (release for momentary if pressed)
  const handleMouseLeave = useCallback(() => {
    if (isMomentary && isPressed) {
      onRelease?.(block.id);
    }
  }, [block.id, isMomentary, isPressed, onRelease]);

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

  // Handle keyboard activation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (isMomentary) {
          onPress?.(block.id);
        } else {
          if (isPressed) {
            onRelease?.(block.id);
          } else {
            onPress?.(block.id);
          }
        }
      }
    },
    [block.id, isMomentary, isPressed, onPress, onRelease]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if ((e.key === 'Enter' || e.key === ' ') && isMomentary) {
        e.preventDefault();
        e.stopPropagation();
        onRelease?.(block.id);
      }
    },
    [block.id, isMomentary, onRelease]
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
            ${isPressed
              ? 'bg-yellow-500 border-yellow-300 shadow-inner'
              : 'bg-neutral-700 border-neutral-500 shadow-md'
            }
            flex items-center justify-center
            transition-all duration-100
            hover:border-yellow-400
            active:scale-95
            focus:outline-none focus:ring-2 focus:ring-yellow-400
          `}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          tabIndex={0}
          role="button"
          aria-pressed={isPressed}
          aria-label={`${isMomentary ? 'Momentary' : 'Toggle'} button ${block.contactConfig}`}
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

        {/* Contact state indicators */}
        <div className="flex gap-1 mt-1">
          {/* NO contacts (normally open) */}
          {contactCounts.no > 0 && (
            <div className="flex gap-0.5" title="Normally Open contacts">
              {Array.from({ length: contactCounts.no }).map((_, i) => {
                const state = contactStates.find(
                  (s) => s.type === 'no' && s.portId.includes(`no${i + 1}`)
                );
                const isClosed = state?.isClosed ?? isPressed;
                return (
                  <div
                    key={`no-${i}`}
                    className={`
                      w-2 h-2 rounded-full border
                      ${isClosed
                        ? 'bg-green-500 border-green-400'
                        : 'bg-transparent border-red-400'
                      }
                      transition-colors duration-100
                    `}
                  />
                );
              })}
            </div>
          )}
          {/* NC contacts (normally closed) */}
          {contactCounts.nc > 0 && (
            <div className="flex gap-0.5" title="Normally Closed contacts">
              {Array.from({ length: contactCounts.nc }).map((_, i) => {
                const state = contactStates.find(
                  (s) => s.type === 'nc' && s.portId.includes(`nc${i + 1}`)
                );
                const isClosed = state?.isClosed ?? !isPressed;
                return (
                  <div
                    key={`nc-${i}`}
                    className={`
                      w-2 h-2 rounded-sm border
                      ${isClosed
                        ? 'bg-green-500 border-green-400'
                        : 'bg-transparent border-red-400'
                      }
                      transition-colors duration-100
                    `}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Mode and config label */}
        <span className="text-[8px] text-neutral-500">
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
