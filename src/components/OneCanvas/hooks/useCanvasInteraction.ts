/**
 * Canvas Interaction Hook
 *
 * Manages canvas pan, zoom, and interaction state including:
 * - Wheel zoom (Ctrl+wheel) towards cursor
 * - Wheel pan (regular wheel)
 * - Space+drag pan mode
 * - Trackpad pinch-to-zoom
 */

import { useCallback, useEffect, useRef } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import {
  useInteractionStore,
  selectIsPanning,
  selectCursor,
  selectIsIdle,
} from '../../../stores/interactionStore';
import {
  clamp,
  calculateZoomPan,
  getRelativeMousePosition,
  distance,
  midpoint,
} from '../utils/canvasCoordinates';
import type { Position } from '../types';

// ============================================================================
// Constants
// ============================================================================

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.0;
const WHEEL_ZOOM_FACTOR = 0.1;

// ============================================================================
// Types
// ============================================================================

interface UseCanvasInteractionOptions {
  /** Whether zoom is enabled */
  enableZoom?: boolean;
  /** Whether pan is enabled */
  enablePan?: boolean;
  /** Minimum zoom level */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
}

interface CanvasInteractionReturn {
  /** Whether space key is held */
  isSpaceHeld: boolean;
  /** Whether currently panning with mouse */
  isPanning: boolean;
  /** Cursor style based on current state */
  cursor: string;
  /** Pan-start handler wired from React mouse flow */
  handlePanMouseDown: (event: MouseEvent) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useCanvasInteraction(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseCanvasInteractionOptions = {}
) {
  const {
    enableZoom = true,
    enablePan = true,
    minZoom = MIN_ZOOM,
    maxZoom = MAX_ZOOM,
  } = options;

  // Store access
  const zoom = useCanvasStore((state) => state.zoom);
  const pan = useCanvasStore((state) => state.pan);
  const setZoom = useCanvasStore((state) => state.setZoom);
  const setPan = useCanvasStore((state) => state.setPan);
  const wireDrawing = useCanvasStore((state) => state.wireDrawing);

  // Interaction state
  const isSpaceHeld = useInteractionStore((s) => s.isSpaceHeld);
  const isPanning = useInteractionStore(selectIsPanning);
  const isIdle = useInteractionStore(selectIsIdle);
  const enterPanning = useInteractionStore((s) => s.enterPanning);
  const exitPanning = useInteractionStore((s) => s.exitPanning);
  const setSpaceHeld = useInteractionStore((s) => s.setSpaceHeld);

  // Refs for tracking drag state
  const dragStartRef = useRef<Position | null>(null);
  const panStartRef = useRef<Position | null>(null);

  // Refs for pinch-to-zoom
  const lastTouchDistanceRef = useRef<number | null>(null);
  const lastTouchCenterRef = useRef<Position | null>(null);

  // Cursor style based on state
  const cursor = useInteractionStore(selectCursor);

  // ========================================================================
  // Wheel Handler (Zoom & Pan)
  // ========================================================================

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const mousePos = getRelativeMousePosition(event, container);

      // Ctrl/Meta + wheel = zoom
      if ((event.ctrlKey || event.metaKey) && enableZoom) {
        // Calculate new zoom
        const zoomDelta = -event.deltaY * WHEEL_ZOOM_FACTOR;
        const zoomFactor = 1 + zoomDelta * 0.1;
        const newZoom = clamp(zoom * zoomFactor, minZoom, maxZoom);

        if (newZoom !== zoom) {
          // Calculate new pan to zoom towards cursor
          const newPan = calculateZoomPan(pan, zoom, newZoom, mousePos);
          setPan(newPan);
          setZoom(newZoom);
        }
      } else if (enablePan) {
        // Regular wheel = pan
        // Invert deltaY for natural scrolling direction
        setPan({
          x: pan.x - event.deltaX,
          y: pan.y - event.deltaY,
        });
      }
    },
    [containerRef, zoom, pan, setZoom, setPan, enableZoom, enablePan, minZoom, maxZoom]
  );

  // ========================================================================
  // Space + Drag Pan
  // ========================================================================

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Space' && !event.repeat) {
      event.preventDefault();
      setSpaceHeld(true);
    }
  }, [setSpaceHeld]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Space') {
      setSpaceHeld(false);
      exitPanning();
      dragStartRef.current = null;
      panStartRef.current = null;
    }
  }, [exitPanning, setSpaceHeld]);

  const handleMouseDown = useCallback(
    (event: MouseEvent) => {
      if (!enablePan) return;

      // Don't start panning during wire drawing
      if (wireDrawing) return;

      const modeType = useInteractionStore.getState().mode.type;
      if (!isIdle && modeType !== 'PANNING') return;
      if (modeType !== 'IDLE' && modeType !== 'PANNING') return;

      // Don't start panning if clicking on a block or port
      const target = event.target as HTMLElement;
      if (target.closest('[data-block-id]') || target.closest('[data-port-id]')) {
        return;
      }

      // Middle mouse button or Space+Left click for pan
      if (event.button === 1 || (isSpaceHeld && event.button === 0)) {
        event.preventDefault();
        enterPanning({ x: event.clientX, y: event.clientY }, { ...pan });
        dragStartRef.current = { x: event.clientX, y: event.clientY };
        panStartRef.current = { ...pan };
      }
    },
    [isSpaceHeld, pan, enablePan, wireDrawing, enterPanning, isIdle]
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isPanning || !dragStartRef.current || !panStartRef.current) return;

      const dx = event.clientX - dragStartRef.current.x;
      const dy = event.clientY - dragStartRef.current.y;

      setPan({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy,
      });
    },
    [isPanning, setPan]
  );

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      exitPanning();
      dragStartRef.current = null;
      panStartRef.current = null;
    }
  }, [exitPanning, isPanning]);

  // ========================================================================
  // Touch / Trackpad Pinch-to-Zoom
  // ========================================================================

  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (event.touches.length === 2) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const p1 = { x: touch1.clientX, y: touch1.clientY };
      const p2 = { x: touch2.clientX, y: touch2.clientY };

      lastTouchDistanceRef.current = distance(p1, p2);
      lastTouchCenterRef.current = midpoint(p1, p2);
    }
  }, []);

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (event.touches.length === 2 && enableZoom) {
        event.preventDefault();

        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const p1 = { x: touch1.clientX, y: touch1.clientY };
        const p2 = { x: touch2.clientX, y: touch2.clientY };

        const currentDistance = distance(p1, p2);
        const currentCenter = midpoint(p1, p2);

        if (lastTouchDistanceRef.current !== null && lastTouchCenterRef.current !== null) {
          const container = containerRef.current;
          if (!container) return;

          const rect = container.getBoundingClientRect();
          const relativeCenterPos = {
            x: currentCenter.x - rect.left,
            y: currentCenter.y - rect.top,
          };

          // Calculate zoom based on pinch distance change
          const scale = currentDistance / lastTouchDistanceRef.current;
          const newZoom = clamp(zoom * scale, minZoom, maxZoom);

          if (newZoom !== zoom) {
            const newPan = calculateZoomPan(pan, zoom, newZoom, relativeCenterPos);
            setPan(newPan);
            setZoom(newZoom);
          }
        }

        lastTouchDistanceRef.current = currentDistance;
        lastTouchCenterRef.current = currentCenter;
      }
    },
    [containerRef, zoom, pan, setZoom, setPan, enableZoom, minZoom, maxZoom]
  );

  const handleTouchEnd = useCallback(() => {
    lastTouchDistanceRef.current = null;
    lastTouchCenterRef.current = null;
  }, []);

  // ========================================================================
  // Gesture Events (Safari)
  // ========================================================================

  const handleGestureStart = useCallback((event: Event) => {
    event.preventDefault();
  }, []);

  const handleGestureChange = useCallback(
    (event: Event) => {
      event.preventDefault();
      if (!enableZoom) return;

      const gestureEvent = event as unknown as { scale: number; clientX: number; clientY: number };
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const centerPos = {
        x: gestureEvent.clientX - rect.left,
        y: gestureEvent.clientY - rect.top,
      };

      const newZoom = clamp(zoom * gestureEvent.scale, minZoom, maxZoom);

      if (newZoom !== zoom) {
        const newPan = calculateZoomPan(pan, zoom, newZoom, centerPos);
        setPan(newPan);
        setZoom(newZoom);
      }
    },
    [containerRef, zoom, pan, setZoom, setPan, enableZoom, minZoom, maxZoom]
  );

  // ========================================================================
  // Effect: Attach Event Listeners
  // ========================================================================

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Wheel events
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Keyboard events (on window)
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Mouse events
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Touch events
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    // Gesture events (Safari)
    container.addEventListener('gesturestart', handleGestureStart);
    container.addEventListener('gesturechange', handleGestureChange);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('gesturestart', handleGestureStart);
      container.removeEventListener('gesturechange', handleGestureChange);
    };
  }, [
    containerRef,
    handleWheel,
    handleKeyDown,
    handleKeyUp,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleGestureStart,
    handleGestureChange,
  ]);

  return {
    isSpaceHeld,
    isPanning,
    cursor,
    handlePanMouseDown: handleMouseDown,
  } as CanvasInteractionReturn;
}

export default useCanvasInteraction;
