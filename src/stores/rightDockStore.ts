/**
 * Right Dock Store
 *
 * 우측 인스펙터 도킹 패널 상태를 관리하는 store.
 * Memory Visualizer, Properties 등 "보면서 동시에 편집하는" 인스펙터 패널을
 * 세로 도크(기본 화면의 1/4)로 띄운다. toolPanelStore(하단)의 width 버전.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { PanelType, PANEL_TYPE_LABELS, INSPECTOR_PANEL_TYPES } from '../types/panel';
import { TabState } from '../types/tab';

/** Minimum width for the right dock in pixels */
export const MIN_RIGHT_DOCK_WIDTH = 240;
/** Maximum width ratio (percentage of viewport) */
export const MAX_RIGHT_DOCK_WIDTH_RATIO = 0.5;
/** Default width ratio (1/4 of viewport, per design) */
export const DEFAULT_RIGHT_DOCK_WIDTH_RATIO = 0.25;

/** Compute the default width (1/4 of viewport), guarded for non-DOM envs. */
function defaultWidth(): number {
  if (typeof window === 'undefined') return 360;
  return Math.round(window.innerWidth * DEFAULT_RIGHT_DOCK_WIDTH_RATIO);
}

interface RightDockState {
  /** Whether the right dock is visible */
  isVisible: boolean;
  /** Width of the right dock in pixels */
  width: number;
  /** Array of inspector tabs */
  tabs: TabState[];
  /** ID of the currently active tab */
  activeTabId: string | null;
  /** Whether the dock is currently being resized */
  isResizing: boolean;
}

interface RightDockActions {
  toggle: () => void;
  show: () => void;
  hide: () => void;
  setWidth: (width: number) => void;
  setActiveTab: (tabId: string | null) => void;
  setActiveTabByType: (type: PanelType) => void;
  /** Show and activate a specific inspector panel type */
  showAndActivate: (type: PanelType) => void;
  setResizing: (isResizing: boolean) => void;
  initializeDefaultTabs: () => void;
  getTabByType: (type: PanelType) => TabState | null;
  reset: () => void;
}

type RightDockStore = RightDockState & RightDockActions;

let tabIdCounter = 0;

const generateDockTabId = (): string => {
  tabIdCounter += 1;
  return `dock-tab-${tabIdCounter}`;
};

function createDefaultDockTabs(): TabState[] {
  return INSPECTOR_PANEL_TYPES.map((type) => ({
    id: generateDockTabId(),
    panelType: type,
    title: PANEL_TYPE_LABELS[type],
    isModified: false,
  }));
}

const initialState: RightDockState = {
  // Decision: right dock defaults to expanded at 1/4 of the screen.
  isVisible: true,
  width: defaultWidth(),
  tabs: [],
  activeTabId: null,
  isResizing: false,
};

export const useRightDockStore = create<RightDockStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        toggle: () => {
          set((state) => ({ isVisible: !state.isVisible }), false, 'toggle');
        },

        show: () => {
          set({ isVisible: true }, false, 'show');
        },

        hide: () => {
          set({ isVisible: false }, false, 'hide');
        },

        setWidth: (width) => {
          const clampedWidth = Math.max(
            MIN_RIGHT_DOCK_WIDTH,
            Math.min(width, window.innerWidth * MAX_RIGHT_DOCK_WIDTH_RATIO)
          );
          set({ width: clampedWidth }, false, 'setWidth');
        },

        setActiveTab: (tabId) => {
          set({ activeTabId: tabId }, false, 'setActiveTab');
        },

        setActiveTabByType: (type) => {
          const { tabs } = get();
          const tab = tabs.find((t) => t.panelType === type);
          if (tab) {
            set({ activeTabId: tab.id }, false, 'setActiveTabByType');
          }
        },

        showAndActivate: (type) => {
          const { tabs, initializeDefaultTabs } = get();
          if (tabs.length === 0) {
            initializeDefaultTabs();
          }
          set({ isVisible: true }, false, 'show');
          get().setActiveTabByType(type);
        },

        setResizing: (isResizing) => {
          set({ isResizing }, false, 'setResizing');
        },

        initializeDefaultTabs: () => {
          const defaultTabs = createDefaultDockTabs();
          const firstTabId = defaultTabs.length > 0 ? defaultTabs[0].id : null;
          set({ tabs: defaultTabs, activeTabId: firstTabId }, false, 'initializeDefaultTabs');
        },

        getTabByType: (type) => {
          const { tabs } = get();
          return tabs.find((t) => t.panelType === type) || null;
        },

        reset: () => {
          set(initialState, false, 'reset');
        },
      }),
      {
        name: 'right-dock-store',
        // Persist only layout prefs; tabs are re-derived from the registry on load.
        partialize: (state) => ({ width: state.width, isVisible: state.isVisible }),
      }
    ),
    { name: 'right-dock-store' }
  )
);
