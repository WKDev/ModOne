import { useCallback, useEffect, useRef } from 'react';
import type { Viewport } from 'pixi-viewport';
import type { PixiCanvasHostRef } from './PixiCanvasHost';
import { PixiGridRenderer } from './PixiGridRenderer';
import { PixiSyncEngine } from './PixiSyncEngine';
import { PixiViewportSync } from './PixiViewportSync';

type Position = { x: number; y: number };

interface UsePixiSyncBridgeOptions {
  documentId: string | null;
  setZoom: (zoom: number) => void;
  setPan: (pan: Position) => void;
}

interface BridgeState {
  gridRenderer: PixiGridRenderer;
  syncEngine: PixiSyncEngine;
  viewportSync: PixiViewportSync;
}

function getVisibleBounds(viewport: Viewport) {
  const corner = viewport.corner;
  const screenWidth = viewport.screenWidth;
  const screenHeight = viewport.screenHeight;
  const scale = viewport.scale.x || 1;

  return {
    minX: corner.x,
    minY: corner.y,
    maxX: corner.x + screenWidth / scale,
    maxY: corner.y + screenHeight / scale,
  };
}

export function usePixiSyncBridge({
  documentId,
  setZoom,
  setPan,
}: UsePixiSyncBridgeOptions) {
  const hostRef = useRef<PixiCanvasHostRef | null>(null);
  const bridgeRef = useRef<BridgeState | null>(null);

  const setZoomRef = useRef(setZoom);
  const setPanRef = useRef(setPan);
  useEffect(() => {
    setZoomRef.current = setZoom;
    setPanRef.current = setPan;
  }, [setZoom, setPan]);

  const documentIdRef = useRef(documentId);
  useEffect(() => {
    documentIdRef.current = documentId;
  }, [documentId]);

  const teardown = useCallback(() => {
    const bridge = bridgeRef.current;
    if (!bridge) {
      return;
    }

    bridge.viewportSync.stop();
    bridge.syncEngine.stop();
    bridge.gridRenderer.destroy();
    bridgeRef.current = null;
  }, []);

  const setup = useCallback(() => {
    const host = hostRef.current;
    const docId = documentIdRef.current;
    if (!host || !docId) {
      return;
    }

    teardown();

    const gridRenderer = new PixiGridRenderer(host.layers.gridLayer);

    const syncEngine = new PixiSyncEngine(
      docId,
      host.layers,
      gridRenderer,
      () => getVisibleBounds(host.viewport),
    );

    const viewportSync = new PixiViewportSync(
      host.viewport,
      (z: number) => {
        setZoomRef.current(z);
        syncEngine.onViewportChanged(z);
      },
      (p: { x: number; y: number }) => setPanRef.current(p),
    );

    bridgeRef.current = { gridRenderer, syncEngine, viewportSync };

    syncEngine.start();
    viewportSync.start();
  }, [teardown]);

  const onPixiReady = useCallback(
    (handle: PixiCanvasHostRef) => {
      hostRef.current = handle;
      setup();
    },
    [setup],
  );

  useEffect(() => {
    if (hostRef.current && documentId) {
      setup();
    }

    return () => {
      teardown();
    };
  }, [documentId, setup, teardown]);

  return { onPixiReady };
}
