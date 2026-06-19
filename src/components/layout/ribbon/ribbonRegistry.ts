import type { RibbonTabConfig, RibbonTabId } from './types';

class RibbonRegistry {
  private tabs: Map<RibbonTabId, RibbonTabConfig> = new Map();
  private subscribers: Set<() => void> = new Set();
  private cachedTabs: RibbonTabConfig[] | null = null;

  register(tab: RibbonTabConfig): void {
    this.tabs.set(tab.id, tab);
    this.notifySubscribers();
  }

  registerAll(tabs: RibbonTabConfig[]): void {
    tabs.forEach((tab) => this.tabs.set(tab.id, tab));
    this.notifySubscribers();
  }

  unregister(tabId: RibbonTabId): void {
    this.tabs.delete(tabId);
    this.notifySubscribers();
  }

  get(tabId: RibbonTabId): RibbonTabConfig | undefined {
    return this.tabs.get(tabId);
  }

  getAll(): RibbonTabConfig[] {
    if (this.cachedTabs === null) {
      this.cachedTabs = Array.from(this.tabs.values());
    }
    return this.cachedTabs;
  }

  has(tabId: RibbonTabId): boolean {
    return this.tabs.has(tabId);
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  clear(): void {
    this.tabs.clear();
    this.notifySubscribers();
  }

  private notifySubscribers(): void {
    this.cachedTabs = null;
    this.subscribers.forEach((callback) => callback());
  }
}

export const ribbonRegistry = new RibbonRegistry();
