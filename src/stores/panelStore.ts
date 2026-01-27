import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { PanelState, PanelType, GridConfig, PANEL_TYPE_LABELS } from '../types/panel';
import { TabState, TabData } from '../types/tab';
import { DropPosition } from '../types/dnd';
import {
  splitGrid,
  parseGridArea,
  createGridArea,
} from '../utils/gridUtils';

interface PanelStoreState {
  panels: PanelState[];
  gridConfig: GridConfig;
  activePanel: string | null;
}

interface PanelStoreActions {
  addPanel: (type: PanelType, area: string) => string;
  removePanel: (id: string) => void;
  updateGridConfig: (config: Partial<GridConfig>) => void;
  setActivePanel: (id: string | null) => void;
  minimizePanel: (id: string) => void;
  maximizePanel: (id: string) => void;
  updatePanelGridArea: (id: string, gridArea: string) => void;
  // Tab management actions
  addTab: (panelId: string, type: PanelType, title?: string, data?: TabData) => string;
  removeTab: (panelId: string, tabId: string) => void;
  setActiveTab: (panelId: string, tabId: string | null) => void;
  reorderTabs: (panelId: string, fromIndex: number, toIndex: number) => void;
  updateTabModified: (panelId: string, tabId: string, isModified: boolean) => void;
  updateTabTitle: (panelId: string, tabId: string, title: string) => void;
  updateTabData: (panelId: string, tabId: string, data: Partial<TabData>) => void;
  closeOtherTabs: (panelId: string, tabId: string) => void;
  closeTabsToRight: (panelId: string, tabId: string) => void;
  closeAllTabs: (panelId: string) => void;
  duplicateTab: (panelId: string, tabId: string) => string | null;
  moveTabToNewPanel: (panelId: string, tabId: string) => string | null;
  // Panel drag-and-drop actions
  splitPanel: (
    targetPanelId: string,
    sourcePanelId: string,
    dropPosition: DropPosition
  ) => boolean;
  mergePanelAsTabs: (targetPanelId: string, sourcePanelId: string) => boolean;
  removePanelFromGrid: (panelId: string) => void;
}

type PanelStore = PanelStoreState & PanelStoreActions;

let panelIdCounter = 0;
let tabIdCounter = 0;

const generatePanelId = (): string => {
  panelIdCounter += 1;
  return `panel-${panelIdCounter}`;
};

const generateTabId = (): string => {
  tabIdCounter += 1;
  return `tab-${tabIdCounter}`;
};

const initialState: PanelStoreState = {
  panels: [],
  gridConfig: {
    columns: ['1fr', '1fr'],
    rows: ['1fr', '1fr'],
  },
  activePanel: null,
};

export const usePanelStore = create<PanelStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      addPanel: (type, area) => {
        const id = generatePanelId();
        const newPanel: PanelState = {
          id,
          type,
          title: PANEL_TYPE_LABELS[type],
          gridArea: area,
          isMinimized: false,
        };

        set(
          (state) => ({
            panels: [...state.panels, newPanel],
            activePanel: id,
          }),
          false,
          'addPanel'
        );

        return id;
      },

      removePanel: (id) => {
        set(
          (state) => ({
            panels: state.panels.filter((p) => p.id !== id),
            activePanel: state.activePanel === id ? null : state.activePanel,
          }),
          false,
          'removePanel'
        );
      },

      updateGridConfig: (config) => {
        set(
          (state) => ({
            gridConfig: { ...state.gridConfig, ...config },
          }),
          false,
          'updateGridConfig'
        );
      },

      setActivePanel: (id) => {
        set({ activePanel: id }, false, 'setActivePanel');
      },

      minimizePanel: (id) => {
        set(
          (state) => ({
            panels: state.panels.map((p) =>
              p.id === id ? { ...p, isMinimized: !p.isMinimized } : p
            ),
          }),
          false,
          'minimizePanel'
        );
      },

      maximizePanel: (id) => {
        const { panels, gridConfig } = get();
        const panel = panels.find((p) => p.id === id);
        if (!panel) return;

        // Calculate full grid area (span all columns and rows)
        const maxCol = gridConfig.columns.length + 1;
        const maxRow = gridConfig.rows.length + 1;
        const fullArea = `1 / 1 / ${maxRow} / ${maxCol}`;

        // Toggle maximize - if already maximized, restore to original
        const isCurrentlyMaximized = panel.gridArea === fullArea;

        set(
          (state) => ({
            panels: state.panels.map((p) =>
              p.id === id
                ? {
                    ...p,
                    gridArea: isCurrentlyMaximized ? '1 / 1 / 2 / 2' : fullArea,
                  }
                : p
            ),
          }),
          false,
          'maximizePanel'
        );
      },

      updatePanelGridArea: (id, gridArea) => {
        set(
          (state) => ({
            panels: state.panels.map((p) =>
              p.id === id ? { ...p, gridArea } : p
            ),
          }),
          false,
          'updatePanelGridArea'
        );
      },

      // Tab management actions
      addTab: (panelId, type, title, data) => {
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
            panels: state.panels.map((p) =>
              p.id === panelId
                ? {
                    ...p,
                    tabs: [...(p.tabs || []), newTab],
                    activeTabId: tabId,
                  }
                : p
            ),
          }),
          false,
          'addTab'
        );

        return tabId;
      },

      removeTab: (panelId, tabId) => {
        set(
          (state) => ({
            panels: state.panels.map((p) => {
              if (p.id !== panelId) return p;

              const tabs = p.tabs || [];
              const tabIndex = tabs.findIndex((t) => t.id === tabId);
              const newTabs = tabs.filter((t) => t.id !== tabId);

              // Determine new active tab
              let newActiveTabId = p.activeTabId;
              if (p.activeTabId === tabId) {
                if (newTabs.length === 0) {
                  newActiveTabId = null;
                } else if (tabIndex >= newTabs.length) {
                  newActiveTabId = newTabs[newTabs.length - 1].id;
                } else {
                  newActiveTabId = newTabs[tabIndex].id;
                }
              }

              return {
                ...p,
                tabs: newTabs,
                activeTabId: newActiveTabId,
              };
            }),
          }),
          false,
          'removeTab'
        );
      },

      setActiveTab: (panelId, tabId) => {
        set(
          (state) => ({
            panels: state.panels.map((p) =>
              p.id === panelId ? { ...p, activeTabId: tabId } : p
            ),
            activePanel: panelId,
          }),
          false,
          'setActiveTab'
        );
      },

      reorderTabs: (panelId, fromIndex, toIndex) => {
        set(
          (state) => ({
            panels: state.panels.map((p) => {
              if (p.id !== panelId || !p.tabs) return p;

              const newTabs = [...p.tabs];
              const [movedTab] = newTabs.splice(fromIndex, 1);
              newTabs.splice(toIndex, 0, movedTab);

              return { ...p, tabs: newTabs };
            }),
          }),
          false,
          'reorderTabs'
        );
      },

      updateTabModified: (panelId, tabId, isModified) => {
        set(
          (state) => ({
            panels: state.panels.map((p) =>
              p.id === panelId
                ? {
                    ...p,
                    tabs: (p.tabs || []).map((t) =>
                      t.id === tabId ? { ...t, isModified } : t
                    ),
                  }
                : p
            ),
          }),
          false,
          'updateTabModified'
        );
      },

      updateTabTitle: (panelId, tabId, title) => {
        set(
          (state) => ({
            panels: state.panels.map((p) =>
              p.id === panelId
                ? {
                    ...p,
                    tabs: (p.tabs || []).map((t) =>
                      t.id === tabId ? { ...t, title } : t
                    ),
                  }
                : p
            ),
          }),
          false,
          'updateTabTitle'
        );
      },

      updateTabData: (panelId, tabId, data) => {
        set(
          (state) => ({
            panels: state.panels.map((p) =>
              p.id === panelId
                ? {
                    ...p,
                    tabs: (p.tabs || []).map((t) =>
                      t.id === tabId ? { ...t, data: { ...t.data, ...data } } : t
                    ),
                  }
                : p
            ),
          }),
          false,
          'updateTabData'
        );
      },

      closeOtherTabs: (panelId, tabId) => {
        set(
          (state) => ({
            panels: state.panels.map((p) => {
              if (p.id !== panelId || !p.tabs) return p;

              const tab = p.tabs.find((t) => t.id === tabId);
              return {
                ...p,
                tabs: tab ? [tab] : [],
                activeTabId: tab ? tabId : null,
              };
            }),
          }),
          false,
          'closeOtherTabs'
        );
      },

      closeTabsToRight: (panelId, tabId) => {
        set(
          (state) => ({
            panels: state.panels.map((p) => {
              if (p.id !== panelId || !p.tabs) return p;

              const tabIndex = p.tabs.findIndex((t) => t.id === tabId);
              if (tabIndex === -1) return p;

              const newTabs = p.tabs.slice(0, tabIndex + 1);
              const newActiveTabId =
                p.activeTabId && newTabs.some((t) => t.id === p.activeTabId)
                  ? p.activeTabId
                  : newTabs[newTabs.length - 1]?.id || null;

              return {
                ...p,
                tabs: newTabs,
                activeTabId: newActiveTabId,
              };
            }),
          }),
          false,
          'closeTabsToRight'
        );
      },

      closeAllTabs: (panelId) => {
        set(
          (state) => ({
            panels: state.panels.map((p) =>
              p.id === panelId
                ? {
                    ...p,
                    tabs: [],
                    activeTabId: null,
                  }
                : p
            ),
          }),
          false,
          'closeAllTabs'
        );
      },

      duplicateTab: (panelId, tabId) => {
        const { panels } = get();
        const panel = panels.find((p) => p.id === panelId);
        const tab = panel?.tabs?.find((t) => t.id === tabId);

        if (!tab) return null;

        const newTabId = generateTabId();
        const newTab: TabState = {
          ...tab,
          id: newTabId,
          title: `${tab.title} (Copy)`,
          isModified: false,
        };

        set(
          (state) => ({
            panels: state.panels.map((p) => {
              if (p.id !== panelId) return p;

              const tabs = p.tabs || [];
              const tabIndex = tabs.findIndex((t) => t.id === tabId);
              const newTabs = [...tabs];
              newTabs.splice(tabIndex + 1, 0, newTab);

              return {
                ...p,
                tabs: newTabs,
                activeTabId: newTabId,
              };
            }),
          }),
          false,
          'duplicateTab'
        );

        return newTabId;
      },

      moveTabToNewPanel: (panelId, tabId) => {
        const { panels, gridConfig, addPanel, removeTab } = get();
        const panel = panels.find((p) => p.id === panelId);
        const tab = panel?.tabs?.find((t) => t.id === tabId);

        if (!tab) return null;

        // Calculate new grid area (next available slot)
        const maxCol = gridConfig.columns.length + 1;
        const maxRow = gridConfig.rows.length + 1;
        const newArea = `${maxRow - 1} / ${maxCol - 1} / ${maxRow} / ${maxCol}`;

        // Create new panel with the tab
        const newPanelId = addPanel(tab.panelType, newArea);

        // Add the tab to the new panel
        const newTabId = generateTabId();
        const newTab: TabState = {
          ...tab,
          id: newTabId,
        };

        set(
          (state) => ({
            panels: state.panels.map((p) =>
              p.id === newPanelId
                ? {
                    ...p,
                    tabs: [newTab],
                    activeTabId: newTabId,
                  }
                : p
            ),
          }),
          false,
          'moveTabToNewPanel'
        );

        // Remove tab from original panel
        removeTab(panelId, tabId);

        return newPanelId;
      },

      // Panel drag-and-drop actions
      splitPanel: (targetPanelId, sourcePanelId, dropPosition) => {
        const { panels, gridConfig } = get();
        const targetPanel = panels.find((p) => p.id === targetPanelId);
        const sourcePanel = panels.find((p) => p.id === sourcePanelId);

        if (!targetPanel || !sourcePanel || dropPosition === 'center') {
          return false;
        }

        const result = splitGrid(gridConfig, targetPanel.gridArea, dropPosition);
        if (!result) return false;

        const { newGridConfig, newArea, updatedTargetArea } = result;

        // Determine the insert position for shifting other panels
        const targetAreaParsed = parseGridArea(targetPanel.gridArea);
        const isHorizontalSplit = dropPosition === 'top' || dropPosition === 'bottom';
        const insertIndex = isHorizontalSplit
          ? dropPosition === 'top'
            ? targetAreaParsed.rowStart
            : targetAreaParsed.rowEnd
          : dropPosition === 'left'
          ? targetAreaParsed.colStart
          : targetAreaParsed.colEnd;

        set(
          (state) => {
            // Update all panel grid areas that need to be shifted
            const updatedPanels = state.panels.map((p) => {
              if (p.id === targetPanelId) {
                return { ...p, gridArea: updatedTargetArea };
              }
              if (p.id === sourcePanelId) {
                return { ...p, gridArea: newArea };
              }

              // Shift other panels if needed
              const parsed = parseGridArea(p.gridArea);
              if (isHorizontalSplit) {
                // Shift rows
                const needsShift =
                  parsed.rowStart >= insertIndex || parsed.rowEnd > insertIndex;
                if (needsShift) {
                  const rowStart =
                    parsed.rowStart >= insertIndex
                      ? parsed.rowStart + 1
                      : parsed.rowStart;
                  const rowEnd =
                    parsed.rowEnd > insertIndex ? parsed.rowEnd + 1 : parsed.rowEnd;
                  return {
                    ...p,
                    gridArea: createGridArea(rowStart, parsed.colStart, rowEnd, parsed.colEnd),
                  };
                }
              } else {
                // Shift columns
                const needsShift =
                  parsed.colStart >= insertIndex || parsed.colEnd > insertIndex;
                if (needsShift) {
                  const colStart =
                    parsed.colStart >= insertIndex
                      ? parsed.colStart + 1
                      : parsed.colStart;
                  const colEnd =
                    parsed.colEnd > insertIndex ? parsed.colEnd + 1 : parsed.colEnd;
                  return {
                    ...p,
                    gridArea: createGridArea(parsed.rowStart, colStart, parsed.rowEnd, colEnd),
                  };
                }
              }

              return p;
            });

            return {
              panels: updatedPanels,
              gridConfig: newGridConfig,
              activePanel: sourcePanelId,
            };
          },
          false,
          'splitPanel'
        );

        return true;
      },

      mergePanelAsTabs: (targetPanelId, sourcePanelId) => {
        const { panels } = get();
        const targetPanel = panels.find((p) => p.id === targetPanelId);
        const sourcePanel = panels.find((p) => p.id === sourcePanelId);

        if (!targetPanel || !sourcePanel) return false;

        // Create tab from source panel
        const newTabId = generateTabId();
        const newTab: TabState = {
          id: newTabId,
          panelType: sourcePanel.type,
          title: sourcePanel.title,
          isModified: false,
        };

        set(
          (state) => {
            // Add source panel as tab to target and remove source
            const updatedPanels = state.panels
              .map((p) => {
                if (p.id === targetPanelId) {
                  const existingTabs = p.tabs || [];
                  // If target has no tabs, create one for the existing content first
                  const targetTab: TabState = existingTabs.length === 0
                    ? {
                        id: generateTabId(),
                        panelType: p.type,
                        title: p.title,
                        isModified: false,
                      }
                    : null!;

                  const newTabs = existingTabs.length === 0
                    ? [targetTab, newTab]
                    : [...existingTabs, newTab];

                  return {
                    ...p,
                    tabs: newTabs,
                    activeTabId: newTabId,
                  };
                }
                return p;
              })
              .filter((p) => p.id !== sourcePanelId);

            return {
              panels: updatedPanels,
              activePanel: targetPanelId,
            };
          },
          false,
          'mergePanelAsTabs'
        );

        return true;
      },

      removePanelFromGrid: (panelId) => {
        set(
          (state) => ({
            panels: state.panels.filter((p) => p.id !== panelId),
            activePanel: state.activePanel === panelId ? null : state.activePanel,
          }),
          false,
          'removePanelFromGrid'
        );
      },
    }),
    { name: 'panel-store' }
  )
);
