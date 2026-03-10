import { forwardRef, useEffect, useRef, type ForwardedRef } from 'react';
import { Application } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { useLadderUIStore } from '../../../stores/ladderUIStore';
import {
  createLadderLayerManager,
  type LadderLayerManager,
} from './LadderLayerManager';
import { LadderEventBridge } from './LadderEventBridge';

export interface LadderPixiCanvasHostRef {
  app: Application;
  viewport: Viewport;
  layers: LadderLayerManager;
  eventBridge: LadderEventBridge;
  /**
   * Update the viewport's world size and clamping based on grid configuration.
   */
  updateWorldConfig: (gridWidth: number) => void;
  /**
   * Scroll the viewport so that a grid cell is visible.
   * Used when keyboard navigation moves the cursor outside the visible area.
   */
  scrollToCell: (row: number, col: number, cellWidth: number, cellHeight: number) => void;
}

interface LadderPixiCanvasHostProps {
  className?: string;
  onReady?: (ref: LadderPixiCanvasHostRef) => void;
}

function setHostRef(
  ref: ForwardedRef<LadderPixiCanvasHostRef>,
  value: LadderPixiCanvasHostRef | null
): void {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }

  if (ref) {
    ref.current = value;
  }
}

/**
 * LadderPixiCanvasHost
 *
 * Hosts the Pixi.js application for the ladder editor canvas.
 *
 * Scroll behaviour: VERTICAL and HORIZONTAL.
 * - Mouse wheel -> vertical scroll only.
 * - Shift + Mouse wheel -> horizontal scroll.
 * - Viewport X is clamped to [0, gridWidth] minus screen width.
 * - scrollToCell() keeps the cursor visible when keyboard navigation
 *   moves it outside the current viewport.
 */
export const LadderPixiCanvasHost = forwardRef<
  LadderPixiCanvasHostRef,
  LadderPixiCanvasHostProps
>(function LadderPixiCanvasHost({ className, onReady }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initRef = useRef(false);
  const onReadyRef = useRef<LadderPixiCanvasHostProps['onReady']>(onReady);

  // Internal viewport ref
  const viewportRef = useRef<Viewport | null>(null);
  const appRef = useRef<Application | null>(null);

  // Access UI store actions
  const setViewportY = useLadderUIStore((state) => state.setViewportY);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (initRef.current) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    initRef.current = true;

    let cancelled = false;
    let app: Application | null = null;
    let viewport: Viewport | null = null;
    let layers: LadderLayerManager | null = null;
    let eventBridge: LadderEventBridge | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let wheelHandler: ((e: WheelEvent) => void) | null = null;

    const initialize = async () => {
      const nextApp = new Application();

      try {
        await nextApp.init({
          preference: 'webgpu',
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          resizeTo: container,
        });

        if (cancelled) {
          nextApp.destroy(true, { children: true, texture: true });
          return;
        }

        container.appendChild(nextApp.canvas);

        // ----------------------------------------------------------------
        // Viewport setup
        // ----------------------------------------------------------------
        const nextViewport = new Viewport({
          worldWidth: container.clientWidth,
          worldHeight: 20000, // tall virtual world for vertical scroll
          events: nextApp.renderer.events,
        });

        nextApp.stage.addChild(nextViewport);
        viewportRef.current = nextViewport;
        appRef.current = nextApp;

        // Initialize viewportY in store
        setViewportY(0);

        // ----------------------------------------------------------------
        // Native wheel handler
        // ----------------------------------------------------------------
        wheelHandler = (e: WheelEvent) => {
          e.preventDefault();
          if (!nextViewport) return;

          let deltaX = 0;
          let deltaY = 0;

          // Shift + Wheel -> Horizontal scroll
          if (e.shiftKey) {
            deltaX = e.deltaY; // most mice use vertical wheel for horizontal with shift
          } else {
            deltaY = e.deltaY;
          }

          // Convert wheel delta to pixels based on deltaMode
          let pixelDeltaX: number;
          let pixelDeltaY: number;

          switch (e.deltaMode) {
            case 1: // lines
              pixelDeltaX = deltaX * 40;
              pixelDeltaY = deltaY * 40;
              break;
            case 2: // pages
              pixelDeltaX = deltaX * nextApp.screen.width;
              pixelDeltaY = deltaY * nextApp.screen.height;
              break;
            default: // pixels (mode 0)
              pixelDeltaX = deltaX;
              pixelDeltaY = deltaY;
              break;
          }

          // Apply vertical scroll
          const maxScrollY = Math.max(0, nextViewport.worldHeight - nextApp.screen.height);
          const newY = Math.min(0, Math.max(-maxScrollY, nextViewport.y - pixelDeltaY));
          nextViewport.y = newY;
          setViewportY(-newY);

          // Apply horizontal scroll (if enabled by worldWidth > screenWidth)
          const maxScrollX = Math.max(0, nextViewport.worldWidth - nextApp.screen.width);
          const newX = Math.min(0, Math.max(-maxScrollX, nextViewport.x - pixelDeltaX));
          nextViewport.x = newX;
        };
        container.addEventListener('wheel', wheelHandler, { passive: false });

        // ----------------------------------------------------------------
        // ResizeObserver
        // ----------------------------------------------------------------
        resizeObserver = new ResizeObserver(() => {
          if (!nextViewport) return;
          // Clamp X and Y after resize to avoid being out of bounds
          const maxScrollX = Math.max(0, nextViewport.worldWidth - nextApp.screen.width);
          const maxScrollY = Math.max(0, nextViewport.worldHeight - nextApp.screen.height);
          nextViewport.x = Math.max(-maxScrollX, Math.min(0, nextViewport.x));
          nextViewport.y = Math.max(-maxScrollY, Math.min(0, nextViewport.y));
          setViewportY(-nextViewport.y);
        });
        resizeObserver.observe(container);

        const nextLayers = createLadderLayerManager(nextViewport);
        const nextEventBridge = new LadderEventBridge(nextViewport);
        nextEventBridge.attach();

        /** Update world width from gridConfig */
        const updateWorldConfig = (gridWidth: number) => {
          if (!nextViewport) return;
          // Add some padding to Ensure the neutral rail isn't right on the edge
          const padding = 40;
          nextViewport.worldWidth = gridWidth + padding;

          // Clamp X immediately
          const maxScrollX = Math.max(0, nextViewport.worldWidth - nextApp.screen.width);
          nextViewport.x = Math.max(-maxScrollX, Math.min(0, nextViewport.x));
        };

        /** Scroll viewport so that the given cell row/col is visible, with padding. */
        const scrollToCell = (row: number, col: number, cellWidth: number, cellHeight: number) => {
          if (!nextViewport || !nextApp) return;

          const screenW = nextApp.screen.width;
          const screenH = nextApp.screen.height;
          const PADDING = 40;

          // Vertical scroll
          const cellTop = row * cellHeight;
          const cellBottom = cellTop + cellHeight;
          const worldTop = -nextViewport.y;
          const worldBottom = worldTop + screenH;

          let newWorldTop = worldTop;
          if (cellTop - PADDING < worldTop) {
            newWorldTop = Math.max(0, cellTop - PADDING);
          } else if (cellBottom + PADDING > worldBottom) {
            newWorldTop = cellBottom + PADDING - screenH;
          }

          if (newWorldTop !== worldTop) {
            const maxScrollY = Math.max(0, nextViewport.worldHeight - screenH);
            const finalWorldTop = Math.min(maxScrollY, Math.max(0, newWorldTop));
            nextViewport.y = -finalWorldTop;
            setViewportY(finalWorldTop);
          }

          // Horizontal scroll
          const cellLeft = col * cellWidth;
          const cellRight = cellLeft + cellWidth;
          const worldLeft = -nextViewport.x;
          const worldRight = worldLeft + screenW;

          let newWorldLeft = worldLeft;
          if (cellLeft - PADDING < worldLeft) {
            newWorldLeft = Math.max(0, cellLeft - PADDING);
          } else if (cellRight + PADDING > worldRight) {
            newWorldLeft = cellRight + PADDING - screenW;
          }

          if (newWorldLeft !== worldLeft) {
            const maxScrollX = Math.max(0, nextViewport.worldWidth - screenW);
            const finalWorldLeft = Math.min(maxScrollX, Math.max(0, newWorldLeft));
            nextViewport.x = -finalWorldLeft;
          }
        };

        const nextHandle: LadderPixiCanvasHostRef = {
          app: nextApp,
          viewport: nextViewport,
          layers: nextLayers,
          eventBridge: nextEventBridge,
          updateWorldConfig,
          scrollToCell,
        };

        app = nextApp;
        viewport = nextViewport;
        layers = nextLayers;
        eventBridge = nextEventBridge;
        setHostRef(ref, nextHandle);
        onReadyRef.current?.(nextHandle);
      } catch {
        nextApp.destroy(true, { children: true, texture: true });
      }
    };

    void initialize();

    return () => {
      cancelled = true;
      setHostRef(ref, null);
      initRef.current = false;
      viewportRef.current = null;
      appRef.current = null;

      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }

      if (wheelHandler && container) {
        container.removeEventListener('wheel', wheelHandler);
        wheelHandler = null;
      }

      if (eventBridge) {
        eventBridge.destroy();
      }

      if (layers) {
        layers.destroy();
      }

      if (viewport && viewport.parent) {
        viewport.parent.removeChild(viewport);
      }

      if (app) {
        if (app.canvas.parentElement === container) {
          container.removeChild(app.canvas);
        }

        app.destroy(true, { children: true, texture: true });
      }
    };
  }, [ref]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  );
});
