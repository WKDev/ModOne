import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type SidebarPanel = 'explorer' | 'search' | 'modbus';

const MIN_WIDTH = 150;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 250;

interface SidebarState {
  activePanel: SidebarPanel;
  isVisible: boolean;
  width: number;
}

interface SidebarActions {
  setActivePanel: (panel: SidebarPanel) => void;
  toggleVisibility: () => void;
  setWidth: (width: number) => void;
}

type SidebarStore = SidebarState & SidebarActions;

const initialState: SidebarState = {
  activePanel: 'explorer',
  isVisible: true,
  width: DEFAULT_WIDTH,
};

export const useSidebarStore = create<SidebarStore>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setActivePanel: (panel) =>
          set({ activePanel: panel }, false, 'setActivePanel'),

        toggleVisibility: () =>
          set(
            (state) => ({ isVisible: !state.isVisible }),
            false,
            'toggleVisibility'
          ),

        setWidth: (width) =>
          set(
            { width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width)) },
            false,
            'setWidth'
          ),
      }),
      {
        name: 'sidebar-store',
        partialize: (state) => ({
          activePanel: state.activePanel,
          width: state.width,
        }),
      }
    ),
    { name: 'sidebar-store' }
  )
);

// Export constants for use in components
export { MIN_WIDTH, MAX_WIDTH, DEFAULT_WIDTH };
