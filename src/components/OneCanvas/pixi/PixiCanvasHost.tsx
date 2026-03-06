import { forwardRef, useEffect, useRef, type ForwardedRef } from 'react';
import { Application } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import {
  createLayerManager,
  type PixiLayerManager,
} from './PixiLayerManager';
import { PixiEventBridge } from './PixiEventBridge';

export interface PixiCanvasHostRef {
  app: Application;
  viewport: Viewport;
  layers: PixiLayerManager;
  eventBridge: PixiEventBridge;
}

interface PixiCanvasHostProps {
  className?: string;
  onReady?: (ref: PixiCanvasHostRef) => void;
}

function setHostRef(
  ref: ForwardedRef<PixiCanvasHostRef>,
  value: PixiCanvasHostRef | null
): void {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }

  if (ref) {
    ref.current = value;
  }
}

export const PixiCanvasHost = forwardRef<PixiCanvasHostRef, PixiCanvasHostProps>(
  function PixiCanvasHost({ className, onReady }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const initRef = useRef(false);
    const onReadyRef = useRef<PixiCanvasHostProps['onReady']>(onReady);

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
      let layers: PixiLayerManager | null = null;
      let eventBridge: PixiEventBridge | null = null;

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

          const nextLayers = createLayerManager(nextViewport);
          const nextEventBridge = new PixiEventBridge(nextViewport);
          nextEventBridge.attach();
          const nextHandle: PixiCanvasHostRef = {
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
  }
);
