/**
 * Tool Panel Store
 *
 * Manages the bottom tool panel in the VSCode-style layout.
 * Contains Console, Memory Visualizer, and Properties panels as tabs.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { PanelType, PANEL_TYPE_LABELS, TOOL_PANEL_TYPES } from '../types/panel';
import { TabState } from '../types/tab';

/** Default height for the tool panel */
export const DEFAULT_TOOL_PANEL_HEIGHT = 200;
/** Minimum height for the tool panel */
export const MIN_TOOL_PANEL_HEIGHT = 100;
/** Maximum height ratio (percentage of viewport) */
export const MAX_TOOL_PANEL_HEIGHT_RATIO = 0.6;

interface ToolPanelState {
  /** Whether the tool panel is visible */
  isVisible: boolean;
  /** Height of the tool panel in pixels */
  height: number;
  /** Array of tool tabs */
  tabs: TabState[];
  /** ID of the currently active tab */
  activeTabId: string | null;
  /** Whether the panel is currently being resized */
  isResizing: boolean;
}

interface ToolPanelActions {
  /** Toggle tool panel visibility */
  toggle: () => void;
  /** Show the tool panel */
  show: () => void;
  /** Hide the tool panel */
  hide: () => void;
  /** Set the height of the tool panel */
  setHeight: (height: number) => void;
  /** Set the active tab by ID */
  setActiveTab: (tabId: string | null) => void;
  /** Set the active tab by panel type */
  setActiveTabByType: (type: PanelType) => void;
  /** Show and activate a specific tool panel type */
  showAndActivate: (type: PanelType) => void;
  /** Set resizing state */
  setResizing: (isResizing: boolean) => void;
  /** Initialize default tool tabs */
  initializeDefaultTabs: () => void;
  /** Get tab by panel type */
  getTabByType: (type: PanelType) => TabState | null;
  /** Reset to default state */
  reset: () => void;
  /** Set state directly (for layout restoration) */
  setState: (state: Partial<ToolPanelState>) => void;
}

type ToolPanelStore = ToolPanelState & ToolPanelActions;

let tabIdCounter = 0;

const generateToolTabId = (): string => {
  tabIdCounter += 1;
  return `tool-tab-${tabIdCounter}`;
};

/**
 * Create default tool tabs
 */
function createDefaultToolTabs(): TabState[] {
  return TOOL_PANEL_TYPES.map((type) => ({
    id: generateToolTabId(),
    panelType: type,
    title: PANEL_TYPE_LABELS[type],
    isModified: false,
  }));
}

const initialState: ToolPanelState = {
  isVisible: true,
  height: DEFAULT_TOOL_PANEL_HEIGHT,
  tabs: [],
  activeTabId: null,
  isResizing: false,
};

export const useToolPanelStore = create<ToolPanelStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      toggle: () => {
        set(
          (state) => ({ isVisible: !state.isVisible }),
          false,
          'toggle'
        );
      },

      show: () => {
        set({ isVisible: true }, false, 'show');
      },

      hide: () => {
        set({ isVisible: false }, false, 'hide');
      },

      setHeight: (height) => {
        // Clamp height to valid range
        const clampedHeight = Math.max(
          MIN_TOOL_PANEL_HEIGHT,
          Math.min(height, window.innerHeight * MAX_TOOL_PANEL_HEIGHT_RATIO)
        );
        set({ height: clampedHeight }, false, 'setHeight');
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
        const { tabs, show, setActiveTabByType, initializeDefaultTabs } = get();

        // Initialize tabs if not already done
        if (tabs.length === 0) {
          initializeDefaultTabs();
        }

        show();
        setActiveTabByType(type);
      },

      setResizing: (isResizing) => {
        set({ isResizing }, false, 'setResizing');
      },

      initializeDefaultTabs: () => {
        const defaultTabs = createDefaultToolTabs();
        const firstTabId = defaultTabs.length > 0 ? defaultTabs[0].id : null;

        set(
          {
            tabs: defaultTabs,
            activeTabId: firstTabId,
          },
          false,
          'initializeDefaultTabs'
        );
      },

      getTabByType: (type) => {
        const { tabs } = get();
        return tabs.find((t) => t.panelType === type) || null;
      },

      reset: () => {
        set(initialState, false, 'reset');
      },

      setState: (state) => {
        set(state, false, 'setState');
      },
    }),
    { name: 'tool-panel-store' }
  )
);
