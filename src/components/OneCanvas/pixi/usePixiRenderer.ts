import { useSyncExternalStore, useCallback } from 'react';

export const PIXI_RENDERER_KEY = 'modone:usePixiRenderer';

const SAME_TAB_EVENT = 'modone:pixi-renderer-change';

function notifySameTab(): void {
  window.dispatchEvent(new Event(SAME_TAB_EVENT));
}

function subscribe(listener: () => void): () => void {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === PIXI_RENDERER_KEY) listener();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(SAME_TAB_EVENT, listener);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(SAME_TAB_EVENT, listener);
  };
}

function getSnapshot(): boolean {
  return localStorage.getItem(PIXI_RENDERER_KEY) === 'true';
}

function getServerSnapshot(): boolean {
  return false;
}

export function usePixiRenderer() {
  const isPixiEnabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const togglePixi = useCallback(() => {
    localStorage.setItem(PIXI_RENDERER_KEY, String(!getSnapshot()));
    notifySameTab();
  }, []);

  const setPixiEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem(PIXI_RENDERER_KEY, String(enabled));
    notifySameTab();
  }, []);

  return { isPixiEnabled, togglePixi, setPixiEnabled };
}
