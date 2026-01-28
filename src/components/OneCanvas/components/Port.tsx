/**
 * Port Component
 *
 * Visual representation of a connection point on a block.
 * Handles wire creation interactions and displays visual feedback.
 */

import { memo, useState, useCallback } from 'react';
import type { Port as PortType, PortPosition } from '../types';

// ============================================================================
// Types
// ============================================================================

interface PortProps {
  /** Port definition */
  port: PortType;
  /** Parent block ID */
  blockId: string;
  /** Parent block dimensions for positioning */
  blockSize: { width: number; height: number };
  /** Whether this port is connected to a wire */
  isConnected?: boolean;
  /** Current voltage at this port (for visual feedback) - reserved for future use */
  _voltage?: number;
  /** Callback when starting wire from this port */
  onStartWire?: (blockId: string, portId: string) => void;
  /** Callback when completing wire at this port */
  onEndWire?: (blockId: string, portId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PORT_SIZE = 8;
const PORT_OFFSET = -PORT_SIZE / 2; // Center the port on the edge

// Colors
const COLORS = {
  disconnected: '#6b7280', // gray-500
  connected: '#22c55e',    // green-500
  hover: '#3b82f6',        // blue-500
  active: '#ef4444',       // red-500
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate port position based on position enum and offset
 */
function getPortPosition(
  position: PortPosition,
  offset: number = 0.5,
  blockSize: { width: number; height: number }
): { x: number; y: number } {
  const { width, height } = blockSize;

  switch (position) {
    case 'top':
      return { x: width * offset + PORT_OFFSET, y: PORT_OFFSET };
    case 'bottom':
      return { x: width * offset + PORT_OFFSET, y: height + PORT_OFFSET };
    case 'left':
      return { x: PORT_OFFSET, y: height * offset + PORT_OFFSET };
    case 'right':
      return { x: width + PORT_OFFSET, y: height * offset + PORT_OFFSET };
    default:
      return { x: width / 2 + PORT_OFFSET, y: height / 2 + PORT_OFFSET };
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * Port component for wire connections on blocks.
 */
export const Port = memo(function Port({
  port,
  blockId,
  blockSize,
  isConnected = false,
  onStartWire,
  onEndWire,
}: PortProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);

  // Calculate position
  const position = getPortPosition(port.position, port.offset, blockSize);

  // Determine color based on state
  const getColor = () => {
    if (isActive) return COLORS.active;
    if (isHovered) return COLORS.hover;
    if (isConnected) return COLORS.connected;
    return COLORS.disconnected;
  };

  // Event handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsActive(true);
      onStartWire?.(blockId, port.id);
    },
    [blockId, port.id, onStartWire]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsActive(false);
      onEndWire?.(blockId, port.id);
    },
    [blockId, port.id, onEndWire]
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setIsActive(false);
  }, []);

  return (
    <div
      className="absolute z-10 transition-all duration-150"
      style={{
        left: position.x,
        top: position.y,
        width: PORT_SIZE,
        height: PORT_SIZE,
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-port-id={port.id}
      data-block-id={blockId}
      title={port.label}
    >
      {/* Port circle */}
      <div
        className="w-full h-full rounded-full cursor-crosshair transition-all duration-150"
        style={{
          backgroundColor: getColor(),
          boxShadow: isHovered || isActive
            ? `0 0 6px ${getColor()}`
            : 'none',
          transform: isHovered ? 'scale(1.3)' : 'scale(1)',
        }}
      />

      {/* Port label (shown on hover) */}
      {isHovered && (
        <div
          className="absolute whitespace-nowrap text-xs bg-neutral-800 text-white px-1 rounded pointer-events-none"
          style={{
            left: port.position === 'left' ? -4 : port.position === 'right' ? PORT_SIZE + 4 : '50%',
            top: port.position === 'top' ? -20 : port.position === 'bottom' ? PORT_SIZE + 4 : '50%',
            transform:
              port.position === 'top' || port.position === 'bottom'
                ? 'translateX(-50%)'
                : 'translateY(-50%)',
          }}
        >
          {port.label}
        </div>
      )}
    </div>
  );
});

export default Port;
