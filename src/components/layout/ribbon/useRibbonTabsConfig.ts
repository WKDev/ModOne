import { useSyncExternalStore } from 'react';
import type { RibbonTabConfig } from './types';
import { ensureBuiltInRibbonTabsRegistered } from './registerBuiltInRibbonTabs';
import { ribbonRegistry } from './ribbonRegistry';

// Cache subscribe and getSnapshot at module level to avoid new references each render
const subscribe = (callback: () => void) => ribbonRegistry.subscribe(callback);

function getSnapshot(): RibbonTabConfig[] {
  return ribbonRegistry.getAll();
}

export function useRibbonTabsConfig(): RibbonTabConfig[] {
  ensureBuiltInRibbonTabsRegistered();
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
