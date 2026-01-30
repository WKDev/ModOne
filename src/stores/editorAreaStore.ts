/**
 * Editor Area Store
 *
 * Manages the main editor area tabs in the VSCode-style layout.
 * All editor-type panels (canvas, ladder, scenario, csv) are managed here as tabs.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { PanelType, PANEL_TYPE_LABELS } from '../types/panel';
import { TabState, TabData } from '../types/tab';

interface EditorAreaState {
  /** Array of tabs in the editor area */
  tabs: TabState[];
  /** ID of the currently active tab */
  activeTabId: string | null;
}

interface EditorAreaActions {
  /** Add a new tab to the editor area */
  addTab: (type: PanelType, title?: string, data?: TabData) => string;
  /** Remove a tab from the editor area */
  removeTab: (tabId: string) => void;
  /** Set the active tab */
  setActiveTab: (tabId: string | null) => void;
  /** Reorder tabs via drag and drop */
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  /** Find a tab by file path */
  findTabByFilePath: (filePath: string) => TabState | null;
  /** Update tab's modified state */
  updateTabModified: (tabId: string, isModified: boolean) => void;
  /** Update tab title */
  updateTabTitle: (tabId: string, title: string) => void;
  /** Update tab data */
  updateTabData: (tabId: string, data: Partial<TabData>) => void;
  /** Close all tabs except the specified one */
  closeOtherTabs: (tabId: string) => void;
  /** Close tabs to the right of the specified tab */
  closeTabsToRight: (tabId: string) => void;
  /** Close all tabs */
  closeAllTabs: () => void;
  /** Duplicate a tab */
  duplicateTab: (tabId: string) => string | null;
  /** Get all tabs */
  getTabs: () => TabState[];
  /** Get all modified tabs */
  getModifiedTabs: () => TabState[];
  /** Clear all tabs (for layout reset) */
  clearTabs: () => void;
  /** Set tabs directly (for layout restoration) */
  setTabs: (tabs: TabState[], activeTabId: string | null) => void;
}

type EditorAreaStore = EditorAreaState & EditorAreaActions;

let tabIdCounter = 0;

const generateTabId = (): string => {
  tabIdCounter += 1;
  return `editor-tab-${tabIdCounter}`;
};

const initialState: EditorAreaState = {
  tabs: [],
  activeTabId: null,
};

export const useEditorAreaStore = create<EditorAreaStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      addTab: (type, title, data) => {
        const tabId = generateTabId();
        const newTab: TabState = {
          id: tabId,
          panelType: type,
          title: title || PANEL_TYPE_LABELS[type],
          isModified: false,
          data,
        };

        set(
          (state) => ({
            tabs: [...state.tabs, newTab],
            activeTabId: tabId,
          }),
          false,
          'addTab'
        );

        return tabId;
      },

      removeTab: (tabId) => {
        set(
          (state) => {
            const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
            const newTabs = state.tabs.filter((t) => t.id !== tabId);

            // Determine new active tab
            let newActiveTabId = state.activeTabId;
            if (state.activeTabId === tabId) {
              if (newTabs.length === 0) {
                newActiveTabId = null;
              } else if (tabIndex >= newTabs.length) {
                newActiveTabId = newTabs[newTabs.length - 1].id;
              } else {
                newActiveTabId = newTabs[tabIndex].id;
              }
            }

            return {
              tabs: newTabs,
              activeTabId: newActiveTabId,
            };
          },
          false,
          'removeTab'
        );
      },

      setActiveTab: (tabId) => {
        set({ activeTabId: tabId }, false, 'setActiveTab');
      },

      reorderTabs: (fromIndex, toIndex) => {
        set(
          (state) => {
            const newTabs = [...state.tabs];
            const [movedTab] = newTabs.splice(fromIndex, 1);
            newTabs.splice(toIndex, 0, movedTab);
            return { tabs: newTabs };
          },
          false,
          'reorderTabs'
        );
      },

      findTabByFilePath: (filePath) => {
        const { tabs } = get();
        return tabs.find((t) => t.data?.filePath === filePath) || null;
      },

      updateTabModified: (tabId, isModified) => {
        set(
          (state) => ({
            tabs: state.tabs.map((t) =>
              t.id === tabId ? { ...t, isModified } : t
            ),
          }),
          false,
          'updateTabModified'
        );
      },

      updateTabTitle: (tabId, title) => {
        set(
          (state) => ({
            tabs: state.tabs.map((t) =>
              t.id === tabId ? { ...t, title } : t
            ),
          }),
          false,
          'updateTabTitle'
        );
      },

      updateTabData: (tabId, data) => {
        set(
          (state) => ({
            tabs: state.tabs.map((t) =>
              t.id === tabId ? { ...t, data: { ...t.data, ...data } } : t
            ),
          }),
          false,
          'updateTabData'
        );
      },

      closeOtherTabs: (tabId) => {
        set(
          (state) => {
            const tab = state.tabs.find((t) => t.id === tabId);
            return {
              tabs: tab ? [tab] : [],
              activeTabId: tab ? tabId : null,
            };
          },
          false,
          'closeOtherTabs'
        );
      },

      closeTabsToRight: (tabId) => {
        set(
          (state) => {
            const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
            if (tabIndex === -1) return state;

            const newTabs = state.tabs.slice(0, tabIndex + 1);
            const newActiveTabId =
              state.activeTabId && newTabs.some((t) => t.id === state.activeTabId)
                ? state.activeTabId
                : newTabs[newTabs.length - 1]?.id || null;

            return {
              tabs: newTabs,
              activeTabId: newActiveTabId,
            };
          },
          false,
          'closeTabsToRight'
        );
      },

      closeAllTabs: () => {
        set({ tabs: [], activeTabId: null }, false, 'closeAllTabs');
      },

      duplicateTab: (tabId) => {
        const { tabs, addTab } = get();
        const tab = tabs.find((t) => t.id === tabId);

        if (!tab) return null;

        const newTabId = addTab(
          tab.panelType,
          `${tab.title} (Copy)`,
          tab.data ? { ...tab.data } : undefined
        );

        return newTabId;
      },

      getTabs: () => get().tabs,

      getModifiedTabs: () => get().tabs.filter((t) => t.isModified),

      clearTabs: () => {
        set({ tabs: [], activeTabId: null }, false, 'clearTabs');
      },

      setTabs: (tabs, activeTabId) => {
        set({ tabs, activeTabId }, false, 'setTabs');
      },
    }),
    { name: 'editor-area-store' }
  )
);
