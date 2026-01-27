import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type SimulationStatus = 'running' | 'stopped' | 'paused';
export type PanelType = 'output' | 'problems' | 'terminal';

interface LayoutState {
  // Menu state
  menuOpen: string | null;

  // Simulation state
  simulationStatus: SimulationStatus;
  scanTime: number;

  // Modbus state
  modbusConnected: boolean;
  modbusPort: number;

  // System state
  memoryUsageMb: number;

  // Layout visibility
  sidebarVisible: boolean;
  panelVisible: boolean;
  panelType: PanelType;
}

interface LayoutActions {
  // Menu actions
  setMenuOpen: (menu: string | null) => void;

  // Simulation actions
  setSimulationStatus: (status: SimulationStatus) => void;
  setScanTime: (time: number) => void;

  // Modbus actions
  setModbusConnected: (connected: boolean) => void;
  setModbusPort: (port: number) => void;

  // System actions
  setMemoryUsage: (mb: number) => void;

  // Layout actions
  toggleSidebar: () => void;
  togglePanel: () => void;
  setPanelType: (type: PanelType) => void;

  // Reset
  resetLayout: () => void;
}

type LayoutStore = LayoutState & LayoutActions;

const initialState: LayoutState = {
  menuOpen: null,
  simulationStatus: 'stopped',
  scanTime: 10,
  modbusConnected: false,
  modbusPort: 502,
  memoryUsageMb: 0,
  sidebarVisible: true,
  panelVisible: false,
  panelType: 'output',
};

export const useLayoutStore = create<LayoutStore>()(
  devtools(
    (set) => ({
      ...initialState,

      // Menu actions
      setMenuOpen: (menu) => set({ menuOpen: menu }, false, 'setMenuOpen'),

      // Simulation actions
      setSimulationStatus: (status) =>
        set({ simulationStatus: status }, false, 'setSimulationStatus'),
      setScanTime: (time) => set({ scanTime: time }, false, 'setScanTime'),

      // Modbus actions
      setModbusConnected: (connected) =>
        set({ modbusConnected: connected }, false, 'setModbusConnected'),
      setModbusPort: (port) => set({ modbusPort: port }, false, 'setModbusPort'),

      // System actions
      setMemoryUsage: (mb) =>
        set({ memoryUsageMb: mb }, false, 'setMemoryUsage'),

      // Layout actions
      toggleSidebar: () =>
        set(
          (state) => ({ sidebarVisible: !state.sidebarVisible }),
          false,
          'toggleSidebar'
        ),
      togglePanel: () =>
        set(
          (state) => ({ panelVisible: !state.panelVisible }),
          false,
          'togglePanel'
        ),
      setPanelType: (type) => set({ panelType: type }, false, 'setPanelType'),

      // Reset
      resetLayout: () => set(initialState, false, 'resetLayout'),
    }),
    { name: 'layout-store' }
  )
);
