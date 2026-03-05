import React, { useMemo } from 'react';
import type { SymbolDefinition, GraphicPrimitive, SymbolPin } from '@/types/symbol';

interface SymbolRendererProps {
  symbol: SymbolDefinition;
  /** Which unit to render (0 = first/only unit, or single-unit fallback) */
  selectedUnit?: number;
  /** Scale factor for rendering (default: 1) */
  scale?: number;
  /** Whether to show pin labels */
  showPinLabels?: boolean;
  /** CSS class for the outer SVG element */
  className?: string;
}

// Helper to convert polar coordinates to cartesian
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

// Helper to compute SVG arc path
const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number): string => {
  const start = polarToCartesian(x, y, radius, startAngle);
  const end = polarToCartesian(x, y, radius, endAngle);

  let angleDiff = endAngle - startAngle;
  // Normalize to [0, 360)
  while (angleDiff < 0) angleDiff += 360;
  while (angleDiff >= 360) angleDiff -= 360;

  const largeArcFlag = angleDiff > 180 ? "1" : "0";
  const sweepFlag = "1"; // Clockwise direction

  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, sweepFlag, end.x, end.y
  ].join(" ");
};

export const SymbolRenderer: React.FC<SymbolRendererProps> = ({
  symbol,
  selectedUnit = 0,
  scale = 1,
  showPinLabels = false,
  className,
}) => {

  const { graphics, pins } = useMemo(() => {
    if (symbol.units && symbol.units.length > 0) {
      // Use array index as per requirement "symbol.units[selectedUnit]"
      // Fallback to unit 0 if selectedUnit is out of bounds
      const unit = symbol.units[selectedUnit] || symbol.units[0];
      return { graphics: unit.graphics, pins: unit.pins };
    }
    return { graphics: symbol.graphics, pins: symbol.pins };
  }, [symbol, selectedUnit]);

  const renderPrimitive = (prim: GraphicPrimitive, key: number) => {
    switch (prim.kind) {
      case 'rect':
        return (
          <rect
            key={key}
            x={prim.x}
            y={prim.y}
            width={prim.width}
            height={prim.height}
            stroke={prim.stroke}
            fill={prim.fill}
            strokeWidth={prim.strokeWidth}
          />
        );
      case 'circle':
        return (
          <circle
            key={key}
            cx={prim.cx}
            cy={prim.cy}
            r={prim.r}
            stroke={prim.stroke}
            fill={prim.fill}
            strokeWidth={prim.strokeWidth}
          />
        );
      case 'polyline':
        return (
          <polyline
            key={key}
            points={prim.points.map(p => `${p.x},${p.y}`).join(' ')}
            stroke={prim.stroke}
            fill={prim.fill}
            strokeWidth={prim.strokeWidth}
          />
        );
      case 'arc':
        return (
          <path
            key={key}
            d={describeArc(prim.cx, prim.cy, prim.r, prim.startAngle, prim.endAngle)}
            stroke={prim.stroke}
            fill={prim.fill}
            strokeWidth={prim.strokeWidth}
          />
        );
      case 'text':
        return (
          <text
            key={key}
            x={prim.x}
            y={prim.y}
            fontSize={prim.fontSize}
            fontFamily={prim.fontFamily}
            fill={prim.fill}
            textAnchor={prim.anchor || 'start'}
          >
            {prim.text}
          </text>
        );
      default:
        return null;
    }
  };

  const renderPin = (pin: SymbolPin) => {
    const x1 = pin.position.x;
    const y1 = pin.position.y;
    let x2 = x1;
    let y2 = y1;

    switch (pin.orientation) {
      case 'right': x2 += pin.length; break;
      case 'left': x2 -= pin.length; break;
      case 'up': y2 -= pin.length; break;
      case 'down': y2 += pin.length; break;
    }


    let labelDx = 0;
    let labelDy = 0;
    let textAnchor: 'start' | 'middle' | 'end' = 'middle';

    switch (pin.orientation) {
      case 'right':
        labelDx = -5;
        labelDy = -5;
        textAnchor = 'end';
        break;
      case 'left':
        labelDx = 5;
        labelDy = -5;
        textAnchor = 'start';
        break;
      case 'up':
        labelDy = 12;
        break;
      case 'down':
        labelDy = -12;
        break;
    }

    return (
      <g key={pin.id}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#888"
          strokeWidth={1}
        />
        <circle
          cx={x2}
          cy={y2}
          r={3}
          fill="#888"
        />
        {showPinLabels && !pin.hidden && (
          <text
            x={x2}
            y={y2}
            dx={labelDx}
            dy={labelDy}
            fontSize={10}
            fill="#666"
            textAnchor={textAnchor}
            style={{ pointerEvents: 'none' }}
          >
            {pin.name}
          </text>
        )}
      </g>
    );
  };

  return (
    <svg
      width={symbol.width * scale}
      height={symbol.height * scale}
      viewBox={`0 0 ${symbol.width} ${symbol.height}`}
      className={className}
      style={{ overflow: 'visible' }}
    >

      {graphics.map((prim, i) => renderPrimitive(prim, i))}

      {pins.map((pin) => renderPin(pin))}
    </svg>
  );
};
