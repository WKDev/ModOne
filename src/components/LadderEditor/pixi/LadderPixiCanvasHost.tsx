import { forwardRef, useEffect, useRef, type ForwardedRef } from 'react';
import { Application } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
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

export const LadderPixiCanvasHost = forwardRef<
  LadderPixiCanvasHostRef,
  LadderPixiCanvasHostProps
>(function LadderPixiCanvasHost({ className, onReady }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initRef = useRef(false);
  const onReadyRef = useRef<LadderPixiCanvasHostProps['onReady']>(onReady);

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

        const nextViewport = new Viewport({
          worldWidth: 20000,
          worldHeight: 20000,
          events: nextApp.renderer.events,
        });

        nextViewport
          .drag({ mouseButtons: 'middle' })
          .wheel({ smooth: 3 })
          .clampZoom({ minScale: 0.05, maxScale: 10 });

        nextApp.stage.addChild(nextViewport);

        const nextLayers = createLadderLayerManager(nextViewport);
        const nextEventBridge = new LadderEventBridge(nextViewport);
        nextEventBridge.attach();
        const nextHandle: LadderPixiCanvasHostRef = {
          app: nextApp,
          viewport: nextViewport,
          layers: nextLayers,
          eventBridge: nextEventBridge,
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
      style={{ width: '100%', height: '100%' }}
    />
  );
});
