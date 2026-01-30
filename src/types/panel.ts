/**
 * Panel Types
 *
 * Types for managing panels in the ModOne application including
 * panel state, grid configuration, and panel-related constants.
 */

/**
 * Available panel types in the application.
 * Each type corresponds to a specific editor or view component.
 */
export type PanelType =
  | 'ladder-editor'
  | 'memory-visualizer'
  | 'one-canvas'
  | 'scenario-editor'
  | 'console'
  | 'properties'
  | 'csv-viewer';

/**
 * Runtime state of a panel instance.
 * Tracks position, visibility, tabs, and floating window association.
 */
export interface PanelState {
  /** Unique identifier for the panel instance */
  id: string;
  /** Type of content displayed in the panel */
  type: PanelType;
  /** Display title shown in the panel header */
  title: string;
  /** CSS grid-area value for positioning, e.g., '1 / 1 / 2 / 2' */
  gridArea: string;
  /** Whether the panel is minimized */
  isMinimized: boolean;
  /** Optional array of tabs within this panel for multi-document interface */
  tabs?: import('./tab').TabState[];
  /** ID of the currently active tab in this panel (null = no tabs or none selected) */
  activeTabId?: string | null;
  /**
   * Floating window ID if panel is in a floating window.
   * - null: Panel is in the main window
   * - string: ID of the floating window containing this panel
   * - undefined: Not set (treated as main window)
   */
  windowId?: string | null;
  /** Whether this panel is currently displayed in a floating window */
  isFloating?: boolean;
  /** Position and size when floating (only used when isFloating is true) */
  floatingBounds?: import('./window').Bounds;
}

/**
 * Grid configuration for panel layout.
 * Defines the CSS grid template for arranging panels.
 */
export interface GridConfig {
  /** Array of grid-template-columns values, e.g., ['1fr', '1fr', '2fr'] */
  columns: string[];
  /** Array of grid-template-rows values, e.g., ['1fr', '2fr'] */
  rows: string[];
}

/**
 * Props passed to panel components.
 * Used by the Panel component and its variants.
 */
export interface PanelProps {
  /** Unique identifier for the panel */
  id: string;
  /** Type of panel content */
  type: PanelType;
  /** Display title shown in the panel header */
  title: string;
  /** Whether this panel is currently active/focused */
  isActive: boolean;
  /** CSS grid-area value for positioning (optional when floating) */
  gridArea?: string;
  /** Callback when the close button is clicked */
  onClose: () => void;
  /** Callback when the minimize button is clicked */
  onMinimize: () => void;
  /** Callback when the maximize button is clicked */
  onMaximize: () => void;
  /** Callback when the panel is clicked to activate */
  onActivate: () => void;
}

/**
 * Human-readable labels for each panel type.
 * Used for display in menus, headers, and tooltips.
 */
export const PANEL_TYPE_LABELS: Record<PanelType, string> = {
  'ladder-editor': 'Ladder Editor',
  'memory-visualizer': 'Memory Visualizer',
  'one-canvas': 'One Canvas',
  'scenario-editor': 'Scenario Editor',
  'console': 'Console',
  'properties': 'Properties',
  'csv-viewer': 'CSV Viewer',
};

/**
 * Minimum panel size in pixels.
 * Prevents panels from being resized below this threshold.
 */
export const MIN_PANEL_SIZE = 150;
