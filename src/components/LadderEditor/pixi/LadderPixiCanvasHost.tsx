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
   * Scroll the viewport so that a grid cell is visible.
   * Used when keyboard navigation moves the cursor outside the visible area.
   */
  scrollToCell: (row: number, col: number, cellHeight: number) => void;
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
 * Scroll behaviour: VERTICAL ONLY (like XG5000 / GXWorks3).
 * - No horizontal pan / zoom.
 * - Mouse wheel → vertical scroll only, deltaMode-aware.
 * - Viewport X is locked to 0 at all times.
 * - Canvas always fills the full container width.
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

  // Internal viewport ref so scrollToCell can access it after init
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
        // Viewport setup — vertical scroll only
        // ----------------------------------------------------------------
        const nextViewport = new Viewport({
          worldWidth: container.clientWidth,
          worldHeight: 100_000, // tall virtual world for vertical scroll
          events: nextApp.renderer.events,
        });

        // Lock X to 0 — no horizontal movement ever
        nextViewport.x = 0;
        nextViewport.clamp({ left: true, right: true, direction: 'x' });

        nextApp.stage.addChild(nextViewport);
        viewportRef.current = nextViewport;
        appRef.current = nextApp;

        // Initialize viewportY in store
        setViewportY(0);

        // ----------------------------------------------------------------
        // Native wheel → vertical scroll only (no zoom, no horizontal)
        // deltaMode:
        //   0 = pixels    → use directly with a small multiplier
        //   1 = lines     → multiply by ~40px per line
        //   2 = pages     → multiply by screen height
        // ----------------------------------------------------------------
        wheelHandler = (e: WheelEvent) => {
          e.preventDefault();
          if (!nextViewport) return;

          let pixelDelta: number;
          switch (e.deltaMode) {
            case 1: // lines
              pixelDelta = e.deltaY * 40;
              break;
            case 2: // pages
              pixelDelta = e.deltaY * nextApp.screen.height;
              break;
            default: // pixels (mode 0)
              pixelDelta = e.deltaY;
              break;
          }

          const maxScroll = Math.max(0, nextViewport.worldHeight - nextApp.screen.height);
          const newY = Math.min(0, Math.max(-maxScroll, nextViewport.y - pixelDelta));
          nextViewport.y = newY;
          // Always snap X to 0
          nextViewport.x = 0;

          // Sync to store
          setViewportY(-newY);
        };
        container.addEventListener('wheel', wheelHandler, { passive: false });

        // ----------------------------------------------------------------
        // ResizeObserver — keep viewport world width in sync with container
        // ----------------------------------------------------------------
        resizeObserver = new ResizeObserver(() => {
          if (!nextViewport) return;
          nextViewport.worldWidth = container.clientWidth;
          nextViewport.x = 0;
        });
        resizeObserver.observe(container);

        const nextLayers = createLadderLayerManager(nextViewport);
        const nextEventBridge = new LadderEventBridge(nextViewport);
        nextEventBridge.attach();

        /** Scroll viewport so that the given cell row is visible, with padding. */
        const scrollToCell = (row: number, _col: number, cellHeight: number) => {
          if (!nextViewport || !nextApp) return;

          const screenH = nextApp.screen.height;
          const PADDING = cellHeight; // one cell of padding around the cursor

          // World Y of the cell top and bottom
          const cellTop = row * cellHeight;
          const cellBottom = cellTop + cellHeight;

          // Current visible world range (note: viewport.y is negative when scrolled down)
          // worldTop = -viewport.y
          const worldTop = -nextViewport.y;
          const worldBottom = worldTop + screenH;

          let newWorldTop = worldTop;

          if (cellTop - PADDING < worldTop) {
            // Cursor is above the visible area → scroll up
            newWorldTop = Math.max(0, cellTop - PADDING);
          } else if (cellBottom + PADDING > worldBottom) {
            // Cursor is below the visible area → scroll down
            newWorldTop = cellBottom + PADDING - screenH;
          }

          if (newWorldTop !== worldTop) {
            const maxScroll = Math.max(0, nextViewport.worldHeight - screenH);
            const finalWorldTop = Math.min(maxScroll, Math.max(0, newWorldTop));
            nextViewport.y = -finalWorldTop;
            nextViewport.x = 0;
            setViewportY(finalWorldTop);
          }
        };

        const nextHandle: LadderPixiCanvasHostRef = {
          app: nextApp,
          viewport: nextViewport,
          layers: nextLayers,
          eventBridge: nextEventBridge,
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
