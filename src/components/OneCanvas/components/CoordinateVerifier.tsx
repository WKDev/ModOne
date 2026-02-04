/**
 * Coordinate Verification Overlay
 *
 * Renders visual markers to verify coordinate system accuracy.
 * Shows where the system THINKS you clicked vs where you actually clicked.
 */

import { useState, useEffect, useRef } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { screenToCanvas, canvasToScreen } from '../utils/canvasCoordinates';
import type { Position } from '../types';
import type { CanvasRef } from '../Canvas';

interface CoordinateVerifierProps {
  canvasRef: React.RefObject<CanvasRef | null>;
}

interface ClickMarker {
  id: number;
  screenActual: Position; // Where user actually clicked (clientX/Y)
  screenCalculated: Position; // screenToCanvas -> canvasToScreen
  canvasCalculated: Position; // screenToCanvas result
  zoom: number;
  pan: Position;
}

export function CoordinateVerifier({ canvasRef }: CoordinateVerifierProps) {
  const [markers, setMarkers] = useState<ClickMarker[]>([]);
  const nextId = useRef(0);

  const zoom = useCanvasStore((state) => state.zoom);
  const pan = useCanvasStore((state) => state.pan);

  useEffect(() => {
    const container = canvasRef.current?.getContainer();
    if (!container) return;

    const handleClick = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();

      // Actual screen position (relative to container)
      const screenActual: Position = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      // Our coordinate transformation
      const canvasCalculated = screenToCanvas(screenActual, pan, zoom);
      const screenCalculated = canvasToScreen(canvasCalculated, pan, zoom);

      const marker: ClickMarker = {
        id: nextId.current++,
        screenActual,
        screenCalculated,
        canvasCalculated,
        zoom,
        pan: { ...pan },
      };

      setMarkers((prev) => [...prev.slice(-4), marker]); // Keep last 5
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [canvasRef, zoom, pan]);

  const handleClear = () => setMarkers([]);

  return (
    <>
      {/* Markers on the canvas (in transformed space) */}
      {markers.map((marker) => {
        return (
          <div key={marker.id}>
            {/* Red cross at canvas position (will be transformed) */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: marker.canvasCalculated.x - 10,
                top: marker.canvasCalculated.y - 10,
                width: 20,
                height: 20,
              }}
            >
              <div className="absolute w-full h-0.5 bg-red-500 top-1/2" />
              <div className="absolute h-full w-0.5 bg-red-500 left-1/2" />
            </div>
          </div>
        );
      })}

      {/* Info panel (fixed position, outside transform) */}
      <div
        className="fixed bottom-4 left-4 bg-black/90 text-white p-4 rounded-lg font-mono text-xs max-w-md z-50"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex justify-between items-center mb-2">
          <div className="font-bold text-yellow-400">Coordinate Verification</div>
          <button
            onClick={handleClear}
            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
          >
            Clear
          </button>
        </div>

        <div className="mb-2 text-gray-400 text-[10px]">
          Red crosses show where the system thinks you clicked.
          If misaligned, coordinates are broken!
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {markers.slice().reverse().map((marker) => {
            const errorX = Math.abs(marker.screenActual.x - marker.screenCalculated.x);
            const errorY = Math.abs(marker.screenActual.y - marker.screenCalculated.y);
            const totalError = Math.sqrt(errorX * errorX + errorY * errorY);
            const isAccurate = totalError < 1;

            return (
              <div
                key={marker.id}
                className={`border-l-4 pl-2 ${
                  isAccurate ? 'border-green-500' : 'border-red-500'
                }`}
              >
                <div className="text-[10px] text-gray-400">
                  Zoom: {marker.zoom.toFixed(2)}, Pan: ({marker.pan.x.toFixed(0)}, {marker.pan.y.toFixed(0)})
                </div>
                <div className={isAccurate ? 'text-green-400' : 'text-red-400'}>
                  Error: {totalError.toFixed(2)}px
                  {!isAccurate && ' ⚠️ MISALIGNED'}
                </div>
                <div className="text-[10px] space-y-1 mt-1">
                  <div>Screen Click: ({marker.screenActual.x.toFixed(1)}, {marker.screenActual.y.toFixed(1)})</div>
                  <div>Canvas: ({marker.canvasCalculated.x.toFixed(1)}, {marker.canvasCalculated.y.toFixed(1)})</div>
                  <div>Back to Screen: ({marker.screenCalculated.x.toFixed(1)}, {marker.screenCalculated.y.toFixed(1)})</div>
                  {!isAccurate && (
                    <div className="text-red-400">
                      Δ: ({errorX.toFixed(2)}, {errorY.toFixed(2)})
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {markers.length === 0 && (
          <div className="text-gray-500 text-center py-4">
            Click on the canvas to test coordinates
          </div>
        )}
      </div>
    </>
  );
}
