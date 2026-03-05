import React, { memo, useEffect, useRef } from 'react';
import { GridBackground } from '../../components/OneCanvas/GridBackground';
import type { GraphicPrimitive, SymbolDefinition, SymbolPin } from '../../types/symbol';
import type { EditorAction, EditorState } from './SymbolEditor';

interface EditorCanvasProps {
  symbol: SymbolDefinition | null;
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  onAddPrimitive?: (prim: GraphicPrimitive) => void;
  onAddPin?: (pin: SymbolPin) => void;
  onDeleteSelected?: () => void;
}

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 8;
const ZOOM_FACTOR = 1.12;

function toArcPath(prim: Extract<GraphicPrimitive, { kind: 'arc' }>): string {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const startX = prim.cx + prim.r * Math.cos(toRad(prim.startAngle));
  const startY = prim.cy + prim.r * Math.sin(toRad(prim.startAngle));
  const endX = prim.cx + prim.r * Math.cos(toRad(prim.endAngle));
  const endY = prim.cy + prim.r * Math.sin(toRad(prim.endAngle));
  const sweep = ((prim.endAngle - prim.startAngle) % 360 + 360) % 360;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${startX} ${startY} A ${prim.r} ${prim.r} 0 ${largeArc} 1 ${endX} ${endY}`;
}

function renderPrimitive(prim: GraphicPrimitive, key: string): React.ReactNode {
  switch (prim.kind) {
    case 'rect':
      return <rect key={key} x={prim.x} y={prim.y} width={prim.width} height={prim.height} stroke="#88aaff" fill="none" strokeWidth={1.5} />;
    case 'circle':
      return <circle key={key} cx={prim.cx} cy={prim.cy} r={prim.r} stroke="#88aaff" fill="none" strokeWidth={1.5} />;
    case 'polyline':
      return <polyline key={key} points={prim.points.map((point) => `${point.x},${point.y}`).join(' ')} stroke="#88aaff" fill="none" strokeWidth={1.5} />;
    case 'arc':
      return <path key={key} d={toArcPath(prim)} stroke="#88aaff" fill="none" strokeWidth={1.5} />;
    case 'text':
      return (
        <text
          key={key}
          x={prim.x}
          y={prim.y}
          textAnchor={prim.anchor ?? 'start'}
          fontSize={prim.fontSize}
          fontFamily={prim.fontFamily}
          stroke="#88aaff"
          fill="none"
          strokeWidth={1.5}
        >
          {prim.text}
        </text>
      );
    default:
      return null;
  }
}

function renderPin(pin: SymbolPin): React.ReactNode {
  const markerLength = pin.length > 0 ? Math.min(pin.length, 12) : 12;
  let dx = 0;
  let dy = 0;

  if (pin.orientation === 'right') dx = markerLength;
  if (pin.orientation === 'left') dx = -markerLength;
  if (pin.orientation === 'up') dy = -markerLength;
  if (pin.orientation === 'down') dy = markerLength;

  return (
    <g key={pin.id}>
      <circle cx={pin.position.x} cy={pin.position.y} r={4} fill="#ff8844" />
      <line
        x1={pin.position.x}
        y1={pin.position.y}
        x2={pin.position.x + dx}
        y2={pin.position.y + dy}
        stroke="#ff8844"
        strokeWidth={1.5}
      />
    </g>
  );
}

export const EditorCanvas = memo(function EditorCanvas({
  symbol,
  state,
  dispatch,
  onDeleteSelected,
}: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panDragRef = useRef({ active: false, x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const pivotScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const delta = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, state.zoom * delta));
    const canvasPoint = {
      x: (pivotScreen.x - state.pan.x) / state.zoom,
      y: (pivotScreen.y - state.pan.y) / state.zoom,
    };
    const newPan = {
      x: pivotScreen.x - canvasPoint.x * newZoom,
      y: pivotScreen.y - canvasPoint.y * newZoom,
    };

    dispatch({ type: 'SET_ZOOM', zoom: newZoom });
    dispatch({ type: 'SET_PAN', pan: newPan });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1) {
      e.preventDefault();
      panDragRef.current = { active: true, x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button !== 0) {
      return;
    }

    switch (state.currentTool) {
      case 'select':
      case 'rect':
      case 'circle':
      case 'polyline':
      case 'arc':
      case 'text':
      case 'pin':
        console.debug('canvas click', state.currentTool);
        break;
      default:
        break;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!panDragRef.current.active) {
      return;
    }

    const dx = e.clientX - panDragRef.current.x;
    const dy = e.clientY - panDragRef.current.y;
    panDragRef.current = { active: true, x: e.clientX, y: e.clientY };
    dispatch({ type: 'PAN_BY', dx, dy });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1) {
      panDragRef.current.active = false;
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        onDeleteSelected?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDeleteSelected]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-neutral-900 select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <GridBackground zoom={state.zoom} />

      <div
        className="absolute top-0 left-0"
        style={{
          transformOrigin: 'top left',
          transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`,
        }}
      >
        <svg width={0} height={0} style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
          <line x1={-10} y1={0} x2={10} y2={0} stroke="#444" strokeWidth={1} />
          <line x1={0} y1={-10} x2={0} y2={10} stroke="#444" strokeWidth={1} />

          {symbol?.graphics.map((prim, index) => renderPrimitive(prim, `prim-${index}`))}
          {symbol?.pins.map((pin) => renderPin(pin))}
        </svg>
      </div>
    </div>
  );
});

export default EditorCanvas;
