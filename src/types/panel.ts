export type PanelType =
  | 'ladder-editor'
  | 'memory-visualizer'
  | 'one-canvas'
  | 'scenario-editor'
  | 'console'
  | 'properties'
  | 'csv-viewer';

export interface PanelState {
  id: string;
  type: PanelType;
  title: string;
  gridArea: string; // CSS grid-area value, e.g., '1 / 1 / 2 / 2'
  isMinimized: boolean;
  /** Optional array of tabs within this panel */
  tabs?: import('./tab').TabState[];
  /** ID of the currently active tab in this panel */
  activeTabId?: string | null;
}

export interface GridConfig {
  columns: string[]; // Array of grid-template-columns values, e.g., ['1fr', '1fr']
  rows: string[]; // Array of grid-template-rows values, e.g., ['1fr', '1fr']
}

export interface PanelProps {
  id: string;
  type: PanelType;
  title: string;
  isActive: boolean;
  gridArea?: string;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onActivate: () => void;
}

export const PANEL_TYPE_LABELS: Record<PanelType, string> = {
  'ladder-editor': 'Ladder Editor',
  'memory-visualizer': 'Memory Visualizer',
  'one-canvas': 'One Canvas',
  'scenario-editor': 'Scenario Editor',
  'console': 'Console',
  'properties': 'Properties',
  'csv-viewer': 'CSV Viewer',
};

export const MIN_PANEL_SIZE = 150; // Minimum panel size in pixels
