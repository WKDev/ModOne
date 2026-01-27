/**
 * Layout Persistence Store
 *
 * Manages layout persistence, presets, and serialization.
 * Works alongside panelStore and sidebarStore to save/restore complete layouts.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { LayoutConfig, LayoutPresetInfo } from '../types/layout';
import { SPECIAL_LAYOUT_NAMES, isBuiltInLayout } from '../types/layout';
import { layoutService } from '../services/layoutService';
import { BUILT_IN_LAYOUTS, getPresetByName, getDefaultLayout } from '../config/layoutPresets';
import { usePanelStore } from './panelStore';
import { useSidebarStore } from './sidebarStore';

interface LayoutPersistenceState {
  /** Name of the currently active layout */
  currentLayoutName: string;
  /** List of user-saved layout names */
  savedLayoutNames: string[];
  /** Whether the current layout has been modified since last save/load */
  isLayoutModified: boolean;
  /** Whether layout data is being loaded */
  isLoading: boolean;
  /** Last error message */
  error: string | null;
  /** Whether to restore last session on startup */
  restoreLastSession: boolean;
}

interface LayoutPersistenceActions {
  /** Initialize the store (load saved layouts list, restore last session if enabled) */
  initialize: () => Promise<void>;
  /** Save the current layout with the given name */
  saveLayout: (name: string) => Promise<void>;
  /** Load and apply a layout by name */
  loadLayout: (name: string) => Promise<void>;
  /** Delete a user layout */
  deleteLayout: (name: string) => Promise<void>;
  /** Reset to the default layout */
  resetToDefault: () => void;
  /** Export the current layout as a LayoutConfig object */
  exportCurrentLayout: (name: string) => LayoutConfig;
  /** Import and apply a layout from a LayoutConfig object */
  importLayout: (config: LayoutConfig) => void;
  /** Get all available layouts (built-in + user) */
  getAvailableLayouts: () => LayoutPresetInfo[];
  /** Refresh the list of saved layouts from storage */
  refreshSavedLayouts: () => Promise<void>;
  /** Mark the layout as modified */
  setLayoutModified: (modified: boolean) => void;
  /** Set restore last session preference */
  setRestoreLastSession: (restore: boolean) => Promise<void>;
  /** Save the current layout as the last session (called on app close) */
  saveLastSession: () => Promise<void>;
  /** Clear any error */
  clearError: () => void;
}

type LayoutPersistenceStore = LayoutPersistenceState & LayoutPersistenceActions;

const initialState: LayoutPersistenceState = {
  currentLayoutName: 'Default',
  savedLayoutNames: [],
  isLayoutModified: false,
  isLoading: false,
  error: null,
  restoreLastSession: true,
};

/**
 * Serialize the current panel and sidebar state into a LayoutConfig
 */
function serializeCurrentLayout(name: string): LayoutConfig {
  const panelState = usePanelStore.getState();
  const sidebarState = useSidebarStore.getState();

  return {
    name,
    grid: { ...panelState.gridConfig },
    panels: panelState.panels.map((panel) => ({
      id: panel.id,
      type: panel.type,
      gridArea: panel.gridArea,
      tabs: panel.tabs?.map((tab) => ({
        type: tab.panelType,
        title: tab.title,
      })),
      activeTabId: panel.activeTabId ?? undefined,
    })),
    sidebar: {
      visible: sidebarState.isVisible,
      width: sidebarState.width,
      activePanel: sidebarState.activePanel,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Apply a LayoutConfig to the panel and sidebar stores
 */
function applyLayoutConfig(config: LayoutConfig): void {
  const panelStore = usePanelStore.getState();
  const sidebarStore = useSidebarStore.getState();

  // Update grid config
  panelStore.updateGridConfig(config.grid);

  // Clear existing panels and add new ones
  // Note: This is a simplified approach - a more sophisticated implementation
  // would diff the panels and minimize changes
  const currentPanels = panelStore.panels;
  currentPanels.forEach((panel) => {
    panelStore.removePanel(panel.id);
  });

  // Add panels from config
  config.panels.forEach((panelConfig) => {
    const panelId = panelStore.addPanel(panelConfig.type, panelConfig.gridArea);

    // Add tabs if present
    if (panelConfig.tabs && panelConfig.tabs.length > 0) {
      panelConfig.tabs.forEach((tabConfig) => {
        panelStore.addTab(panelId, tabConfig.type, tabConfig.title);
      });
    }
  });

  // Update sidebar state
  if (config.sidebar.visible !== sidebarStore.isVisible) {
    sidebarStore.toggleVisibility();
  }
  sidebarStore.setWidth(config.sidebar.width);
  sidebarStore.setActivePanel(config.sidebar.activePanel);
}

export const useLayoutPersistenceStore = create<LayoutPersistenceStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      initialize: async () => {
        set({ isLoading: true, error: null }, false, 'initialize:start');

        try {
          // Load saved layout names
          const savedNames = await layoutService.listLayouts();
          const restoreLastSession = await layoutService.getRestoreLastSession();

          set(
            {
              savedLayoutNames: savedNames,
              restoreLastSession,
            },
            false,
            'initialize:loadNames'
          );

          // Restore last session if enabled
          if (restoreLastSession) {
            try {
              const lastActive = await layoutService.getLastActiveLayout();
              if (lastActive) {
                await get().loadLayout(lastActive);
              } else {
                // Apply default layout
                get().resetToDefault();
              }
            } catch {
              // If last session restore fails, use default
              get().resetToDefault();
            }
          } else {
            get().resetToDefault();
          }
        } catch (error) {
          set(
            { error: error instanceof Error ? error.message : 'Failed to initialize layouts' },
            false,
            'initialize:error'
          );
          // Apply default layout on error
          get().resetToDefault();
        } finally {
          set({ isLoading: false }, false, 'initialize:complete');
        }
      },

      saveLayout: async (name: string) => {
        set({ isLoading: true, error: null }, false, 'saveLayout:start');

        try {
          const config = serializeCurrentLayout(name);

          // Check if this is a built-in layout name
          if (isBuiltInLayout(name)) {
            throw new Error(`Cannot save over built-in layout '${name}'`);
          }

          await layoutService.saveLayout(config);
          await layoutService.setLastActiveLayout(name);

          // Refresh the saved layouts list
          const savedNames = await layoutService.listLayouts();

          set(
            {
              currentLayoutName: name,
              savedLayoutNames: savedNames,
              isLayoutModified: false,
            },
            false,
            'saveLayout:success'
          );
        } catch (error) {
          set(
            { error: error instanceof Error ? error.message : 'Failed to save layout' },
            false,
            'saveLayout:error'
          );
          throw error;
        } finally {
          set({ isLoading: false }, false, 'saveLayout:complete');
        }
      },

      loadLayout: async (name: string) => {
        set({ isLoading: true, error: null }, false, 'loadLayout:start');

        try {
          let config: LayoutConfig;

          // Check if it's a built-in layout
          const builtIn = getPresetByName(name);
          if (builtIn) {
            config = builtIn;
          } else {
            config = await layoutService.loadLayout(name);
          }

          // Apply the layout
          applyLayoutConfig(config);
          await layoutService.setLastActiveLayout(name);

          set(
            {
              currentLayoutName: name,
              isLayoutModified: false,
            },
            false,
            'loadLayout:success'
          );
        } catch (error) {
          set(
            { error: error instanceof Error ? error.message : 'Failed to load layout' },
            false,
            'loadLayout:error'
          );
          throw error;
        } finally {
          set({ isLoading: false }, false, 'loadLayout:complete');
        }
      },

      deleteLayout: async (name: string) => {
        set({ isLoading: true, error: null }, false, 'deleteLayout:start');

        try {
          if (isBuiltInLayout(name)) {
            throw new Error(`Cannot delete built-in layout '${name}'`);
          }

          await layoutService.deleteLayout(name);

          // Refresh the saved layouts list
          const savedNames = await layoutService.listLayouts();

          // If we deleted the current layout, switch to default
          if (get().currentLayoutName === name) {
            get().resetToDefault();
          }

          set({ savedLayoutNames: savedNames }, false, 'deleteLayout:success');
        } catch (error) {
          set(
            { error: error instanceof Error ? error.message : 'Failed to delete layout' },
            false,
            'deleteLayout:error'
          );
          throw error;
        } finally {
          set({ isLoading: false }, false, 'deleteLayout:complete');
        }
      },

      resetToDefault: () => {
        const defaultLayout = getDefaultLayout();
        applyLayoutConfig(defaultLayout);

        set(
          {
            currentLayoutName: defaultLayout.name,
            isLayoutModified: false,
          },
          false,
          'resetToDefault'
        );
      },

      exportCurrentLayout: (name: string) => {
        return serializeCurrentLayout(name);
      },

      importLayout: (config: LayoutConfig) => {
        applyLayoutConfig(config);

        set(
          {
            currentLayoutName: config.name,
            isLayoutModified: true, // Mark as modified until saved
          },
          false,
          'importLayout'
        );
      },

      getAvailableLayouts: () => {
        const { savedLayoutNames } = get();

        // Built-in layouts
        const builtInInfos: LayoutPresetInfo[] = BUILT_IN_LAYOUTS.map((layout) => ({
          name: layout.name,
          isBuiltIn: true,
          description: layout.description,
        }));

        // User layouts (filter out built-in names and special names)
        const userInfos: LayoutPresetInfo[] = savedLayoutNames
          .filter((name) => !isBuiltInLayout(name) && !name.startsWith('_'))
          .map((name) => ({
            name,
            isBuiltIn: false,
          }));

        return [...builtInInfos, ...userInfos];
      },

      refreshSavedLayouts: async () => {
        try {
          const savedNames = await layoutService.listLayouts();
          set({ savedLayoutNames: savedNames }, false, 'refreshSavedLayouts');
        } catch (error) {
          set(
            { error: error instanceof Error ? error.message : 'Failed to refresh layouts' },
            false,
            'refreshSavedLayouts:error'
          );
        }
      },

      setLayoutModified: (modified: boolean) => {
        set({ isLayoutModified: modified }, false, 'setLayoutModified');
      },

      setRestoreLastSession: async (restore: boolean) => {
        try {
          await layoutService.setRestoreLastSession(restore);
          set({ restoreLastSession: restore }, false, 'setRestoreLastSession');
        } catch (error) {
          set(
            { error: error instanceof Error ? error.message : 'Failed to update setting' },
            false,
            'setRestoreLastSession:error'
          );
        }
      },

      saveLastSession: async () => {
        try {
          const config = serializeCurrentLayout(SPECIAL_LAYOUT_NAMES.LAST_SESSION);
          await layoutService.saveLayout(config);
        } catch (error) {
          console.error('Failed to save last session:', error);
        }
      },

      clearError: () => {
        set({ error: null }, false, 'clearError');
      },
    }),
    { name: 'layout-persistence-store' }
  )
);

// Subscribe to panel store changes to track modifications
usePanelStore.subscribe((state, prevState) => {
  // Only track changes if a layout is loaded
  const layoutStore = useLayoutPersistenceStore.getState();
  if (layoutStore.currentLayoutName && !layoutStore.isLoading) {
    // Check if panels or grid changed
    if (
      state.panels !== prevState.panels ||
      state.gridConfig !== prevState.gridConfig
    ) {
      layoutStore.setLayoutModified(true);
    }
  }
});

// Subscribe to sidebar store changes to track modifications
useSidebarStore.subscribe((state, prevState) => {
  const layoutStore = useLayoutPersistenceStore.getState();
  if (layoutStore.currentLayoutName && !layoutStore.isLoading) {
    if (
      state.isVisible !== prevState.isVisible ||
      state.width !== prevState.width ||
      state.activePanel !== prevState.activePanel
    ) {
      layoutStore.setLayoutModified(true);
    }
  }
});
