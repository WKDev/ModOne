/**
 * Coordinate Debugger Component
 *
 * Displays real-time coordinate information for debugging the coordinate system.
 * Shows mouse position in both screen and canvas coordinates.
 */

import { useState, useCallback, useEffect } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { screenToCanvas } from '../utils/canvasCoordinates';
import type { Position } from '../types';
import type { CanvasRef } from '../Canvas';

interface CoordinateDebuggerProps {
  canvasRef: React.RefObject<CanvasRef | null>;
}

export function CoordinateDebugger({ canvasRef }: CoordinateDebuggerProps) {
  const [mouseScreen, setMouseScreen] = useState<Position | null>(null);
  const [mouseCanvas, setMouseCanvas] = useState<Position | null>(null);
  const [clickScreen, setClickScreen] = useState<Position | null>(null);
  const [clickCanvas, setClickCanvas] = useState<Position | null>(null);

  const zoom = useCanvasStore((state) => state.zoom);
  const pan = useCanvasStore((state) => state.pan);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const container = canvasRef.current?.getContainer();
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const screenPos = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const canvasPos = screenToCanvas(screenPos, pan, zoom);

      setMouseScreen(screenPos);
      setMouseCanvas(canvasPos);
    },
    [canvasRef, pan, zoom]
  );

  const handleClick = useCallback(
    (event: MouseEvent) => {
      const container = canvasRef.current?.getContainer();
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const screenPos = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const canvasPos = screenToCanvas(screenPos, pan, zoom);

      setClickScreen(screenPos);
      setClickCanvas(canvasPos);
    },
    [canvasRef, pan, zoom]
  );

  useEffect(() => {
    const container = canvasRef.current?.getContainer();
    if (!container) return;

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick);
    };
  }, [canvasRef, handleMouseMove, handleClick]);

  return (
    <div className="absolute top-2 right-2 bg-black/80 text-white p-3 rounded-lg font-mono text-xs z-50 pointer-events-none select-none">
      <div className="font-bold mb-2 text-yellow-400">Coordinate Debug</div>

      <div className="mb-2">
        <div className="text-blue-400">Pan:</div>
        <div>x: {pan.x.toFixed(1)}, y: {pan.y.toFixed(1)}</div>
      </div>

      <div className="mb-2">
        <div className="text-blue-400">Zoom:</div>
        <div>{zoom.toFixed(3)}x</div>
      </div>

      <div className="mb-2">
        <div className="text-green-400">Mouse Screen:</div>
        <div>
          {mouseScreen
            ? `x: ${mouseScreen.x.toFixed(1)}, y: ${mouseScreen.y.toFixed(1)}`
            : 'N/A'}
        </div>
      </div>

      <div className="mb-2">
        <div className="text-green-400">Mouse Canvas:</div>
        <div>
          {mouseCanvas
            ? `x: ${mouseCanvas.x.toFixed(1)}, y: ${mouseCanvas.y.toFixed(1)}`
            : 'N/A'}
        </div>
      </div>

      {clickScreen && clickCanvas && (
        <>
          <div className="border-t border-gray-600 mt-2 pt-2">
            <div className="text-purple-400">Last Click Screen:</div>
            <div>x: {clickScreen.x.toFixed(1)}, y: {clickScreen.y.toFixed(1)}</div>
          </div>

          <div className="mt-1">
            <div className="text-purple-400">Last Click Canvas:</div>
            <div>x: {clickCanvas.x.toFixed(1)}, y: {clickCanvas.y.toFixed(1)}</div>
          </div>
        </>
      )}

      <div className="mt-2 text-gray-400 text-[10px]">
        Formula: canvas = (screen - pan) / zoom
      </div>
    </div>
  );
}
