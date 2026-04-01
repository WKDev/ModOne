/**
 * SvgPinsLayer — Renders SymbolPin[] as SVG elements
 *
 * Each pin is drawn as:
 *   1. A line from the pin endpoint to the symbol body
 *   2. A small circle at the connection endpoint
 *   3. Pin name label (optional)
 *   4. Pin number label (optional)
 *
 * Pin orientation determines the direction the stub line points:
 *   right → stub goes LEFT  (pin is on the right edge, connects to left)
 *   left  → stub goes RIGHT
 *   up    → stub goes DOWN
 *   down  → stub goes UP
 */

import { memo } from 'react';
import type { SymbolPin, PinShape } from '../../../types/symbol';

// ============================================================================
// Types
// ============================================================================

export interface SvgPinsLayerProps {
  /** Pins to render */
  pins: SymbolPin[];
  /** Set of selected pin IDs */
  selectedIds?: Set<string>;
  /** Called when a pin is clicked */
  onSelect?: (id: string, multi: boolean) => void;
  /** Whether interactions are enabled (default: true) */
  interactive?: boolean;
  /** Whether pin numbers are shown (default: true) */
  showNumbers?: boolean;
  /** Whether pin names are shown (default: true) */
  showNames?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const PIN_COLOR = '#4ade80';           // Green for pins (electrically significant)
const PIN_SELECTED_COLOR = '#3b82f6'; // Blue when selected
const PIN_ENDPOINT_RADIUS = 1.5;       // Circle at the connection point
const PIN_FONT_SIZE = 6;               // Label font size in symbol units
const PIN_LABEL_OFFSET = 2;            // Gap between line end and label

// ============================================================================
// Helpers
// ============================================================================

interface PinGeometry {
  /** Connection endpoint (where wires attach) */
  endpointX: number;
  endpointY: number;
  /** Body attachment point (at symbol boundary) */
  bodyX: number;
  bodyY: number;
  /** Direction the name label goes (-1 or 1) */
  nameAnchor: 'start' | 'middle' | 'end';
  /** Direction the number label goes */
  numberAnchor: 'start' | 'middle' | 'end';
  /** Name label offset from body point */
  nameLabelX: number;
  nameLabelY: number;
  /** Number label offset from endpoint */
  numberLabelX: number;
  numberLabelY: number;
}

function getPinGeometry(pin: SymbolPin): PinGeometry {
  const { position, orientation, length } = pin;

  // Direction vectors for each orientation
  // The stub points FROM the symbol body TOWARD the connection endpoint
  const dirs: Record<typeof orientation, { dx: number; dy: number }> = {
    right: { dx: 1, dy: 0 },
    left: { dx: -1, dy: 0 },
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
  };

  const dir = dirs[orientation];
  const endpointX = position.x + dir.dx * length;
  const endpointY = position.y + dir.dy * length;

  // Name label placement (near the body)
  let nameAnchor: PinGeometry['nameAnchor'] = 'start';
  let nameLabelX = position.x;
  let nameLabelY = position.y;

  // Number label placement (near the endpoint)
  let numberAnchor: PinGeometry['numberAnchor'] = 'start';
  let numberLabelX = endpointX;
  let numberLabelY = endpointY;

  switch (orientation) {
    case 'right':
      nameAnchor = 'end';
      nameLabelX = position.x - PIN_LABEL_OFFSET;
      nameLabelY = position.y;
      numberAnchor = 'start';
      numberLabelX = endpointX + PIN_LABEL_OFFSET;
      numberLabelY = endpointY;
      break;
    case 'left':
      nameAnchor = 'start';
      nameLabelX = position.x + PIN_LABEL_OFFSET;
      nameLabelY = position.y;
      numberAnchor = 'end';
      numberLabelX = endpointX - PIN_LABEL_OFFSET;
      numberLabelY = endpointY;
      break;
    case 'up':
      nameAnchor = 'middle';
      nameLabelX = position.x;
      nameLabelY = position.y + PIN_LABEL_OFFSET + PIN_FONT_SIZE;
      numberAnchor = 'middle';
      numberLabelX = endpointX;
      numberLabelY = endpointY - PIN_LABEL_OFFSET;
      break;
    case 'down':
      nameAnchor = 'middle';
      nameLabelX = position.x;
      nameLabelY = position.y - PIN_LABEL_OFFSET;
      numberAnchor = 'middle';
      numberLabelX = endpointX;
      numberLabelY = endpointY + PIN_LABEL_OFFSET + PIN_FONT_SIZE;
      break;
  }

  return {
    endpointX,
    endpointY,
    bodyX: position.x,
    bodyY: position.y,
    nameAnchor,
    numberAnchor,
    nameLabelX,
    nameLabelY,
    numberLabelX,
    numberLabelY,
  };
}

/** Renders the shape decoration at the body end of a pin */
function PinShapeDecoration({
  shape,
  geo,
  color,
  orientation,
}: {
  shape: PinShape;
  geo: PinGeometry;
  color: string;
  orientation: SymbolPin['orientation'];
}) {
  const sw = 1;

  switch (shape) {
    case 'inverted': {
      // Small bubble (circle) near body
      const bubbleR = 2.5;
      const dirs = { right: { dx: -1, dy: 0 }, left: { dx: 1, dy: 0 }, up: { dx: 0, dy: 1 }, down: { dx: 0, dy: -1 } };
      const d = dirs[orientation];
      return (
        <circle
          cx={geo.bodyX + d.dx * bubbleR}
          cy={geo.bodyY + d.dy * bubbleR}
          r={bubbleR}
          fill="none"
          stroke={color}
          strokeWidth={sw}
        />
      );
    }
    case 'clock': {
      // Small triangle near body
      const size = 3;
      let points = '';
      switch (orientation) {
        case 'right':
          points = `${geo.bodyX},${geo.bodyY - size} ${geo.bodyX},${geo.bodyY + size} ${geo.bodyX + size},${geo.bodyY}`;
          break;
        case 'left':
          points = `${geo.bodyX},${geo.bodyY - size} ${geo.bodyX},${geo.bodyY + size} ${geo.bodyX - size},${geo.bodyY}`;
          break;
        case 'up':
          points = `${geo.bodyX - size},${geo.bodyY} ${geo.bodyX + size},${geo.bodyY} ${geo.bodyX},${geo.bodyY - size}`;
          break;
        case 'down':
          points = `${geo.bodyX - size},${geo.bodyY} ${geo.bodyX + size},${geo.bodyY} ${geo.bodyX},${geo.bodyY + size}`;
          break;
      }
      return (
        <polygon
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={sw}
        />
      );
    }
    default:
      return null;
  }
}

// ============================================================================
// Single pin component
// ============================================================================

interface SinglePinProps {
  pin: SymbolPin;
  isSelected: boolean;
  interactive: boolean;
  showNumbers: boolean;
  showNames: boolean;
  onSelect?: (id: string, multi: boolean) => void;
}

function SinglePin({ pin, isSelected, interactive, showNumbers, showNames, onSelect }: SinglePinProps) {
  if (pin.hidden) return null;

  const geo = getPinGeometry(pin);
  const isLocked = pin.locked === true;
  const strokeColor = isSelected ? PIN_SELECTED_COLOR : PIN_COLOR;
  // AC 9: Use pin.color as fill color; stroke retains default
  const fillColor = pin.color || strokeColor;
  const sw = 1; // stroke width in world units

  const handleClick = interactive && onSelect
    ? (e: React.MouseEvent) => { e.stopPropagation(); onSelect(pin.id, e.shiftKey); }
    : undefined;

  // AC 8: Locked pins show not-allowed cursor
  const cursorStyle = isLocked ? 'not-allowed' : 'pointer';

  // Hit area (wider transparent line for easier clicking)
  const hitArea = interactive ? (
    <line
      x1={geo.bodyX}
      y1={geo.bodyY}
      x2={geo.endpointX}
      y2={geo.endpointY}
      stroke="transparent"
      strokeWidth={8}
      style={{ cursor: cursorStyle }}
      onClick={handleClick}
      data-pin-id={pin.id}
    />
  ) : null;

  // AC 10: Build tooltip text from description
  const tooltipText = pin.description || undefined;

  return (
    <g data-testid={`pin-${pin.id}`} data-pin-id={pin.id}>
      {/* AC 10: SVG title element for native tooltip on hover */}
      {tooltipText && <title>{tooltipText}</title>}

      {/* Pin stub line */}
      <line
        x1={geo.bodyX}
        y1={geo.bodyY}
        x2={geo.endpointX}
        y2={geo.endpointY}
        stroke={strokeColor}
        strokeWidth={sw}
        strokeLinecap="round"
      />

      {/* Connection endpoint circle — AC 9: fill uses pin.color */}
      <circle
        cx={geo.endpointX}
        cy={geo.endpointY}
        r={PIN_ENDPOINT_RADIUS}
        fill={fillColor}
        stroke="none"
      />

      {/* Shape decoration */}
      <PinShapeDecoration
        shape={pin.shape}
        geo={geo}
        color={strokeColor}
        orientation={pin.orientation}
      />

      {/* AC 8: Lock icon (🔒 rendered as small SVG) for locked pins */}
      {isLocked && (
        <g transform={`translate(${geo.endpointX + 2.5}, ${geo.endpointY - 4})`}>
          {/* Lock body */}
          <rect x={0} y={2} width={4} height={3} rx={0.5} fill="#f59e0b" stroke="none" />
          {/* Lock shackle */}
          <path d="M0.8,2 V1.2 A1.2,1.2 0 0,1 3.2,1.2 V2" fill="none" stroke="#f59e0b" strokeWidth={0.6} />
        </g>
      )}

      {/* AC 11: Group label (small text above pin name) */}
      {pin.group && (
        <text
          x={geo.nameLabelX}
          y={geo.nameLabelY - PIN_FONT_SIZE - 1}
          fontSize={PIN_FONT_SIZE * 0.7}
          fontFamily="sans-serif"
          fill="#94a3b8"
          textAnchor={geo.nameAnchor}
          dominantBaseline="middle"
          style={{ pointerEvents: 'none', fontStyle: 'italic' }}
        >
          [{pin.group}]
        </text>
      )}

      {/* Pin name label */}
      {showNames && pin.nameVisible !== false && pin.name && (
        <text
          x={geo.nameLabelX}
          y={geo.nameLabelY}
          fontSize={PIN_FONT_SIZE}
          fontFamily="sans-serif"
          fill={strokeColor}
          textAnchor={geo.nameAnchor}
          dominantBaseline="middle"
          style={{ pointerEvents: 'none' }}
        >
          {pin.name}
        </text>
      )}

      {/* Pin number label */}
      {showNumbers && pin.numberVisible !== false && pin.number && (
        <text
          x={geo.numberLabelX}
          y={geo.numberLabelY}
          fontSize={PIN_FONT_SIZE * 0.85}
          fontFamily="monospace"
          fill={isSelected ? PIN_SELECTED_COLOR : '#86efac'}
          textAnchor={geo.numberAnchor}
          dominantBaseline="middle"
          style={{ pointerEvents: 'none' }}
        >
          {pin.number}
        </text>
      )}

      {/* Transparent hit area (on top) */}
      {hitArea}
    </g>
  );
}

// ============================================================================
// Main component
// ============================================================================

export const SvgPinsLayer = memo(function SvgPinsLayer({
  pins,
  selectedIds,
  onSelect,
  interactive = true,
  showNumbers = true,
  showNames = true,
}: SvgPinsLayerProps) {
  return (
    <g data-testid="svg-pins-layer">
      {pins.map((pin) => (
        <SinglePin
          key={pin.id}
          pin={pin}
          isSelected={selectedIds?.has(pin.id) ?? false}
          interactive={interactive}
          showNumbers={showNumbers}
          showNames={showNames}
          onSelect={onSelect}
        />
      ))}
    </g>
  );
});

export default SvgPinsLayer;
